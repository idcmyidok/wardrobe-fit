import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFit } from "@/lib/fit/compute";
import type { FitRequest } from "@/lib/fit/schema";
import { selectComparables } from "@/lib/fit/select-comparables";
import type { AiStatus, FitComputed, FitInterpretation } from "@/lib/fit/types";
import type { Database, Json } from "@/lib/supabase/database.types";
import { buildFitInput, inputHash, interpretFit } from "@/server/ai/fit-interpreter";
import { getQuotaExemption } from "@/server/admin/is-admin";
import { AiError, getAiProvider } from "@/server/ai/provider";
import { GARMENT_COLUMNS, rowToGarment } from "@/server/garments/mapper";

/**
 * 구매 판단 1건(PROJECT_SPEC.md 15장). 규칙 계산 결과를 먼저 보내고, AI가 켜져 있으면 요약을 붙인 뒤 저장한다.
 * - 판단은 사용자당 24시간에 20번, 그중 AI 호출은 10번(FIT_AI_DAILY_LIMIT)까지. 관리자·테스터는 제한 없음.
 * - 같은 입력의 AI 요약은 7일 동안 다시 쓴다(AI를 다시 부르지 않음).
 * - fit_checks는 insert만 한다(마이그레이션 6에서 사용자 update/delete를 막아 제한을 초기화할 수 없다).
 */

export const FIT_DAILY_LIMIT = 20;
export const AI_DAILY_LIMIT_DEFAULT = 10;
export const AI_CACHE_DAYS = 7;
export const CACHE_SUFFIX = ":cache";

type Client = SupabaseClient<Database>;

export type FitErrorCode = "rate_limited" | "invalid_input" | "save_failed" | "unknown";

export type FitStreamEvent =
  | { type: "computed"; id: string; computed: FitComputed; aiEnabled: boolean }
  | { type: "done"; id: string; saved: boolean; aiStatus: AiStatus; interpretation: FitInterpretation | null }
  | { type: "error"; code: FitErrorCode };

export const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function aiDailyLimit() {
  const n = Number(process.env.FIT_AI_DAILY_LIMIT);
  return Number.isInteger(n) && n >= 0 ? n : AI_DAILY_LIMIT_DEFAULT;
}

export async function runFitCheck(supabase: Client, userId: string, req: FitRequest, send: (e: FitStreamEvent) => void) {
  const unlimited = Boolean(await getQuotaExemption(supabase, userId));
  if (!unlimited) {
    const { count } = await supabase
      .from("fit_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hoursAgo(24));
    if ((count ?? 0) >= FIT_DAILY_LIMIT) return send({ type: "error", code: "rate_limited" });
  }

  // 남의 분석 기록 id면 연결하지 않는다(RLS가 insert를 막기 전에 걸러 저장은 되게 한다).
  let importId = req.importId ?? null;
  if (importId) {
    const { data: imp } = await supabase.from("product_imports").select("id").eq("id", importId).maybeSingle();
    if (!imp) importId = null;
  }

  const { data: rows, error } = await supabase.from("garments").select(GARMENT_COLUMNS).is("deleted_at", null).eq("held", false).limit(2000);
  if (error) return send({ type: "error", code: "unknown" });
  const garments = rows.map((r) => rowToGarment(r, { imageUrl: null, thumbUrl: null }));

  const { selected, lacking } = selectComparables(req.candidate, garments);
  const excluded = new Set(req.excludedGarmentIds);
  const included = selected.filter((s) => !excluded.has(s.garment.id));
  const computed = computeFit(req.candidate, included, lacking.length);

  const id = crypto.randomUUID();
  const provider = getAiProvider();
  // 신발은 사이즈·착용감 규칙 판단만 한다(AI 요약 없음, 비용 0).
  const judgeable = computed.categoryId !== "shoes" && computed.sizes.some((s) => s.confidence !== "insufficient");
  send({ type: "computed", id, computed, aiEnabled: Boolean(provider && judgeable) });

  let aiStatus: AiStatus = provider ? "skipped" : "disabled";
  let interpretation: FitInterpretation | null = null;
  let aiModel: string | null = null;
  if (provider && judgeable) {
    const input = buildFitInput(req.candidate, computed, provider.privacy);
    const hash = inputHash(provider.model, input);
    computed.aiInputHash = hash;
    const { data: cached } = await supabase
      .from("fit_checks")
      .select("interpretation")
      .eq("user_id", userId)
      .eq("computed->>aiInputHash", hash)
      .not("interpretation", "is", null)
      .gte("created_at", hoursAgo(AI_CACHE_DAYS * 24))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.interpretation) {
      interpretation = cached.interpretation as unknown as FitInterpretation;
      aiStatus = "cached";
      aiModel = provider.model + CACHE_SUFFIX;
    } else {
      const { count: aiCount } = unlimited
        ? { count: 0 }
        : await supabase
            .from("fit_checks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .not("ai_model", "is", null)
            .not("ai_model", "like", `%${CACHE_SUFFIX}`)
            .gte("created_at", hoursAgo(24));
      if ((aiCount ?? 0) >= aiDailyLimit()) aiStatus = "limited";
      else {
        // 호출하면 성공·실패와 관계없이 사용량으로 센다.
        aiModel = provider.model;
        try {
          interpretation = await interpretFit(provider, req.candidate, computed, input);
          aiStatus = interpretation ? "ok" : "failed";
          if (!interpretation) console.error("[fit-checks] ai invalid_output");
        } catch (e) {
          // 무료 등급 한도 초과(429)는 "오늘 한도"로 안내하고 규칙 요약을 쓴다.
          aiStatus = e instanceof AiError && e.message === "quota" ? "limited" : "failed";
          // 입력·출력 전문은 남기지 않는다(PROJECT_SPEC.md 19장 로그).
          // 원인 코드(quota, http_404, invalid_json, max_tokens, TimeoutError 등)만 남긴다.
          console.error("[fit-checks] ai", e instanceof AiError ? e.message : e instanceof Error ? e.name : "error");
        }
      }
    }
  }

  const { error: saveError } = await supabase.from("fit_checks").insert({
    id,
    user_id: userId,
    import_id: importId,
    candidate: req.candidate as unknown as Json,
    computed: computed as unknown as Json,
    interpretation: interpretation as unknown as Json,
    confidence: computed.sizes[0]?.confidence ?? null,
    status: "completed",
    ai_model: aiModel,
    error_code: aiStatus === "failed" ? "ai_failed" : aiStatus === "limited" ? "ai_limited" : null,
    completed_at: new Date().toISOString(),
  });
  if (!saveError && selected.length) {
    await supabase.from("fit_check_comparables").insert(
      selected.map((s) => ({ fit_check_id: id, garment_id: s.garment.id, user_id: userId, match_level: s.matchLevel, included: !excluded.has(s.garment.id) })),
    );
  }
  if (saveError) console.error("[fit-checks] save", saveError.code);
  send({ type: "done", id, saved: !saveError, aiStatus, interpretation });
}

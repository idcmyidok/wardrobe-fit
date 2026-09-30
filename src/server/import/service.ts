import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportFailureCode } from "@/lib/import/messages";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getQuotaExemption } from "@/server/admin/is-admin";
import { aiSizeChart } from "./ai-size-chart";
import { analyzeProductUrl, type AnalyzeStage } from "./analyze";
import { ImportError, type NormalizedProduct } from "./types";
import { normalizeProductUrl } from "./url";

/**
 * 링크 분석 1건을 실행하고 product_imports에 남긴다(PROJECT_SPEC.md 12.1 [6], 12.3).
 * - 같은 사용자·같은 주소는 10분 동안 이전 결과를 다시 쓴다(쇼핑몰에 다시 요청하지 않음).
 * - 링크 가져오기는 사용자당 24시간에 100번, 무신사 주문 가져오기는 따로 세어 500번까지(PROJECT_SPEC.md 19장 비용 남용). 관리자·테스터는 제한 없음.
 *   주문 가져오기 기록은 parser_version 끝에 ORDER_IMPORT_SUFFIX를 붙여 구분한다(마이그레이션 없이).
 *   AI(Gemini)는 규칙으로 사이즈표를 못 찾았을 때만 1번 부르므로 실제 AI 호출은 이보다 훨씬 적다.
 */

export const IMPORT_REUSE_MINUTES = 10;
export const IMPORT_DAILY_LIMIT = 100;
export const ORDER_IMPORT_DAILY_LIMIT = 500;
export const ORDER_IMPORT_SUFFIX = ":order";
/** 분석 방식이 바뀌면 올린다. 이전 방식의 결과는 다시 쓰지 않는다(product_imports.parser_version). */
export const IMPORT_ENGINE_VERSION = "v4";

type Client = SupabaseClient<Database>;

export interface ImportOutcome {
  importId: string | null;
  status: "succeeded" | "partial" | "failed";
  reused: boolean;
  domain: string | null;
  sourceUrl: string;
  parserId: string | null;
  durationMs: number;
  product: NormalizedProduct | null;
  errorCode: ImportFailureCode | null;
  /** 실패 원인 요약(자세히 보기용). 비밀 값은 담지 않는다. */
  errorDetail: string | null;
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export async function runImport(
  supabase: Client,
  userId: string,
  input: string,
  purpose: "wardrobe" | "fit_check",
  onStage?: (stage: AnalyzeStage) => void,
  /** photosOnly: 등록된 옷의 사진만 다시 고를 때. 실측 AI 추출을 건너뛴다(하루 분석 한도에는 센다). */
  { photosOnly = false, kind = "link" }: { photosOnly?: boolean; kind?: "link" | "order" } = {},
): Promise<ImportOutcome> {
  const started = Date.now();
  const base = { importId: null, reused: false, domain: null, sourceUrl: input.trim().slice(0, 2048), parserId: null, product: null };
  const fail = (errorCode: ImportFailureCode, errorDetail: string | null = null): ImportOutcome => ({
    ...base,
    status: "failed",
    durationMs: Date.now() - started,
    errorCode,
    errorDetail,
  });

  let normalizedUrl: URL;
  try {
    normalizedUrl = normalizeProductUrl(input);
  } catch (e) {
    return fail(e instanceof ImportError ? e.code : "invalid_url");
  }

  if (!(await getQuotaExemption(supabase, userId))) {
    const counted = supabase
      .from("product_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", minutesAgo(24 * 60));
    const { count } = await (kind === "order" ? counted.like("parser_version", `%${ORDER_IMPORT_SUFFIX}`) : counted.or(`parser_version.is.null,parser_version.not.like.%${ORDER_IMPORT_SUFFIX}`));
    if ((count ?? 0) >= (kind === "order" ? ORDER_IMPORT_DAILY_LIMIT : IMPORT_DAILY_LIMIT)) return fail("rate_limited");
  }

  const { data: recent } = await supabase
    .from("product_imports")
    .select("id, status, result, domain, parser_id, duration_ms")
    .eq("user_id", userId)
    .eq("normalized_url", normalizedUrl.toString())
    .eq("purpose", purpose)
    .in("status", ["succeeded", "partial"])
    .in("parser_version", [IMPORT_ENGINE_VERSION, IMPORT_ENGINE_VERSION + ORDER_IMPORT_SUFFIX])
    .gte("created_at", minutesAgo(IMPORT_REUSE_MINUTES))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.result) {
    return {
      ...base,
      importId: recent.id,
      status: recent.status as "succeeded" | "partial",
      reused: true,
      domain: recent.domain,
      parserId: recent.parser_id,
      durationMs: Date.now() - started,
      product: { ...(recent.result as unknown as NormalizedProduct), diagnostics: undefined },
      errorCode: null,
      errorDetail: null,
    };
  }

  // 사용자가 이미 쓰는 브랜드 표기로 맞춘다(대소문자만 다를 때).
  const { data: brands } = await supabase.from("garments").select("brand").eq("user_id", userId).not("brand", "is", null).limit(1000);
  const knownBrands = [...new Set((brands ?? []).map((b) => b.brand).filter((b): b is string => Boolean(b)))];

  let outcome: ImportOutcome;
  try {
    const result = await analyzeProductUrl(normalizedUrl.toString(), { normalize: { knownBrands }, onStage, extractSizeChart: photosOnly ? undefined : aiSizeChart });
    const found = Boolean(result.product.productName);
    outcome = {
      ...base,
      status: found ? result.status : "failed",
      domain: result.domain,
      parserId: result.parserId,
      durationMs: result.durationMs,
      product: result.product,
      errorCode: found ? null : "no_product",
      errorDetail: found ? null : `parser: ${result.parserId}`,
    };
  } catch (e) {
    const code: ImportFailureCode = e instanceof ImportError ? e.code : "unknown";
    outcome = { ...fail(code, e instanceof Error ? e.message.slice(0, 200) : null), domain: normalizedUrl.hostname };
    if (!(e instanceof ImportError)) console.error("[imports]", e);
  }

  const { data: row } = await supabase
    .from("product_imports")
    .insert({
      user_id: userId,
      purpose,
      source_url: base.sourceUrl,
      normalized_url: normalizedUrl.toString(),
      domain: (outcome.domain ?? normalizedUrl.hostname).slice(0, 255),
      parser_id: outcome.parserId,
      parser_version: kind === "order" ? IMPORT_ENGINE_VERSION + ORDER_IMPORT_SUFFIX : outcome.parserId ? IMPORT_ENGINE_VERSION : null,
      status: outcome.status,
      result: outcome.product as unknown as Json,
      warnings: (outcome.product?.warnings ?? []) as unknown as Json,
      error_code: outcome.errorCode,
      duration_ms: outcome.durationMs,
    })
    .select("id")
    .single();
  // 진단 정보는 기록에만 남기고 화면으로는 보내지 않는다.
  const product = outcome.product ? { ...outcome.product, diagnostics: undefined } : null;
  return { ...outcome, product, importId: row?.id ?? null };
}

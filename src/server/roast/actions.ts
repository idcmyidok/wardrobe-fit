"use server";

import { z } from "zod";
import { DEFAULT_USD_KRW } from "@/lib/format/price";
import { MOCK_GARMENTS } from "@/lib/mock/garments";
import { wardrobeHash } from "@/lib/roast/hash";
import type { RoastFinish, RoastGarmentRef, RoastResult, RoastStart } from "@/lib/roast/types";
import { isAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import type { Garment } from "@/lib/types/domain";
import { isAdmin } from "@/server/admin/guard";
import { getMyBodyProfile } from "@/server/body/queries";
import { listMyGarments } from "@/server/garments/queries";
import { getUsdRate } from "@/server/settings/queries";
import { analyze, MIN_GARMENTS } from "./analyze";
import { buildScript, composeResult } from "./compose";
import { getRoastTexts, signGarments } from "./queries";
import { buildReport } from "./report";
import type { ScoreRules } from "./score-deltas";

/**
 * AI 옷장 분석 서버 액션.
 * - startRoast: 지금 옷장을 읽어 대화 순서를 만든다. 진행 상태는 저장하지 않는다.
 * - finishRoast: 같은 seed로 분석을 다시 만들고 답을 반영해 결과(report)를 만든다. AI는 쓰지 않는다.
 * 로그인한 사용자는 DB의 옷장을 읽고 결과를 저장한다. Supabase가 없는 미리보기 모드는 화면이 보낸 예시 옷장으로 계산하고 저장하지 않는다.
 */

const nameSchema = z
  .string()
  .trim()
  .max(20)
  .transform((s) => s.replace(/[<>{}]/g, "") || null)
  .nullable();

/** 나이는 이번 계산에만 쓰고 어디에도 저장하지 않는다. */
const ageSchema = z.number().int().min(10).max(99).nullable();
const AGE_REQUIRED = "나이를 입력해 주세요.";

/** 미리보기 모드에서 화면이 보내는 옷장(브라우저 저장소). 계산에 쓰는 칸만 느슨하게 확인한다. */
const previewSchema = z
  .array(
    z
      .object({
        id: z.string().max(100),
        categoryId: z.enum(["outer", "top", "bottom", "hat", "shoes"]),
        subcategoryId: z.string().max(50).nullable(),
        brand: z.string().max(100),
        productName: z.string().max(200),
        colorName: z.string().max(50).nullable(),
        seasons: z.array(z.enum(["spring", "summer", "fall", "winter", "all"])).max(5),
        purchasedOn: z.string().max(10).nullable(),
        purchasePrice: z.number().nullable(),
      })
      .passthrough(),
  )
  .max(2000);

interface Source {
  garments: Garment[];
  userId: string | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}

async function source(preview: unknown): Promise<Source | { error: string }> {
  if (!isAuthConfigured()) {
    const parsed = previewSchema.safeParse(preview);
    return { garments: parsed.success ? (parsed.data as unknown as Garment[]) : MOCK_GARMENTS, userId: null, supabase: null };
  }
  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return { error: "로그인이 필요합니다. 다시 로그인해 주세요." };
  return { garments: await listMyGarments(), userId: user.id, supabase };
}

export async function startRoast(input: { name: string | null; age?: number | null; preview?: unknown }): Promise<RoastStart> {
  try {
    const s = await source(input.preview);
    if ("error" in s) return { ok: false, code: "error", message: s.error };
    const name = nameSchema.safeParse(input.name).data ?? null;
    const age = ageSchema.safeParse(input.age ?? null).data ?? null;
    if (age == null) return { ok: false, code: "error", message: AGE_REQUIRED };
    const [body, usdRate] = s.userId ? await Promise.all([getMyBodyProfile(), getUsdRate()]) : [null, DEFAULT_USD_KRW];
    const texts = await getRoastTexts(s.supabase);
    const a = analyze(s.garments, body, usdRate, new Date(), texts.score.rules as Partial<ScoreRules> | undefined);
    if (a.clothesTotal < MIN_GARMENTS) return { ok: false, code: "too_few", count: a.clothesTotal };
    const seed = Math.floor(Math.random() * 2 ** 31);
    const { script } = buildScript(a, seed, name, texts, age);
    return { ok: true, script };
  } catch (e) {
    console.error("[roast] start", e instanceof Error ? e.message : e);
    return { ok: false, code: "error", message: "옷장을 읽지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function finishRoast(input: { seed: number; name: string | null; age?: number | null; answers: Record<string, string>; preview?: unknown }): Promise<RoastFinish> {
  try {
    const s = await source(input.preview);
    if ("error" in s) return { ok: false, message: s.error };
    const name = nameSchema.safeParse(input.name).data ?? null;
    const age = ageSchema.safeParse(input.age ?? null).data ?? null;
    if (age == null) return { ok: false, message: AGE_REQUIRED };
    const seed = z.number().int().nonnegative().safeParse(input.seed).data ?? 0;
    const answers = z.record(z.string().max(60), z.string().max(200)).safeParse(input.answers).data ?? {};

    const [body, usdRate] = s.userId ? await Promise.all([getMyBodyProfile(), getUsdRate()]) : [null, DEFAULT_USD_KRW];
    const texts = await getRoastTexts(s.supabase);
    const a = analyze(s.garments, body, usdRate, new Date(), texts.score.rules as Partial<ScoreRules> | undefined);
    if (a.clothesTotal < MIN_GARMENTS) return { ok: false, message: "모자·신발을 제외한 옷이 30개 이상일 때 분석할 수 있습니다." };
    const plan = buildScript(a, seed, name, texts, age);
    const composed = composeResult(a, seed, texts);
    const report = buildReport(a, name, seed, texts.report, plan.asked, answers, texts.score, age);
    // 점수 풀이는 관리자에게만 보인다(미리보기 모드는 로그인 없는 개발용 화면이라 확인용으로 보여 준다).
    if (s.userId && !(await isAdmin(s.userId))) delete report.scoreDetail;

    // 결과에 나온 옷의 브랜드·제품명·사진 경로를 복사해 둔다(옷을 지워도 문장은 남는다).
    const ids = [
      ...new Set(report.points.flatMap((p) => p.photos ?? [])),
    ];
    const paths = new Map<string, { image: string | null; thumb: string | null }>();
    if (s.supabase && ids.length) {
      const { data } = await s.supabase.from("garments").select("id, image_path, thumb_path").in("id", ids);
      for (const r of data ?? []) paths.set(r.id, { image: r.image_path, thumb: r.thumb_path });
    }
    const garments: Record<string, RoastGarmentRef> = {};
    for (const id of ids) {
      const item = a.items.find((i) => i.id === id);
      if (!item) continue;
      const p = paths.get(id);
      garments[id] = {
        brand: item.brandLabel,
        name: item.g.productName,
        imagePath: p ? (p.thumb ?? p.image) : null,
        imageUrl: s.userId ? undefined : (item.g.thumbUrl ?? item.g.imageUrl),
      };
    }

    const result: RoastResult = {
      name,
      createdAt: new Date().toISOString(),
      garmentCount: a.clothesTotal,
      headline: "",
      paragraphs: [],
      closing: composed.closing,
      disclaimer: texts.screen.DISCLAIMER,
      report,
      garments,
      answers: plan.asked
        .filter((q) => answers[q.id])
        .map((q) => ({ id: q.id, question: q.text, answer: q.options.find((o) => o.id === answers[q.id])?.label ?? "" })),
      patterns: composed.used.map((p) => ({ id: p.id, stats: p.stats })),
      wardrobeHash: wardrobeHash(s.garments),
    };

    if (s.supabase && s.userId) {
      const [run, save] = await Promise.all([
        s.supabase.from("roast_runs").insert({ user_id: s.userId }),
        s.supabase.from("roast_results").upsert({
          user_id: s.userId,
          name,
          garment_count: result.garmentCount,
          result: JSON.parse(JSON.stringify({ ...result, garments: stripUrls(garments) })),
          wardrobe_hash: result.wardrobeHash,
          created_at: result.createdAt,
        }),
      ]);
      if (run.error) console.error("[roast] run", run.error.code, run.error.message);
      if (save.error) {
        console.error("[roast] save", save.error.code, save.error.message);
        return { ok: false, message: "결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
      }
      result.garments = await signGarments(s.supabase, garments);
    }
    return { ok: true, result };
  } catch (e) {
    console.error("[roast] finish", e instanceof Error ? e.message : e);
    return { ok: false, message: "결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

const stripUrls = (g: Record<string, RoastGarmentRef>) =>
  Object.fromEntries(Object.entries(g).map(([id, r]) => [id, { brand: r.brand, name: r.name, imagePath: r.imagePath }]));

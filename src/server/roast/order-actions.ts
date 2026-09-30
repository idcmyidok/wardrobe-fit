"use server";

import { z } from "zod";
import { DEFAULT_USD_KRW } from "@/lib/format/price";
import type { RoastFinish, RoastGarmentRef, RoastReport, RoastResult, RoastStart } from "@/lib/roast/types";
import { isAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { isAdmin } from "@/server/admin/guard";
import { getUsdRate } from "@/server/settings/queries";
import { MIN_GARMENTS, type Analysis } from "./analyze";
import { analyzeOrders } from "./orders/analysis";
import { asOrders, buildScript, composeResult } from "./compose";
import { orderListSchema, toGarments, type OrderRoastItem } from "./orders/input";
import { orderOverride } from "./orders/report";
import type { OrderRules } from "./orders/rules";
import { scoreOrders } from "./orders/score";
import { getRoastTexts } from "./queries";
import { buildReport } from "./report";
import type { ScoreRules } from "./score-deltas";
import { fill } from "./text";
import type { RoastTexts } from "./texts";

/**
 * 무신사 주문내역 훈수(숨은 주소 /roast/orders). 옷장 훈수 엔진을 주문내역 모드로 쓴다.
 * - 화면이 보낸 주문 목록으로 매번 분석을 다시 만든다(주문 원문·목록·결과 모두 저장하지 않는다).
 * - AI 글쓰기는 쓰지 않는다(정해 둔 문장만). 그래서 하루 AI 한도와 상관없다.
 */

const nameSchema = z
  .string()
  .trim()
  .max(20)
  .transform((s) => s.replace(/[<>{}]/g, "") || null)
  .nullable();
const ageSchema = z.number().int().min(10).max(99).nullable();

async function prepare(items: unknown): Promise<{ a: Analysis; T: RoastTexts; signedIn: boolean; userId: string | null } | { error: string }> {
  const parsed = orderListSchema.safeParse(items);
  if (!parsed.success) return { error: "주문내역을 읽지 못했습니다. 처음부터 다시 해 주세요." };
  let supabase = null;
  let userId: string | null = null;
  if (isAuthConfigured()) {
    supabase = await createSupabaseServerClient();
    const user = supabase ? await getActiveUser(supabase) : null;
    if (!supabase || !user) return { error: "로그인이 필요합니다. 다시 로그인해 주세요." };
    userId = user.id;
  }
  const [T, usdRate] = await Promise.all([getRoastTexts(supabase), userId ? getUsdRate() : DEFAULT_USD_KRW]);
  const { garments, ctx } = toGarments(parsed.data as OrderRoastItem[]);
  const a = analyzeOrders(garments, ctx, usdRate, new Date(), T.score.rules as Partial<ScoreRules> | undefined);
  return { a, T, signedIn: Boolean(userId), userId };
}

export async function startOrderRoast(input: { name: string | null; age?: number | null; items: unknown }): Promise<RoastStart> {
  try {
    const p = await prepare(input.items);
    if ("error" in p) return { ok: false, code: "error", message: p.error };
    if (p.a.clothesTotal < MIN_GARMENTS) return { ok: false, code: "too_few", count: p.a.clothesTotal };
    const name = nameSchema.safeParse(input.name).data ?? null;
    const age = ageSchema.safeParse(input.age ?? null).data ?? null;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const { script } = buildScript(p.a, seed, name, p.T, age);
    return { ok: true, script, aiLeft: null };
  } catch (e) {
    console.error("[order-roast] start", e instanceof Error ? e.message : e);
    return { ok: false, code: "error", message: "주문내역을 읽지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function finishOrderRoast(input: { seed: number; name: string | null; age?: number | null; answers: Record<string, string>; items: unknown }): Promise<RoastFinish> {
  try {
    const p = await prepare(input.items);
    if ("error" in p) return { ok: false, message: p.error };
    const { a, T } = p;
    if (a.clothesTotal < MIN_GARMENTS) return { ok: false, message: fill(T.orders.screen.TOO_FEW, { n: a.clothesTotal }) };
    const name = nameSchema.safeParse(input.name).data ?? null;
    const age = ageSchema.safeParse(input.age ?? null).data ?? null;
    const seed = z.number().int().nonnegative().safeParse(input.seed).data ?? 0;
    const answers = z.record(z.string().max(60), z.string().max(200)).safeParse(input.answers).data ?? {};

    const plan = buildScript(a, seed, name, T, age);
    const composed = composeResult(a, name, seed, T, plan.asked, answers);
    const score = scoreOrders(a, { age, rules: T.score.orules as Partial<OrderRules>, ageRules: T.score.oage as Record<string, Record<string, number>> });
    const report = reportAsOrders(buildReport(a, name, seed, T.report, plan.asked, answers, T.score, age, orderOverride(a, seed, T, score)));
    // 점수 풀이는 관리자에게만(미리보기 모드는 확인용으로 보여 준다)
    if (p.userId && !(await isAdmin(p.userId))) delete report.scoreDetail;

    const ids = [...new Set([...composed.paragraphs.flatMap((x) => x.photos), ...report.points.flatMap((x) => x.photos ?? [])])];
    const garments: Record<string, RoastGarmentRef> = {};
    for (const id of ids) {
      const item = a.items.find((i) => i.id === id);
      if (item) garments[id] = { brand: item.brandLabel, name: item.g.productName, imagePath: null, imageUrl: item.g.imageUrl };
    }
    const result: RoastResult = {
      name,
      createdAt: new Date().toISOString(),
      garmentCount: a.clothesTotal,
      headline: asOrders(composed.headline),
      paragraphs: composed.paragraphs.map((x) => ({ ...x, text: asOrders(x.text) })),
      closing: composed.closing.map(asOrders),
      disclaimer: T.orders.screen.DISCLAIMER,
      report,
      garments,
      answers: plan.asked
        .filter((q) => answers[q.id])
        .map((q) => ({ id: q.id, question: q.text, answer: q.options.find((o) => o.id === answers[q.id])?.label ?? "" })),
      patterns: composed.used.map((x) => ({ id: x.id, stats: x.stats })),
      aiUsed: false,
      wardrobeHash: "orders",
    };
    return { ok: true, result };
  } catch (e) {
    console.error("[order-roast] finish", e instanceof Error ? e.message : e);
    return { ok: false, message: "결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

/** 옷장 훈수 결과 문장에 남은 "옷장"을 "주문내역"으로 */
function reportAsOrders(r: RoastReport): RoastReport {
  return {
    ...r,
    headline: asOrders(r.headline),
    intro: r.intro.map(asOrders),
    lists: r.lists.map((l) => ({ title: asOrders(l.title), items: l.items })),
    total: { ...r.total, lead: asOrders(r.total.lead), text: asOrders(r.total.text) },
    points: r.points.map((x) => ({ ...x, lead: asOrders(x.lead), text: asOrders(x.text), ...(x.answer ? { answer: asOrders(x.answer) } : {}) })),
    ...(r.summary ? { summary: asOrders(r.summary) } : {}),
    notes: r.notes.map(asOrders),
  };
}

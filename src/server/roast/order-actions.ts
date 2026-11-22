"use server";

import { z } from "zod";
import { DEFAULT_USD_KRW } from "@/lib/format/price";
import type { RoastFinish, RoastGarmentRef, RoastResult, RoastStart } from "@/lib/roast/types";
import { isAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { isAdmin } from "@/server/admin/guard";
import { getQuotaExemption } from "@/server/admin/is-admin";
import { getMyBodyProfile } from "@/server/body/queries";
import { getUsdRate } from "@/server/settings/queries";
import { orderListSchema, toGarments, type OrderRoastItem } from "./orders/input";
import { orderRoastUsedToday } from "./order-limit";
import { getFlConfig } from "./queries";
import type { FlConfig } from "./fl/config";
import { MIN_CLOTHES, planOf, resultOf, runEvaluation, type Run } from "./fl/run";
import { fill } from "./text";

/**
 * 무신사 주문내역 훈수(숨은 주소 /roast/orders). 옷장 훈수 엔진을 주문내역 모드로 쓴다.
 * - 화면이 보낸 주문 목록으로 매번 분석을 다시 만든다(주문 원문·목록·결과 모두 저장하지 않는다).
 * - AI는 쓰지 않는다.
 */

const nameSchema = z
  .string()
  .trim()
  .max(20)
  .transform((s) => s.replace(/[<>{}]/g, "") || null)
  .nullable();
const ageSchema = z.number().int().min(10).max(99).nullable();
const AGE_REQUIRED = "나이를 입력해 주세요.";

async function prepare(items: unknown, age: number | null): Promise<{ run: Run; C: FlConfig; signedIn: boolean; userId: string | null } | { error: string }> {
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
  const [C, usdRate, body] = await Promise.all([getFlConfig(supabase), userId ? getUsdRate() : DEFAULT_USD_KRW, userId ? getMyBodyProfile() : null]);
  const { garments, ctx } = toGarments(parsed.data as OrderRoastItem[]);
  return { run: runEvaluation(garments, body, usdRate, "orders", C, ctx, age), C, signedIn: Boolean(userId), userId };
}

/**
 * 주문내역을 붙여 넣고 상품을 읽기 직전에 부른다. 오늘 이미 훈수를 시작했으면 막는다(하루 한 번).
 * 횟수는 여기서 쓰지 않는다. 읽은 옷이 30벌 이상으로 확인된 뒤 commitOrderRoast에서 쓴다(옷이 모자라면 횟수를 쓰지 않는다).
 * 관리자·테스터는 제한이 없다.
 */
export async function beginOrderRoast(): Promise<{ ok: true } | { ok: false; used: boolean; message: string }> {
  if (!isAuthConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const user = supabase ? await getActiveUser(supabase) : null;
    if (!supabase || !user) return { ok: false, used: false, message: "로그인이 필요합니다. 다시 로그인해 주세요." };
    if (await getQuotaExemption(supabase, user.id)) return { ok: true };
    if (await orderRoastUsedToday(supabase, user.id)) return { ok: false, used: true, message: "" };
    return { ok: true };
  } catch (e) {
    console.error("[order-roast] begin", e instanceof Error ? e.message : e);
    return { ok: true };
  }
}

/** 읽은 옷(못 찾은 상품·옷이 아닌 상품 제외)이 30벌 이상일 때 오늘 횟수를 쓴다. 이미 썼으면 막는다. 관리자·테스터는 기록하지 않는다. */
export async function commitOrderRoast(): Promise<{ ok: true } | { ok: false; used: boolean; message: string }> {
  if (!isAuthConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const user = supabase ? await getActiveUser(supabase) : null;
    if (!supabase || !user) return { ok: false, used: false, message: "로그인이 필요합니다. 다시 로그인해 주세요." };
    if (await getQuotaExemption(supabase, user.id)) return { ok: true };
    if (await orderRoastUsedToday(supabase, user.id)) return { ok: false, used: true, message: "" };
    const { error } = await supabase.from("roast_runs").insert({ user_id: user.id, ai_used: false, kind: "orders" });
    if (error) console.error("[order-roast] commit", error.code, error.message);
    return { ok: true };
  } catch (e) {
    console.error("[order-roast] commit", e instanceof Error ? e.message : e);
    return { ok: true };
  }
}

/** 시작 화면용: 오늘 이미 했는지(관리자·테스터는 항상 false) */
export async function orderRoastUsed(): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user || (await getQuotaExemption(supabase, user.id))) return false;
  return (await orderRoastUsedToday(supabase, user.id)) === true;
}

export async function startOrderRoast(input: { name: string | null; age?: number | null; items: unknown }): Promise<RoastStart> {
  try {
    const p = await prepare(input.items, ageSchema.safeParse(input.age ?? null).data ?? null);
    if ("error" in p) return { ok: false, code: "error", message: p.error };
    if (p.run.clothes < MIN_CLOTHES) return { ok: false, code: "too_few", count: p.run.clothes };
    const name = nameSchema.safeParse(input.name).data ?? null;
    const age = ageSchema.safeParse(input.age ?? null).data ?? null;
    if (age == null) return { ok: false, code: "error", message: AGE_REQUIRED };
    const seed = Math.floor(Math.random() * 2 ** 31);
    const { script } = planOf(p.run, p.C, seed, name);
    return { ok: true, script };
  } catch (e) {
    console.error("[order-roast] start", e instanceof Error ? e.message : e);
    return { ok: false, code: "error", message: "주문내역을 읽지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function finishOrderRoast(input: { seed: number; name: string | null; age?: number | null; answers: Record<string, string>; items: unknown }): Promise<RoastFinish> {
  try {
    const p = await prepare(input.items, ageSchema.safeParse(input.age ?? null).data ?? null);
    if ("error" in p) return { ok: false, message: p.error };
    const { run, C } = p;
    if (run.clothes < MIN_CLOTHES) return { ok: false, message: fill(String(C.orderScreen.TOO_FEW), { n: run.clothes }) };
    const name = nameSchema.safeParse(input.name).data ?? null;
    const age = ageSchema.safeParse(input.age ?? null).data ?? null;
    if (age == null) return { ok: false, message: AGE_REQUIRED };
    const seed = z.number().int().nonnegative().safeParse(input.seed).data ?? 0;
    const answers = z.record(z.string().max(60), z.string().max(200)).safeParse(input.answers).data ?? {};

    // 점수 풀이는 관리자에게만(미리보기 모드는 확인용으로 보여 준다)
    const admin = !p.userId || (await isAdmin(p.userId));
    const { plan, built } = resultOf(run, C, seed, name, answers, { admin, partial: false });
    const report = built.report;

    const ids = [...new Set(report.points.flatMap((x) => x.photos ?? []))];
    const garments: Record<string, RoastGarmentRef> = {};
    for (const id of ids) {
      const item = run.ev.F.items.find((i) => i.id === id);
      if (item) garments[id] = { brand: item.brandLabel, name: item.g.productName, imagePath: null, imageUrl: item.g.imageUrl };
    }
    const result: RoastResult = {
      name,
      createdAt: new Date().toISOString(),
      garmentCount: run.clothes,
      headline: "",
      paragraphs: [],
      closing: built.closing,
      disclaimer: String(C.orderScreen.DISCLAIMER),
      report,
      garments,
      answers: plan.asked
        .filter((q) => answers[q.id])
        .map((q) => ({ id: q.id, question: q.text, answer: q.options.find((o) => o.id === answers[q.id])?.label ?? "" })),
      patterns: run.ev.types.map((t) => ({ id: t.id, stats: { fitness: Math.round(t.fitness * 100), share: Math.round(t.share * 100) } })),
      wardrobeHash: "orders",
    };
    return { ok: true, result };
  } catch (e) {
    console.error("[order-roast] finish", e instanceof Error ? e.message : e);
    return { ok: false, message: "결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

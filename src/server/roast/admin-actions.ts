"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";
import type { QuizEntry } from "./quiz";
import { checkUnit, CUSTOM_QUIZ_ID, sameValue, toRows, unitAt, type UnitValue } from "./texts";

/**
 * 관리자 화면에서 훈수 문장 고치기. 관리자 확인은 여기서 한 번, DB RLS(admins에 있는 사람만 쓰기)에서 한 번 더 한다.
 * 문장 하나, 문장 목록(항목 더하기·빼기), 퀴즈(새로 만들기·지우기)를 고친다. 새 패턴·질문은 코드로만 추가한다.
 */

export type RoastTextResult = { ok: true; value?: UnitValue } | { ok: false; error: string };

const keySchema = z.string().max(190);
type Db = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function ready() {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 고칠 수 있습니다." } as const;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "저장하지 못했습니다." } as const;
  return { supabase, adminId: admin.id };
}

/** key와 그 key의 나눈 행(key~1…)을 지운다. keep에 있는 행은 남긴다. */
async function deleteRows(supabase: Db, prefix: string, match: (k: string) => boolean, keep: Set<string> = new Set()) {
  const { data, error } = await supabase.from("roast_text_edits").select("key").like("key", `${prefix}%`);
  if (error) return error;
  const gone = data.map((r) => r.key).filter((k) => match(k) && !keep.has(k));
  if (!gone.length) return null;
  return (await supabase.from("roast_text_edits").delete().in("key", gone)).error;
}
const rowsOf = (key: string) => (k: string) => k === key || new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}~\\d+$`).test(k);

async function writeUnit(supabase: Db, adminId: string, key: string, value: UnitValue, base: UnitValue | undefined) {
  // 기본값과 같으면 고친 기록을 지운다.
  if (sameValue(value, base)) return deleteRows(supabase, key, rowsOf(key));
  const rows = toRows(key, value);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("roast_text_edits")
    .upsert(Object.entries(rows).map(([k, body]) => ({ key: k, body, updated_by: adminId, updated_at: now })));
  if (error) return error;
  return deleteRows(supabase, key, rowsOf(key), new Set(Object.keys(rows)));
}

function fail(where: string, error: { code?: string; message: string }): RoastTextResult {
  console.error(`[roast] ${where}`, error.code, error.message);
  return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
}

/** 문장 하나 또는 문장 목록 저장 */
export async function saveRoastUnit(key: string, value: UnitValue): Promise<RoastTextResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  const parsed = keySchema.safeParse(key);
  const unit = parsed.success ? unitAt(parsed.data) : null;
  if (!parsed.success || !unit || unit.base === undefined) return { ok: false, error: "없는 문장입니다." };
  const checked = checkUnit(parsed.data, value);
  if ("error" in checked) return { ok: false, error: checked.error };
  const error = await writeUnit(r.supabase, r.adminId, parsed.data, checked.value, unit.base);
  return error ? fail("text save", error) : { ok: true, value: checked.value };
}

/** 고친 값을 지우고 코드의 기본값으로 돌린다. */
export async function resetRoastUnit(key: string): Promise<RoastTextResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  const parsed = keySchema.safeParse(key);
  if (!parsed.success || !unitAt(parsed.data)) return { ok: false, error: "없는 문장입니다." };
  const error = await deleteRows(r.supabase, parsed.data, rowsOf(parsed.data));
  return error ? fail("text reset", error) : { ok: true };
}

const QUIZ_KEYS: (keyof QuizEntry)[] = ["brand", "question", "options", "answer", "correct", "wrong"];

/** 퀴즈 하나 저장(새 퀴즈는 id가 "c-"로 시작). 기본 퀴즈는 기본값과 다른 칸만 저장한다. */
export async function saveRoastQuiz(id: string, quiz: QuizEntry): Promise<RoastTextResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  const builtIn = unitAt(`quiz.${id}.question`)?.base !== undefined;
  if (!builtIn && !CUSTOM_QUIZ_ID.test(id)) return { ok: false, error: "없는 퀴즈입니다." };
  const values: Partial<Record<keyof QuizEntry, UnitValue>> = {};
  for (const f of QUIZ_KEYS) {
    const checked = checkUnit(`quiz.${id}.${f}`, quiz?.[f]);
    if ("error" in checked) return { ok: false, error: checked.error };
    values[f] = checked.value;
  }
  if ((values.options as string[])[values.answer as number] == null) return { ok: false, error: "정답을 골라 주세요." };
  for (const f of QUIZ_KEYS) {
    const key = `quiz.${id}.${f}`;
    const error = await writeUnit(r.supabase, r.adminId, key, values[f]!, builtIn ? unitAt(key)!.base : undefined);
    if (error) return fail("quiz save", error);
  }
  const error = await deleteRows(r.supabase, `quiz.${id}.`, (k) => k === `quiz.${id}.deleted`);
  return error ? fail("quiz save", error) : { ok: true };
}

/** 퀴즈 지우기. 기본 퀴즈는 "지움" 표시만 남기고(원래대로 되돌릴 수 있게), 새 퀴즈는 행을 모두 지운다. */
export async function deleteRoastQuiz(id: string): Promise<RoastTextResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  const builtIn = unitAt(`quiz.${id}.question`)?.base !== undefined;
  if (!builtIn && !CUSTOM_QUIZ_ID.test(id)) return { ok: false, error: "없는 퀴즈입니다." };
  let error = await deleteRows(r.supabase, `quiz.${id}.`, () => true);
  if (!error && builtIn)
    error = (
      await r.supabase
        .from("roast_text_edits")
        .upsert({ key: `quiz.${id}.deleted`, body: "1", updated_by: r.adminId, updated_at: new Date().toISOString() })
    ).error;
  return error ? fail("quiz delete", error) : { ok: true };
}

/** 기본 퀴즈를 원래대로(고친 칸과 지움 표시를 모두 지운다) */
export async function resetRoastQuiz(id: string): Promise<RoastTextResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  if (unitAt(`quiz.${id}.question`)?.base === undefined) return { ok: false, error: "없는 퀴즈입니다." };
  const error = await deleteRows(r.supabase, `quiz.${id}.`, () => true);
  return error ? fail("quiz reset", error) : { ok: true };
}

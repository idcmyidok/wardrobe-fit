"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";
import type { QuizEntry } from "./quiz";
import { checkUnit, CUSTOM_QUIZ_ID, toRows, unitAt, type UnitValue } from "./texts";

/**
 * 관리자 화면에서 훈수 문장 고치기. 관리자 확인은 여기서 한 번, DB RLS(admins에 있는 사람만 쓰기)에서 한 번 더 한다.
 * 한 묶음의 문장(항목 더하기·빼기 포함), 퀴즈(새로 만들기·지우기)를 고친다. 새 패턴·질문은 코드로만 추가한다.
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

async function writeUnit(supabase: Db, adminId: string, key: string, value: UnitValue) {
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

/** 한 묶음(블록)의 고친 칸들을 한꺼번에 저장한다. 저장된 값이 곧 기준이라 코드 기본값과 같아도 그대로 저장한다. */
export async function saveRoastUnits(items: { key: string; value: UnitValue }[]): Promise<RoastTextResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  if (!Array.isArray(items) || !items.length || items.length > 200) return { ok: false, error: "저장할 문장이 없습니다." };
  const checked: { key: string; value: UnitValue }[] = [];
  for (const item of items) {
    const key = keySchema.safeParse(item?.key);
    const unit = key.success ? unitAt(key.data) : null;
    if (!key.success || !unit || unit.base === undefined) return { ok: false, error: "없는 문장입니다." };
    const c = checkUnit(key.data, item.value);
    if ("error" in c) return { ok: false, error: c.error };
    checked.push({ key: key.data, value: c.value });
  }
  for (const { key, value } of checked) {
    const error = await writeUnit(r.supabase, r.adminId, key, value);
    if (error) return fail("text save", error);
  }
  return { ok: true };
}

const QUIZ_KEYS: (keyof QuizEntry)[] = ["brand", "question", "options", "answer", "correct", "wrong"];

/** 퀴즈 하나 저장(새 퀴즈는 id가 "c-"로 시작). 칸은 모두 저장한다. */
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
    const error = await writeUnit(r.supabase, r.adminId, `quiz.${id}.${f}`, values[f]!);
    if (error) return fail("quiz save", error);
  }
  const error = await deleteRows(r.supabase, `quiz.${id}.`, (k) => k === `quiz.${id}.deleted`);
  return error ? fail("quiz save", error) : { ok: true };
}

/** 퀴즈 지우기. 기본 퀴즈는 "지움" 표시만 남기고(다시 저장하면 되살아난다), 새 퀴즈는 행을 모두 지운다. */
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

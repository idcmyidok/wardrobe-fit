"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";
import { isSection, sanitizeSection, toRows } from "./fl/store";

/**
 * 관리자 "훈수 설계" 저장. 관리자 확인은 여기서 한 번, DB RLS(admins에 있는 사람만 쓰기)에서 한 번 더 한다.
 * 한 구역(유형 하나, 숫자 설정, 공통 문장, 대화 순서 등)을 통째로 저장하거나 기본값으로 되돌린다.
 */

export type DesignResult = { ok: true; value?: unknown } | { ok: false; error: string };

const sectionSchema = z.string().max(80);
type Db = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function ready() {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 고칠 수 있습니다." } as const;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "저장하지 못했습니다." } as const;
  return { supabase, adminId: admin.id };
}

const rowOf = (section: string) => {
  const esc = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^fl\\.${esc}~\\d+$`);
};

/** 그 구역의 저장 행을 지운다(keep에 있는 행은 남김) */
async function clearRows(supabase: Db, section: string, keep: Set<string> = new Set()) {
  const { data, error } = await supabase.from("roast_text_edits").select("key").like("key", `fl.${section}~%`);
  if (error) return error;
  const re = rowOf(section);
  const gone = data.map((r) => r.key).filter((k) => re.test(k) && !keep.has(k));
  if (!gone.length) return null;
  return (await supabase.from("roast_text_edits").delete().in("key", gone)).error;
}

function fail(where: string, error: { code?: string; message: string }): DesignResult {
  console.error(`[roast] ${where}`, error.code, error.message);
  return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
}

/** 한 구역 저장. 검사를 통과한 값(정리된 값)을 돌려준다. */
export async function saveDesignSection(section: string, value: unknown): Promise<DesignResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  const s = sectionSchema.safeParse(section);
  if (!s.success || !isSection(s.data)) return { ok: false, error: "없는 구역입니다." };
  const checked = sanitizeSection(s.data, value);
  if (!checked.ok) return checked;
  const rows = toRows(s.data, checked.value);
  const now = new Date().toISOString();
  const { error } = await r.supabase
    .from("roast_text_edits")
    .upsert(Object.entries(rows).map(([key, body]) => ({ key, body, updated_by: r.adminId, updated_at: now })));
  if (error) return fail("design save", error);
  const e2 = await clearRows(r.supabase, s.data, new Set(Object.keys(rows)));
  return e2 ? fail("design save", e2) : { ok: true, value: checked.value };
}

/** 한 구역을 기본값으로 되돌린다(저장 행 삭제). 새로 만든 퀴즈는 이걸로 완전히 지워진다. */
export async function resetDesignSection(section: string): Promise<DesignResult> {
  const r = await ready();
  if ("error" in r) return { ok: false, error: r.error! };
  const s = sectionSchema.safeParse(section);
  if (!s.success || !isSection(s.data)) return { ok: false, error: "없는 구역입니다." };
  const error = await clearRows(r.supabase, s.data);
  return error ? fail("design reset", error) : { ok: true };
}

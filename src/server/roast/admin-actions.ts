"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";
import { checkText, defaultText } from "./texts";

/**
 * 관리자 화면에서 훈수 문장 고치기. 관리자 확인은 여기서 한 번, DB RLS(admins에 있는 사람만 쓰기)에서 한 번 더 한다.
 * 새 패턴·질문은 코드로만 추가하고, 여기서는 이미 있는 문장만 바꾼다.
 */

export type RoastTextResult = { ok: true } | { ok: false; error: string };

const keySchema = z.string().max(200);

async function ready(key: unknown) {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 고칠 수 있습니다." } as const;
  const parsed = keySchema.safeParse(key);
  if (!parsed.success || defaultText(parsed.data) === undefined) return { error: "없는 문장입니다." } as const;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "저장하지 못했습니다." } as const;
  return { supabase, adminId: admin.id, key: parsed.data };
}

export async function saveRoastText(key: string, body: string): Promise<RoastTextResult> {
  const r = await ready(key);
  if ("error" in r) return { ok: false, error: r.error! };
  const text = typeof body === "string" ? body.trim() : "";
  const problem = checkText(r.key, text);
  if (problem) return { ok: false, error: problem };
  // 원래 문장과 같으면 고친 기록을 지운다.
  if (text === defaultText(r.key)) return resetRoastText(r.key);
  const { error } = await r.supabase
    .from("roast_text_edits")
    .upsert({ key: r.key, body: text, updated_by: r.adminId, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[roast] text save", error.code, error.message);
    return { ok: false, error: "저장하지 못했습니다. 마이그레이션 20번을 실행했는지 확인해 주세요." };
  }
  return { ok: true };
}

/** 고친 문장을 지우고 코드의 원래 문장으로 돌린다. */
export async function resetRoastText(key: string): Promise<RoastTextResult> {
  const r = await ready(key);
  if ("error" in r) return { ok: false, error: r.error! };
  const { error } = await r.supabase.from("roast_text_edits").delete().eq("key", r.key);
  if (error) {
    console.error("[roast] text reset", error.code, error.message);
    return { ok: false, error: "되돌리지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return { ok: true };
}

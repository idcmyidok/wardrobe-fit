"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DELETE_CONFIRM_WORD } from "@/lib/account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LAST_EMAIL_COOKIE, REMEMBER_COOKIE } from "@/lib/supabase/config";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { isAdmin } from "@/server/admin/guard";
import { deleteAccountAndData } from "./delete";

export type DeleteAccountState = { error?: string };

/**
 * 본인 회원 탈퇴(개인정보 삭제 요구를 화면에서 바로 처리). 계정·옷·기록·사진을 모두 지우고 쿠키를 비운 뒤 첫 화면으로 보낸다.
 * 관리자 계정은 실수로 관리자가 사라지지 않도록 먼저 SQL Editor에서 admins 행을 지워야 한다.
 */
export async function deleteMyAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  if (String(formData.get("confirm") ?? "").trim() !== DELETE_CONFIRM_WORD) {
    return { error: `확인 칸에 "${DELETE_CONFIRM_WORD}"라고 적어 주세요.` };
  }
  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) redirect("/");
  if (await isAdmin(user.id)) return { error: "관리자 계정은 관리자 등록을 먼저 해제한 뒤 탈퇴할 수 있습니다." };

  const db = createSupabaseAdminClient();
  if (!db) return { error: "지금은 탈퇴를 처리할 수 없습니다. 개인정보처리방침의 이메일로 요청해 주세요." };
  const error = await deleteAccountAndData(db, user.id);
  if (error) return { error: `${error} 잠시 후 다시 시도해 주세요.` };

  await supabase.auth.signOut({ scope: "local" });
  const store = await cookies();
  for (const { name } of store.getAll()) if (name.startsWith("sb-")) store.delete(name);
  store.delete(REMEMBER_COOKIE);
  store.delete(LAST_EMAIL_COOKIE);
  redirect("/?deleted=1");
}

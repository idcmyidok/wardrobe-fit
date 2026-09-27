import "server-only";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";

/**
 * 관리자인지 서버에서 확인한다. 로그인한 사용자 본인의 세션으로 admins를 읽으므로
 * RLS상 자기 행만 보이고, 행이 있으면 관리자다. 미리보기 모드(키 없음)에서는 관리자가 없다.
 */
export async function getAdminUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const user = await getActiveUser(supabase);
  if (!user) return null;
  return (await isAdmin(user.id)) ? user : null;
}

/** 이미 확인한 사용자가 관리자인지(머리글 메뉴에 관리자 링크를 보일지). */
export async function isAdmin(userId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

/** 관리자 화면용. 관리자가 아니면 화면이 있다는 것도 알리지 않도록 404로 보낸다. */
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) notFound();
  return user;
}

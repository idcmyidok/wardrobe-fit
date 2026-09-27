import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE } from "@/lib/supabase/config";
import { createSupabaseServerClient, isBanned } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 세션 쿠키는 남아 있지만 더 쓸 수 없는 경우(관리자가 정지·삭제한 계정 등) 쿠키를 지우고 첫 화면으로 보낸다.
 * 정상 로그인 상태면 아무것도 하지 않는다(다른 사이트가 링크로 로그아웃시키지 못하게).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/");
  const { data, error } = await supabase.auth.getUser();
  if (data.user && !isBanned(data.user)) redirect("/wardrobe");
  const suspended = Boolean(data.user) || error?.code === "user_banned";

  await supabase.auth.signOut({ scope: "local" });
  // 로그아웃 요청이 실패해도 쿠키는 반드시 지운다.
  const store = await cookies();
  for (const { name } of store.getAll()) if (name.startsWith("sb-")) store.delete(name);
  store.delete(REMEMBER_COOKIE);
  redirect(suspended ? "/?error=suspended" : "/");
}

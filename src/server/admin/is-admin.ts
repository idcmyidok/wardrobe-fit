import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * 이미 만든 사용자 세션 클라이언트로 관리자인지 확인한다(admins는 RLS상 자기 행만 보인다).
 * 관리자 계정은 링크 분석·구매 판단 하루 한도를 받지 않는다.
 */
export async function hasAdminRow(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

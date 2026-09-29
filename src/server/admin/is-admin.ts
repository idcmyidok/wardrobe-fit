import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { UnlimitedReason } from "@/lib/usage";

/**
 * 이미 만든 사용자 세션 클라이언트로 관리자인지 확인한다(admins는 RLS상 자기 행만 보인다).
 */
export async function hasAdminRow(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

/**
 * 링크 분석·구매 판단 하루 한도를 받지 않는 계정인지. 관리자와, 관리자가 지정한 테스터(testers, 마이그레이션 17)는
 * 한도가 없다. testers도 RLS상 자기 행만 보이고, 테이블이 아직 없으면 테스터가 아닌 것으로 본다.
 */
export async function getQuotaExemption(supabase: SupabaseClient<Database>, userId: string): Promise<UnlimitedReason | null> {
  const [admin, tester] = await Promise.all([
    hasAdminRow(supabase, userId),
    supabase.from("testers").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (admin) return "admin";
  return tester.data ? "tester" : null;
}

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./config";

/**
 * service role 클라이언트. RLS를 건너뛰므로 관리자 확인(requireAdmin)을 마친 서버 코드에서만 쓴다.
 * 키가 없으면 null(관리자 화면이 "설정 필요"를 보여 준다).
 */
export function createSupabaseAdminClient() {
  const env = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !key) return null;
  return createClient<Database>(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

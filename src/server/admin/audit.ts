import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type AdminAuditAction = "view_admin" | "ban_user" | "unban_user" | "delete_user" | "grant_tester" | "revoke_tester" | "set_usd_rate";

/**
 * 관리자 작업을 admin_audit_logs에 남긴다(마이그레이션 9). 기록이 실패해도 관리 작업은 막지 않고 로그만 남긴다
 * (마이그레이션을 아직 적용하지 않은 환경에서도 관리자 화면이 열리도록).
 */
export async function logAdminAction(db: SupabaseClient<Database>, adminId: string, action: AdminAuditAction, targetId: string | null = null) {
  const { error } = await db.from("admin_audit_logs").insert({ admin_id: adminId, action, target_id: targetId });
  if (error) console.error("[admin] audit", error.code ?? error.message);
}

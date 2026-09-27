import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isBanned } from "@/lib/supabase/server";

/** requireAdmin()을 통과한 뒤에만 부른다. service role로 전체 데이터를 읽는다. */

export const ADMIN_USERS_PER_PAGE = 50;

export interface AdminStats {
  users_total: number;
  users_7d: number;
  users_banned: number;
  garments_total: number;
  garments_7d: number;
  fit_checks_24h: number;
  fit_checks_7d: number;
  ai_calls_24h: number;
  ai_calls_7d: number;
  ai_limited_7d: number;
  imports_7d: number;
  imports_failed_7d: number;
}

export interface ImportFailure {
  domain: string;
  errorCode: string;
  failures: number;
  lastAt: string;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  banned: boolean;
  isAdmin: boolean;
  garments: number;
  fitChecks: number;
  imports: number;
}

export interface AdminOverview {
  stats: AdminStats;
  failures: ImportFailure[];
  users: AdminUserRow[];
  page: number;
  lastPage: number;
}

/** 서버에 service role 키가 없으면 null. */
export async function getAdminOverview(page: number): Promise<AdminOverview | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const [stats, failures, list, admins] = await Promise.all([
    db.rpc("admin_stats"),
    db.rpc("admin_import_failures"),
    db.auth.admin.listUsers({ page, perPage: ADMIN_USERS_PER_PAGE }),
    db.from("admins").select("user_id"),
  ]);
  const error = stats.error ?? failures.error ?? list.error ?? admins.error;
  if (error) throw new Error(`관리자 통계를 불러오지 못했습니다: ${error.message}`);

  const users = list.data.users;
  const { data: counts, error: countError } = users.length
    ? await db.rpc("admin_user_counts", { p_user_ids: users.map((u) => u.id) })
    : { data: [], error: null };
  if (countError) throw new Error(`사용자별 숫자를 불러오지 못했습니다: ${countError.message}`);

  const countMap = new Map((counts ?? []).map((c) => [c.user_id, c]));
  const adminIds = new Set((admins.data ?? []).map((a) => a.user_id));
  const total = "total" in list.data ? list.data.total : users.length;

  return {
    stats: stats.data as unknown as AdminStats,
    failures: (failures.data ?? []).map((f) => ({
      domain: f.domain,
      errorCode: f.error_code,
      failures: Number(f.failures),
      lastAt: f.last_at,
    })),
    users: users.map((u) => {
      const c = countMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmed: Boolean(u.email_confirmed_at),
        banned: isBanned(u),
        isAdmin: adminIds.has(u.id),
        garments: Number(c?.garments ?? 0),
        fitChecks: Number(c?.fit_checks ?? 0),
        imports: Number(c?.imports ?? 0),
      };
    }),
    page,
    lastPage: Math.max(1, Math.ceil(total / ADMIN_USERS_PER_PAGE)),
  };
}

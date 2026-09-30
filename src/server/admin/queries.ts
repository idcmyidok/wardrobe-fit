import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isBanned } from "@/lib/supabase/server";
import { logAdminAction } from "./audit";

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
  /** 관리자가 지정한 테스터(한도 없음). */
  isTester: boolean;
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

/** 읽기에 실패하면 화면 전체를 오류로 바꾸지 않고 원인을 관리자에게 보여 준다. */
export interface AdminOverviewError {
  error: string;
  /** 잘못된 키를 넣은 경우(anon 키 등)처럼 운영자가 고칠 수 있는 원인 */
  hint: string | null;
}

/** 서버에 service role 키가 없으면 null. */
export async function getAdminOverview(adminId: string, page: number): Promise<AdminOverview | AdminOverviewError | null> {
  try {
    return await readOverview(adminId, page);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin] overview", message);
    return { error: message, hint: keyHint(message) };
  }
}

function keyHint(message: string) {
  return /permission denied|User not allowed|Invalid API key|JWT|not_admin|401|403/i.test(message)
    ? "서버의 SUPABASE_SERVICE_ROLE_KEY가 service_role(secret) 키가 아닌 것 같습니다. anon(publishable) 키를 넣었는지 확인해 주세요."
    : null;
}

async function readOverview(adminId: string, page: number): Promise<AdminOverview | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  // 사용자 목록(이메일 등)을 여는 것도 개인정보 열람이므로 기록한다.
  await logAdminAction(db, adminId, "view_admin");
  const [stats, failures, list, admins, testers] = await Promise.all([
    db.rpc("admin_stats"),
    db.rpc("admin_import_failures"),
    db.auth.admin.listUsers({ page, perPage: ADMIN_USERS_PER_PAGE }),
    db.from("admins").select("user_id"),
    // 마이그레이션 17을 적용하기 전에는 테이블이 없으므로 실패해도 빈 목록으로 본다.
    db.from("testers").select("user_id"),
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
  const testerIds = new Set((testers.data ?? []).map((t) => t.user_id));
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
        isTester: testerIds.has(u.id),
        garments: Number(c?.garments ?? 0),
        fitChecks: Number(c?.fit_checks ?? 0),
        imports: Number(c?.imports ?? 0),
      };
    }),
    page,
    lastPage: Math.max(1, Math.ceil(total / ADMIN_USERS_PER_PAGE)),
  };
}


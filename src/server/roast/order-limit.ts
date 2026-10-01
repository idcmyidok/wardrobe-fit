import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * 주문내역 훈수는 한 계정이 하루(한국 시간 0시 기준)에 한 번만 시작할 수 있다. 시작하는 순간 roast_runs에
 * kind='orders'로 한 줄 남기고, 중간에 나가도 돌려주지 않는다. 관리자·테스터는 호출하는 쪽에서 건너뛴다.
 */

const KST_MS = 9 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

/** 오늘 0시(한국 시간)의 ISO 시각 */
export function kstDayStart(now = new Date()): string {
  return new Date(Math.floor((now.getTime() + KST_MS) / DAY_MS) * DAY_MS - KST_MS).toISOString();
}

/** 오늘 이미 시작했는지. 기록을 읽지 못하면(구분 칸이 아직 없는 DB 등) null: 막지 않는다. */
export async function orderRoastUsedToday(supabase: SupabaseClient<Database>, userId: string): Promise<boolean | null> {
  const { count, error } = await supabase
    .from("roast_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "orders")
    .gte("created_at", kstDayStart());
  if (error) {
    console.error("[order-roast] used-today", error.code, error.message);
    return null;
  }
  return (count ?? 0) > 0;
}

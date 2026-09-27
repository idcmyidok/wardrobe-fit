import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Usage } from "@/lib/usage";
import { aiDailyLimit, CACHE_SUFFIX, FIT_DAILY_LIMIT, hoursAgo } from "@/server/fit/service";
import { IMPORT_DAILY_LIMIT } from "@/server/import/service";

/** 최근 24시간 사용량. 한도를 거는 쿼리(import/service.ts, fit/service.ts)와 같은 조건으로 센다. */
export async function getUsage(supabase: SupabaseClient<Database>, userId: string): Promise<Usage> {
  const since = hoursAgo(24);
  const [imports, fits, ai] = await Promise.all([
    supabase.from("product_imports").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("fit_checks").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase
      .from("fit_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("ai_model", "is", null)
      .not("ai_model", "like", `%${CACHE_SUFFIX}`)
      .gte("created_at", since),
  ]);
  return {
    imports: { used: imports.count ?? 0, limit: IMPORT_DAILY_LIMIT },
    fits: { used: fits.count ?? 0, limit: FIT_DAILY_LIMIT },
    ai: { used: ai.count ?? 0, limit: aiDailyLimit() },
  };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Usage, UsageCounter } from "@/lib/usage";
import { getQuotaExemption } from "@/server/admin/is-admin";
import { aiDailyLimit, CACHE_SUFFIX, FIT_DAILY_LIMIT, hoursAgo } from "@/server/fit/service";
import { IMPORT_DAILY_LIMIT } from "@/server/import/service";

type Client = SupabaseClient<Database>;

/**
 * 최근 24시간 사용량. 한도를 거는 쿼리(import/service.ts, fit/service.ts)와 같은 조건으로 센다.
 * 가장 이른·늦은 기록 시각도 함께 돌려 화면이 "다시 쓸 수 있는 때"를 보여 준다.
 */
export async function getUsage(supabase: Client, userId: string): Promise<Usage> {
  const since = hoursAgo(24);
  const imports = () => supabase.from("product_imports").select("created_at", { count: "exact" }).eq("user_id", userId).gte("created_at", since);
  const fits = () => supabase.from("fit_checks").select("created_at", { count: "exact" }).eq("user_id", userId).gte("created_at", since);
  const ai = () => fits().not("ai_model", "is", null).not("ai_model", "like", `%${CACHE_SUFFIX}`);

  const counter = async (query: () => ReturnType<typeof imports> | ReturnType<typeof fits>, limit: number): Promise<UsageCounter> => {
    const [oldest, newest] = await Promise.all([
      query().order("created_at", { ascending: true }).limit(1),
      query().order("created_at", { ascending: false }).limit(1),
    ]);
    return { used: oldest.count ?? 0, limit, oldestAt: oldest.data?.[0]?.created_at ?? null, newestAt: newest.data?.[0]?.created_at ?? null };
  };

  const [exemption, importUsage, fitUsage, aiUsage] = await Promise.all([
    getQuotaExemption(supabase, userId),
    counter(imports, IMPORT_DAILY_LIMIT),
    counter(fits, FIT_DAILY_LIMIT),
    counter(ai, aiDailyLimit()),
  ]);
  return { unlimited: Boolean(exemption), unlimitedReason: exemption, imports: importUsage, fits: fitUsage, ai: aiUsage };
}

import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { getUsage } from "@/server/usage";

export const dynamic = "force-dynamic";

/** GET /api/usage → 최근 24시간 링크 분석·구매 판단·AI 요약 사용량과 한도 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return Response.json({ error: "signed_out" }, { status: 401 });
  return Response.json(await getUsage(supabase, user.id), { headers: { "cache-control": "no-store" } });
}

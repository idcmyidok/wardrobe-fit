import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { getUsage } from "@/server/usage";

export const dynamic = "force-dynamic";

/** GET /api/usage → 최근 24시간 링크 분석·구매 판단·AI 요약 사용량과 한도 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  // 로그인 전(미리보기 포함)에는 보여 줄 사용량이 없다. 오류 대신 빈 응답이라 브라우저 콘솔에 실패가 남지 않는다.
  if (!supabase || !user) return new Response(null, { status: 204 });
  return Response.json(await getUsage(supabase, user.id), { headers: { "cache-control": "no-store" } });
}

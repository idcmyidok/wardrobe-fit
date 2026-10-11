import type { RoastCopy } from "@/lib/roast/copy";
import { RoastView } from "@/components/roast/roast-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";
import { getLatestRoast, getFlConfig } from "@/server/roast/queries";

export const metadata = { title: "내 패션 훈수 · Wardrobe Fit" };
/** 결과를 쓸 때 AI를 한 번 부른다(서버 액션이 이 화면 설정을 따른다). */
export const maxDuration = 30;

export default async function RoastPage() {
  const [result, texts, admin] = await Promise.all([getLatestRoast(), createSupabaseServerClient().then(getFlConfig), getAdminUser()]);
  return <RoastView initialResult={result} copy={texts.screen as RoastCopy} fast={Boolean(admin)} />;
}

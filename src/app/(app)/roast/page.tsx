import { RoastView } from "@/components/roast/roast-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestRoast, getRoastTexts } from "@/server/roast/queries";

export const metadata = { title: "내 패션 훈수 · Wardrobe Fit" };
/** 결과를 쓸 때 AI를 한 번 부른다(서버 액션이 이 화면 설정을 따른다). */
export const maxDuration = 30;

export default async function RoastPage() {
  const [result, texts] = await Promise.all([getLatestRoast(), createSupabaseServerClient().then(getRoastTexts)]);
  return <RoastView initialResult={result} copy={texts.screen} />;
}

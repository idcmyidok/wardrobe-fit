import { RoastView } from "@/components/roast/roast-view";
import { getLatestRoast } from "@/server/roast/queries";

export const metadata = { title: "내 옷장 훈수 · Wardrobe Fit" };
/** 결과를 쓸 때 AI를 한 번 부른다(서버 액션이 이 화면 설정을 따른다). */
export const maxDuration = 30;

export default async function RoastPage() {
  return <RoastView initialResult={await getLatestRoast()} />;
}

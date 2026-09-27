import { WardrobeView } from "@/components/wardrobe/wardrobe-view";

export const metadata = { title: "내 옷장 · Wardrobe Fit" };

/** 인증 연결 전 개발 확인용 화면. mock data로 동작을 확인한다. */
export default function WardrobePage() {
  return <WardrobeView />;
}

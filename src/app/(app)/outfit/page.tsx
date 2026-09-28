import { notFound } from "next/navigation";
import { OutfitView } from "@/components/outfit/outfit-view";
import { FEATURES } from "@/lib/features";

// 꺼 두었을 때는 탭 제목에도 이름이 드러나지 않게 한다.
export const metadata = FEATURES.outfit ? { title: "오늘의 코디 · Wardrobe Fit" } : {};

export default function OutfitPage() {
  if (!FEATURES.outfit) notFound();
  return <OutfitView />;
}

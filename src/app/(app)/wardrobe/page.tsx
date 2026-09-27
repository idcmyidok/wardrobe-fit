import { WardrobeView } from "@/components/wardrobe/wardrobe-view";

export const metadata = { title: "내 옷장 · Wardrobe Fit" };

/** 내 옷장. 옷 목록은 (app) layout이 불러와 WardrobeProvider로 내려준다. */
export default function WardrobePage() {
  return <WardrobeView />;
}

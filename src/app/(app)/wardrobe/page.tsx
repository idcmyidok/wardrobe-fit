import { Suspense } from "react";
import { WardrobeView } from "@/components/wardrobe/wardrobe-view";

export const metadata = { title: "내 옷장 · Wardrobe Fit" };

/** 내 옷장. 옷 목록은 (app) layout이 불러와 WardrobeProvider로 내려준다. */
export default function WardrobePage() {
  // 필터·정렬을 URL(searchParams)에서 읽기 때문에 Suspense 경계가 필요하다.
  return (
    <Suspense>
      <WardrobeView />
    </Suspense>
  );
}

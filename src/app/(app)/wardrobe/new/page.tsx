import { Suspense } from "react";
import { NewGarmentView } from "@/components/garment-form/new-garment-view";

export const metadata = { title: "새 옷 추가 · Wardrobe Fit" };

export default function NewGarmentPage() {
  // ?mode=manual 을 읽기 때문에 Suspense 경계가 필요하다.
  return (
    <Suspense>
      <NewGarmentView />
    </Suspense>
  );
}

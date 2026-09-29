"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import { GarmentDetail } from "./garment-drawer";
import { useWardrobe } from "./wardrobe-store";

/** /wardrobe/[id]: 옷 정보 본문을 페이지로 보여준다. 옷 목록은 (app) layout이 이미 불러와 있다. */
export function GarmentDetailView({ id }: { id: string }) {
  const { allGarments } = useWardrobe();
  const router = useRouter();
  const garment = allGarments.find((g) => g.id === id);

  if (!garment) {
    return (
      <main className="mx-auto flex max-w-140 flex-col items-start gap-3 px-4 py-16">
        <h1 className="text-lg font-semibold">옷을 찾을 수 없습니다</h1>
        <p className="text-base text-neutral-700">삭제되었거나 주소가 잘못되었을 수 있습니다.</p>
        <Link href="/wardrobe" className={buttonClassName({ variant: "secondary" })}>
          내 옷장으로
        </Link>
      </main>
    );
  }
  return <GarmentDetail key={garment.id} garment={garment} variant="page" onClose={() => router.push(garment.held ? "/fit-check" : "/wardrobe")} />;
}

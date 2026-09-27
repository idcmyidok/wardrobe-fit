import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

export const metadata = { title: "페이지를 찾을 수 없습니다 · Wardrobe Fit" };

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-140 flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-lg font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-base text-neutral-700">주소가 잘못되었거나 사라진 페이지입니다.</p>
      <Link href="/wardrobe" className={buttonClassName({ variant: "secondary" })}>
        내 옷장으로
      </Link>
    </main>
  );
}

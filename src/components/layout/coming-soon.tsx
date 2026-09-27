import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageHeader } from "./page-header";

/** 아직 구현하지 않은 화면의 자리 표시 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex max-w-xl flex-col items-start gap-2 py-16">
        <h2 className="text-lg text-text">준비 중인 화면입니다</h2>
        <p className="text-base text-text-muted">{description}</p>
        <Link href="/wardrobe" className={cn(buttonClassName({ variant: "secondary" }), "mt-3")}>
          내 옷장으로
        </Link>
      </div>
    </>
  );
}

import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "./page-header";

/** 아직 구현하지 않은 화면의 자리 표시 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="border-y border-border bg-surface py-16">
        <EmptyState
          title="준비 중인 화면입니다"
          description={description}
          action={
            <Link href="/wardrobe" className={buttonClassName({ size: "sm" })}>
              내 옷장으로
            </Link>
          }
        />
      </div>
    </>
  );
}

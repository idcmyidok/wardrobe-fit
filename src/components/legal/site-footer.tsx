import Link from "next/link";
import { SERVICE_NAME } from "@/lib/legal";

/** 모든 화면 맨 아래의 작은 법적 고지 링크(여백은 쓰는 쪽에서 준다). 개인정보처리방침은 다른 링크보다 눈에 띄게 보인다. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 ${className ?? ""}`}>
      <span>© {SERVICE_NAME}</span>
      <Link href="/privacy" className="font-semibold text-neutral-700 no-underline hover:underline">
        개인정보처리방침
      </Link>
      <Link href="/terms" className="text-neutral-600 no-underline hover:underline">
        이용약관
      </Link>
    </footer>
  );
}

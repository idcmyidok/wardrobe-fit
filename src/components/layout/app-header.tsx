"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { ReleaseNoteEdits, ReleaseNoteImages } from "@/lib/release-notes";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/wardrobe", label: "내 옷장" },
  { href: "/fit-check", label: "구매 판단기" },
  { href: "/analysis", label: "옷장 데이터" },
  { href: "/roast", label: "내 패션 훈수" },
  { href: "/body", label: "내 치수" },
];

/** email이 null이면 인증 서버가 없는 미리보기 모드다. admin이면 사용자 메뉴에 관리자 링크가 생긴다. */
export function AppHeader({
  email,
  admin = false,
  releaseNoteEdits = {},
  releaseNoteImages = {},
}: {
  email: string | null;
  admin?: boolean;
  releaseNoteEdits?: ReleaseNoteEdits;
  releaseNoteImages?: ReleaseNoteImages;
}) {
  const pathname = usePathname();
  return (
    <header className="header-bar sticky top-0 z-30 pt-[calc(env(safe-area-inset-top)+0.25rem)] md:pt-[env(safe-area-inset-top)]">
      {/* 좁은 화면에서는 메뉴가 두 번째 줄로 내려간다. */}
      <div className="relative mx-auto flex min-h-12 max-w-400 flex-wrap items-center gap-x-6 gap-y-0 py-1.5 md:py-0 px-[clamp(16px,3vw,32px)] md:flex-nowrap">
        <nav aria-label="주요 메뉴" className="-mx-1.5 flex w-[calc(100%+0.75rem)] flex-wrap justify-between md:mx-0 md:mr-auto md:w-auto md:flex-nowrap md:gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-1.5 py-1.5 text-[12.5px] whitespace-nowrap no-underline transition-colors md:px-3 md:text-sm",
                  active
                    ? "bg-surface-muted font-semibold text-text"
                    : "text-text-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0 md:flex">
          <UserMenu email={email} admin={admin} releaseNoteEdits={releaseNoteEdits} releaseNoteImages={releaseNoteImages} />
        </div>
      </div>
    </header>
  );
}

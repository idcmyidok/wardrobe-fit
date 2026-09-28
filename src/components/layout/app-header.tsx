"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { FEATURES } from "@/lib/features";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/wardrobe", label: "내 옷장" },
  { href: "/fit-check", label: "AI 구매 판단기" },
  { href: "/analysis", label: "옷장 분석" },
  ...(FEATURES.outfit ? [{ href: "/outfit", label: "오늘의 코디" }] : []),
];

/** email이 null이면 인증 서버가 없는 미리보기 모드다. admin이면 사용자 메뉴에 관리자 링크가 생긴다. */
export function AppHeader({ email, admin = false }: { email: string | null; admin?: boolean }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-text bg-bg">
      {/* 좁은 화면에서는 메뉴가 두 번째 줄로 내려간다. */}
      <div className="relative flex min-h-14 flex-wrap items-center gap-x-7 gap-y-1 px-[clamp(16px,3vw,32px)] md:flex-nowrap">
        <Link href="/wardrobe" className="py-2 font-display text-brand whitespace-nowrap text-text no-underline">
          Wardrobe Fit
        </Link>
        <nav aria-label="주요 메뉴" className="order-last -mx-2 flex w-full gap-1 md:order-none md:mx-0 md:mr-auto md:w-auto md:gap-5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-2 py-2.5 text-base whitespace-nowrap no-underline transition-colors md:px-0",
                  active
                    ? "text-text underline decoration-1 underline-offset-[6px]"
                    : "text-text hover:text-accent-700",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <UserMenu email={email} admin={admin} />
        </div>
      </div>
    </header>
  );
}

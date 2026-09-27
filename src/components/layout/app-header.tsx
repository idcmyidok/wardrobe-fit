"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/wardrobe", label: "내 옷장" },
  { href: "/fit-check", label: "AI 구매 판단기" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-text bg-bg">
      {/* 좁은 화면에서는 메뉴가 두 번째 줄로 내려간다. */}
      <div className="mx-auto flex min-h-14 max-w-screen-2xl flex-wrap items-center gap-x-7 px-4 sm:flex-nowrap sm:px-8">
        <Link href="/wardrobe" className="py-2 font-display text-brand whitespace-nowrap text-text hover:text-text">
          Wardrobe Fit
        </Link>
        <nav aria-label="주요 메뉴" className="order-last -mx-2 flex w-full items-center gap-1 sm:order-none sm:mx-0 sm:w-auto sm:gap-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-2 py-2.5 text-base whitespace-nowrap underline-offset-[6px] transition-colors",
                  active ? "text-text underline decoration-1" : "text-text-muted hover:text-accent-hover",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

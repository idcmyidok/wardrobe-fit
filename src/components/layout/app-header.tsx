"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/wardrobe", label: "내 옷장" },
  { href: "/fit-check", label: "AI 구매 판단기" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 sm:gap-8 sm:px-8">
        <Link href="/wardrobe" className="text-md font-semibold tracking-tight text-text">
          Wardrobe Fit
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-md px-2.5 py-1.5 text-base font-medium text-text"
                    : "rounded-md px-2.5 py-1.5 text-base text-text-muted hover:text-text"
                }
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

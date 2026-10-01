import Link from "next/link";
import type { CSSProperties } from "react";
import "./landing.css";

/**
 * 로그인 화면 회원가입 줄 아래에 띄우는 새 기능 소개. 항목을 늘리거나 바꿀 때는 이 목록만 고친다.
 * 로그인 전에 눌러도 프록시가 로그인 화면(?next=)으로 돌려보냈다가 로그인 뒤 그 주소로 보낸다.
 */
const PROMOS = [
  {
    href: "/roast/orders",
    tag: "NEW",
    title: "AI 무신사 주문내역 훈수 OPEN!",
    description:
      "무신사 주문내역을 복사해 붙여 넣으면, 그동안 산 옷을 훑어보고 훈수를 둡니다.",
  },
];

export function PromoBanner() {
  return (
    <ul
      className="lp-rise flex w-full max-w-95 flex-col gap-2"
      style={{ "--rise": "200ms" } as CSSProperties}
    >
      {PROMOS.map((promo) => (
        <li key={promo.href}>
          <Link
            href={promo.href}
            className="group flex items-center gap-3 rounded-md border border-neutral-300 bg-bg px-4 py-3.5 transition-colors hover:border-text"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2">
                <span className="tag tag-accent shrink-0">{promo.tag}</span>
                <span className="truncate text-md font-semibold">
                  {promo.title}
                </span>
              </span>
              <span className="text-sm text-pretty text-neutral-700">
                {promo.description}
              </span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4 shrink-0 fill-none stroke-current stroke-[1.6] text-neutral-600 transition-transform group-hover:translate-x-0.5 group-hover:text-text"
            >
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}

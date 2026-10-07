"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import "./landing.css";

/**
 * 로그인 화면 회원가입 줄 아래에 띄우는 새 기능 소개. 항목을 늘리거나 바꿀 때는 이 목록만 고친다.
 * 눌러 봤자 로그인이 먼저라 링크 없이 알림만 한다(사용자 요청).
 */
const PROMOS = [
  {
    id: "order-roast",
    tag: "NEW",
    title: "AI 무신사 주문내역 훈수 OPEN!",
    description: "무신사 주문내역을 복사해 붙여 넣으면, 그동안 산 옷을 훑어보고 훈수를 둡니다.",
  },
  {
    id: "order-import",
    tag: "NEW",
    title: "무신사에서 산 옷, 한 번에 옷장으로",
    description: "주문내역을 붙여 넣으면 산 옷들이 한꺼번에 옷장에 추가됩니다.",
  },
];

/** 다음 배너로 넘어가는 간격(ms) */
const INTERVAL = 5000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** 배너가 둘 이상이면 5초마다 지금 배너를 왼쪽으로 밀어내며 다음 배너가 들어온다. 마우스를 올리거나 키보드로 들어오면 멈춘다. */
export function PromoBanner() {
  const [index, setIndex] = useState(0);
  // 밀려 나가는 중인 배너. 다 나가면(animationend) 지운다.
  const [leaving, setLeaving] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const rotating = PROMOS.length > 1 && !paused && !reduced;

  const go = (next: number) => {
    if (next === index) return;
    // 움직임 줄이기면 밀어내기 없이 바로 바꾼다.
    if (!reduced) setLeaving(index);
    setIndex(next);
  };

  useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(() => {
      setLeaving(index);
      setIndex((index + 1) % PROMOS.length);
    }, INTERVAL);
    return () => clearTimeout(timer);
  }, [rotating, index]);

  return (
    <section
      aria-label="새 기능 소개"
      aria-roledescription="carousel"
      className="lp-rise flex w-full max-w-95 flex-col gap-2.5"
      style={{ "--rise": "200ms" } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* 모든 배너를 한 칸에 겹쳐 두어 가장 긴 배너 높이로 고정한다(바뀔 때 아래가 흔들리지 않게). */}
      <div className="grid overflow-hidden rounded-md">
        {PROMOS.map((promo, i) => {
          const state = i === index ? "current" : i === leaving ? "leaving" : "idle";
          return (
            <div
              key={promo.id}
              aria-hidden={state !== "current"}
              data-state={state}
              data-moved={leaving !== null || undefined}
              onAnimationEnd={state === "leaving" ? () => setLeaving(null) : undefined}
              className="pb-slide col-start-1 row-start-1 flex items-center gap-3 rounded-md border border-neutral-300 bg-bg px-4 py-3.5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="tag tag-accent shrink-0">{promo.tag}</span>
                  <span className="truncate text-md font-semibold">{promo.title}</span>
                </span>
                <span className="text-sm text-pretty text-neutral-700">{promo.description}</span>
              </span>
            </div>
          );
        })}
      </div>

      {PROMOS.length > 1 && (
        <div className="flex justify-center gap-0">
          {PROMOS.map((promo, i) => (
            <button
              key={promo.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1}번째 소개 보기: ${promo.title}`}
              aria-current={i === index}
              className="grid h-6 min-w-6 place-items-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-[width,background-color] ${i === index ? "w-4 bg-text" : "w-1.5 bg-neutral-400 hover:bg-neutral-600"}`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

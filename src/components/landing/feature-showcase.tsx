"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/** 미리보기 조각이 움직이기 시작하는 시각(초). landing.css의 애니메이션이 --d만큼 기다린다. */
const at = (seconds: number, extra?: Record<string, string>) =>
  ({ "--d": `${seconds}s`, ...extra }) as CSSProperties;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

type Feature = {
  id: string;
  label: string;
  title: string;
  body: string;
  /** 자동 넘김일 때 이 기능에 머무는 시간(초). 미리보기가 끝나고 잠깐 멈춰 있을 만큼 둔다. */
  seconds: number;
  icon: ReactNode;
  Demo: () => ReactNode;
};

/** 첫 화면 왼쪽의 대표 기능 소개. 탭을 누르거나 자동으로 넘기며 각 기능의 예시 화면을 움직여 보여 준다. */
export function FeatureShowcase({ style }: { style?: CSSProperties }) {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  // 같은 탭이라도 다시 고르면 미리보기를 처음부터 다시 움직이려고 key로 쓴다.
  const [run, setRun] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const cycling = autoplay && !reduced;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const show = (index: number) => {
    setActive(index);
    setRun((r) => r + 1);
  };
  // 사람이 직접 고르면 자동 넘김을 멈춘다.
  const choose = (index: number) => {
    setAutoplay(false);
    show(index);
  };
  const toggleAutoplay = () => {
    if (!autoplay) setRun((r) => r + 1);
    setAutoplay(!autoplay);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = FEATURES.length - 1;
    const target =
      event.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (target < 0) return;
    event.preventDefault();
    choose(target);
    tabRefs.current[target]?.focus();
  };

  return (
    <div
      ref={rootRef}
      style={style}
      data-offscreen={onScreen ? undefined : ""}
      className="fs lp-rise flex max-w-130 flex-col"
    >
      <div className="flex items-stretch gap-2 border-b border-neutral-300">
        <div
          role="tablist"
          aria-label="대표 기능"
          onKeyDown={onTabKeyDown}
          className="grid flex-1 grid-cols-3"
        >
          {FEATURES.map((feature, index) => {
            const selected = index === active;
            return (
              <button
                key={feature.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                id={`fs-tab-${feature.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`fs-panel-${feature.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(index)}
                className={`relative flex items-center gap-1.5 pt-1 pb-3 text-left text-[15px] font-medium transition-colors ${
                  selected ? "text-text" : "text-neutral-600 hover:text-text"
                }`}
              >
                <span
                  aria-hidden
                  className={selected ? "text-accent-700" : undefined}
                >
                  {feature.icon}
                </span>
                {feature.label}
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-px h-0.5 overflow-hidden"
                >
                  {selected &&
                    (cycling ? (
                      <span
                        key={`${active}-${run}`}
                        className="fs-progress block h-full bg-text"
                        style={{ animationDuration: `${feature.seconds}s` }}
                        onAnimationEnd={() =>
                          show((active + 1) % FEATURES.length)
                        }
                      />
                    ) : (
                      <span className="block h-full bg-text" />
                    ))}
                </span>
              </button>
            );
          })}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={toggleAutoplay}
            aria-label={
              autoplay
                ? "기능 소개 자동 넘김 멈추기"
                : "기능 소개 자동 넘김 켜기"
            }
            title={autoplay ? "자동 넘김 멈추기" : "자동 넘김 켜기"}
            className="mb-2 grid size-7 shrink-0 place-items-center self-center rounded-sm text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-text"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5 fill-current"
            >
              {autoplay ? (
                <path d="M4 3h3v10H4zM9 3h3v10H9z" />
              ) : (
                <path d="M4.5 2.5v11l9-5.5z" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* 예시 화면은 눈으로 보는 그림이다. 같은 내용을 아래 글로 설명한다. */}
      <div aria-hidden className="mt-4 grid">
        {FEATURES.map((feature, index) => (
          <div
            key={feature.id}
            data-active={index === active}
            className="fs-card col-start-1 row-start-1"
          >
            <feature.Demo key={index === active ? run : "rest"} />
          </div>
        ))}
      </div>

      <div className="mt-5 grid">
        {FEATURES.map((feature, index) => {
          const selected = index === active;
          return (
            <div
              key={feature.id}
              id={`fs-panel-${feature.id}`}
              role="tabpanel"
              aria-labelledby={`fs-tab-${feature.id}`}
              tabIndex={selected ? 0 : -1}
              data-active={selected}
              className="fs-copy col-start-1 row-start-1"
            >
              <div
                key={selected ? run : "rest"}
                className="fs-in flex flex-col gap-1.5"
              >
                <h2 className="text-lg font-semibold tracking-[-0.01em]">
                  {feature.title}
                </h2>
                <p className="text-base leading-relaxed text-pretty text-neutral-700">
                  {feature.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* — 예시 화면 — */

function DemoFrame({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-md border border-neutral-300 bg-surface">
      <div className="flex items-center justify-between border-b border-neutral-300 px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        {note && <span className="text-xs text-neutral-600">{note}</span>}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

const TOP_PATH =
  "M8.6 3 4.8 4.6 2 9.2l2.9 1.9.9-1.1V21h12.4V10l.9 1.1L22 9.2l-2.8-4.6L15.4 3c-.5 1.4-1.8 2.2-3.4 2.2S9.1 4.4 8.6 3Z";
const BOTTOM_PATH = "M6 3h12l1.2 18h-4.6L12 10.2 9.4 21H4.8L6 3Z";

function Garment({
  shape,
  color,
  className = "size-5",
}: {
  shape: "top" | "bottom";
  color: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d={shape === "top" ? TOP_PATH : BOTTOM_PATH} fill={color} />
    </svg>
  );
}

const LINK = "musinsa.com/products/4012573";

function WardrobeDemo() {
  return (
    <DemoFrame title="내 옷장" note="링크로 추가">
      <div className="flex items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-neutral-300 bg-bg px-2.5">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-3.5 shrink-0 fill-none stroke-neutral-600 stroke-2"
          >
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
          <span className="flex min-w-0 items-center overflow-hidden">
            <span
              className="fs-type overflow-hidden font-mono text-xs whitespace-nowrap"
              style={at(0.4, { "--n": String(LINK.length) })}
            >
              {LINK}
            </span>
            <span className="fs-caret ml-px h-3.5 w-px shrink-0 bg-text" />
          </span>
        </div>
        <span
          className="fs-press grid h-9 shrink-0 place-items-center rounded-sm bg-text px-3.5 text-sm font-medium text-bg"
          style={at(1.95)}
        >
          분석
        </span>
      </div>

      {/* 새 줄이 끼어들어도 카드 높이가 변하지 않게, 다 채워진 목록을 안 보이게 깔아 자리를 잡아 둔다. */}
      <div className="mt-3 grid">
        <WardrobeList className="fs-still invisible col-start-1 row-start-1" />
        <WardrobeList className="col-start-1 row-start-1" />
      </div>
    </DemoFrame>
  );
}

function WardrobeList({ className }: { className: string }) {
  return (
    <ul className={`flex flex-col ${className}`}>
      <li className="fs-grow" style={at(2.25)}>
        <div>
          <div
            className="fs-flash -mx-2 flex items-start gap-3 rounded-sm px-2 py-2.5"
            style={at(2.25)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xs bg-bg">
              <Garment shape="top" color="#7b7650" className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">워크 자켓</span>
                <span className="shrink-0 text-xs text-neutral-600">
                  아우터 · M · 카키
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  ["총장", "68"],
                  ["어깨", "50"],
                  ["가슴", "61"],
                  ["소매", "62"],
                ].map(([part, cm], i) => (
                  <span
                    key={part}
                    className="fs-pop rounded-xs border border-neutral-300 px-1.5 py-px text-2xs text-neutral-700 tabular-nums"
                    style={at(2.6 + i * 0.12)}
                  >
                    {part} {cm}
                  </span>
                ))}
              </div>
              <p
                className="fs-in mt-1.5 text-xs text-neutral-600"
                style={at(3.3)}
              >
                메모 · 어깨 딱 맞음, 소매 살짝 김
              </p>
            </div>
          </div>
        </div>
      </li>
      {[
        {
          name: "옥스퍼드 셔츠",
          meta: "셔츠 · L · 하늘색",
          shape: "top" as const,
          color: "#a7bfd8",
        },
        {
          name: "와이드 데님",
          meta: "바지 · 32 · 진청",
          shape: "bottom" as const,
          color: "#34465f",
        },
      ].map((item) => (
        <li
          key={item.name}
          className="flex items-center gap-3 border-t border-neutral-300 py-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xs bg-bg">
            <Garment shape={item.shape} color={item.color} className="size-6" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
          <span className="shrink-0 text-xs text-neutral-600">{item.meta}</span>
        </li>
      ))}
    </ul>
  );
}

/** 예시 비교. 실제 데이터가 아니라 구매 판단기가 무엇을 보여 주는지 설명하는 용도다. */
const SIZE_ROWS = [
  { part: "총장", mine: 70, next: 72 },
  { part: "어깨", mine: 46, next: 46.5 },
  { part: "가슴", mine: 58, next: 59 },
  { part: "소매", mine: 63, next: 63.5 },
];
/** 막대 한쪽 끝이 나타내는 차이(cm) */
const SIZE_SCALE = 2.5;

function FitCheckDemo() {
  return (
    <DemoFrame title="구매 판단기" note="cm">
      <p className="fs-in text-sm" style={at(0.1)}>
        <span className="text-neutral-600">내 자켓 M</span>
        <span className="px-1.5 text-neutral-500">와</span>
        <span className="font-semibold">새 자켓 48</span>
        <span className="pl-1.5 text-neutral-500">비교</span>
      </p>
      <div className="mt-3 grid grid-cols-[2.25rem_2.75rem_2.75rem_minmax(0,1fr)] items-center gap-x-2 border-b border-divider pb-1.5 text-label text-neutral-600">
        <span />
        <span className="text-right">내 옷</span>
        <span className="text-right">새 옷</span>
        <span className="grid grid-cols-2 pr-11">
          <span className="pr-1.5 text-right">작게</span>
          <span className="border-l border-neutral-400 pl-1.5">크게</span>
        </span>
      </div>
      {SIZE_ROWS.map((row, i) => {
        const diff = row.next - row.mine;
        const standout = Math.abs(diff) >= 1.5;
        const width = `${(Math.min(Math.abs(diff), SIZE_SCALE) / SIZE_SCALE) * 50}%`;
        return (
          <div
            key={row.part}
            className="fs-in grid grid-cols-[2.25rem_2.75rem_2.75rem_minmax(0,1fr)] items-center gap-x-2 border-b border-neutral-300 py-2 text-sm tabular-nums"
            style={at(0.3 + i * 0.12)}
          >
            <span className="text-neutral-700">{row.part}</span>
            <span className="text-right font-mono text-neutral-600">
              {row.mine.toFixed(1)}
            </span>
            <span
              className={`text-right font-mono ${standout ? "font-medium text-accent-700" : ""}`}
            >
              {row.next.toFixed(1)}
            </span>
            <span className="flex items-center gap-2">
              <span className="relative h-2 flex-1">
                <span className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-neutral-400" />
                <span
                  className={`fs-bar absolute inset-y-0 rounded-r-xs ${standout ? "bg-accent" : "bg-neutral-400"}`}
                  style={{
                    ...at(0.85 + i * 0.12),
                    ...(diff >= 0 ? { left: "50%" } : { right: "50%" }),
                    width,
                  }}
                />
              </span>
              <span
                className={`fs-in w-9 text-right font-mono text-xs ${standout ? "font-medium text-accent-700" : "text-neutral-600"}`}
                style={at(1.1 + i * 0.12)}
              >
                {diff > 0 ? "+" : ""}
                {diff.toFixed(1)}
              </span>
            </span>
          </div>
        );
      })}
      <p
        className="fs-in mt-3 text-sm leading-relaxed text-pretty text-neutral-800"
        style={at(1.9)}
      >
        어깨·가슴은 평소 입던 자켓과 비슷하고, 총장은 2cm 길게 느껴질 수
        있습니다.
      </p>
    </DemoFrame>
  );
}

const BUBBLE =
  "max-w-[88%] rounded-md rounded-tl-xs bg-neutral-200 px-3 py-2 text-sm leading-relaxed";
const ANSWERS = [
  "짱구 맞음. 같은 옷만 입음",
  "좋아서 여러 벌 삼",
  "빨래 돌리는 사이에 입으려고",
];
const PICKED = 2;

function RoastDemo() {
  return (
    <DemoFrame title="내 패션 훈수">
      <div className="flex flex-col items-start gap-2">
        <div className={`fs-in ${BUBBLE}`} style={at(0.2)}>
          <span className="mb-1 flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <Garment
                key={i}
                shape="top"
                color="var(--n-700)"
                className="size-6"
              />
            ))}
          </span>
          3벌이 전부 같은 옷입니다. 진지하게 하나만 묻겠습니다.
        </div>
        <div className={`fs-in ${BUBBLE} font-semibold`} style={at(0.95)}>
          혹시 짱구세요?
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 self-stretch pt-1">
          {ANSWERS.map((answer, i) => (
            <span key={answer} className="fs-pop" style={at(1.5 + i * 0.1)}>
              <span
                className={`block rounded-full border px-3 py-1 text-xs ${
                  i === PICKED
                    ? "fs-select border-text bg-text text-bg"
                    : "fs-dim border-neutral-300 bg-surface opacity-40"
                }`}
                style={at(2.6)}
              >
                {answer}
              </span>
            </span>
          ))}
        </div>
        <div className="grid self-stretch">
          <span
            className="fs-blip col-start-1 row-start-1 inline-flex h-8 items-center gap-1 justify-self-start rounded-md rounded-tl-xs bg-neutral-200 px-3"
            style={at(3.0)}
          >
            <span className="fs-dot size-1.5 rounded-full bg-neutral-600" />
            <span className="fs-dot size-1.5 rounded-full bg-neutral-600" />
            <span className="fs-dot size-1.5 rounded-full bg-neutral-600" />
          </span>
          <div
            className={`fs-in col-start-1 row-start-1 justify-self-start ${BUBBLE}`}
            style={at(3.75)}
          >
            빨래 로테이션까지 계산하셨군요. 옷장이 아니라 교대 근무표입니다.
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 fill-none stroke-current"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const FEATURES: Feature[] = [
  {
    id: "wardrobe",
    label: "옷장 관리",
    title: "가진 옷을 한곳에 정리합니다",
    body: "상품 링크를 붙여 넣으면 브랜드, 사이즈표, 색이 알아서 채워집니다. 직접 잰 치수나 입어 본 느낌도 같이 적어 둘 수 있고, 무신사 주문내역을 복사해 붙여 넣으면 산 옷을 한 번에 불러옵니다.",
    seconds: 7,
    icon: (
      <Icon>
        <path d="M9.6 6.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4V11m0 0-8.6 6c-.8.6-.4 1.9.6 1.9h16c1 0 1.4-1.3.6-1.9L12 11Z" />
      </Icon>
    ),
    Demo: WardrobeDemo,
  },
  {
    id: "fit-check",
    label: "구매 판단",
    title: "사기 전에 내 옷과 대 봅니다",
    body: "사려는 옷의 링크를 넣고 사이즈를 고르면, 옷장에서 비슷한 옷을 찾아 총장, 어깨, 가슴, 소매를 하나씩 비교합니다. 어디가 몇 cm 크고 작은지 보고 사이즈를 정하면 됩니다.",
    seconds: 6.5,
    icon: (
      <Icon>
        <rect x="2.5" y="7.5" width="19" height="9" rx="1.2" />
        <path d="M6.5 7.5v3M10 7.5v4.5M13.5 7.5v3M17 7.5v4.5" />
      </Icon>
    ),
    Demo: FitCheckDemo,
  },
  {
    id: "roast",
    label: "패션 훈수",
    title: "옷 사는 습관에 훈수를 둡니다",
    body: "옷장을 훑어본 뒤 몇 가지 질문을 하고, 브랜드가 한쪽에 몰렸는지, 같은 옷을 또 샀는지, 언제 옷값을 많이 썼는지 짚어 줍니다. 말투가 꽤 직설적입니다.",
    seconds: 8,
    icon: (
      <Icon>
        <path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5v-3.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
        <path d="M8.5 10.5h7M8.5 13h4" />
      </Icon>
    ),
    Demo: RoastDemo,
  },
];

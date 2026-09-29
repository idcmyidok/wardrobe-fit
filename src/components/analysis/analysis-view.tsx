"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { priceInKrw } from "@/lib/format/price";
import { cn } from "@/lib/cn";
import {
  brandSummary,
  man,
  won,
  colorSummary,
  monthlySummary,
  priceSummary,
  recommendations,
  seasonSummary,
  type CategoryTab,
  type DonutSlice,
} from "./wardrobe-analysis";

const TABS: { id: CategoryTab; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "outer", label: "아우터" },
  { id: "top", label: "상의" },
  { id: "bottom", label: "하의" },
  { id: "hat", label: "모자" },
  { id: "shoes", label: "신발" },
];

const section =
  "grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-12 gap-y-8 border-b border-text py-9";
const sectionTitle = "text-body font-semibold";
const colLabel = "font-mono text-label font-medium tracking-[0.08em] text-neutral-700";

export function AnalysisView() {
  const { garments: owned, usdRate } = useWardrobe();
  // 달러로 기록한 옷은 환율로 원으로 바꿔 금액에 함께 넣는다.
  const garments = useMemo(
    () => owned.map((g) => (g.currency === "USD" ? { ...g, purchasePrice: priceInKrw(g.purchasePrice, g.currency, usdRate), currency: "KRW" as const } : g)),
    [owned, usdRate],
  );
  const [brandTab, setBrandTab] = useState<CategoryTab>("all");
  const [colorTab, setColorTab] = useState<CategoryTab>("all");

  const price = priceSummary(garments);
  const monthly = monthlySummary(garments);
  const [month, setMonth] = useState<string | null>(null);
  const picked = monthly.bars.find((b) => b.key === month) ?? null;
  const brands = brandSummary(garments, brandTab);
  const colors = colorSummary(garments, colorTab);
  const seasons = seasonSummary(garments);
  const recs = recommendations(garments, seasons.least);

  return (
    <main className="mx-auto max-w-320 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-text pb-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-label font-medium tracking-[0.08em] text-neutral-700 uppercase">
            Wardrobe report · 2026.09.27
          </span>
          <h1 className="text-title">옷장 분석</h1>
        </div>
        <span className="text-sm text-neutral-700">{garments.length}벌 기준 · 구매가·구매일이 있는 옷만 금액에 포함</span>
      </div>

      {/* 가격 */}
      <section className={section} aria-labelledby="an-price">
        <div className="flex flex-col gap-3.5">
          <span id="an-price" className={sectionTitle}>
            옷장 총 가격
          </span>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-display text-total tracking-[-0.03em]">{price.totalShort}</span>
            <span className="text-lg">￦</span>
          </div>
          <div className="flex flex-col gap-1 font-mono text-sm text-neutral-700">
            <span>{price.totalFull}</span>
            <span>{price.recentFull}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1 rounded-md bg-accent-100 px-4 py-3.5">
            <span className="text-lg font-semibold text-accent-800">{price.tierTitle}</span>
            <span className="text-base text-pretty text-neutral-800">{price.tierBody}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3.5 md:col-span-2">
          <span className={colLabel}>분류별 금액</span>
          <div className="flex h-3.5 overflow-hidden rounded-sm bg-neutral-200" role="img" aria-label="분류별 금액 비율">
            {price.cats.map((c) => (
              <div key={c.id} title={c.label} style={{ width: c.width, background: c.fill }} />
            ))}
          </div>
          <div className="flex flex-col">
            {price.cats.map((c) => (
              <div key={c.id} className="grid grid-cols-[14px_72px_minmax(0,1fr)_auto_56px] items-center gap-3 border-b border-neutral-300 py-3">
                <span className="size-2.5 rounded-xs" style={{ background: c.fill }} />
                <span className="text-body font-semibold">{c.label}</span>
                <span className="text-sm text-neutral-700">{c.meta}</span>
                <span className="text-right font-mono text-body tabular-nums">{c.amount}</span>
                <span className="text-right font-mono text-sm text-neutral-700">{c.pct}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-6 gap-y-3 text-base">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-neutral-700">한 벌 평균</span>
              <span className="font-mono text-md">{price.avg}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-neutral-700">가장 비싼 옷</span>
              <span>{price.topItem}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 월별 구매 */}
      <section className={section} aria-labelledby="an-month">
        <div className="flex min-w-0 flex-col gap-3.5 md:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span id="an-month" className={sectionTitle}>
              월별 구매 금액
            </span>
            <span className="text-xs text-neutral-700">막대를 누르면 그 달을 볼 수 있어요</span>
          </div>
          <MonthChart bars={monthly.bars} selected={month} onSelect={setMonth} />
        </div>
        {picked ? (
          <div className="relative flex flex-col justify-center gap-2.5 self-center rounded-lg border border-neutral-300 bg-neutral-100 px-5 py-4.5">
            <button
              type="button"
              aria-label="닫고 가장 많이 구매한 달 보기"
              onClick={() => setMonth(null)}
              className="absolute top-2 right-2 grid size-7 place-items-center rounded-md text-neutral-700 hover:bg-neutral-200 hover:text-text"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <span className={colLabel}>선택한 달</span>
            <MonthDetail detail={picked.detail} />
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-2.5">
            <span className={colLabel}>가장 많이 구매한 달</span>
            <MonthDetail detail={monthly.top} />
            <div className="mt-2 flex flex-col gap-0.5 border-t border-neutral-300 pt-3 text-sm text-neutral-700">
              <span>{monthly.span}</span>
              <span>{monthly.average}</span>
            </div>
          </div>
        )}
      </section>

      {/* 브랜드 */}
      <DonutSection
        title="브랜드 분석"
        name="anbtab"
        tab={brandTab}
        onTab={setBrandTab}
        message={brands.message}
        slices={brands.slices}
        total={brands.total}
        totalLabel={brands.totalLabel}
        chartLabel="브랜드 비율 도넛 그래프"
        limit={10}
        nameHeader="브랜드"
        withAmount
      />

      {/* 컬러 */}
      <DonutSection
        title="컬러 분석"
        name="antab"
        tab={colorTab}
        onTab={setColorTab}
        message={colors.message}
        slices={colors.slices}
        total={colors.total}
        totalLabel={colors.totalLabel}
        chartLabel="컬러 비율 도넛 그래프"
        nameHeader="컬러"
        swatchOutline
      />

      {/* 시즌 */}
      <section className={section} aria-labelledby="an-season">
        <div className="flex flex-col gap-2.5">
          <span id="an-season" className={sectionTitle}>
            시즌별 옷
          </span>
          <p className="text-lg leading-normal text-pretty">{seasons.message}</p>
          <span className="text-sm text-neutral-700">여러 시즌에 입는 옷은 시즌마다 한 벌로 셉니다.</span>
        </div>
        <div className="grid min-w-0 grid-cols-4 items-end gap-4 md:col-span-2">
          {seasons.bars.map((x) => (
            <div key={x.id} className="flex flex-col gap-2">
              <div className="flex h-45 items-end border-b border-text">
                <div
                  className={cn("flex w-full justify-center rounded-t-sm pt-2", x.isLeast ? "bg-accent-200" : "bg-neutral-300")}
                  style={{ height: x.height }}
                >
                  <span className={cn("font-display text-[32px] leading-none", x.isLeast ? "text-accent-800" : "text-text")}>
                    {x.count}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-body font-semibold">{x.label}</span>
                <span className="font-mono text-xs text-neutral-700">{x.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 추천 */}
      <section className="flex flex-col gap-4 py-9" aria-labelledby="an-rec">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span id="an-rec" className={sectionTitle}>
            지금 필요한 옷
          </span>
          <span className="text-xs text-neutral-700">종류별 기본 구성 대비 부족한 순</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          {recs.map((r) => (
            <div key={r.label} className="flex flex-col gap-2 border-b border-neutral-300 py-5 pr-5">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-display">{r.rank}</span>
                <span className="text-xs text-neutral-700">{r.category}</span>
              </div>
              <span className="text-lg font-semibold">{r.label}</span>
              <div className="flex gap-0.75" aria-hidden>
                {r.dots.map((filled, i) => (
                  <span key={i} className={cn("h-1.5 w-4.5 rounded-xs", filled ? "bg-text" : "bg-neutral-300")} />
                ))}
              </div>
              <span className="font-mono text-sm text-neutral-700">{r.have}</span>
              <span className="text-base text-pretty text-neutral-800">{r.reason}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function MonthDetail({ detail }: { detail: ReturnType<typeof monthlySummary>["top"] }) {
  return (
    <>
      <span className="font-display text-display-lg">{detail.month}</span>
      <span className="font-mono text-md">{detail.amount}</span>
      <span className="text-base text-pretty text-neutral-800">{detail.note}</span>
    </>
  );
}

/**
 * 월별 막대. 구매한 달만 그린다. 마우스를 올리면 강조되고, 누르면 그 달을 옆에 보여 준다.
 * 가로로 길어지면 마우스로 끌어서 이동한다(휠 스크롤도 된다). 끌어서 옮긴 경우에는 클릭으로 치지 않는다.
 * 터치는 브라우저 기본 스크롤에 맡긴다. 직접 옮기면 iOS Safari에서 관성 없이 뻑뻑하다.
 */
function MonthChart({
  bars,
  selected,
  onSelect,
}: {
  bars: ReturnType<typeof monthlySummary>["bars"];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const moved = useRef(false);

  // 막대가 많아 가로 스크롤이 생기면 처음에는 최근 달(오른쪽 끝)을 보여준다.
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [bars.length]);

  return (
    <div
      ref={ref}
      className="overflow-x-auto overscroll-x-contain pb-1.5 select-none"
      onPointerDown={(e) => {
        moved.current = false;
        if (e.pointerType !== "mouse") return;
        if (ref.current) drag.current = { x: e.clientX, left: ref.current.scrollLeft };
      }}
      onPointerMove={(e) => {
        if (!ref.current || !drag.current) return;
        const dx = e.clientX - drag.current.x;
        if (Math.abs(dx) > 4) moved.current = true;
        ref.current.scrollLeft = drag.current.left - dx;
      }}
      onPointerUp={() => (drag.current = null)}
      onKeyDown={() => (moved.current = false)}
      onPointerLeave={() => (drag.current = null)}
    >
      <div className="flex h-65 min-w-max items-end gap-1.5 border-b border-text pt-6">
        {bars.map((m) => {
          const on = selected === m.key;
          return (
            <button
              key={m.key}
              type="button"
              title={m.title}
              aria-label={m.title}
              aria-pressed={on}
              onClick={() => !moved.current && onSelect(m.key)}
              className="group flex h-full w-11 flex-none cursor-pointer flex-col items-center justify-end gap-1 rounded-t-sm hover:bg-neutral-100"
            >
              <span
                className={cn(
                  "font-mono text-2xs whitespace-nowrap",
                  on ? "font-semibold text-text" : m.isTop ? "text-accent-700" : "text-neutral-700",
                )}
              >
                {m.short}
              </span>
              <span
                className={cn(
                  "block min-h-1 w-7 rounded-t-bar transition-[width,opacity] group-hover:w-8",
                  m.isTop ? "bg-accent" : "bg-text",
                  selected && !on && "opacity-35",
                )}
                style={{ height: m.height }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex min-w-max gap-1.5 pt-1.5">
        {bars.map((m) => (
          <div key={m.key} className="flex w-11 flex-none flex-col items-center font-mono">
            <span className={cn("text-label", selected === m.key && "font-semibold")}>{m.label}</span>
            <span className="min-h-3.5 text-2xs text-neutral-700">{m.year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 도넛 그래프 + 순위표. 조각이나 행에 마우스를 올리면 서로 강조되고 툴팁이 뜬다. */
function DonutSection({
  title,
  name,
  tab,
  onTab,
  message,
  slices,
  total,
  totalLabel,
  chartLabel,
  nameHeader,
  withAmount = false,
  swatchOutline = false,
  limit,
}: {
  title: string;
  name: string;
  tab: CategoryTab;
  onTab: (tab: CategoryTab) => void;
  message: string;
  slices: DonutSlice[];
  total: number;
  totalLabel: string;
  chartLabel: string;
  nameHeader: string;
  withAmount?: boolean;
  swatchOutline?: boolean;
  /** 순위표에 처음 보여 줄 행 수. 넘으면 "더보기"로 펼친다. */
  limit?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const rows = limit && !expanded ? slices.slice(0, limit) : slices;

  const hoverAt = (i: number, e?: React.MouseEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return setHover({ i, x: 0, y: 0 });
    setHover({ i, x: e ? e.clientX - rect.left : rect.width / 2 + 60, y: e ? e.clientY - rect.top : rect.height / 2 });
  };
  const tip = hover ? slices[hover.i] : null;
  const swatch = cn("size-3 rounded-bar", swatchOutline && "shadow-[inset_0_0_0_1px_var(--n-400)]");
  const cols = withAmount ? "grid-cols-[28px_14px_minmax(0,1fr)_40px_52px_96px]" : "grid-cols-[28px_14px_minmax(0,1fr)_48px_56px]";

  return (
    <section className={section} aria-label={title}>
      <div className="col-span-full flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={sectionTitle}>{title}</span>
          <div className="seg" role="radiogroup" aria-label={`${title} 범위`}>
            {TABS.map((t) => (
              <label key={t.id} className="seg-opt px-3.5 py-1.5">
                <input
                  type="radio"
                  name={name}
                  checked={tab === t.id}
                  onChange={() => {
                    onTab(t.id);
                    setHover(null);
                    setExpanded(false);
                  }}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <p className="max-w-190 text-quote leading-[1.45] text-pretty">{message}</p>
      </div>

      <div ref={box} className="relative flex items-center justify-center">
        <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label={chartLabel}>
          <circle cx="120" cy="120" r="80" fill="none" stroke="var(--n-200)" strokeWidth="34" />
          <g transform="rotate(-90 120 120)">
            {slices.map((s, i) => (
              <circle
                key={s.name}
                cx="120"
                cy="120"
                r="80"
                fill="none"
                stroke={s.color}
                strokeWidth={hover?.i === i ? 40 : 34}
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
                onMouseEnter={(e) => hoverAt(i, e)}
                onMouseMove={(e) => hoverAt(i, e)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-[stroke-width]"
              />
            ))}
          </g>
          {swatchOutline && (
            <>
              <circle cx="120" cy="120" r="97" fill="none" stroke="var(--n-300)" strokeWidth="1" />
              <circle cx="120" cy="120" r="63" fill="none" stroke="var(--n-300)" strokeWidth="1" />
            </>
          )}
          <text x="120" y="116" textAnchor="middle" className="fill-text font-display text-[40px]">
            {total}
          </text>
          <text x="120" y="140" textAnchor="middle" className="fill-neutral-700 font-mono text-label">
            {totalLabel}
          </text>
        </svg>
        {tip && hover && (
          <div
            role="tooltip"
            className="elev-md pointer-events-none absolute z-2 flex min-w-30 translate-x-3 -translate-y-1/2 flex-col gap-0.5 rounded-md border border-neutral-300 bg-bg px-2.5 py-2"
            style={{ left: hover.x, top: hover.y }}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn(swatch, "size-2.5 rounded-xs")} style={{ background: tip.color }} />
              <span className="text-sm font-semibold">{tip.name}</span>
            </div>
            <span className="font-mono text-xs text-neutral-800">
              {tip.count}벌 · {tip.pct}
            </span>
            {withAmount && (
              <span className="font-mono text-xs text-neutral-700">{tip.amount ? won(tip.amount) : "구매가 미입력"}</span>
            )}
            {tip.members && !(tip.members.length === 1 && tip.members[0].name === tip.name) && (
              <ul className="mt-1 flex flex-col gap-0.5 border-t border-neutral-300 pt-1.5">
                {tip.members.map((m) => (
                  <li key={m.name} className="flex justify-between gap-4 text-xs">
                    <span>{m.name}</span>
                    <span className="font-mono text-neutral-800">{m.count}벌</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col md:col-span-2">
        <div className={cn("grid gap-2.5 border-b border-text py-2", cols, colLabel)}>
          <span>순위</span>
          <span />
          <span>{nameHeader}</span>
          <span className="text-right">벌</span>
          <span className="text-right">비율</span>
          {withAmount && <span className="text-right">금액</span>}
        </div>
        {rows.map((s, i) => (
          <div
            key={s.name}
            onMouseEnter={() => hoverAt(i)}
            onMouseLeave={() => setHover(null)}
            className={cn("grid items-center gap-2.5 border-b border-neutral-300 py-2.5", cols, hover?.i === i && "bg-neutral-100")}
          >
            <span className="font-mono text-xs text-neutral-700">{String(i + 1).padStart(2, "0")}</span>
            <span className={swatch} style={{ background: s.color }} />
            <span className={cn("text-base", withAmount && "font-medium")}>{s.name}</span>
            <span className="text-right font-mono text-sm">{s.count}</span>
            <span className="text-right font-mono text-sm text-neutral-700">{s.pct}</span>
            {withAmount && (
              <span className="text-right font-mono text-sm">{s.amount ? `${man(s.amount)}원` : "—"}</span>
            )}
          </div>
        ))}
        {limit && slices.length > limit && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="self-start py-3 text-sm font-medium text-neutral-800 underline-offset-4 hover:underline"
          >
            {expanded ? "접기" : `더보기 (${slices.length - limit}개 더)`}
          </button>
        )}
      </div>
    </section>
  );
}

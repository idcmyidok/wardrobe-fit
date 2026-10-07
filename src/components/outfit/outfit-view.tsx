"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { buttonClassName, Button } from "@/components/ui/button";
import { GarmentThumbnail } from "@/components/wardrobe/garment-thumbnail";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import { SEASON_NAME } from "@/lib/constants/seasons";
import { fitsSeason, localDateKey, recommendOutfit, seasonOfDate, type OutfitItem } from "@/lib/outfit/recommend";
import type { Garment } from "@/lib/types/domain";

const noop = () => () => {};

/** 오늘 날짜는 기기 시간대로 정한다. 서버 렌더링 때는 아직 모르므로 null */
function useToday(): string | null {
  return useSyncExternalStore(noop, () => localDateKey(new Date()), () => null);
}

export function OutfitView() {
  const { garments } = useWardrobe();
  const today = useToday();
  const [variant, setVariant] = useState(0);

  return (
    <main className="mx-auto max-w-320 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-divider pb-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-label font-medium tracking-[0.08em] text-neutral-700 uppercase">
            Today&apos;s outfit{today && ` · ${today.replaceAll("-", ".")} · ${SEASON_NAME[seasonOfDate(today)]}`}
          </span>
          <h1 className="text-title">오늘의 코디 추천</h1>
        </div>
      </div>
      {today && <Recommendation garments={garments} today={today} variant={variant} onNext={() => setVariant((v) => v + 1)} />}
    </main>
  );
}

function Recommendation({ garments, today, variant, onNext }: { garments: Garment[]; today: string; variant: number; onNext: () => void }) {
  const result = recommendOutfit(garments, today, variant);
  const season = SEASON_NAME[result.season];

  if (!result.ok) {
    const missing = result.missing.map((c) => CATEGORY_NAME[c]).join("와 ");
    return (
      <section className="mt-8 flex flex-col items-start gap-3 rounded-md bg-neutral-100 px-5 py-6" aria-live="polite">
        <p className="text-lg font-semibold">옷이 부족해서 코디를 추천할 수 없어요</p>
        <p className="text-base text-pretty text-neutral-800">
          {season}에 입을 {missing}가 옷장에 없어요. 상의와 하의가 한 벌씩은 있어야 추천할 수 있어요. 옷을 추가하거나 옷 정보에서 시즌을 확인해 주세요.
        </p>
        <Link href="/wardrobe/new" className={buttonClassName({ variant: "primary" })}>
          옷 추가하기
        </Link>
      </section>
    );
  }

  const lacking = (["hat", "shoes"] as const).filter((c) => !garments.some((g) => g.categoryId === c && fitsSeason(g, result.season)));

  return (
    <section className="mt-6 flex flex-col gap-4" aria-label="추천 코디">
      <p className="rounded-md bg-accent-100 px-4 py-3 text-base text-pretty text-neutral-800">
        AI가 옷장 정보로 고른 임시 추천이라 조합이 어색할 수 있어요. 참고용으로 봐 주세요.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-col gap-0.5 text-base text-neutral-800">
          <li>{season} 옷으로 골랐어요.</li>
          {result.reasons.map((r) => (
            <li key={r}>{r}.</li>
          ))}
        </ul>
        <Button onClick={onNext}>다른 조합 보기</Button>
      </div>
      <OutfitCards items={result.items} />
      {lacking.length > 0 && (
        <p className="text-sm text-neutral-700">
          {lacking.map((c) => CATEGORY_NAME[c]).join("·")}를 옷장에 추가하면 함께 추천해요.
        </p>
      )}
    </section>
  );
}

/** 고른 옷 카드를 가로로 늘어놓는다. 넘치면 가로 스크롤(터치는 밀기, 마우스는 끌기). */
function OutfitCards({ items }: { items: OutfitItem[] }) {
  const { openDrawer } = useWardrobe();
  const ref = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  return (
    <ul
      ref={ref}
      className="-mx-[clamp(16px,3vw,32px)] flex cursor-grab snap-x gap-3 overflow-x-auto px-[clamp(16px,3vw,32px)] pb-3 select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !ref.current) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 5) d.moved = true;
        ref.current.scrollLeft = d.left - dx;
      }}
      onPointerUp={() => {
        // 끌고 난 뒤의 클릭은 카드 열기로 치지 않는다(아래 onClickCapture).
        setTimeout(() => (drag.current = null));
      }}
      onPointerLeave={() => (drag.current = null)}
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {items.map(({ slot, garment: g }) => (
        <li key={g.id} className="w-40 shrink-0 snap-start sm:w-52">
          <button
            type="button"
            onClick={() => openDrawer(g.id)}
            className="flex w-full flex-col gap-2 text-left"
            aria-label={`${CATEGORY_NAME[slot]} ${g.brand} ${g.productName} 정보 열기`}
          >
            <GarmentThumbnail item={g} className="aspect-[4/5] h-auto rounded-md border border-neutral-300" />
            <span className="font-mono text-label font-medium tracking-[0.08em] text-neutral-700">{CATEGORY_NAME[slot]}</span>
            <span className="flex flex-col">
              {g.brand && <span className="text-sm text-neutral-700">{g.brand}</span>}
              <span className="line-clamp-2 text-base">{g.productName}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

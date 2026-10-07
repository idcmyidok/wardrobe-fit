"use client";

import { cn } from "@/lib/cn";

/**
 * 쇼핑몰 페이지에서 찾은 사진 목록. 누르면 그 사진을 옷 사진으로 고른다.
 * 받지 못했거나 아이콘처럼 작은 사진은 onBroken으로 알려 부모가 목록에서 뺀다.
 */
export function PageImageGrid({
  images,
  selected,
  onSelect,
  onBroken,
}: {
  images: Array<{ src: string; i: number }>;
  /** 고른 사진의 i. 없으면 -1 */
  selected: number;
  onSelect: (i: number) => void;
  onBroken: (i: number) => void;
}) {
  if (!images.length) return null;
  return (
    <>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold">페이지 사진 {images.length}장</span>
        <span className="text-label text-neutral-700">눌러서 고르기</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {images.map(({ src, i }, n) => {
          const isSelected = selected === i;
          return (
            <button
              key={src}
              type="button"
              aria-pressed={isSelected}
              aria-label={`페이지 사진 ${n + 1}${isSelected ? " (옷 사진으로 선택됨)" : ""}`}
              onClick={() => onSelect(i)}
              className={cn(
                "relative aspect-[4/5] cursor-pointer overflow-hidden rounded-sm bg-neutral-200 transition-opacity",
                isSelected ? "ring-2 ring-text ring-offset-2 ring-offset-bg" : "opacity-60 ring-1 ring-neutral-300 ring-inset hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 대신 받아 주는 미리보기 */}
              <img
                src={src}
                alt=""
                loading="lazy"
                className="size-full object-contain"
                onError={() => onBroken(i)}
                onLoad={(e) => {
                  if (Math.max(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight) < 150) onBroken(i);
                }}
              />
              {isSelected && (
                <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-text text-bg" aria-hidden>
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { buttonClassName } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants/categories";
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  applyFilters,
  clampPage,
  isFiltered,
  nextSort,
  parseWardrobeParams,
  sortGarments,
  toWardrobeSearch,
  uniqueValues,
  withFilters,
  type WardrobeFilters as Filters,
  type WardrobeState,
} from "./filter-state";
import { WardrobeFilters } from "./wardrobe-filters";
import { useOpenGarmentId, useWardrobe } from "./wardrobe-store";
import { WardrobeTable } from "./wardrobe-table";

const EMPTY_STEPS = [
  { title: "링크 붙여넣기", description: "상품 페이지에서 브랜드, 사이즈표, 컬러를 읽습니다." },
  { title: "구매한 사이즈 선택", description: "고른 사이즈의 실측이 채워지고, 직접 잰 값으로 고칠 수 있습니다." },
  { title: "착용 후기 쓰기", description: "\"총장이 조금 길다\" 같은 한 줄이 구매 판단의 근거가 됩니다." },
];

export function WardrobeView() {
  const { garments, openDrawer } = useWardrobe();
  const drawerId = useOpenGarmentId();
  const params = useSearchParams();
  // 필터·검색·정렬·페이지는 모두 URL에 둔다. 정렬과 페이지는 대분류 표마다 따로(기본은 최근 구매순, 1쪽).
  const state = useMemo(() => parseWardrobeParams(new URLSearchParams(params.toString())), [params]);
  const { filters, sorts, pages } = state;
  // 서버에 다시 묻지 않고 주소만 바꾼다. 검색어 입력처럼 잦은 변경은 기록을 쌓지 않는다(replace).
  const navigate = useCallback((next: WardrobeState, mode: "push" | "replace" = "push") => {
    const search = new URLSearchParams(toWardrobeSearch(next));
    // 열려 있는 옷 정보(?item=)는 그대로 둔다.
    const item = new URLSearchParams(window.location.search).get("item");
    if (item) search.set("item", item);
    const query = search.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);
  const setFilters = (next: Filters) => navigate(withFilters(state, next), next.q !== filters.q ? "replace" : "push");
  const options = useMemo(
    () => ({
      brands: uniqueValues(garments, (g) => g.brand),
      colors: uniqueValues(garments, (g) => g.colorName),
    }),
    [garments],
  );
  const items = useMemo(() => applyFilters(garments, filters), [garments, filters]);
  const empty = garments.length === 0;
  const filtered = isFiltered(filters) && !empty;
  const groups = CATEGORIES.filter((c) => filters.categories.includes(c.id))
    .map((category) => {
      const all = sortGarments(items.filter((item) => item.categoryId === category.id), sorts[category.id]);
      const page = clampPage(pages[category.id], all.length);
      return { ...category, total: all.length, page, items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
    })
    .filter((group) => group.total > 0);

  return (
    <main className="mx-auto max-w-400 px-[clamp(16px,3vw,32px)] pt-7 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-text pb-4">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="font-display text-count tracking-[-0.02em] tabular-nums">
            {filtered ? items.length : garments.length}
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl">내 옷장</h1>
            <span className="font-mono text-xs tracking-[0.02em] text-neutral-700 tabular-nums">
              {filtered ? `${items.length} / ${garments.length}벌` : `${garments.length}벌`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {empty ? (
            <button type="button" className={buttonClassName({ variant: "secondary" })} disabled>
              AI 구매 판단기
            </button>
          ) : (
            <Link href="/fit-check" className={buttonClassName({ variant: "secondary" })}>
              AI 구매 판단기
            </Link>
          )}
          <Link href="/wardrobe/new" className={buttonClassName({ variant: "primary" })}>
            + 새 옷 추가
          </Link>
        </div>
      </div>

      {empty ? (
        <>
          <div className="flex max-w-140 flex-col gap-3 pt-16 pb-8">
            <div className="font-mono text-xs font-medium tracking-[0.08em] text-accent-700">0벌</div>
            <h2 className="text-[28px]">아직 등록한 옷이 없습니다</h2>
            <p className="text-body text-pretty text-neutral-800">
              자주 입는 옷부터 등록하세요. 비교할 옷이 있어야 AI 구매 판단기를 쓸 수 있습니다. 같은 종류의 옷이 3벌
              이상이면 판단이 안정적입니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/wardrobe/new" className={buttonClassName({ variant: "primary" })}>
                상품 링크로 첫 옷 추가
              </Link>
              <Link href="/wardrobe/new?mode=manual" className={buttonClassName({ variant: "secondary" })}>
                직접 입력
              </Link>
            </div>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border-t border-text">
            {EMPTY_STEPS.map((step, i) => (
              <li key={step.title} className={i === 0 ? "border-b border-neutral-300 py-4 pr-4" : "border-b border-l border-b-neutral-300 border-l-divider p-4"}>
                <div className="font-mono text-sm font-semibold text-accent-700 tabular-nums">0{i + 1}</div>
                <div className="mt-1 text-body font-semibold">{step.title}</div>
                <div className="text-base text-neutral-700">{step.description}</div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <WardrobeFilters value={filters} onChange={setFilters} options={options} />

          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`} className="pt-6">
              <div className="flex items-baseline gap-2.5 pb-2">
                <h2 id={`group-${group.id}`} className="text-lg">
                  {group.name}
                </h2>
                <span className="font-mono text-base text-neutral-700 tabular-nums">{group.total}벌</span>
              </div>
              <WardrobeTable
                categoryId={group.id}
                items={group.items}
                sort={sorts[group.id]}
                onSort={(key) =>
                  navigate({
                    ...state,
                    sorts: { ...sorts, [group.id]: nextSort(sorts[group.id], key) },
                    pages: { ...pages, [group.id]: 1 },
                  })
                }
                selectedId={drawerId}
                onOpen={openDrawer}
              />
              {group.total > PAGE_SIZE && (
                <Pagination
                  label={group.name}
                  page={group.page}
                  total={group.total}
                  onPage={(page) => navigate({ ...state, pages: { ...pages, [group.id]: page } })}
                />
              )}
            </section>
          ))}

          {items.length === 0 && (
            <div className="flex max-w-110 flex-col items-start gap-2 py-16">
              <div className="text-lg font-semibold">
                {filters.q ? `‘${filters.q}’에 맞는 옷이 없습니다` : "조건에 맞는 옷이 없습니다"}
              </div>
              <div className="text-base text-neutral-700">
                검색어를 바꾸거나 필터를 초기화해 보세요.
              </div>
              <button
                type="button"
                className="btn btn-secondary mt-2"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                필터 초기화
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-between border-t border-text py-3 font-mono text-sm text-neutral-700 tabular-nums">
            <span>{filtered ? `${items.length} / ${garments.length}벌` : `${garments.length}벌`}</span>
            <span>행을 누르면 상세가 열립니다</span>
          </div>
        </>
      )}
    </main>
  );
}

/** 표 아래 페이지 이동. 한 표가 50벌을 넘을 때만 보인다. */
function Pagination({ label, page, total, onPage }: { label: string; page: number; total: number; onPage: (page: number) => void }) {
  const last = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label={`${label} 페이지`} className="flex items-center justify-end gap-3 pt-2 font-mono text-sm text-neutral-700 tabular-nums">
      <span>
        {from}–{to} / {total}
      </span>
      <button type="button" className="btn btn-ghost text-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        이전
      </button>
      <span aria-current="page">
        {page} / {last}
      </span>
      <button type="button" className="btn btn-ghost text-sm" disabled={page >= last} onClick={() => onPage(page + 1)}>
        다음
      </button>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CATEGORIES, COUNT_UNIT, SUBCATEGORIES } from "@/lib/constants/categories";
import { SEASONS } from "@/lib/constants/seasons";
import type { CategoryId } from "@/lib/types/domain";
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
import { WardrobeTable, type GarmentSelection, type WardrobeViewMode } from "./wardrobe-table";

const EMPTY_STEPS = [
  { title: "링크 붙여넣기", description: "상품 페이지에서 브랜드, 사이즈표, 컬러를 읽습니다." },
  { title: "구매한 사이즈 선택", description: "고른 사이즈의 실측이 채워지고, 직접 잰 값으로 고칠 수 있습니다." },
  { title: "착용 후기 쓰기", description: "\"총장이 조금 길다\" 같은 한 줄이 구매 판단의 근거가 됩니다." },
];

export function WardrobeView() {
  const { garments, openDrawer, removeGarments, usdRate } = useWardrobe();
  const drawerId = useOpenGarmentId();
  const params = useSearchParams();
  // 필터·검색·정렬·페이지는 모두 URL에 둔다. 정렬과 페이지는 대분류 표마다 따로(기본은 최근 구매순, 1쪽).
  const state = useMemo(() => parseWardrobeParams(new URLSearchParams(params.toString())), [params]);
  const { filters, sorts, pages } = state;
  // 접어 둔 대분류 표. 기본은 모두 펼침이고, 이 화면에 머무는 동안만 기억한다.
  const [collapsed, setCollapsed] = useState<ReadonlySet<CategoryId>>(() => new Set());
  const toggleGroup = (id: CategoryId) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // 간략하게/자세하게. 고르기 전에는 모바일은 간략(목록), PC는 자세히(표). 고른 값은 이 기기에 기억한다.
  const chosenView = useSyncExternalStore(subscribeView, readSavedView, () => null);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => true);
  // 옷 삭제 모드: 간략하게 목록에 체크박스를 띄우고, 오른쪽 아래 "선택 삭제하기"로 한꺼번에 지운다.
  // 보기 방식은 이 모드 동안만 간략하게로 바꾸고 저장된 선택은 건드리지 않는다.
  const [deleting, setDeleting] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const view = deleting ? "simple" : (chosenView ?? (desktop ? "detail" : "simple"));
  // 지워졌거나 사라진 옷은 세지 않는다.
  const checkedIds = useMemo(() => garments.filter((g) => checked.has(g.id)).map((g) => g.id), [garments, checked]);
  const selection = useMemo<GarmentSelection | undefined>(
    () =>
      deleting
        ? {
            selected: checked,
            onToggle: (id) =>
              setChecked((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              }),
          }
        : undefined,
    [deleting, checked],
  );
  const exitDeleting = () => {
    setDeleting(false);
    setChecked(new Set());
    setConfirmDelete(false);
  };
  const removeChecked = async () => {
    setRemoving(true);
    const ok = await removeGarments(checkedIds);
    setRemoving(false);
    setConfirmDelete(false);
    if (ok) exitDeleting();
  };
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
      const all = sortGarments(items.filter((item) => item.categoryId === category.id), sorts[category.id], usdRate);
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
              구매 판단기
            </button>
          ) : (
            <Link href="/fit-check" className={buttonClassName({ variant: "secondary" })}>
              구매 판단기
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
              자주 입는 옷부터 등록하세요. 비교할 옷이 있어야 구매 판단기를 쓸 수 있습니다. 같은 종류의 옷이 3벌
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
          <div className="flex items-center justify-end gap-2 pt-4">
            <div role="group" aria-label="보기 방식" className="flex">
              <div className="inline-flex border border-text">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={view === option.id}
                    disabled={deleting}
                    onClick={() => saveView(option.id)}
                    className={cn(
                      "min-h-9 cursor-pointer px-3 text-sm disabled:cursor-not-allowed",
                      view === option.id ? "bg-text text-bg" : "text-neutral-700 hover:bg-neutral-100 hover:text-text",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              aria-pressed={deleting}
              onClick={() => (deleting ? exitDeleting() : setDeleting(true))}
              className={cn("btn min-h-9 px-3 text-sm", deleting ? "btn-secondary" : "btn-danger")}
            >
              {deleting ? "삭제 취소" : "옷 삭제"}
            </button>
          </div>

          {groups.map((group) => {
            const open = !collapsed.has(group.id);
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`} className="pt-6">
                <div className="flex items-baseline gap-2.5 pb-2">
                  <h2 id={`group-${group.id}`} className="text-lg">
                    {group.name}
                  </h2>
                  <span className="font-mono text-base text-neutral-700 tabular-nums">{group.total}{COUNT_UNIT[group.id]}</span>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`group-body-${group.id}`}
                    aria-label={`${group.name} 표 ${open ? "접기" : "펼치기"}`}
                    onClick={() => toggleGroup(group.id)}
                    className="inline-flex size-7 cursor-pointer items-center justify-center self-center rounded-sm text-neutral-700 hover:bg-neutral-100 hover:text-text"
                  >
                    <svg
                      aria-hidden
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn("transition-transform", !open && "-rotate-90")}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
                <div id={`group-body-${group.id}`} hidden={!open}>
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
                    view={deleting ? "simple" : (chosenView ?? undefined)}
                    selection={selection}
                  />
                  {group.total > PAGE_SIZE && (
                    <Pagination
                      label={group.name}
                      page={group.page}
                      total={group.total}
                      onPage={(page) => navigate({ ...state, pages: { ...pages, [group.id]: page } })}
                    />
                  )}
                </div>
              </section>
            );
          })}

          {items.length === 0 && (
            <div className="flex max-w-110 flex-col items-start gap-2 py-16">
              <div className="text-lg font-semibold">
                {filters.q ? `‘${filters.q}’에 맞는 옷이 없습니다` : "조건에 맞는 옷이 없습니다"}
              </div>
              <div className="text-base text-neutral-700">
                {filterSummary(filters) ? `적용한 조건: ${filterSummary(filters)}. ` : ""}검색어를 바꾸거나 필터를 초기화해 보세요.
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
            <span>{deleting ? "지울 옷을 골라 주세요" : "행을 누르면 상세가 열립니다"}</span>
          </div>
          {/* 고정 버튼이 마지막 행을 가리지 않게 */}
          {deleting && <div aria-hidden className="h-20" />}
        </>
      )}

      {deleting && (
        <div className="fixed right-[clamp(16px,3vw,32px)] bottom-6 z-40 flex items-center gap-2">
          <button type="button" className="btn btn-secondary bg-bg" onClick={exitDeleting}>
            취소
          </button>
          <button
            type="button"
            disabled={checkedIds.length === 0}
            onClick={() => setConfirmDelete(true)}
            className={cn(
              "btn min-h-11 px-5 font-semibold",
              checkedIds.length === 0
                ? "bg-neutral-300 text-neutral-600 disabled:opacity-100"
                : "btn-danger shadow-[0_4px_14px_color-mix(in_srgb,var(--negative)_35%,transparent)]",
            )}
          >
            선택 삭제하기{checkedIds.length > 0 && ` (${checkedIds.length})`}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--n-900)_50%,transparent)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
            onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}
            className="flex w-[min(440px,100%)] flex-col gap-3 rounded-lg border border-text bg-bg p-4"
          >
            <div id="bulk-delete-title" className="text-lg font-semibold">
              {checkedIds.length}벌을 삭제할까요?
            </div>
            <div className="text-base text-neutral-800">
              고른 옷의 실측과 착용 후기가 함께 삭제됩니다. 5초 안에는 실행 취소할 수 있습니다.
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" autoFocus onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button type="button" className="btn btn-danger" disabled={removing} onClick={removeChecked}>
                {removing ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const VIEW_OPTIONS: { id: WardrobeViewMode; label: string }[] = [
  { id: "simple", label: "간략하게" },
  { id: "detail", label: "자세하게" },
];
const VIEW_STORAGE_KEY = "wardrobe-view";
const DESKTOP_QUERY = "(min-width: 768px)";

// 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 이 화면 안에서는 고른 값이 적용되게 메모리에도 둔다.
let memoryView: WardrobeViewMode | null = null;
const viewListeners = new Set<() => void>();

function readSavedView(): WardrobeViewMode | null {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "simple" || saved === "detail") return saved;
  } catch {
    // 아래 메모리 값을 쓴다.
  }
  return memoryView;
}

function saveView(next: WardrobeViewMode) {
  memoryView = next;
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  } catch {
    // 메모리 값만 남긴다.
  }
  viewListeners.forEach((listener) => listener());
}

function subscribeView(onChange: () => void) {
  viewListeners.add(onChange);
  return () => viewListeners.delete(onChange);
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
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

/** 결과가 없을 때 보여 줄 적용 조건 요약(PROJECT_SPEC.md 20장) */
function filterSummary(f: Filters): string {
  const parts: string[] = [];
  if (f.categories.length < CATEGORIES.length) parts.push(CATEGORIES.filter((c) => f.categories.includes(c.id)).map((c) => c.name).join("·") || "대분류 없음");
  if (f.subcategory) parts.push(SUBCATEGORIES.find((s) => s.id === f.subcategory)?.name ?? f.subcategory);
  if (f.brand) parts.push(`브랜드 ${f.brand}`);
  if (f.season) parts.push(SEASONS.find((s) => s.id === f.season)?.name ?? f.season);
  if (f.color) parts.push(`컬러 ${f.color}`);
  if (f.q) parts.push(`검색어 ‘${f.q}’`);
  return parts.join(", ");
}

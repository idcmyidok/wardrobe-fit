"use client";

import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import { SEASONS } from "@/lib/constants/seasons";
import { SORT_OPTIONS, type WardrobeSort } from "@/lib/constants/sort";
import type { CategoryId, Season } from "@/lib/types/domain";
import {
  DEFAULT_FILTERS,
  columnSortLabel,
  isFiltered,
  type WardrobeFilters as Filters,
} from "./filter-state";

export function WardrobeFilters({
  value,
  onChange,
  options,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  options: { brands: string[]; sizes: string[]; colors: string[] };
}) {
  const set = <K extends keyof Filters>(key: K, v: Filters[K]) => onChange({ ...value, [key]: v });
  const subcategories = SUBCATEGORIES.filter((s) => value.categories.includes(s.categoryId));

  const toggleCategory = (id: CategoryId) => {
    const categories = value.categories.includes(id)
      ? value.categories.filter((c) => c !== id)
      : [...value.categories, id];
    if (!categories.length) return; // 최소 1개는 선택된 상태를 유지한다.
    // 선택 해제된 대분류의 세부분류가 남아 있으면 비운다.
    const keep = SUBCATEGORIES.some((s) => s.id === value.subcategory && categories.includes(s.categoryId));
    onChange({ ...value, categories, subcategory: keep ? value.subcategory : "" });
  };

  return (
    <div className="flex flex-col gap-2.5 border-b border-neutral-300 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="seg" role="group" aria-label="대분류">
          {CATEGORIES.map((c) => (
            <label key={c.id} className="seg-opt px-4 py-2 text-base">
              <input
                type="checkbox"
                checked={value.categories.includes(c.id)}
                onChange={() => toggleCategory(c.id)}
              />
              {c.name}
            </label>
          ))}
        </div>
        <input
          className="input w-[min(100%,280px)]"
          type="search"
          aria-label="검색"
          placeholder="브랜드, 제품명 검색"
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
        />
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="wardrobe-sort" className="text-sm text-neutral-700">
            정렬
          </label>
          <select
            id="wardrobe-sort"
            className="input w-37.5"
            value={typeof value.sort === "string" ? value.sort : "column"}
            onChange={(e) => set("sort", e.target.value as WardrobeSort)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            {/* 표 헤더로 정렬한 동안에만 보이는 항목. 다른 정렬을 고르면 헤더 정렬이 풀린다. */}
            {typeof value.sort !== "string" && <option value="column">{columnSortLabel(value.sort)}</option>}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="세부분류"
          width="w-37.5"
          value={value.subcategory}
          onChange={(v) => set("subcategory", v)}
          options={subcategories.map((s) => ({ value: s.id, name: s.name }))}
        />
        <FilterSelect label="브랜드" width="w-37.5" value={value.brand} onChange={(v) => set("brand", v)} options={toOptions(options.brands)} />
        <FilterSelect
          label="시즌"
          width="w-30"
          value={value.season}
          onChange={(v) => set("season", v as Season | "")}
          options={SEASONS.map((s) => ({ value: s.id, name: s.name }))}
        />
        <FilterSelect label="사이즈" width="w-30" value={value.size} onChange={(v) => set("size", v)} options={toOptions(options.sizes)} />
        <FilterSelect label="컬러" width="w-32.5" value={value.color} onChange={(v) => set("color", v)} options={toOptions(options.colors)} />
        {isFiltered(value) && (
          <button type="button" className="btn btn-ghost text-sm" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: value.sort })}>
            필터 초기화
          </button>
        )}
      </div>
    </div>
  );
}

const toOptions = (values: string[]) => values.map((v) => ({ value: v, name: v }));

function FilterSelect({
  label,
  width,
  value,
  onChange,
  options,
}: {
  label: string;
  width: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; name: string }[];
}) {
  return (
    <select
      aria-label={label}
      className={`input min-h-8 py-1 text-sm ${width} ${value ? "border-accent text-accent-700" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label} 전체</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

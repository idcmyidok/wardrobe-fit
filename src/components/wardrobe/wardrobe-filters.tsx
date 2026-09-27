"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SUBCATEGORIES } from "@/lib/constants/categories";
import { SEASONS } from "@/lib/constants/seasons";
import { SORT_OPTIONS, type WardrobeSort } from "@/lib/constants/sort";
import type { Season } from "@/lib/types/domain";
import { CategoryToggle } from "./category-toggle";
import { DEFAULT_FILTERS, type WardrobeFilters as Filters } from "./filter-state";

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
  const detailCount = [value.subcategory, value.brand, value.season, value.size, value.color].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-2.5 border-b border-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryToggle
          value={value.categories}
          onChange={(categories) => {
            // 선택 해제된 대분류의 세부분류가 남아 있으면 비운다.
            const keep = SUBCATEGORIES.some((s) => s.id === value.subcategory && categories.includes(s.categoryId));
            onChange({ ...value, categories, subcategory: keep ? value.subcategory : "" });
          }}
        />
        <div className="w-full sm:w-72">
          <Input
            type="search"
            aria-label="검색"
            placeholder="브랜드, 제품명 검색"
            value={value.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <label htmlFor="wardrobe-sort" className="text-sm text-text-muted">
            정렬
          </label>
          <Select
            id="wardrobe-sort"
            containerClassName="w-40"
            value={value.column ? "column" : value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as WardrobeSort, column: null })}
          >
            {/* 표 헤더로 정렬한 동안에만 보이는 항목. 다른 정렬을 고르면 헤더 정렬이 풀린다. */}
            {value.column && (
              <option value="column" disabled>
                표 헤더 기준
              </option>
            )}
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="세부분류"
          value={value.subcategory}
          onChange={(v) => set("subcategory", v)}
          options={subcategories.map((s) => ({ value: s.id, name: s.name }))}
        />
        <FilterSelect label="브랜드" value={value.brand} onChange={(v) => set("brand", v)} options={toOptions(options.brands)} />
        <FilterSelect
          label="시즌"
          value={value.season}
          onChange={(v) => set("season", v as Season | "")}
          options={SEASONS.map((s) => ({ value: s.id, name: s.name }))}
        />
        <FilterSelect label="사이즈" value={value.size} onChange={(v) => set("size", v)} options={toOptions(options.sizes)} />
        <FilterSelect label="컬러" value={value.color} onChange={(v) => set("color", v)} options={toOptions(options.colors)} />
        {(detailCount > 0 || value.q || value.categories.length < 3) && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: value.sort, column: value.column })}>
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}

const toOptions = (values: string[]) => values.map((v) => ({ value: v, name: v }));

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; name: string }[];
}) {
  return (
    <Select
      aria-label={label}
      size="sm"
      active={Boolean(value)}
      containerClassName="w-[calc(50%-4px)] sm:w-36"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}: 전체</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {label}: {o.name}
        </option>
      ))}
    </Select>
  );
}

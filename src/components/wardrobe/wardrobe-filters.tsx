"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import { SEASONS } from "@/lib/constants/seasons";
import type { CategoryId, Season } from "@/lib/types/domain";
import {
  DEFAULT_FILTERS,
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
  options: { brands: string[]; colors: string[] };
}) {
  const set = <K extends keyof Filters>(key: K, v: Filters[K]) => onChange({ ...value, [key]: v });
  // 세부분류·브랜드·시즌·컬러는 "필터" 버튼을 눌러야 보인다. 이미 하나라도 걸려 있으면 펼친 채로 시작한다.
  const active = [value.subcategory, value.brand, value.season, value.color].filter(Boolean).length;
  const [open, setOpen] = useState(active > 0);
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
        <div className="seg seg-loose" role="group" aria-label="대분류">
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
        {/* 검색창과 필터 버튼은 좁은 화면에서도 한 줄에 둔다. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchBox value={value.q} onCommit={(q) => set("q", q)} />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="wardrobe-more-filters"
            onClick={() => setOpen((v) => !v)}
            className={`btn btn-secondary shrink-0 gap-1 ${active ? "border-accent text-accent-700" : ""}`}
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
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            필터{active > 0 && ` ${active}`}
          </button>
        </div>
        {isFiltered(value) && !open && (
          <button type="button" className="btn btn-ghost text-sm" onClick={() => onChange(DEFAULT_FILTERS)}>
            필터 초기화
          </button>
        )}
      </div>

      <div id="wardrobe-more-filters" hidden={!open} className="flex flex-wrap items-center gap-2">
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
        <FilterSelect label="컬러" width="w-32.5" value={value.color} onChange={(v) => set("color", v)} options={toOptions(options.colors)} />
        {isFiltered(value) && (
          <button type="button" className="btn btn-ghost text-sm" onClick={() => onChange(DEFAULT_FILTERS)}>
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

const SEARCH_DEBOUNCE_MS = 300;

/** 브랜드·제품명 검색. 입력을 멈추고 300ms 뒤에 적용한다. 초기화처럼 밖에서 값이 바뀌면 따라간다. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // 입력을 멈춘 사이 다른 필터를 바꿨을 수 있으므로, 적용할 때는 가장 최근 onCommit(최근 필터 값)을 쓴다.
  const latestCommit = useRef(onCommit);
  useEffect(() => {
    latestCommit.current = onCommit;
  });

  if (value !== committed) {
    setCommitted(value);
    setText(value);
  }

  return (
    <input
      className="input min-w-0 flex-1 sm:w-70 sm:flex-none"
      type="search"
      aria-label="검색"
      placeholder="브랜드, 제품명 검색"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => latestCommit.current(next), SEARCH_DEBOUNCE_MS);
      }}
    />
  );
}

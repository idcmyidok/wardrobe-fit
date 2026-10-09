"use client";

import { useEffect, useRef, useState } from "react";
import { SUBCATEGORIES } from "@/lib/constants/categories";
import { SEASONS } from "@/lib/constants/seasons";
import type { Season } from "@/lib/types/domain";
import {
  DEFAULT_FILTERS,
  isFiltered,
  type WardrobeFilters as Filters,
} from "./filter-state";

/** 세부분류·브랜드·시즌·컬러 고르기. 옷장 머리말에 늘 펼쳐 둔다. */
export function MoreFilters({
  value,
  onChange,
  options,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  options: { brands: string[]; colors: string[] };
}) {
  const set = <K extends keyof Filters>(key: K, v: Filters[K]) => onChange({ ...value, [key]: v });
  const subcategories = SUBCATEGORIES.filter((s) => value.categories.includes(s.categoryId));
  return (
    <div role="group" aria-label="필터" className="flex flex-wrap items-center gap-2">
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
        width="w-37.5"
        value={value.season}
        onChange={(v) => set("season", v as Season | "")}
        options={SEASONS.map((s) => ({ value: s.id, name: s.name }))}
      />
      <FilterSelect label="컬러" width="w-37.5" value={value.color} onChange={(v) => set("color", v)} options={toOptions(options.colors)} />
      {isFiltered(value) && (
        <button type="button" className="btn btn-ghost text-sm" onClick={() => onChange(DEFAULT_FILTERS)}>
          필터 초기화
        </button>
      )}
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
      className={`input keep-font min-h-8 py-1 text-sm ${width} ${value ? "border-accent text-accent-700" : ""}`}
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
export function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
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
      className="input w-full sm:w-80"
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

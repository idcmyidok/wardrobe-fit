"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonClassName } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants/categories";
import type { GarmentListItem } from "@/lib/types/domain";
import { DEFAULT_FILTERS, applyFilters, nextColumnSort, uniqueValues } from "./filter-state";
import { WardrobeFilters } from "./wardrobe-filters";
import { WardrobeTable } from "./wardrobe-table";

export function WardrobeView({ garments }: { garments: GarmentListItem[] }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const options = useMemo(
    () => ({
      brands: uniqueValues(garments, (g) => g.brand),
      sizes: uniqueValues(garments, (g) => g.sizeLabel),
      colors: uniqueValues(garments, (g) => g.colorName),
    }),
    [garments],
  );
  const items = useMemo(() => applyFilters(garments, filters), [garments, filters]);
  const groups = CATEGORIES.map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <PageHeader
        title="내 옷장"
        count={items.length}
        meta={items.length === garments.length ? `전체 ${garments.length}벌` : `전체 ${garments.length}벌 중 ${items.length}벌`}
        actions={
          <>
            <Link href="/fit-check" className={buttonClassName({ variant: "secondary" })}>
              AI 구매 판단기
            </Link>
            <Link href="/wardrobe/new" className={buttonClassName({ variant: "primary" })}>
              + 새 옷 추가
            </Link>
          </>
        }
      />
      <WardrobeFilters value={filters} onChange={setFilters} options={options} />

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className="flex flex-col gap-2 pt-6">
          <div className="flex items-baseline gap-2.5">
            <h2 id={`group-${group.id}`} className="text-lg text-text">
              {group.name}
            </h2>
            <span className="font-mono text-sm text-text-muted tabular-nums">{group.items.length}벌</span>
          </div>
          <WardrobeTable
            categoryId={group.id}
            items={group.items}
            sort={filters.column}
            onSort={(key) => setFilters({ ...filters, column: nextColumnSort(filters.column, key) })}
          />
        </section>
      ))}

      {groups.length === 0 && (
        <div className="flex max-w-md flex-col items-start gap-2 py-16">
          <h2 className="text-lg text-text">조건에 맞는 옷이 없습니다</h2>
          <p className="text-base text-text-muted">검색어나 필터를 바꿔 보세요.</p>
          <Button
            className="mt-2"
            onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, column: filters.column })}
          >
            필터 초기화
          </Button>
        </div>
      )}

      <p className="mt-6 border-t border-text py-3 font-mono text-xs text-text-muted tabular-nums">
        실측은 cm, 단면 기준입니다. 브랜드, 사이즈, 컬러, 시즌, 구매일, 구매가 머리글을 누르면 정렬됩니다.
      </p>
    </>
  );
}

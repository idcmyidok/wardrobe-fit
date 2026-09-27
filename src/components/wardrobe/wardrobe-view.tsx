"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { GarmentListItem } from "@/lib/types/domain";
import { DEFAULT_FILTERS, applyFilters, uniqueValues } from "./filter-state";
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

  return (
    <>
      <PageHeader
        title="내 옷장"
        meta={items.length === garments.length ? `${garments.length}벌` : `${items.length} / ${garments.length}벌`}
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
      <WardrobeTable
        items={items}
        empty={
          <EmptyState
            title="조건에 맞는 옷이 없습니다"
            description="검색어나 필터를 바꿔 보세요."
            action={
              <Button size="sm" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>
                필터 초기화
              </Button>
            }
          />
        }
      />
    </>
  );
}

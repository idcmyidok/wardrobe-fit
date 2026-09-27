import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { TABLE_MEASUREMENTS } from "@/lib/constants/measurements";
import { SEASON_NAME } from "@/lib/constants/seasons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { formatPrice } from "@/lib/format/price";
import type { CategoryId, GarmentListItem } from "@/lib/types/domain";
import type { ColumnSort, SortableColumn } from "./filter-state";
import { GarmentThumbnail } from "./garment-thumbnail";

const EMPTY = <span className="text-text-subtle">—</span>;

const cell = "border-r border-border px-3 text-center";
const numeric = "font-mono tabular-nums whitespace-nowrap";

/** 대분류 하나의 표. 실측 열은 대분류에 맞춰 바뀐다(상의·아우터 / 하의). */
export function WardrobeTable({
  categoryId,
  items,
  sort,
  onSort,
}: {
  categoryId: CategoryId;
  items: GarmentListItem[];
  sort: ColumnSort | null;
  onSort: (key: SortableColumn) => void;
}) {
  const measurements = TABLE_MEASUREMENTS[categoryId];
  const head = (key: SortableColumn, label: string, className?: string) => (
    <SortHeader key={key} column={key} label={label} sort={sort} onSort={onSort} className={className} />
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-300 table-fixed border-collapse border-t border-l border-border bg-surface text-sm">
        <thead>
          <tr className="font-mono text-label text-text-muted">
            <th scope="col" className={cn(cell, "w-20 border-b border-b-text py-2.5 font-medium")}>
              이미지
            </th>
            <th scope="col" className={cn(cell, "w-28 border-b border-b-text font-medium")}>
              세부분류
            </th>
            {head("brand", "브랜드", "w-36")}
            <th scope="col" className={cn(cell, "border-b border-b-text font-medium")}>
              제품명
            </th>
            {head("size", "사이즈", "w-20")}
            {head("color", "컬러", "w-24")}
            {head("season", "시즌", "w-28")}
            {measurements.map((m) => (
              <th
                key={m.key}
                scope="col"
                className={cn(cell, "w-14 border-b border-b-text bg-surface-muted px-0 font-medium")}
              >
                {m.label}
              </th>
            ))}
            {head("purchasedOn", "구매일", "w-28")}
            {head("price", "구매가", "w-32")}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border transition-colors hover:bg-surface-muted">
              <td className="border-r border-border p-0">
                <GarmentThumbnail item={item} />
              </td>
              <td className={cn(cell, "truncate text-text-muted")}>
                {item.subcategoryId ? SUBCATEGORY_NAME[item.subcategoryId] : EMPTY}
              </td>
              <td className={cn(cell, "font-semibold text-balance text-text")}>{item.brand}</td>
              <td className={cn(cell, "text-balance text-text")}>{item.productName}</td>
              <td className={cn(cell, numeric, "px-1 text-xs text-text")}>{item.sizeLabel ?? EMPTY}</td>
              <td className={cn(cell, "text-text")}>{item.colorName ?? EMPTY}</td>
              <td className={cn(cell, "text-text-muted")}>
                {item.seasons.length ? item.seasons.map((s) => SEASON_NAME[s]).join(" · ") : EMPTY}
              </td>
              {measurements.map((m) => {
                const v = item.measurements[m.key];
                return (
                  <td key={m.key} className={cn(cell, numeric, "bg-surface-muted/60 px-0 text-xs text-text")}>
                    {v == null ? EMPTY : v.toFixed(1)}
                  </td>
                );
              })}
              <td className={cn(cell, numeric, "text-text-muted")}>{formatDate(item.purchasedOn)}</td>
              <td className={cn(cell, numeric, "text-text")}>{formatPrice(item.purchasePrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: SortableColumn;
  label: string;
  sort: ColumnSort | null;
  onSort: (key: SortableColumn) => void;
  className?: string;
}) {
  const active = sort?.key === column;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className={cn(cell, "border-b border-b-text p-0 font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex h-full min-h-10 w-full cursor-pointer items-center justify-center gap-1 px-2 transition-colors hover:bg-surface-muted hover:text-text",
          active && "text-text",
        )}
      >
        {label}
        <span aria-hidden className={active ? "text-accent" : "text-border-strong"}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

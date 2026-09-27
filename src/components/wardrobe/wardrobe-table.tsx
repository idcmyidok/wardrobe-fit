import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { colorChip } from "@/lib/constants/colors";
import { TABLE_MEASUREMENTS, formatCm } from "@/lib/constants/measurements";
import { SEASON_NAME } from "@/lib/constants/seasons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { formatPrice } from "@/lib/format/price";
import type { CategoryId, Garment } from "@/lib/types/domain";
import type { ColumnSort, SortableColumn } from "./filter-state";
import { GarmentThumbnail } from "./garment-thumbnail";

const cell = "border-r border-neutral-300 px-2 py-2 text-center align-middle";
const head = "border-r border-b border-r-neutral-300 border-b-text bg-surface font-mono text-[10.5px] font-medium tracking-[0.06em] text-neutral-700";
const mono = "font-mono tabular-nums whitespace-nowrap";

/**
 * 대분류 하나의 표. 실측 열은 대분류에 맞춰 바뀐다(상의·아우터 4열 / 하의 6열). 행을 누르면 옷 정보가 열린다.
 * 세 표의 공통 열은 모두 고정 폭이라 표끼리 같은 자리에 선다. 실측 열만 폭을 정하지 않아 남는 폭을 나눠 가진다.
 */
export function WardrobeTable({
  categoryId,
  items,
  sort,
  onSort,
  selectedId,
  onOpen,
}: {
  categoryId: CategoryId;
  items: Garment[];
  sort: ColumnSort;
  onSort: (key: SortableColumn) => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const measurements = TABLE_MEASUREMENTS[categoryId];
  const sortHead = (key: SortableColumn, label: string, className: string, narrow = false) => (
    <SortHeader key={key} column={key} label={label} active={sort.key === key ? sort.dir : null} onSort={onSort} className={className} narrow={narrow} />
  );

  return (
    <>
      <MobileList items={items} selectedId={selectedId} onOpen={onOpen} />
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-312 table-fixed border-collapse border-t border-l border-neutral-300 bg-surface text-sm">
          <thead>
            <tr>
              <th scope="col" className={cn(head, "w-20 py-2")}>
                이미지
              </th>
              <th scope="col" className={cn(head, "w-25")}>
                세부분류
              </th>
              {sortHead("brand", "브랜드", "w-28")}
              <th scope="col" className={cn(head, "w-44")}>
                제품명
              </th>
              {sortHead("size", "사이즈", "w-9.5", true)}
              {sortHead("color", "컬러", "w-24")}
              {sortHead("season", "시즌", "w-26")}
              {measurements.map((m) => sortHead(m.key, m.label, "bg-neutral-100", true))}
              {sortHead("purchasedOn", "구매일", "w-32")}
              {sortHead("price", "구매가", "w-32")}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const chip = colorChip(item.colorName);
              return (
                <tr
                  key={item.id}
                  onClick={() => onOpen(item.id)}
                  className={cn(
                    "cursor-pointer border-b border-neutral-300 transition-colors hover:bg-neutral-100",
                    selectedId === item.id && "bg-accent-100 hover:bg-accent-100",
                  )}
                >
                  <td className="h-24 border-r border-neutral-300 p-0">
                    <GarmentThumbnail item={item} />
                  </td>
                  <td className={cn(cell, "truncate")}>{item.subcategoryId ? SUBCATEGORY_NAME[item.subcategoryId] : "—"}</td>
                  <td className={cn(cell, "leading-tight font-semibold")} title={item.brand || undefined}>
                    <span className="line-clamp-2 break-words">{item.brand || "—"}</span>
                  </td>
                  <td className={cn(cell, "leading-snug")} title={item.productName}>
                    {/* 키보드로도 옷 정보를 열 수 있게 제품명을 버튼으로 둔다. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(item.id);
                      }}
                      className="cursor-pointer"
                    >
                      <span className="line-clamp-2 break-words">{item.productName}</span>
                    </button>
                  </td>
                  <td className={cn(cell, mono, "px-0 text-xs")}>{item.sizeLabel ?? "—"}</td>
                  <td className={cn(cell, "text-sm")}>
                    <span className="inline-block rounded-sm px-1.5 py-0.5" style={chip}>
                      {item.colorName ?? "—"}
                    </span>
                  </td>
                  <td className={cn(cell, "text-neutral-700")}>
                    {item.seasons.length ? item.seasons.map((s) => SEASON_NAME[s]).join(" · ") : "—"}
                  </td>
                  {measurements.map((m) => (
                    <td key={m.key} className={cn(cell, mono, "bg-neutral-100/60 px-0 text-xs tracking-[-0.02em]")}>
                      {formatCm(item.measurements[m.key])}
                    </td>
                  ))}
                  <td className={cn(cell, mono, "text-neutral-700")}>{formatDate(item.purchasedOn)}</td>
                  <td className={cn(cell, mono)}>{formatPrice(item.purchasePrice)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 모바일(768px 미만): 표 대신 두 줄 목록. 누르면 옷 정보 페이지로 간다(PROJECT_SPEC.md 5.2). */
function MobileList({ items, selectedId, onOpen }: { items: Garment[]; selectedId: string | null; onOpen: (id: string) => void }) {
  return (
    <ul className="border-t border-text md:hidden">
      {items.map((item) => (
        <li key={item.id} className="border-b border-neutral-300">
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className={cn(
              "grid min-h-16 w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-center gap-3 py-2 text-left",
              selectedId === item.id && "bg-accent-100",
            )}
          >
            <GarmentThumbnail item={item} className="h-15" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-base">
                {item.brand && <span className="font-semibold">{item.brand} </span>}
                {item.productName}
              </span>
              <span className={cn(mono, "truncate text-xs text-neutral-700")}>
                {[item.sizeLabel, item.colorName, item.purchasedOn && formatDate(item.purchasedOn)].filter(Boolean).join(" · ") || "—"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SortHeader({
  column,
  label,
  active,
  onSort,
  className,
  narrow,
}: {
  column: SortableColumn;
  label: string;
  active: "asc" | "desc" | null;
  onSort: (key: SortableColumn) => void;
  className: string;
  narrow: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (active === "asc" ? "ascending" : "descending") : "none"}
      className={cn(head, narrow && "px-0 text-2xs tracking-[-0.02em]", className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-0.5 hover:text-text"
      >
        {label}
        <span aria-hidden className={cn("text-2xs", active ? "text-accent" : "text-neutral-400")}>
          {active ? (active === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

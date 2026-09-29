import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { colorChip } from "@/lib/constants/colors";
import { TABLE_MEASUREMENTS, formatCm } from "@/lib/constants/measurements";
import { SEASON_NAME } from "@/lib/constants/seasons";
import { SHOE_FIT_FIELDS, shoeFitText } from "@/lib/constants/shoe-fit";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { formatPrice } from "@/lib/format/price";
import type { CategoryId, Garment } from "@/lib/types/domain";
import type { ColumnSort, SortableColumn } from "./filter-state";
import { GarmentThumbnail } from "./garment-thumbnail";
import { useBodyFit } from "@/components/body/body-store";
import { FitMeter } from "@/components/body/fit-meter";

/** 옷장 목록 보기: simple은 사진·요약 목록, detail은 실측까지 보이는 표. */
export type WardrobeViewMode = "simple" | "detail";

export interface GarmentSelection {
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

const cell = "border-r border-neutral-300 px-2 py-2 text-center align-middle";
const head = "border-r border-b border-r-neutral-300 border-b-text bg-surface font-mono text-[10.5px] font-medium tracking-[0.06em] text-neutral-700";
const mono = "font-mono tabular-nums whitespace-nowrap";

/**
 * 대분류 하나의 표. 실측 열은 대분류에 맞춰 바뀐다(상의·아우터 4열 / 하의 6열 / 모자 3열).
 * 신발은 실측 대신 착용감(길이감·발볼·발등) 3열을 보여 준다. 행을 누르면 옷 정보가 열린다.
 * 세 표의 공통 열은 모두 고정 폭이라 표끼리 같은 자리에 선다. 실측 열만 폭을 정하지 않아 남는 폭을 나눠 가진다.
 */
export function WardrobeTable({
  categoryId,
  items,
  sort,
  onSort,
  selectedId,
  onOpen,
  view,
  selection,
}: {
  /** simple: 간략 목록, detail: 표. 정하지 않으면 모바일은 목록, PC는 표. */
  view?: WardrobeViewMode;
  /** 삭제할 옷 고르기. 있으면 간략 목록에 체크박스가 생기고, 행을 누르면 옷 정보 대신 체크가 바뀐다. */
  selection?: GarmentSelection;
  categoryId: CategoryId;
  items: Garment[];
  sort: ColumnSort;
  onSort: (key: SortableColumn) => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const measurements = TABLE_MEASUREMENTS[categoryId];
  // 모자·신발을 뺀 의류 표에만 예상 핏 열을 둔다.
  const fitColumn = categoryId === "outer" || categoryId === "top" || categoryId === "bottom";
  const sortHead = (key: SortableColumn, label: string, className: string, narrow = false) => (
    <SortHeader key={key} column={key} label={label} active={sort.key === key ? sort.dir : null} onSort={onSort} className={className} narrow={narrow} />
  );

  return (
    <>
      <MobileList
        items={items}
        selectedId={selectedId}
        onOpen={onOpen}
        selection={selection}
        className={view === "simple" ? undefined : view === "detail" ? "hidden" : "md:hidden"}
      />
      <div className={cn("overflow-x-auto overscroll-x-contain", view === "simple" ? "hidden" : view === "detail" ? undefined : "hidden md:block")}>
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
              {sortHead("size", "사이즈", "w-15", true)}
              {sortHead("color", "컬러", "w-24")}
              <th scope="col" className={cn(head, "w-26")}>
                시즌
              </th>
              {measurements.map((m) => sortHead(m.key, m.label, "bg-neutral-100", true))}
              {categoryId === "shoes" &&
                SHOE_FIT_FIELDS.map((f) => (
                  <th key={f.key} scope="col" className={cn(head, "bg-neutral-100 px-0 text-2xs tracking-[-0.02em]")}>
                    {f.label}
                  </th>
                ))}
              {fitColumn && (
                <th scope="col" className={cn(head, "w-24")}>
                  핏
                </th>
              )}
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
                  <td className={cn(cell, mono, "truncate px-1 text-xs")} title={item.sizeLabel ?? undefined}>
                    {item.sizeLabel ?? "—"}
                  </td>
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
                  {categoryId === "shoes" &&
                    SHOE_FIT_FIELDS.map((f) => (
                      <td key={f.key} className={cn(cell, "bg-neutral-100/60 px-0 text-xs")}>
                        {shoeFitText(f.key, item.shoeFit?.[f.key])}
                      </td>
                    ))}
                  {fitColumn && (
                    <td className={cn(cell, "px-1")}>
                      <FitCell item={item} />
                    </td>
                  )}
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

/** 핏 칸: 내가 표기한 핏이 있으면 그것, 없으면 내 치수로 계산한 예상 핏. 계산할 수 없으면 "—" */
function FitCell({ item }: { item: Garment }) {
  const result = useBodyFit(item);
  const kind = item.categoryId === "bottom" ? "bottom" : "top";
  if (item.userFit) return <FitMeter level={item.userFit} kind={kind} mine />;
  if (result?.status !== "ok") return <span className="text-neutral-500">—</span>;
  return <FitMeter level={result.level} kind={kind} />;
}

/** 간략 목록(모바일 기본): 사진과 두 줄 요약. 모바일에서 누르면 옷 정보 페이지로 간다(PROJECT_SPEC.md 5.2). */
function MobileList({
  items,
  selectedId,
  onOpen,
  selection,
  className,
}: {
  items: Garment[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  selection?: GarmentSelection;
  className?: string;
}) {
  return (
    <ul className={cn("border-t border-text", className)}>
      {items.map((item) => {
        const checked = selection?.selected.has(item.id) ?? false;
        const row = cn(
          "grid min-h-16 w-full cursor-pointer items-center gap-3 py-2 text-left",
          selection ? "grid-cols-[20px_56px_minmax(0,1fr)] pl-1" : "grid-cols-[56px_minmax(0,1fr)]",
          (selection ? checked : selectedId === item.id) && "bg-accent-100",
        );
        const body = (
          <>
            <GarmentThumbnail item={item} className="h-17.5" fit="contain" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-base">
                {item.brand && <span className="font-semibold">{item.brand} </span>}
                {item.productName}
              </span>
              <span className={cn(mono, "truncate text-xs text-neutral-700")}>
                {[
                  item.sizeLabel,
                  item.colorName,
                  item.purchasedOn && formatDate(item.purchasedOn),
                  item.purchasePrice != null && formatPrice(item.purchasePrice),
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </span>
          </>
        );
        return (
          <li key={item.id} className="border-b border-neutral-300">
            {selection ? (
              <label className={row}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => selection.onToggle(item.id)}
                  aria-label={`${[item.brand, item.productName].filter(Boolean).join(" ")} 선택`}
                  className="size-4.5 cursor-pointer accent-negative"
                />
                {body}
              </label>
            ) : (
              <button type="button" onClick={() => onOpen(item.id)} className={row}>
                {body}
              </button>
            )}
          </li>
        );
      })}
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

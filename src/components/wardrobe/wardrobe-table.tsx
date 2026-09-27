import { CATEGORY_NAME, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { SEASON_NAME } from "@/lib/constants/seasons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { formatPrice } from "@/lib/format/price";
import type { GarmentListItem } from "@/lib/types/domain";
import { GarmentThumbnail } from "./garment-thumbnail";

const COLUMNS: { key: string; label: string; className?: string }[] = [
  { key: "image", label: "이미지", className: "w-16" },
  { key: "category", label: "카테고리" },
  { key: "brand", label: "브랜드" },
  { key: "name", label: "제품명", className: "w-full" },
  { key: "size", label: "사이즈" },
  { key: "color", label: "컬러" },
  { key: "season", label: "시즌" },
  { key: "purchasedOn", label: "구매일", className: "text-right" },
  { key: "price", label: "구매가", className: "text-right" },
];

const EMPTY = <span className="text-text-subtle">—</span>;

export function WardrobeTable({ items, empty }: { items: GarmentListItem[]; empty?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-y border-border bg-surface">
      <table className="w-full min-w-240 border-collapse text-sm">
        <thead>
          <tr className="bg-surface-muted">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn("h-9 px-3 text-left text-xs font-medium whitespace-nowrap text-text-muted", col.className)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="h-14 border-t border-border transition-colors hover:bg-surface-muted">
              <td className="px-3 py-2">
                <GarmentThumbnail item={item} />
              </td>
              <td className="px-3 whitespace-nowrap">
                <span className="text-text">{item.subcategoryId ? SUBCATEGORY_NAME[item.subcategoryId] : "—"}</span>
                <span className="ml-1.5 text-xs text-text-subtle">{CATEGORY_NAME[item.categoryId]}</span>
              </td>
              <td className="px-3 font-medium whitespace-nowrap text-text">{item.brand}</td>
              <td className="px-3 text-text">{item.productName}</td>
              <td className="px-3 whitespace-nowrap text-text">{item.sizeLabel ?? EMPTY}</td>
              <td className="px-3 whitespace-nowrap text-text">{item.colorName ?? EMPTY}</td>
              <td className="px-3 whitespace-nowrap text-text-muted">
                {item.seasons.length ? item.seasons.map((s) => SEASON_NAME[s]).join(" · ") : EMPTY}
              </td>
              <td className="px-3 text-right whitespace-nowrap text-text-muted tabular-nums">
                {formatDate(item.purchasedOn)}
              </td>
              <td className="px-3 text-right whitespace-nowrap text-text tabular-nums">
                {formatPrice(item.purchasePrice)}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-16">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

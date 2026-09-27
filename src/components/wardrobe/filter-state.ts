import type { WardrobeSort } from "@/lib/constants/sort";
import type { CategoryId, GarmentListItem, Season } from "@/lib/types/domain";

/**
 * 지금은 화면 확인용 로컬 상태다. 6단계에서 URL searchParams + 서버 조회로 옮긴다.
 */
export interface WardrobeFilters {
  categories: CategoryId[];
  subcategory: string;
  brand: string;
  season: Season | "";
  size: string;
  color: string;
  q: string;
  sort: WardrobeSort;
}

export const DEFAULT_FILTERS: WardrobeFilters = {
  categories: ["outer", "top", "bottom"],
  subcategory: "",
  brand: "",
  season: "",
  size: "",
  color: "",
  q: "",
  sort: "purchased_desc",
};

export function applyFilters(items: GarmentListItem[], f: WardrobeFilters): GarmentListItem[] {
  const q = f.q.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      f.categories.includes(item.categoryId) &&
      (!f.subcategory || item.subcategoryId === f.subcategory) &&
      (!f.brand || item.brand === f.brand) &&
      (!f.season || item.seasons.includes(f.season)) &&
      (!f.size || item.sizeLabel === f.size) &&
      (!f.color || item.colorName === f.color) &&
      (!q || `${item.brand} ${item.productName}`.toLowerCase().includes(q)),
  );

  const byDate = (a: GarmentListItem, b: GarmentListItem) =>
    (a.purchasedOn ?? "").localeCompare(b.purchasedOn ?? "");
  const byPrice = (a: GarmentListItem, b: GarmentListItem) => (a.purchasePrice ?? 0) - (b.purchasePrice ?? 0);
  // 값이 없는 항목은 정렬 방향과 관계없이 뒤로 보낸다.
  const missing = (item: GarmentListItem) =>
    f.sort.startsWith("price") ? item.purchasePrice == null : item.purchasedOn == null;

  return filtered.sort((a, b) => {
    const m = Number(missing(a)) - Number(missing(b));
    if (m !== 0) return m;
    switch (f.sort) {
      case "purchased_asc":
        return byDate(a, b);
      case "price_desc":
        return byPrice(b, a);
      case "price_asc":
        return byPrice(a, b);
      default:
        return byDate(b, a);
    }
  });
}

export function uniqueValues(items: GarmentListItem[], pick: (item: GarmentListItem) => string | null): string[] {
  return [...new Set(items.map(pick).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b, "ko", { numeric: true }),
  );
}

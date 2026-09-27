import { SEASONS } from "@/lib/constants/seasons";
import type { WardrobeSort } from "@/lib/constants/sort";
import type { CategoryId, GarmentListItem, Season } from "@/lib/types/domain";

/** 표 헤더를 눌러 정렬할 수 있는 열. 이미지·제품명·실측 열은 정렬하지 않는다. */
export type SortableColumn = "brand" | "size" | "color" | "season" | "purchasedOn" | "price";
export type SortDirection = "asc" | "desc";
export interface ColumnSort {
  key: SortableColumn;
  dir: SortDirection;
}

/**
 * 지금은 화면 확인용 로컬 상태다. 6단계에서 URL searchParams + 서버 조회로 옮긴다.
 * column이 있으면 정렬 Select(sort)보다 우선한다.
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
  column: ColumnSort | null;
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
  column: null,
};

/** 날짜·가격은 큰 값부터, 나머지는 가나다·작은 값부터 시작한다. */
const FIRST_DIRECTION: Record<SortableColumn, SortDirection> = {
  brand: "asc",
  size: "asc",
  color: "asc",
  season: "asc",
  purchasedOn: "desc",
  price: "desc",
};

/** 같은 열을 누를 때마다 첫 방향 → 반대 방향 → 해제(정렬 Select 기준) 순서로 바뀐다. */
export function nextColumnSort(current: ColumnSort | null, key: SortableColumn): ColumnSort | null {
  const first = FIRST_DIRECTION[key];
  if (current?.key !== key) return { key, dir: first };
  if (current.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** 문자 사이즈(XS~XXXL)는 치수 순서대로, 숫자 사이즈는 숫자 순서대로, 그 외는 가나다순 */
function compareSize(a: string, b: string): number {
  const ia = LETTER_SIZES.indexOf(a.toUpperCase());
  const ib = LETTER_SIZES.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, "ko", { numeric: true });
}

const SEASON_ORDER = SEASONS.map((s) => s.id);
const seasonRank = (item: GarmentListItem) => Math.min(...item.seasons.map((s) => SEASON_ORDER.indexOf(s)));

function columnValue(item: GarmentListItem, key: SortableColumn): string | number | null {
  switch (key) {
    case "brand":
      return item.brand;
    case "size":
      return item.sizeLabel;
    case "color":
      return item.colorName;
    case "season":
      return item.seasons.length ? seasonRank(item) : null;
    case "purchasedOn":
      return item.purchasedOn;
    case "price":
      return item.purchasePrice;
  }
}

function compareColumn(a: GarmentListItem, b: GarmentListItem, key: SortableColumn): number {
  const va = columnValue(a, key);
  const vb = columnValue(b, key);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  if (key === "size") return compareSize(String(va), String(vb));
  return String(va).localeCompare(String(vb), "ko", { numeric: true });
}

const PRESET_COLUMN: Record<WardrobeSort, ColumnSort> = {
  purchased_desc: { key: "purchasedOn", dir: "desc" },
  purchased_asc: { key: "purchasedOn", dir: "asc" },
  price_desc: { key: "price", dir: "desc" },
  price_asc: { key: "price", dir: "asc" },
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

  const { key, dir } = f.column ?? PRESET_COLUMN[f.sort];
  // 값이 없는 항목은 정렬 방향과 관계없이 뒤로 보낸다.
  const missing = (item: GarmentListItem) => columnValue(item, key) == null;

  return filtered.sort((a, b) => {
    const m = Number(missing(a)) - Number(missing(b));
    if (m !== 0) return m;
    const c = compareColumn(a, b, key);
    return dir === "asc" ? c : -c;
  });
}

export function uniqueValues(items: GarmentListItem[], pick: (item: GarmentListItem) => string | null): string[] {
  return [...new Set(items.map(pick).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b, "ko", { numeric: true }),
  );
}

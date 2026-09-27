import type { MeasurementKey } from "@/lib/constants/measurements";
import { SEASONS } from "@/lib/constants/seasons";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";

/** 표 헤더를 눌러 정렬할 수 있는 열. 이미지·세부분류·제품명은 정렬하지 않는다. */
export type SortableColumn = "brand" | "size" | "color" | "season" | "purchasedOn" | "price" | MeasurementKey;
export type SortDirection = "asc" | "desc";
export interface ColumnSort {
  key: SortableColumn;
  dir: SortDirection;
}

/**
 * 지금은 화면 확인용 로컬 상태다. 6단계에서 URL searchParams + 서버 조회로 옮긴다.
 * 정렬은 필터에 두지 않고 대분류 표마다 따로 둔다(WardrobeView의 sorts).
 */
export interface WardrobeFilters {
  categories: CategoryId[];
  subcategory: string;
  brand: string;
  season: Season | "";
  color: string;
  q: string;
}

/** 표마다의 기본 정렬: 최근에 산 옷이 위로 */
export const DEFAULT_SORT: ColumnSort = { key: "purchasedOn", dir: "desc" };

export const DEFAULT_FILTERS: WardrobeFilters = {
  categories: ["outer", "top", "bottom"],
  subcategory: "",
  brand: "",
  season: "",
  color: "",
  q: "",
};

export function isFiltered(f: WardrobeFilters): boolean {
  return f.categories.length < 3 || Boolean(f.subcategory || f.brand || f.season || f.color || f.q);
}

/** 날짜·가격은 큰 값부터, 나머지는 가나다·작은 값부터 시작한다. */
const firstDirection = (key: SortableColumn): SortDirection =>
  key === "purchasedOn" || key === "price" ? "desc" : "asc";

/**
 * 같은 열을 누를 때마다 첫 방향 → 반대 방향 → 기본 정렬(최근 구매순) 순서로 바뀐다.
 * 기본 정렬 상태에서 구매일을 누르면 반대 방향(오래된 순)부터 시작한다.
 */
export function nextSort(cur: ColumnSort, key: SortableColumn): ColumnSort {
  const first = firstDirection(key);
  if (cur.key !== key) return { key, dir: first };
  const flipped: SortDirection = cur.dir === "asc" ? "desc" : "asc";
  if (cur.dir === first) return { key, dir: flipped };
  return DEFAULT_SORT;
}

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SEASON_ORDER = SEASONS.map((s) => s.id);

/** 정렬용 값. 문자 사이즈(XS~XXXL)는 치수 순서, 숫자 사이즈는 그 뒤에 숫자 순서 */
function sortValue(g: Garment, key: SortableColumn): string | number | null {
  switch (key) {
    case "brand":
      return g.brand || null;
    case "color":
      return g.colorName;
    case "purchasedOn":
      return g.purchasedOn;
    case "price":
      return g.purchasePrice;
    case "season":
      return g.seasons.length ? Math.min(...g.seasons.map((s) => SEASON_ORDER.indexOf(s))) : null;
    case "size": {
      if (!g.sizeLabel) return null;
      const i = LETTER_SIZES.indexOf(g.sizeLabel.toUpperCase());
      return i >= 0 ? i : 100 + (parseFloat(g.sizeLabel) || 0);
    }
    default:
      return g.measurements[key] ?? null;
  }
}

export function applyFilters(items: Garment[], f: WardrobeFilters): Garment[] {
  const q = f.q.trim().toLowerCase();
  return items.filter(
    (item) =>
      f.categories.includes(item.categoryId) &&
      (!f.subcategory || item.subcategoryId === f.subcategory) &&
      (!f.brand || item.brand === f.brand) &&
      (!f.season || item.seasons.includes(f.season)) &&
      (!f.color || item.colorName === f.color) &&
      (!q || `${item.brand} ${item.productName}`.toLowerCase().includes(q)),
  );
}

/** 표 하나를 정렬한 새 배열. 값이 없는 항목은 정렬 방향과 관계없이 뒤로 보낸다. */
export function sortGarments(items: Garment[], { key, dir }: ColumnSort): Garment[] {
  const sign = dir === "asc" ? 1 : -1;
  return items.slice().sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === "string" ? va.localeCompare(String(vb), "ko", { numeric: true }) : va - Number(vb);
    return c * sign;
  });
}

export function uniqueValues(items: Garment[], pick: (item: Garment) => string | null): string[] {
  return [...new Set(items.map(pick).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b, "ko", { numeric: true }),
  );
}

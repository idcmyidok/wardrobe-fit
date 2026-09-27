import { MEASUREMENT_LABELS, type MeasurementKey } from "@/lib/constants/measurements";
import { SEASONS } from "@/lib/constants/seasons";
import type { WardrobeSort } from "@/lib/constants/sort";
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
 * sort는 정렬 Select의 값이거나, 표 헤더를 눌러 만든 열 정렬이다.
 */
export interface WardrobeFilters {
  categories: CategoryId[];
  subcategory: string;
  brand: string;
  season: Season | "";
  size: string;
  color: string;
  q: string;
  sort: WardrobeSort | ColumnSort;
}

export const DEFAULT_SORT: WardrobeSort = "purchased_desc";

export const DEFAULT_FILTERS: WardrobeFilters = {
  categories: ["outer", "top", "bottom"],
  subcategory: "",
  brand: "",
  season: "",
  size: "",
  color: "",
  q: "",
  sort: DEFAULT_SORT,
};

export function isFiltered(f: WardrobeFilters): boolean {
  return f.categories.length < 3 || Boolean(f.subcategory || f.brand || f.season || f.size || f.color || f.q);
}

const PRESET: Record<WardrobeSort, { key: SortableColumn | "created"; dir: SortDirection }> = {
  purchased_desc: { key: "purchasedOn", dir: "desc" },
  purchased_asc: { key: "purchasedOn", dir: "asc" },
  created_desc: { key: "created", dir: "desc" },
  price_desc: { key: "price", dir: "desc" },
  price_asc: { key: "price", dir: "asc" },
};

/** 지금 정렬 기준(열 + 방향) */
export function currentSort(sort: WardrobeFilters["sort"]): { key: SortableColumn | "created"; dir: SortDirection } {
  return typeof sort === "string" ? PRESET[sort] : sort;
}

/** 날짜·가격은 큰 값부터, 나머지는 가나다·작은 값부터 시작한다. */
const firstDirection = (key: SortableColumn): SortDirection =>
  key === "purchasedOn" || key === "price" ? "desc" : "asc";

/**
 * 같은 열을 누를 때마다 첫 방향 → 반대 방향 → 기본 정렬(최근 구매순) 순서로 바뀐다.
 * 정렬 Select로 고른 기준과 같은 열을 누르면 반대 방향부터 시작한다.
 */
export function nextSort(sort: WardrobeFilters["sort"], key: SortableColumn): WardrobeFilters["sort"] {
  const cur = currentSort(sort);
  const first = firstDirection(key);
  if (cur.key !== key) return { key, dir: first };
  const flipped: SortDirection = cur.dir === "asc" ? "desc" : "asc";
  if (typeof sort === "string" || cur.dir === first) return { key, dir: flipped };
  return DEFAULT_SORT;
}

const COLUMN_LABEL: Record<SortableColumn, string> = {
  ...MEASUREMENT_LABELS,
  brand: "브랜드",
  size: "사이즈",
  color: "컬러",
  season: "시즌",
  purchasedOn: "구매일",
  price: "구매가",
};

/** 헤더 정렬 중일 때 정렬 Select에 보여줄 이름. 예: "브랜드 오름차순" */
export function columnSortLabel(sort: ColumnSort): string {
  return `${COLUMN_LABEL[sort.key].replace("단면", "")} ${sort.dir === "asc" ? "오름차순" : "내림차순"}`;
}

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SEASON_ORDER = SEASONS.map((s) => s.id);

/** 정렬용 값. 문자 사이즈(XS~XXXL)는 치수 순서, 숫자 사이즈는 그 뒤에 숫자 순서 */
function sortValue(g: Garment, key: SortableColumn): string | number | null {
  switch (key) {
    case "brand":
      return g.brand;
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

  const { key, dir } = currentSort(f.sort);
  const value = (g: Garment) => (key === "created" ? items.indexOf(g) : sortValue(g, key));
  const sign = dir === "asc" ? 1 : -1;

  // 값이 없는 항목은 정렬 방향과 관계없이 뒤로 보낸다.
  return filtered.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
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

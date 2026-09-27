import { CATEGORIES } from "@/lib/constants/categories";
import { BOTTOM_MEASUREMENTS, TOP_MEASUREMENTS, type MeasurementKey } from "@/lib/constants/measurements";
import { SEASONS, wearsInSeason } from "@/lib/constants/seasons";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";

/** 표 헤더를 눌러 정렬할 수 있는 열. 이미지·세부분류·제품명은 정렬하지 않는다. */
export type SortableColumn = "brand" | "size" | "color" | "season" | "purchasedOn" | "price" | MeasurementKey;
export type SortDirection = "asc" | "desc";
export interface ColumnSort {
  key: SortableColumn;
  dir: SortDirection;
}

/**
 * 옷장 필터. URL searchParams에 저장해 새로고침·뒤로가기·링크 공유에도 그대로 남는다(PROJECT_SPEC.md 5.2).
 * 정렬과 페이지는 필터에 두지 않고 대분류 표마다 따로 둔다(WardrobeState).
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
      (!f.season || wearsInSeason(item.seasons, f.season)) &&
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

/** 표 하나에 한 번에 보여주는 행 수(PROJECT_SPEC.md 5.2) */
export const PAGE_SIZE = 50;

export type PerCategory<T> = Record<CategoryId, T>;

/** URL에 담는 옷장 화면 상태 전체 */
export interface WardrobeState {
  filters: WardrobeFilters;
  sorts: PerCategory<ColumnSort>;
  /** 1부터 시작 */
  pages: PerCategory<number>;
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const SORT_KEYS: Record<CategoryId, readonly SortableColumn[]> = {
  outer: ["brand", "size", "color", "season", "purchasedOn", "price", ...TOP_MEASUREMENTS],
  top: ["brand", "size", "color", "season", "purchasedOn", "price", ...TOP_MEASUREMENTS],
  bottom: ["brand", "size", "color", "season", "purchasedOn", "price", ...BOTTOM_MEASUREMENTS],
};
const SEASON_IDS = SEASONS.map((s) => s.id);
const MAX_TEXT = 100;

const perCategory = <T,>(value: T): PerCategory<T> => ({ outer: value, top: value, bottom: value });

/** 잘못된 값은 조용히 기본값으로 돌린다(손으로 고친 URL, 오래된 링크). */
export function parseWardrobeParams(params: URLSearchParams): WardrobeState {
  const text = (key: string) => (params.get(key) ?? "").slice(0, MAX_TEXT);
  const cats = (params.get("cat") ?? "").split(",").filter((c): c is CategoryId => CATEGORY_IDS.includes(c as CategoryId));
  const season = text("season");
  const filters: WardrobeFilters = {
    categories: cats.length ? CATEGORY_IDS.filter((c) => cats.includes(c)) : DEFAULT_FILTERS.categories,
    subcategory: text("sub"),
    brand: text("brand"),
    season: SEASON_IDS.includes(season as Season) ? (season as Season) : "",
    color: text("color"),
    q: text("q"),
  };
  const sorts = perCategory(DEFAULT_SORT);
  const pages = perCategory(1);
  for (const id of CATEGORY_IDS) {
    const [key, dir] = (params.get(`sort_${id}`) ?? "").split(".");
    if (SORT_KEYS[id].includes(key as SortableColumn) && (dir === "asc" || dir === "desc")) {
      sorts[id] = { key: key as SortableColumn, dir };
    }
    const page = Number(params.get(`page_${id}`));
    if (Number.isInteger(page) && page > 1) pages[id] = page;
  }
  return { filters, sorts, pages };
}

/** 기본값은 빼고 적는다. 필터가 없고 기본 정렬이면 빈 문자열. */
export function toWardrobeSearch({ filters: f, sorts, pages }: WardrobeState): string {
  const params = new URLSearchParams();
  if (f.categories.length < CATEGORY_IDS.length) params.set("cat", f.categories.join(","));
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.subcategory) params.set("sub", f.subcategory);
  if (f.brand) params.set("brand", f.brand);
  if (f.season) params.set("season", f.season);
  if (f.color) params.set("color", f.color);
  for (const id of CATEGORY_IDS) {
    const s = sorts[id];
    if (s.key !== DEFAULT_SORT.key || s.dir !== DEFAULT_SORT.dir) params.set(`sort_${id}`, `${s.key}.${s.dir}`);
    if (pages[id] > 1) params.set(`page_${id}`, String(pages[id]));
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** 필터를 바꾸면 모든 표를 첫 페이지로 돌린다. */
export const withFilters = (state: WardrobeState, filters: WardrobeFilters): WardrobeState => ({
  ...state,
  filters,
  pages: perCategory(1),
});

/** 페이지 번호를 1~마지막 페이지 사이로 맞춘다. */
export const clampPage = (page: number, total: number) => Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / PAGE_SIZE)));

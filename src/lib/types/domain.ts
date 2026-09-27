export type CategoryId = "outer" | "top" | "bottom";
export type Season = "spring" | "summer" | "fall" | "winter";

/** 내 옷장 목록에 필요한 필드만 우선 정의한다. 전체 타입은 PROJECT_SPEC.md 9장 참고. */
export interface GarmentListItem {
  id: string;
  categoryId: CategoryId;
  subcategoryId: string | null;
  brand: string;
  productName: string;
  sizeLabel: string | null;
  colorName: string | null;
  seasons: Season[];
  purchasedOn: string | null; // YYYY-MM-DD
  purchasePrice: number | null; // KRW 정수
  imageUrl: string | null;
}

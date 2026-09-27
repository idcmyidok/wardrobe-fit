import type { MeasurementKey } from "@/lib/constants/measurements";

export type CategoryId = "outer" | "top" | "bottom";
export type Season = "spring" | "summer" | "fall" | "winter";

/** cm, 단면 기준. 없으면 null */
export type Measurements = Partial<Record<MeasurementKey, number | null>>;

/** 옷 한 벌. PROJECT_SPEC.md 9장 Garment에서 인증·저장 관련 필드를 뺀 화면용 타입 */
export interface Garment {
  id: string;
  categoryId: CategoryId;
  subcategoryId: string | null;
  brand: string;
  productName: string;
  sizeLabel: string | null;
  colorName: string | null;
  material: string | null;
  seasons: Season[];
  purchasedOn: string | null; // YYYY-MM-DD
  purchasePrice: number | null; // KRW 정수
  productUrl: string | null;
  imageUrl: string | null;
  measurements: Measurements;
  fitReview: string | null;
}

/** 목록 화면용 별칭(기존 코드 호환) */
export type GarmentListItem = Garment;

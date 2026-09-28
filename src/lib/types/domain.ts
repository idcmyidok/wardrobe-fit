import type { MeasurementKey } from "@/lib/constants/measurements";
import type { ShoeFit } from "@/lib/constants/shoe-fit";

export type CategoryId = "outer" | "top" | "bottom" | "hat" | "shoes";
/** 구매 판단(치수 비교)을 하는 대분류. 모자·신발은 옷장에만 저장한다. */
export type FitCategoryId = "outer" | "top" | "bottom";
/** "all"(사계절)은 다른 시즌과 함께 고르지 않는다. */
export type Season = "spring" | "summer" | "fall" | "winter" | "all";

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
  seasons: Season[];
  purchasedOn: string | null; // YYYY-MM-DD
  purchasePrice: number | null; // KRW 정수
  productUrl: string | null;
  /** 사진(약 1600px). 비공개 bucket의 signed URL이라 잠시 뒤 만료된다. */
  imageUrl: string | null;
  /** 목록용 썸네일(약 300px). 없으면 imageUrl을 쓴다. */
  thumbUrl?: string | null;
  measurements: Measurements;
  fitReview: string | null;
  /** 신발만: 신어 본 느낌(길이감·발볼·발등). 다른 대분류는 null */
  shoeFit: ShoeFit | null;
}

/** 목록 화면용 별칭(기존 코드 호환) */
export type GarmentListItem = Garment;

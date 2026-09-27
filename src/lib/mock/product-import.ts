import type { CategoryId, Season } from "@/lib/types/domain";

/**
 * 상품 URL 분석 흉내. 실제 Import 모듈(PROJECT_SPEC.md 12~14장)을 붙이기 전까지
 * 시안과 같은 결과를 돌려준다. 무신사·29CM 링크는 성공, 그 외는 실패로 처리한다.
 */

export const ANALYZE_STEPS = ["페이지 불러오는 중", "상품 정보 읽는 중", "사이즈표·컬러 정리 중"];

export function isSupportedUrl(url: string): boolean {
  return /musinsa|29cm/.test(url);
}

export const EXTRACTED = {
  categoryId: "top" as CategoryId,
  subcategoryId: "top.shirt",
  brand: "ARKET",
  productName: "헤비 코튼 오버셔츠",
  material: "면 100%",
  seasons: ["spring", "fall"] as Season[],
  price: "119000",
  date: "2026-09-27",
  source: "musinsa.com",
  fieldCount: 11,
  imageCount: 8,
};

/** 사이즈표: 사이즈를 고르면 실측이 채워진다. */
export const EXTRACTED_SIZE_CHART: Record<string, Record<string, string>> = {
  S: { shoulder: "44", chest: "55", length: "73", sleeve: "61" },
  M: { shoulder: "46", chest: "57.5", length: "75", sleeve: "62.5" },
  L: { shoulder: "48", chest: "60", length: "77", sleeve: "64" },
  XL: { shoulder: "50", chest: "62.5", length: "79", sleeve: "65.5" },
};

export const EXTRACTED_COLORS = ["다크 네이비", "스톤", "블랙"];

export const FAILED_DETAIL = "FETCH_BLOCKED · HTTP 403 · 4.2초 · parser: generic";

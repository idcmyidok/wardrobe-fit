import type { MeasurementKey } from "@/lib/constants/measurements";
import type { ShoeFit } from "@/lib/constants/shoe-fit";
import type { CategoryId, Measurements } from "@/lib/types/domain";

/**
 * 구매 판단 계산 결과 타입(PROJECT_SPEC.md 16.5 ComparisonReport를 사이즈 여러 개로 묶은 형태).
 * 모든 숫자와 판정은 서버의 결정적 계산으로 만든다. AI는 이 결과를 문장으로만 바꾼다.
 */

export type MatchLevel = "subcategory" | "category" | "similar";
export type Direction = "long" | "short" | "tight" | "loose" | "good";
export type Confidence = "insufficient" | "low" | "medium" | "high";

export interface ReviewSignal {
  dimension: MeasurementKey | "overall";
  direction: Direction;
  /** 1 조금 · 2 보통 · 3 많이 */
  strength: 1 | 2 | 3;
  /** 신호를 찾은 후기 구절(원문 그대로) */
  evidence: string;
}

/** 비교에 쓴 옷의 그때 값(나중에 옷을 고쳐도 결과는 그대로 보인다). 가격·구매일·링크는 담지 않는다. */
export interface ComparableSnapshot {
  garmentId: string;
  brand: string;
  productName: string;
  sizeLabel: string | null;
  subcategoryId: string | null;
  matchLevel: MatchLevel;
  measurements: Measurements;
  review: string | null;
  signals: ReviewSignal[];
  /** 신발만: 기록한 착용감 */
  shoeFit?: ShoeFit | null;
}

/** 신발 판단(실측 대신 사이즈 mm와 착용감). shoes.ts */
export interface ShoeSizeReport {
  candidateMm: number | null;
  /** 가진 신발로 추정한 평소 사이즈(5mm 단위) */
  idealMm: number | null;
  diffMm: number | null;
  basis: "sameBrand" | "all" | null;
  lengthVerdict: "small" | "good" | "large" | "unknown";
  cautions: Array<{ part: "width" | "instep"; garmentId: string; sameBrand: boolean; text: string }>;
}

export interface RangeStat {
  min: number;
  max: number;
  median: number;
  n: number;
}

export type Verdict = "within" | "above" | "below" | "unknown";
/** within 비슷함 · caution 주의 · weak 후기 없이 수치만 비교 · none 비교 불가 */
/** excluded: 값은 보여 주지만 핏 판단에는 쓰지 않는 치수(하의 허리) */
export type DimensionTag = "within" | "caution" | "weak" | "none" | "excluded";

export interface Anchor {
  garmentId: string;
  value: number;
  direction: Exclude<Direction, "good">;
  evidence: string;
  /** similar: 그 옷과 비슷함 · beyond: 그 옷보다도 더 그 방향 */
  relation: "similar" | "beyond";
}

export interface DimensionResult {
  key: MeasurementKey;
  candidate: number | null;
  /** 후기에 불만이 없는 옷(후기 있는 옷만)의 범위. 2벌 미만이면 null */
  comfortRange: RangeStat | null;
  /** 비교한 옷 전체의 범위 */
  ownedRange: RangeStat | null;
  /** 판정에 쓴 범위 */
  basis: "comfort" | "owned" | null;
  verdict: Verdict;
  /** 범위 밖이면 경계와의 거리(cm, 부호 포함). 범위 안이면 0 */
  distanceFromRange: number | null;
  anchors: Anchor[];
  tag: DimensionTag;
  /** 표에 쓰는 짧은 판단 문구 */
  judgement: string;
}

export interface SizeReport {
  sizeLabel: string;
  measurements: Measurements;
  confidence: Confidence;
  dimensions: DimensionResult[];
  nearest: Array<{ garmentId: string; distance: number }>;
  sameBrandSameSize: string[];
  limitations: string[];
  /** 규칙으로 만든 예상 핏 문장(AI 없이도 항상 있음) */
  summary: string;
  /** 신발만 */
  shoe?: ShoeSizeReport;
}

export interface FitComputed {
  version: 1;
  categoryId: CategoryId;
  subcategoryId: string | null;
  comparables: ComparableSnapshot[];
  /** 실측이 겹치지 않아 뺀 옷 수 */
  skippedCount: number;
  sizes: SizeReport[];
  /** 사이즈를 여러 개 고른 경우 어느 쪽이 가까운지 */
  sizeNote: string | null;
  /** AI 결과 캐시 키(같은 입력이면 AI를 다시 부르지 않는다) */
  aiInputHash?: string | null;
}

/** AI 요약(선택). 서버가 검증을 통과한 문장만 남긴다. */
export interface FitInterpretation {
  perSize: Array<{
    sizeLabel: string;
    overallFit: string;
    dimensionNotes: Array<{ dimension: MeasurementKey; note: string; citedGarmentIds: string[] }>;
  }>;
  reviewEvidence: Array<{ garmentId: string; quote: string; relevance: string }>;
  cautions: string[];
  sizeRecommendationNote: string | null;
}

/** AI 요약 상태. disabled: 키가 없어 규칙 요약만 · skipped: 데이터가 부족해 부르지 않음 */
export type AiStatus = "disabled" | "skipped" | "ok" | "cached" | "failed" | "limited";

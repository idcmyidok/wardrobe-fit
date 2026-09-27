import type { MeasurementKey } from "@/lib/constants/measurements";
import type { Measurements } from "@/lib/types/domain";

/**
 * AI 구매 판단 흉내. 실제 비교 엔진·AI 해석(PROJECT_SPEC.md 15~17장)을 붙이기 전까지
 * 시안과 같은 상품(Our Legacy 에브리데이 워크 자켓)과 판단 문구를 쓴다.
 */

export const FIT_PRODUCT = {
  url: "https://www.musinsa.com/products/4812077",
  categoryId: "outer" as const,
  subcategoryId: "outer.jacket",
  brand: "Our Legacy",
  productName: "에브리데이 워크 자켓",
  material: "코튼 100%",
  source: "musinsa.com",
  sizes: ["46", "48", "50"],
};

export type FitTag = "범위 내" | "주의" | "근거 부족" | "비교 불가";

export const FIT_BY_SIZE: Record<
  string,
  { m: Measurements; judge: Partial<Record<MeasurementKey, [FitTag, string]>>; summary: string }
> = {
  "46": {
    m: { shoulder: 45, chest: 56.5, length: 70.5, sleeve: 63, armhole: 24, hemWidth: null },
    judge: {
      shoulder: ["주의", "가장 좁은 베드포드 자켓보다 0.5 좁음. 어깨가 끼일 수 있음"],
      chest: ["주의", "니트 위에 입으면 답답할 수 있음"],
      length: ["주의", "만족 범위보다 0.5 김. 체감 차이는 작음"],
      sleeve: ["범위 내", "A.P.C. 자켓과 같은 길이"],
      armhole: ["근거 부족", "후기 언급 없음"],
      hemWidth: ["비교 불가", "신규 실측 없음"],
    },
    summary:
      "총장은 평소 입던 자켓과 거의 같지만, 어깨와 가슴이 가장 작은 자켓보다 0.5cm씩 작습니다. 니트 위에 겹쳐 입으면 답답하게 느낄 수 있습니다.",
  },
  "48": {
    m: { shoulder: 46.5, chest: 59, length: 72, sleeve: 64.5, armhole: 25, hemWidth: null },
    judge: {
      shoulder: ["범위 내", "만족했던 자켓들과 비슷함"],
      chest: ["범위 내", "만족했던 자켓들과 비슷함"],
      length: ["주의", "길다고 기록한 베드포드 자켓(71.5)보다도 김"],
      sleeve: ["주의", "소매가 길다고 적은 코치 자켓(64)보다 0.5 김"],
      armhole: ["근거 부족", "후기 언급 없음. 수치는 기존 자켓 사이"],
      hemWidth: ["비교 불가", "신규 실측 없음"],
    },
    summary:
      "어깨와 가슴은 평소 만족하던 자켓 범위 안에 있습니다. 총장은 72cm로, 길다고 기록한 베드포드 자켓(71.5cm)보다도 길어 길게 느낄 가능성이 높습니다. 소매도 조금 긴 편입니다.",
  },
  "50": {
    m: { shoulder: 48, chest: 61, length: 73.5, sleeve: 65.5, armhole: 26, hemWidth: null },
    judge: {
      shoulder: ["주의", "만족 범위보다 1.0 넓음. 어깨선이 떨어질 수 있음"],
      chest: ["주의", "만족 범위보다 1.0 여유"],
      length: ["주의", "기존 자켓 중 가장 긴 것보다 2.0 김"],
      sleeve: ["주의", "손등을 덮을 가능성"],
      armhole: ["근거 부족", "후기 언급 없음"],
      hemWidth: ["비교 불가", "신규 실측 없음"],
    },
    summary:
      "모든 치수가 만족 범위를 넘습니다. 어깨 48cm, 총장 73.5cm로 기존 자켓을 한 치수 크게 입는 느낌에 가깝습니다. 오버핏을 의도하지 않는다면 48이 더 가깝습니다.",
  },
};

/** 링크로 판단할 때 비교에 쓰는 옷(동일 세부분류 자켓 3벌) */
export const FIT_COMPARABLE_IDS = ["g1", "g9", "g10"];

/**
 * 착용 후기에서 "좋다/길다"로 읽힌 치수. 실제로는 AI가 후기를 해석해 만든다.
 * 만족 범위는 good으로 기록된 치수로만 정한다.
 */
export const REVIEW_SIGNALS: Record<string, Partial<Record<MeasurementKey, "good" | "long">>> = {
  g1: { shoulder: "good", chest: "good", length: "good" },
  g9: { shoulder: "good", chest: "good", length: "good", sleeve: "long" },
  g10: { shoulder: "good", chest: "good", length: "long" },
};

/** 링크 판단 결과의 착용 후기 근거(시안 문구) */
export const FIT_QUOTES = [
  {
    tag: "총장",
    accent: true,
    source: "Engineered Garments 베드포드 자켓 M · 총장 71.5",
    text: "어깨와 가슴은 마음에 드는데 총장이 조금 길다.",
    note: "신규 옷의 총장이 이 옷보다 길어, 같은 느낌이거나 더 길게 느낄 수 있습니다.",
  },
  {
    tag: "어깨 · 가슴",
    accent: false,
    source: "Nanamica 코튼 코치 자켓 L · 어깨 47 가슴 60",
    text: "어깨와 가슴은 딱 좋다. 총장은 엉덩이를 반쯤 덮어서 적당하다. 소매는 조금 긴 편.",
    note: "만족 범위의 위쪽 끝을 정하는 옷입니다. 소매 판단의 유일한 근거이기도 합니다.",
  },
  {
    tag: "어깨 · 가슴",
    accent: false,
    source: "A.P.C. 울 블렌드 워크 자켓 M · 어깨 46 가슴 58",
    text: "어깨 딱 맞고 가슴도 여유 적당. 니트 위에 입어도 답답하지 않다.",
    note: null,
  },
];

export const FIT_LIMITS = [
  "밑단너비: 신규 상품 사이즈표에 없어 비교하지 않았습니다.",
  "암홀: 기존 옷의 후기에 언급이 없어 수치만 표시했습니다.",
  "비교한 자켓이 3벌입니다. 자켓 기록이 늘면 범위가 더 정확해집니다.",
];

export const FIT_WARNING =
  "암홀과 밑단너비는 근거가 없어 판단하지 않았습니다. 소매는 비교한 옷 중 1벌의 후기에만 근거합니다.";

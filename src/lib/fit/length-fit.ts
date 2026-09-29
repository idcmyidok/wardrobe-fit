import { formatNum } from "@/lib/constants/measurements";
import type { CategoryId } from "@/lib/types/domain";

/**
 * 총장 길이감(키 기준). 핏 판정과 따로 본다. 총장을 키에 비례한 기준과 비교해 크롭 … 오버핏 5단계로 나눈다.
 * 몸무게는 쓰지 않는다. 바지(내려 입는 경우가 많다)·반바지·모자·신발, 길이가 디자인·취향인 셔츠·블레이저·코트·롱패딩은 판정하지 않는다.
 * 숫자는 LENGTH_BASE 한곳에만 둔다(키 177cm 기준). 사용자가 추천 표에서 고친 범위가 있으면 그 범위를 쓴다.
 */

export const LENGTH_LEVELS = ["crop", "semi_crop", "regular", "semi_over", "over"] as const;
export type LengthLevel = (typeof LENGTH_LEVELS)[number];
export const LENGTH_LEVEL_NAME: Record<LengthLevel, string> = {
  crop: "크롭",
  semi_crop: "세미크롭",
  regular: "정핏",
  semi_over: "세미오버",
  over: "오버핏",
};

export type LengthGroup = "inner" | "outer";
export const LENGTH_GROUPS: LengthGroup[] = ["inner", "outer"];
export const LENGTH_GROUP_NAME: Record<LengthGroup, string> = { inner: "이너", outer: "아우터" };

export type Band = [number, number];
/** 사용자가 고친 총장 추천(cm). 내 치수의 추천 치수 수정값(fit_overrides)의 length 칸에 저장한다. */
export type LengthOverrides = Partial<Record<LengthGroup, Partial<Record<LengthLevel, Band>>>>;

/** 기준 키(cm). 다른 키는 이 값에 비례해 늘리고 줄인다. */
export const REFERENCE_HEIGHT = 177;
/** 키 177cm 기준 경계 6개: 크롭 [0]~[1], 세미크롭 ~[2], 정핏 ~[3], 세미오버 ~[4], 오버핏 ~[5] */
export const LENGTH_BASE: Record<LengthGroup, readonly [number, number, number, number, number, number]> = {
  inner: [60, 64, 67, 71, 74, 78],
  // 아우터는 안에 입은 옷을 덮도록 이너보다 2cm 길게
  outer: [62, 66, 69, 73, 76, 80],
};

/** 길이감을 보지 않는 아우터 세부분류(셔츠·블레이저·코트·롱패딩) */
const EXCLUDED_OUTER = new Set([
  "outer.shirt",
  "outer.blazer",
  "outer.transition_coat",
  "outer.single_coat",
  "outer.double_coat",
  "outer.winter_coat",
  "outer.long_padding",
]);

export function lengthGroupOf(categoryId: CategoryId, subcategoryId: string | null): LengthGroup | null {
  if (categoryId === "top") return "inner";
  if (categoryId === "outer") return subcategoryId && EXCLUDED_OUTER.has(subcategoryId) ? null : "outer";
  return null;
}

const half = (v: number) => Math.round(v * 2) / 2;

/** 내 키 기준 단계별 추천 총장(0.5cm 단위). 고친 값이 있으면 그 값. */
export function lengthBands(group: LengthGroup, height: number, overrides: LengthOverrides = {}): Record<LengthLevel, Band> {
  const base = LENGTH_BASE[group].map((v) => half((v * height) / REFERENCE_HEIGHT));
  const out = {} as Record<LengthLevel, Band>;
  LENGTH_LEVELS.forEach((level, i) => {
    out[level] = overrides[group]?.[level] ?? [base[i], base[i + 1]];
  });
  return out;
}

/** 단계별 구간 → 경계 6개. 벌어지거나 겹치면 가운데를 쓰되, 사용자가 고친 구간은 양끝을 그대로 쓰고 이웃을 밀어낸다. */
function thresholdsOf(bands: Record<LengthLevel, Band>, edited: LengthLevel[]): number[] {
  const t = [bands.crop[0]];
  for (let i = 0; i < LENGTH_LEVELS.length - 1; i++) t.push((bands[LENGTH_LEVELS[i]][1] + bands[LENGTH_LEVELS[i + 1]][0]) / 2);
  t.push(bands.over[1]);
  for (const level of edited) {
    const i = LENGTH_LEVELS.indexOf(level);
    t[i] = bands[level][0];
    t[i + 1] = bands[level][1];
    for (let j = 0; j < i; j++) t[j] = Math.min(t[j], t[i]);
    for (let j = i + 2; j < t.length; j++) t[j] = Math.max(t[j], t[i + 1]);
  }
  for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i], t[i - 1]);
  return t;
}

export type LengthFitResult =
  | {
      status: "ok";
      group: LengthGroup;
      level: LengthLevel;
      /** 크롭보다 짧거나(short) 오버핏보다 길다(long) */
      extreme: "short" | "long" | null;
      length: number;
      height: number;
      bands: Record<LengthLevel, Band>;
      /** 사용자가 고친 범위를 썼는지 */
      edited: boolean;
    }
  | { status: "unsupported" }
  | { status: "insufficient"; missingHeight: boolean; missingLength: boolean };

export function computeLengthFit(
  garment: { categoryId: CategoryId; subcategoryId: string | null; measurements: { length?: number | null } },
  height: number | null | undefined,
  overrides: LengthOverrides = {},
): LengthFitResult {
  const group = lengthGroupOf(garment.categoryId, garment.subcategoryId);
  if (!group) return { status: "unsupported" };
  const length = garment.measurements.length;
  if (length == null || height == null) return { status: "insufficient", missingHeight: height == null, missingLength: length == null };
  const bands = lengthBands(group, height, overrides);
  const t = thresholdsOf(bands, LENGTH_LEVELS.filter((l) => overrides[group]?.[l]));
  let level: LengthLevel;
  let extreme: "short" | "long" | null = null;
  if (length < t[0]) {
    level = "crop";
    extreme = "short";
  } else if (length > t[5]) {
    level = "over";
    extreme = "long";
  } else {
    // 위 경계는 아래 단계에 넣는다(정핏 67~71이면 71은 정핏).
    const i = t.findIndex((x, idx) => idx > 0 && length <= x);
    level = LENGTH_LEVELS[Math.max(0, i - 1)];
  }
  return { status: "ok", group, level, extreme, length, height, bands, edited: Boolean(overrides[group] && Object.keys(overrides[group]!).length) };
}

export const lengthLevelLabel = (r: Extract<LengthFitResult, { status: "ok" }>) =>
  `${LENGTH_LEVEL_NAME[r.level]}${r.extreme === "short" ? "(매우 짧음)" : r.extreme === "long" ? "(매우 김)" : ""}`;

export const bandLabel = (b: Band) => `${formatNum(b[0])}~${formatNum(b[1])}`;

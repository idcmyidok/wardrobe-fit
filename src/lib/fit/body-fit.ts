import { WEARABLE_LEVELS, fitLevelName, type BodyKey, type FitKind, type FitLevel, type WearableLevel } from "@/lib/constants/body";
import { formatNum } from "@/lib/constants/measurements";
import type { CategoryId, Measurements } from "@/lib/types/domain";

/**
 * 내 치수로 옷의 예상 핏을 계산하는 규칙 엔진(AI 없음).
 *
 * 핵심은 여유분(ease)이다. 옷 실측(단면이면 ×2)에서 몸 치수를 빼고, 옷 종류마다 정해 둔 경계값과 비교해
 * 부위마다 6단계(너무 작음·슬림·레귤러·세미오버·오버·너무 큼)를 먼저 정한다. 그다음 부위를 합친다.
 * - 상의: 가슴이 기본 축(몸통 크기), 어깨는 실루엣을 더하는 보조 축
 * - 하의: 허벅지가 기본 축, 엉덩이가 보조 축. 허리는 핏 단계와 관계없이 크고 작은지만 본다.
 * - 두 부위 단계 차이가 1 이하면 가중 평균, 2 이상이면 기본 축에서 다른 부위 쪽으로 한 단계만 옮긴다.
 * - 한 부위만 너무 작음·너무 큼이면 전체를 그렇게 만들지 않는다(상의 가슴 너무 작음, 하의 몸보다 좁음은 예외).
 * 제품명(오버핏·슬림핏 등)과 원단·두께·신축성은 판정에 쓰지 않는다.
 *
 * 보정 순서: 기본 경계값 → "내 핏"을 표기한 옷으로 옮긴 기준(최대 ±4cm) → 사용자가 고친 추천 치수.
 * 숫자는 FIT_GROUPS·WAIST·아래 상수에만 둔다. 실제 입어 본 느낌과 다르면 여기 숫자만 고친다.
 */

export type WidthKey = "chest" | "shoulder" | "waist" | "hip" | "thigh";
/** 추천 치수 표에 쓰는 옷 실측. 총장·소매는 핏과 관계가 적어 보지 않는다(옷장 옷과의 길이 비교는 구매 판단에서). */
export type RecKey = WidthKey;
export type Band = [number, number];

export type FitGroupId =
  | "short_tee"
  | "long_tee"
  | "knit"
  | "shirt"
  | "light_outer"
  | "leather"
  | "coat"
  | "padding"
  | "pants"
  | "shorts";

/** 사용자가 고친 추천 치수(옷 실측 기준: 가슴·허리·엉덩이·허벅지는 단면, 어깨는 그대로). 허리는 핏 단계와 무관해 regular 칸에 둔다. */
export type FitOverrides = Partial<Record<FitGroupId, Partial<Record<WearableLevel, Partial<Record<RecKey, Band>>>>>>;

export interface BodyProfile {
  values: Partial<Record<BodyKey, number>>;
  /** "정확하지 않아요"로 표시한 치수: 느슨하게 적용하고 신뢰도를 낮춘다. */
  uncertain: BodyKey[];
  overrides: FitOverrides;
  updatedAt: string | null;
}

export const EMPTY_BODY: BodyProfile = { values: {}, uncertain: [], overrides: {}, updatedAt: null };

/** 핏을 가르는 폭 치수(허리 제외) */
type LevelKey = Exclude<WidthKey, "waist">;
/**
 * 여유 경계 5개: 너무 작음 | 슬림 | 레귤러 | 세미오버 | 오버 | 너무 큼.
 * 슬림은 [0]~[1](양끝 포함), 나머지는 (앞 경계, 뒤 경계]. [4]를 넘으면 너무 큼.
 */
type Thresholds = readonly [number, number, number, number, number];

interface GroupDef {
  id: FitGroupId;
  name: string;
  kind: FitKind;
  /** 가슴·허리·엉덩이·허벅지는 옷 둘레 − 몸 둘레, 어깨는 옷 어깨 − 몸 어깨(직선) */
  width: Partial<Record<LevelKey, Thresholds>>;
  /** 종합 판정 가중치(합 1) */
  weight: Partial<Record<LevelKey, number>>;
}

export const FIT_GROUPS: GroupDef[] = [
  { id: "short_tee", name: "반팔 티셔츠", kind: "top", width: { chest: [2, 6, 12, 20, 28], shoulder: [-1, 1, 3, 6, 10] }, weight: { chest: 0.6, shoulder: 0.4 } },
  { id: "long_tee", name: "긴팔·맨투맨·후드", kind: "top", width: { chest: [4, 8, 14, 22, 32], shoulder: [-1, 1.5, 4, 8, 13] }, weight: { chest: 0.55, shoulder: 0.45 } },
  { id: "knit", name: "니트·카디건", kind: "top", width: { chest: [3, 7, 13, 20, 28], shoulder: [-1, 1, 3, 6, 10] }, weight: { chest: 0.65, shoulder: 0.35 } },
  { id: "shirt", name: "셔츠", kind: "top", width: { chest: [4, 8, 14, 22, 30], shoulder: [-0.5, 1.5, 3, 6, 10] }, weight: { chest: 0.55, shoulder: 0.45 } },
  { id: "light_outer", name: "가벼운 아우터·바람막이", kind: "top", width: { chest: [6, 12, 18, 26, 36], shoulder: [-0.5, 2, 4, 8, 13] }, weight: { chest: 0.65, shoulder: 0.35 } },
  { id: "leather", name: "레더·무스탕", kind: "top", width: { chest: [4, 8, 14, 20, 28], shoulder: [-0.5, 1, 3, 6, 10] }, weight: { chest: 0.6, shoulder: 0.4 } },
  { id: "coat", name: "코트", kind: "top", width: { chest: [10, 16, 24, 32, 42], shoulder: [-0.5, 2, 4, 8, 14] }, weight: { chest: 0.65, shoulder: 0.35 } },
  { id: "padding", name: "패딩", kind: "top", width: { chest: [16, 24, 34, 44, 56], shoulder: [-0.5, 2, 5, 9, 14] }, weight: { chest: 0.75, shoulder: 0.25 } },
  { id: "pants", name: "긴 바지", kind: "bottom", width: { hip: [2, 6, 10, 16, 24], thigh: [2, 4, 8, 14, 22] }, weight: { thigh: 0.55, hip: 0.45 } },
  { id: "shorts", name: "반바지", kind: "bottom", width: { hip: [3, 6, 11, 17, 25], thigh: [3, 5, 9, 15, 23] }, weight: { thigh: 0.6, hip: 0.4 } },
];

/**
 * 하의 허리(여유 cm): 핏 단계와 관계없이 크기만 본다. 밴딩·조절 여부를 몰라 입을 수 있는지 단정하지 않는다.
 * 너무 작음(전체 판정도 너무 작음) < −6 ≤ 작음 < −2 ≤ 적정 ≤ +2 < 너무 큼
 */
export const WAIST = { tooSmall: -6, fit: [-2, 2] as Band, tooBig: 2 } as const;
export const WAIST_TOO_SMALL = WAIST.tooSmall;
export const WAIST_TOO_BIG = WAIST.tooBig;
export type WaistState = "too_small" | "small" | "fit" | "too_big";
export const WAIST_STATE_NAME: Record<WaistState, string> = { too_small: "너무 작음", small: "작음", fit: "적정", too_big: "너무 큼" };

/** 상의 기본 축·보조 축, 하의 기본 축·보조 축 */
const AXES: Record<FitKind, [LevelKey, LevelKey]> = { top: ["chest", "shoulder"], bottom: ["thigh", "hip"] };
/** 핏 단계 점수(너무 작음 −1 … 너무 큼 4) */
const LEVEL_INDEX: Record<FitLevel, number> = { too_small: -1, slim: 0, regular: 1, semi_over: 2, over: 3, too_big: 4 };
const INDEX_LEVEL: FitLevel[] = ["too_small", "slim", "regular", "semi_over", "over", "too_big"];
/** 경계에서 이만큼(cm) 안이면 경계로 본다. 상의 가슴이 슬림 하한보다 이만큼 안으로 작으면 너무 작음 대신 슬림. */
const BOUNDARY_CM = 1;
/** "정확하지 않아요" 치수는 이만큼(cm) 느슨하게 본다. */
const UNCERTAIN_TOLERANCE = 3;
/** 내 핏 표기로 옮기는 기준의 한계(cm) */
const CALIBRATION_LIMIT = 4;

const GROUP = Object.fromEntries(FIT_GROUPS.map((g) => [g.id, g])) as Record<FitGroupId, GroupDef>;

/** 세부분류 → 핏 묶음. 없는 세부분류는 대분류 기본값. 점프슈트·오버올은 상하의가 붙어 있어 계산하지 않는다(null). */
const SUBCATEGORY_GROUP: Record<string, FitGroupId | null> = {
  "top.short_tee": "short_tee",
  "top.sleeveless": "short_tee",
  "top.polo": "short_tee",
  "top.long_tee": "long_tee",
  "top.sweatshirt": "long_tee",
  "top.hoodie": "long_tee",
  "top.etc": "long_tee",
  "top.knit": "knit",
  "outer.cardigan": "knit",
  "outer.shirt": "shirt",
  "outer.leather": "leather",
  "outer.mustang": "leather",
  "outer.transition_coat": "coat",
  "outer.single_coat": "coat",
  "outer.double_coat": "coat",
  "outer.winter_coat": "coat",
  "outer.light_padding": "padding",
  "outer.short_padding": "padding",
  "outer.long_padding": "padding",
  "bottom.shorts": "shorts",
  "bottom.jumpsuit": null,
};
const CATEGORY_GROUP: Partial<Record<CategoryId, FitGroupId>> = { top: "long_tee", outer: "light_outer", bottom: "pants" };

export function fitGroupOf(categoryId: CategoryId, subcategoryId: string | null): FitGroupId | null {
  if (subcategoryId && subcategoryId in SUBCATEGORY_GROUP) return SUBCATEGORY_GROUP[subcategoryId];
  return CATEGORY_GROUP[categoryId] ?? null;
}

export const fitGroupName = (id: FitGroupId) => GROUP[id].name;
export const fitGroupKind = (id: FitGroupId) => GROUP[id].kind;

/** 옷 실측 → 몸과 비교할 값(단면 치수는 둘레로) */
const HALF: Record<WidthKey, boolean> = { chest: true, shoulder: false, waist: true, hip: true, thigh: true };
const BODY_OF: Record<WidthKey, BodyKey> = { chest: "chest", shoulder: "shoulder", waist: "waist", hip: "hip", thigh: "thigh" };
const WIDTH_LABEL: Record<WidthKey, string> = { chest: "가슴", shoulder: "어깨", waist: "허리", hip: "엉덩이", thigh: "허벅지" };

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const center = ([lo, hi]: Band) => (lo + hi) / 2;

/** 받침이 있으면 true(이/가, 은/는 고르기) */
const hasBatchim = (word: string) => {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};
const iga = (w: string) => `${w}${hasBatchim(w) ? "이" : "가"}`;
const eunNeun = (w: string) => `${w}${hasBatchim(w) ? "은" : "는"}`;
const gwaWa = (w: string) => `${w}${hasBatchim(w) ? "과" : "와"}`;
const ieyo = (w: string) => `${w}${hasBatchim(w) ? "이에요" : "예요"}`;
const iraRa = (w: string) => `${w}${hasBatchim(w) ? "이라" : "라"}`;
const eulReul = (w: string) => `${w}${hasBatchim(w) ? "을" : "를"}`;
/** 으로/로: 받침이 없거나 ㄹ 받침이면 "로" */
const euro = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  const jong = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
  return `${w}${jong === 0 || jong === 8 ? "로" : "으로"}`;
};

const widthKeys = (group: GroupDef): WidthKey[] => (group.kind === "top" ? ["chest", "shoulder"] : ["hip", "thigh", "waist"]);

/** 기본 여유 구간(내 핏 보정 전). 허리는 핏 단계와 무관해 모든 단계가 적정 구간이다. */
function baseBands(group: GroupDef, key: WidthKey): Record<WearableLevel, Band> | null {
  if (key === "waist") return group.kind === "bottom" ? { slim: WAIST.fit, regular: WAIST.fit, semi_over: WAIST.fit, over: WAIST.fit } : null;
  const t = group.width[key];
  if (!t) return null;
  return { slim: [t[0], t[1]], regular: [t[1], t[2]], semi_over: [t[2], t[3]], over: [t[3], t[4]] };
}

/** 사용자가 고친 허리 적정 범위(어느 단계에 저장됐든 하나만 쓴다) */
function waistOverride(body: BodyProfile, groupId: FitGroupId): Band | undefined {
  const byLevel = body.overrides[groupId];
  if (!byLevel) return undefined;
  return byLevel.regular?.waist ?? WEARABLE_LEVELS.map((l) => byLevel[l]?.waist).find(Boolean);
}

/** 옷 한 벌: 예상 핏 계산 입력 */
export interface BodyFitGarment {
  id?: string;
  categoryId: CategoryId;
  subcategoryId: string | null;
  productName?: string | null;
  measurements: Measurements;
  userFit?: FitLevel | null;
}

/** "내 핏"을 표기한 옷으로 기준을 옮긴 값(ease cm). 같은 묶음 옷만 쓴다. */
export type Calibration = Partial<Record<FitGroupId, Partial<Record<WidthKey, number>>>>;

export function computeCalibration(body: BodyProfile, garments: BodyFitGarment[]): Calibration {
  const deltas: Partial<Record<FitGroupId, Partial<Record<WidthKey, number[]>>>> = {};
  for (const g of garments) {
    const level = g.userFit;
    if (!level || !(WEARABLE_LEVELS as readonly string[]).includes(level)) continue;
    const groupId = fitGroupOf(g.categoryId, g.subcategoryId);
    if (!groupId) continue;
    const group = GROUP[groupId];
    for (const key of widthKeys(group)) {
      if (key === "waist") continue;
      const bands = baseBands(group, key);
      const ease = easeOf(key, g.measurements, body);
      if (!bands || ease == null) continue;
      ((deltas[groupId] ??= {})[key] ??= []).push(ease - center(bands[level as WearableLevel]));
    }
  }
  const result: Calibration = {};
  for (const [groupId, byKey] of Object.entries(deltas) as [FitGroupId, Partial<Record<WidthKey, number[]>>][]) {
    for (const [key, list] of Object.entries(byKey) as [WidthKey, number[]][]) {
      // 한 벌뿐이면 절반만 옮긴다.
      const shift = clamp(median(list) * (list.length >= 2 ? 1 : 0.5), -CALIBRATION_LIMIT, CALIBRATION_LIMIT);
      if (Math.abs(shift) >= 0.5) (result[groupId] ??= {})[key] = round1(shift);
    }
  }
  return result;
}

function easeOf(key: WidthKey, m: Measurements, body: BodyProfile): number | null {
  const g = m[key];
  const b = body.values[BODY_OF[key]];
  if (g == null || b == null) return null;
  return round1((HALF[key] ? g * 2 : g) - b);
}

/** 옷 실측(표에 보이는 값) ↔ 여유 */
const toEase = (key: WidthKey, garmentValue: number, bodyValue: number) => (HALF[key] ? garmentValue * 2 : garmentValue) - bodyValue;
const fromEase = (key: WidthKey, ease: number, bodyValue: number) => (HALF[key] ? (ease + bodyValue) / 2 : ease + bodyValue);

/** 보정·사용자 수정까지 반영한 폭 치수 구간(여유 기준) */
function effectiveBands(groupId: FitGroupId, key: WidthKey, body: BodyProfile, calibration: Calibration): Record<WearableLevel, Band> | null {
  const group = GROUP[groupId];
  const base = baseBands(group, key);
  const b = body.values[BODY_OF[key]];
  if (!base || b == null) return null;
  if (key === "waist") {
    const o = waistOverride(body, groupId);
    const band: Band = o ? [toEase(key, o[0], b), toEase(key, o[1], b)] : WAIST.fit;
    return { slim: band, regular: band, semi_over: band, over: band };
  }
  const shift = calibration[groupId]?.[key] ?? 0;
  const out = {} as Record<WearableLevel, Band>;
  for (const level of WEARABLE_LEVELS) {
    const o = body.overrides[groupId]?.[level]?.[key];
    out[level] = o ? [toEase(key, o[0], b), toEase(key, o[1], b)] : [base[level][0] + shift, base[level][1] + shift];
  }
  return out;
}

/**
 * 단계별 구간 → 경계 5개. 구간이 벌어지면 가운데를 경계로 삼고,
 * 사용자가 고친 구간은 양끝을 그대로 쓰며 겹치는 이웃 구간을 밀어낸다.
 */
function thresholdsOf(bands: Record<WearableLevel, Band>, edited: WearableLevel[] = []): Thresholds {
  const mid = (a: number, b: number) => (a + b) / 2;
  const t = [
    bands.slim[0],
    mid(bands.slim[1], bands.regular[0]),
    mid(bands.regular[1], bands.semi_over[0]),
    mid(bands.semi_over[1], bands.over[0]),
    bands.over[1],
  ];
  for (const level of edited) {
    const i = WEARABLE_LEVELS.indexOf(level);
    t[i] = bands[level][0];
    t[i + 1] = bands[level][1];
    for (let j = 0; j < i; j++) t[j] = Math.min(t[j], t[i]);
    for (let j = i + 2; j < t.length; j++) t[j] = Math.max(t[j], t[i + 1]);
  }
  for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i], t[i - 1]);
  return t as unknown as Thresholds;
}

/** 여유 하나를 6단계 중 하나로. tol만큼 너무 작음·너무 큼을 봐준다. */
function classify(ease: number, t: Thresholds, tol: number): FitLevel {
  if (ease < t[0] - tol) return "too_small";
  if (ease > t[4] + tol) return "too_big";
  const e = clamp(ease, t[0], t[4]);
  return e <= t[1] ? "slim" : e <= t[2] ? "regular" : e <= t[3] ? "semi_over" : "over";
}

/**
 * 여유를 연속 점수로: 구간 한가운데가 그 단계 점수(슬림 0 … 오버 3), 경계는 ±0.5.
 * 경계 근처에서 1cm 차이로 결과가 갑자기 바뀌지 않게 가중 평균에 이 값을 쓴다.
 */
function positionOf(ease: number, t: Thresholds, tol: number): number {
  let e = ease;
  if (e < t[0] && e >= t[0] - tol) e = t[0];
  if (e > t[4] && e <= t[4] + tol) e = t[4];
  const w = (i: number) => Math.max(t[i + 1] - t[i], 0.5);
  if (e < t[0]) return Math.max(-1.5, -0.5 - (t[0] - e) / w(0));
  if (e > t[4]) return Math.min(4.5, 3.5 + (e - t[4]) / w(3));
  for (let i = 0; i < 4; i++) if (e <= t[i + 1]) return i - 0.5 + (e - t[i]) / w(i);
  return 3.5;
}

/**
 * 가중 평균 점수 → 단계(구간 경계는 ±0.5). 부위 판정처럼 위 경계는 아래 단계에 넣는다:
 * −0.5 미만 너무 작음, 0.5 이하 슬림, 1.5 이하 레귤러, 2.5 이하 세미오버, 3.5 이하 오버, 그 위 너무 큼
 */
const EPS = 1e-9;
const bucketIndex = (p: number) => (p < -0.5 - EPS ? -1 : p <= 0.5 + EPS ? 0 : p <= 1.5 + EPS ? 1 : p <= 2.5 + EPS ? 2 : p <= 3.5 + EPS ? 3 : 4);

function waistStateOf(ease: number, band: Band, tol: number): WaistState {
  if (ease < WAIST.tooSmall - tol) return "too_small";
  if (ease < band[0] - tol) return "small";
  if (ease <= band[1] + tol) return "fit";
  return "too_big";
}

export interface BodyFitDimension {
  key: WidthKey;
  label: string;
  ease: number;
  /** 허리는 적정 regular, 작음 slim, 너무 작음·너무 큼은 그대로(표시는 waist 상태로) */
  level: FitLevel;
  uncertain: boolean;
  /** 판단 근거용: 옷 실측(표에 보이는 값), 내 치수, 단면이면 true */
  garmentValue: number;
  bodyValue: number;
  half: boolean;
  /** 판단에 쓴 핏 단계별 여유 구간(보정 반영). 허리는 null(적정 범위만 본다) */
  bands: Record<WearableLevel, Band> | null;
  /** 내 핏 표기로 옮긴 기준(cm) */
  shift: number;
  /** 사용자가 고친 추천 치수를 썼는지 */
  overridden: boolean;
  /** 허리 상태(허리만) */
  waist?: WaistState;
  /** 허리 적정 여유 구간(허리만) */
  waistBand?: Band;
  /** 연속 점수(슬림 0 … 오버 3). 허리는 없음 */
  position?: number;
  /** 핏 경계에서 1cm 안 */
  boundary?: boolean;
}

export interface BodyFitIssue {
  key: WidthKey;
  text: string;
  /** 너무 작음·너무 큼처럼 입기 어려운 문제 */
  severe: boolean;
}

export type Silhouette = "tapered" | "straight" | "flare";
export const SILHOUETTE_NAME: Record<Silhouette, string> = { tapered: "테이퍼드", straight: "스트레이트", flare: "플레어·부츠컷" };

/** 종합 판정이 어떤 규칙으로 나왔는지(판단 근거 문장용) */
export type FitRule =
  | "single"
  | "average"
  | "axis_shift"
  | "waist_small"
  | "core_small"
  | "no_room"
  | "both_small"
  | "core_big"
  | "chest_big"
  | "both_big";

export interface FitBasis {
  rule: FitRule;
  /** 기본 축과 보조 축(보조 축이 없으면 null) */
  axis: WidthKey;
  other: WidthKey | null;
  /** 판정에 쓴 비중(%) */
  weights: Partial<Record<WidthKey, number>>;
  /** 규칙을 일으킨 치수 */
  cause?: WidthKey;
  /** 가중 평균 연속 점수 */
  average: number | null;
  /** 상의 가슴이 슬림 하한보다 1cm 안으로 작아 슬림으로 봤다 */
  chestEdge: boolean;
  /** 하의 한 부위가 슬림보다 작아(몸보다는 넓음) 한 단계 작게 봤다 */
  pulledBy: WidthKey | null;
}

export type BodyFitResult =
  | {
      status: "ok";
      group: FitGroupId;
      kind: FitKind;
      level: FitLevel;
      /** 핏별 점수(0~100): 종합 판정 위치에 가까울수록 높다. 예상 핏이 가장 높다. */
      scores: Record<WearableLevel, number>;
      dimensions: BodyFitDimension[];
      /** 안 맞는 폭 치수 */
      issues: BodyFitIssue[];
      silhouette: Silhouette | null;
      /** 배기(품이 넉넉한데 밑단이 좁음) */
      baggy: boolean;
      /** 니트·스판 등 늘어나는 소재로 보이는지(안내만 하고 판정에는 쓰지 않는다) */
      stretch: boolean;
      /** 정확하지 않은 치수를 썼거나 핵심 치수가 하나뿐이면 low */
      confidence: "normal" | "low";
      calibrated: boolean;
      basis: FitBasis;
    }
  | { status: "unsupported" }
  /** missingBody: 내 치수에 입력이 필요한 항목, missingGarment: 옷 실측이 없는 항목 */
  | { status: "insufficient"; missingBody: BodyKey[]; missingGarment: WidthKey[] };

const STRETCH_WORDS = /니트|스웨터|스판|스트레치|레깅스|저지|골지|터틀넥|폴라|knit|sweater|stretch|spandex|jersey|legging/i;
const STRETCH_SUBCATEGORIES = new Set(["top.knit", "outer.cardigan", "bottom.leggings"]);

export function isStretchy(g: Pick<BodyFitGarment, "subcategoryId" | "productName">): boolean {
  return (g.subcategoryId != null && STRETCH_SUBCATEGORIES.has(g.subcategoryId)) || STRETCH_WORDS.test(g.productName ?? "");
}

/** 밑단 ÷ 허벅지 단면 비율로 실루엣을 본다. 무릎 실측이 없어 부츠컷과 플레어는 가르지 않는다. */
export function silhouetteOf(m: Measurements): Silhouette | null {
  if (m.legOpening == null || m.thigh == null || m.thigh <= 0) return null;
  const r = m.legOpening / m.thigh;
  return r < 0.65 ? "tapered" : r < 1 ? "straight" : "flare";
}

interface Scored extends BodyFitDimension {
  position: number;
  weight: number;
  t: Thresholds;
}

/** 부위별 판정을 합친다(모듈 설명의 규칙). */
function combine(kind: FitKind, dims: Scored[], waistTooSmall: WidthKey | null): { level: FitLevel; basis: FitBasis } {
  const [axisKey, otherKey] = AXES[kind];
  let axis = dims.find((d) => d.key === axisKey);
  let other = dims.find((d) => d.key === otherKey) ?? null;
  if (!axis) {
    axis = other!;
    other = null;
  }
  const present = other ? [axis, other] : [axis];
  const weightSum = present.reduce((s, d) => s + d.weight, 0) || 1;
  const average = present.reduce((s, d) => s + d.position * d.weight, 0) / weightSum;
  const weights = Object.fromEntries(present.map((d) => [d.key, Math.round((d.weight / weightSum) * 100)])) as FitBasis["weights"];
  const basis: FitBasis = { rule: "average", axis: axis.key, other: other?.key ?? null, weights, average: round1(average), chestEdge: false, pulledBy: null };
  const done = (level: FitLevel, rule: FitRule, cause?: WidthKey) => ({ level, basis: { ...basis, rule, cause } });

  if (waistTooSmall) return done("too_small", "waist_small", waistTooSmall);

  // 부위 단계(−1~4). 상의 가슴이 슬림 하한보다 1cm 안으로 작으면 매우 타이트한 슬림으로 본다.
  let axisIndex = LEVEL_INDEX[axis.level];
  let axisPos = axis.position;

  if (kind === "top") {
    if (axis.level === "too_small") {
      if (axis.ease < axis.t[0] - BOUNDARY_CM - (axis.uncertain ? UNCERTAIN_TOLERANCE : 0)) return done("too_small", "core_small", axis.key);
      basis.chestEdge = true;
      axisIndex = 0;
      axisPos = -0.5;
    }
    if (axis.level === "too_big") {
      if (!other || LEVEL_INDEX[other.level] >= LEVEL_INDEX.over) return done("too_big", other?.level === "too_big" ? "both_big" : "core_big", axis.key);
      return done("over", "chest_big", axis.key);
    }
  } else {
    const noRoom = present.find((d) => d.ease < 0);
    if (noRoom) return done("too_small", "no_room", noRoom.key);
    if (present.every((d) => d.level === "too_small")) return done("too_small", present.length > 1 ? "both_small" : "core_small", axis.key);
    if (other && present.every((d) => d.level === "too_big")) return done("too_big", "both_big", axis.key);
    if (!other && axis.level === "too_big") return done("too_big", "core_big", axis.key);
  }

  if (!other) return done(INDEX_LEVEL[clamp(axisIndex, 0, 3) + 1], "single");

  const otherIndex = LEVEL_INDEX[other.level];
  let index: number;
  let rule: FitRule;
  if (Math.abs(axisIndex - otherIndex) >= 2) {
    index = axisIndex + Math.sign(otherIndex - axisIndex);
    rule = "axis_shift";
  } else {
    const avg = (axisPos * axis.weight + other.position * other.weight) / (axis.weight + other.weight);
    basis.average = round1(avg);
    index = bucketIndex(avg);
    rule = "average";
  }
  // 한 부위만 너무 작음·너무 큼이면 전체를 그렇게 만들지 않는다.
  index = clamp(index, 0, 3);
  // 하의: 한 부위가 슬림보다 작으면(몸보다는 넓음) 다른 부위보다 한 단계 작은 쪽으로 당긴다.
  if (kind === "bottom") {
    const small = present.find((d) => d.level === "too_small");
    const rest = present.find((d) => d !== small);
    if (small && rest) {
      const pulled = Math.max(0, Math.min(index, LEVEL_INDEX[rest.level] - 1));
      if (pulled !== index) basis.pulledBy = small.key;
      index = pulled;
    }
  }
  return done(INDEX_LEVEL[index + 1], rule);
}

/** 종합 위치에서 각 핏까지의 거리로 0~100점(한가운데 100, 경계 70, 한 단계 40, 두 단계 이상 0) */
function levelScores(level: FitLevel, average: number | null): Record<WearableLevel, number> {
  const idx = LEVEL_INDEX[level];
  const p = average != null && bucketIndex(average) === idx ? average : clamp(idx, -0.5, 3.5);
  return Object.fromEntries(WEARABLE_LEVELS.map((l) => [l, Math.max(0, Math.round(100 - 60 * Math.abs(p - LEVEL_INDEX[l])))])) as Record<WearableLevel, number>;
}

/**
 * 옷 한 벌의 예상 핏. 핵심 치수(상의 가슴, 하의 엉덩이·허벅지 중 하나)가 옷과 내 치수 양쪽에 있어야 계산한다.
 */
export function computeBodyFit(garment: BodyFitGarment, body: BodyProfile, calibration: Calibration = {}): BodyFitResult {
  const groupId = fitGroupOf(garment.categoryId, garment.subcategoryId);
  if (!groupId) return { status: "unsupported" };
  const group = GROUP[groupId];
  const kind = group.kind;
  const m = garment.measurements;
  const name = (l: FitLevel) => fitLevelName(l, kind);

  const core: WidthKey[] = kind === "top" ? ["chest"] : ["hip", "thigh"];
  const coreReady = core.some((k) => m[k] != null && body.values[BODY_OF[k]] != null);
  if (!coreReady) {
    return {
      status: "insufficient",
      missingBody: core.filter((k) => body.values[BODY_OF[k]] == null).map((k) => BODY_OF[k]),
      missingGarment: core.filter((k) => m[k] == null),
    };
  }

  const dimensions: BodyFitDimension[] = [];
  const scored: Scored[] = [];
  const issues: BodyFitIssue[] = [];
  let waistTooSmall: WidthKey | null = null;

  for (const key of widthKeys(group)) {
    const ease = easeOf(key, m, body);
    const bands = effectiveBands(groupId, key, body, calibration);
    if (ease == null || !bands) continue;
    const uncertain = body.uncertain.includes(BODY_OF[key]);
    const tol = uncertain ? UNCERTAIN_TOLERANCE : 0;
    const label = WIDTH_LABEL[key];
    const facts = {
      garmentValue: m[key]!,
      bodyValue: body.values[BODY_OF[key]]!,
      half: HALF[key],
      shift: key === "waist" ? 0 : (calibration[groupId]?.[key] ?? 0),
      overridden: key === "waist" ? Boolean(waistOverride(body, groupId)) : WEARABLE_LEVELS.some((l) => body.overrides[groupId]?.[l]?.[key]),
    };

    if (key === "waist") {
      // 허리는 핏 단계와 관계없이 크기만 본다. 너무 작으면(−6cm 미만) 전체를 너무 작음으로.
      const band = bands.regular;
      const state = waistStateOf(ease, band, tol);
      const level: FitLevel = state === "too_small" ? "too_small" : state === "too_big" ? "too_big" : state === "small" ? "slim" : "regular";
      dimensions.push({ key, label, ease, level, uncertain, ...facts, bands: null, waist: state, waistBand: band });
      const gap = formatNum(Math.abs(ease));
      if (state === "too_small") {
        waistTooSmall = key;
        issues.push({ key, severe: true, text: `허리가 내 허리둘레보다 ${gap}cm 작아요. 잠기지 않거나 끼일 수 있어요.` });
      } else if (state === "small") {
        issues.push({ key, severe: false, text: `허리가 내 허리둘레보다 ${gap}cm 작아요. 밴딩이 없으면 조일 수 있어요.` });
      } else if (state === "too_big") {
        issues.push({ key, severe: true, text: `허리가 ${gap}cm 커요. 벨트로 줄여도 입기 어려울 수 있어요.` });
      }
      continue;
    }

    const t = thresholdsOf(bands, WEARABLE_LEVELS.filter((l) => body.overrides[groupId]?.[l]?.[key]));
    const level = classify(ease, t, tol);
    const position = positionOf(ease, t, tol);
    const boundary = t.some((x) => Math.abs(ease - x) <= BOUNDARY_CM);
    const dim: BodyFitDimension = { key, label, ease, level, uncertain, ...facts, bands, position: round1(position), boundary };
    dimensions.push(dim);
    const weight = (group.weight[key as LevelKey] ?? 0) * (uncertain ? 0.5 : 1);
    scored.push({ ...dim, position, weight, t });
  }

  const { level, basis } = combine(kind, scored, waistTooSmall);
  const scores = levelScores(level, basis.average);

  // 전체와 다른 폭 치수
  for (const d of scored) {
    if (d.level === "too_small") {
      const gap = d.t[0] - d.ease;
      issues.push({ key: d.key, severe: true, text: `${iga(d.label)} ${name("slim")} 기준보다도 ${formatNum(round1(gap))}cm 작아요. 끼거나 입기 어려울 수 있어요.` });
    } else if (d.level === "too_big") {
      const gap = d.ease - d.t[4];
      issues.push({ key: d.key, severe: true, text: `${iga(d.label)} ${name("over")} 기준보다도 ${formatNum(round1(gap))}cm 커요.` });
    } else if (level !== "too_small" && level !== "too_big" && d.level !== level) {
      issues.push({ key: d.key, severe: false, text: `${eunNeun(d.label)} ${name(d.level)}에 가까워요(전체는 ${name(level)}).` });
    }
  }

  const silhouette = kind === "bottom" ? silhouetteOf(m) : null;
  const usedUncertain = scored.some((d) => d.uncertain);
  const coreCount = scored.filter((d) => core.includes(d.key)).length;

  return {
    status: "ok",
    group: groupId,
    kind,
    level,
    scores,
    dimensions,
    issues,
    silhouette,
    baggy: silhouette === "tapered" && (level === "semi_over" || level === "over"),
    stretch: isStretchy(garment),
    confidence: usedUncertain || (kind === "bottom" && coreCount < 2) ? "low" : "normal",
    calibrated: Boolean(calibration[groupId] && Object.keys(calibration[groupId]!).length),
    basis,
  };
}

/**
 * 한 핏 단계에서 권장하는 옷 실측 범위(표에 보이는 값: 가슴·허리·엉덩이·허벅지는 단면).
 * 허리는 단계와 관계없이 같은 적정 범위. 계산에 필요한 내 치수가 없으면 null. 사용자가 고친 값이 있으면 그 값.
 */
export function garmentRange(
  groupId: FitGroupId,
  level: WearableLevel,
  key: RecKey,
  body: BodyProfile,
  calibration: Calibration = {},
): Band | null {
  const group = GROUP[groupId];
  const override = key === "waist" ? waistOverride(body, groupId) : body.overrides[groupId]?.[level]?.[key];
  if (override) return override;
  const v = body.values;
  if (!widthKeys(group).includes(key)) return null;
  const bands = effectiveBands(groupId, key, body, calibration);
  const b = v[BODY_OF[key]];
  if (!bands || b == null) return null;
  // 단면 치수는 0.5cm 단위로 둥글린다.
  const r = (x: number) => (HALF[key] ? Math.round(x * 2) / 2 : round1(x));
  return [r(fromEase(key, bands[level][0], b)), r(fromEase(key, bands[level][1], b))];
}

/** 추천 치수 표의 열(묶음마다) */
export function recKeys(groupId: FitGroupId): RecKey[] {
  const g = GROUP[groupId];
  return g.kind === "top" ? ["shoulder", "chest"] : ["waist", "hip", "thigh"];
}

/** 핏 단계와 관계없이 한 범위만 쓰는 추천 치수 열(허리) */
export const isLevelFreeKey = (key: RecKey) => key === "waist";

/** 추천 치수 표 한 칸에 필요한 내 치수 */
export function recNeeds(_groupId: FitGroupId, key: RecKey): BodyKey[] {
  return [BODY_OF[key]];
}

/**
 * 잘 맞는 옷으로 내 치수 추정: 고른 옷의 실측에서 여유(내 핏 표기가 있으면 그 단계, 없으면 레귤러핏 가운데 값)를
 * 빼 몸 치수를 거꾸로 구한다. 여러 벌이면 중앙값. 0.5cm 단위.
 */
export function estimateBodyFromGarments(garments: BodyFitGarment[]): Partial<Record<BodyKey, number>> {
  const acc: Partial<Record<BodyKey, number[]>> = {};
  const push = (k: BodyKey, v: number) => (acc[k] ??= []).push(v);
  for (const g of garments) {
    const groupId = fitGroupOf(g.categoryId, g.subcategoryId);
    if (!groupId) continue;
    const group = GROUP[groupId];
    const level: WearableLevel = g.userFit && (WEARABLE_LEVELS as readonly string[]).includes(g.userFit) ? (g.userFit as WearableLevel) : "regular";
    const m = g.measurements;
    for (const key of widthKeys(group)) {
      const bands = baseBands(group, key);
      const value = m[key];
      if (!bands || value == null) continue;
      // 몸 = 옷(단면이면 둘레로) − 여유
      const bodyValue = (HALF[key] ? value * 2 : value) - center(bands[level]);
      push(BODY_OF[key], bodyValue);
    }
  }
  const out: Partial<Record<BodyKey, number>> = {};
  for (const [k, list] of Object.entries(acc) as [BodyKey, number[]][]) if (list.length) out[k] = Math.round(median(list) * 2) / 2;
  return out;
}

export const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNum(Math.abs(round1(v)))}`;
const bandText = (b: Band) => `${signed(b[0])}~${signed(b[1])}cm`;

/**
 * 예상 핏 판단 근거(규칙 계산을 그대로 문장으로). 치수마다 "옷 실측 → 내 치수와의 여유 → 어느 핏 구간인지",
 * 마지막에 전체 판정이 어떻게 나왔는지 한 줄. 화면에 그대로 보여 준다.
 */
export interface BodyFitReason {
  key: WidthKey | "overall";
  label: string;
  /** 비교 전체 문장 */
  text: string;
  /** 어느 핏 구간인지만(비교 표에서 숫자 칸 아래에 쓴다) */
  verdict: string;
}

export function bodyFitReasons(r: Extract<BodyFitResult, { status: "ok" }>): BodyFitReason[] {
  const name = (l: FitLevel) => fitLevelName(l, r.kind);
  const out: BodyFitReason[] = [];
  for (const d of r.dimensions) {
    const bodyName = d.key === "shoulder" ? "어깨너비" : `${d.label}둘레`;
    const girth = d.half ? round1(d.garmentValue * 2) : d.garmentValue;
    const garment = d.half ? `옷 단면 ${formatNum(d.garmentValue)}cm(둘레 ${formatNum(girth)}cm)` : `옷 ${d.label} ${formatNum(d.garmentValue)}cm`;
    const diff =
      d.ease === 0
        ? `내 ${bodyName} ${formatNum(d.bodyValue)}cm와 같아요`
        : `내 ${bodyName} ${formatNum(d.bodyValue)}cm보다 ${formatNum(Math.abs(d.ease))}cm ${d.ease > 0 ? (d.half ? "여유가 있어요" : "넓어요") : d.half ? "작아요" : "좁아요"}`;
    const g = (e: number) => (d.half ? Math.round(((e + d.bodyValue) / 2) * 2) / 2 : round1(e + d.bodyValue));
    let verdict: string;
    if (d.waist) {
      const band = d.waistBand ?? WAIST.fit;
      verdict =
        `허리는 핏 단계와 관계없이 크기만 봐요. 적정은 여유 ${bandText(band)}(단면 ${formatNum(g(band[0]))}~${formatNum(g(band[1]))}cm), ` +
        `${signed(WAIST.tooSmall)}cm보다 작으면 너무 작음이에요. 이 옷은 ${ieyo(WAIST_STATE_NAME[d.waist])}.`;
      if (d.overridden) verdict += " 적정 범위는 내가 고친 추천 치수 기준이에요.";
    } else {
      const range = (l: WearableLevel) => {
        const b = d.bands![l];
        return `${d.half ? "여유" : "차이"} ${bandText(b)}, ${d.half ? "단면" : d.label} ${formatNum(g(b[0]))}~${formatNum(g(b[1]))}cm`;
      };
      if (d.level === "too_small") verdict = `가장 작은 ${name("slim")} 범위(${range("slim")})보다도 작아요.`;
      else if (d.level === "too_big") verdict = `가장 큰 ${name("over")} 범위(${range("over")})보다도 커요.`;
      else {
        const b = d.bands![d.level as WearableLevel];
        const inside = d.ease >= b[0] && d.ease <= b[1];
        verdict = `${name(d.level)} 범위(${range(d.level as WearableLevel)})${inside ? "에 들어요" : "에 가장 가까워요"}.`;
      }
      if (d.overridden) verdict += " 범위는 내가 고친 추천 치수 기준이에요.";
      else if (d.shift) verdict += ` 내 핏 표기 옷에 맞춰 기준을 ${signed(d.shift)}cm 옮겼어요.`;
    }
    if (d.uncertain) verdict += ` 정확하지 않다고 표시한 치수라 ${UNCERTAIN_TOLERANCE}cm 느슨하게 봤어요.`;
    out.push({ key: d.key, label: d.label, text: `${garment}는 ${diff}. ${verdict}`, verdict });
  }
  out.push({ key: "overall", label: "종합", text: overallText(r), verdict: overallText(r) });
  return out;
}

function overallText(r: Extract<BodyFitResult, { status: "ok" }>): string {
  const name = (l: FitLevel) => fitLevelName(l, r.kind);
  const b = r.basis;
  const dim = (k: WidthKey | null | undefined) => r.dimensions.find((d) => d.key === k);
  const label = (k: WidthKey | null | undefined) => (k ? WIDTH_LABEL[k] : "");
  const final = name(r.level);
  const weights = Object.entries(b.weights)
    .map(([k, w]) => `${WIDTH_LABEL[k as WidthKey]} ${w}%`)
    .join("·");
  let text: string;
  switch (b.rule) {
    case "waist_small":
      text = `허리가 내 허리둘레보다 ${formatNum(Math.abs(dim("waist")?.ease ?? 0))}cm 작아(${signed(WAIST.tooSmall)}cm 넘게) 전체를 ${euro(final)} 봤어요.`;
      break;
    case "core_small":
      text = `${iga(label(b.cause))} 가장 작은 ${name("slim")} 범위보다도 작아 전체를 ${euro(final)} 봤어요.`;
      break;
    case "no_room":
      text = `${iga(label(b.cause))} 내 몸보다도 좁아 전체를 ${euro(final)} 봤어요.`;
      break;
    case "both_small":
      text = `${gwaWa(label(b.axis))} ${label(b.other)} 모두 가장 작은 ${name("slim")} 범위보다 작아 전체를 ${euro(final)} 봤어요.`;
      break;
    case "core_big": {
      const shoulder = r.kind === "top" ? dim("shoulder") : undefined;
      text = shoulder
        ? `가슴은 가장 큰 ${name("over")} 범위보다도 크고 어깨도 ${iraRa(name(shoulder.level))} 전체를 ${euro(final)} 봤어요.`
        : `${iga(label(b.cause))} 가장 큰 ${name("over")} 범위보다도 커 전체를 ${euro(final)} 봤어요.`;
      break;
    }
    case "both_big":
      text = `${gwaWa(label(b.axis))} ${label(b.other)} 모두 가장 큰 ${name("over")} 범위보다도 커 전체를 ${euro(final)} 봤어요.`;
      break;
    case "chest_big":
      text = `가슴은 가장 큰 ${name("over")} 범위보다도 크지만 어깨는 ${ieyo(name(dim("shoulder")!.level))}. 몸통이 아주 넓은 박스형으로 보고 전체를 ${euro(final)} 봤어요.`;
      break;
    case "single":
      text = `${label(b.axis)}만 비교할 수 있어 ${label(b.axis)} 기준으로 ${ieyo(final)}.`;
      break;
    case "axis_shift": {
      const a = dim(b.axis)!;
      const o = dim(b.other)!;
      const axisName = b.chestEdge ? `${name("slim")} 하한 근처` : name(a.level);
      const wider = r.kind === "top" && LEVEL_INDEX[o.level] > LEVEL_INDEX[a.level] ? " 넓은 어깨 패턴이나 드롭형일 수 있어요." : "";
      text =
        `${eunNeun(label(b.axis))} ${axisName}, ${eunNeun(label(b.other))} ${iraRa(name(o.level))} 두 단계 이상 차이 나요. ` +
        `${eulReul(label(b.axis))} 기준으로 ${label(b.other)} 쪽으로 한 단계만 옮겨 ${euro(final)} 봤어요.${wider}`;
      break;
    }
    default:
      text = `${weights} 비중으로 합치면 ${ieyo(final)}.`;
  }
  if (b.chestEdge && b.rule !== "axis_shift") text = `가슴이 ${name("slim")} 하한보다 1cm 안으로 작아 매우 타이트한 ${euro(name("slim"))} 봤어요. ${text}`;
  if (b.pulledBy) text += ` ${iga(label(b.pulledBy))} ${name("slim")} 범위보다 작아 한 단계 작은 쪽으로 봤어요.`;
  if (r.kind === "bottom" && b.rule !== "waist_small") text += " 허리는 핏 판정에 넣지 않아요.";
  return text;
}

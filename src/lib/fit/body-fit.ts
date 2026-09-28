import { WEARABLE_LEVELS, fitLevelName, type BodyKey, type FitKind, type FitLevel, type WearableLevel } from "@/lib/constants/body";
import { formatNum } from "@/lib/constants/measurements";
import type { CategoryId, Measurements } from "@/lib/types/domain";

/**
 * 내 치수로 옷의 예상 핏을 계산하는 규칙 엔진(AI 없음).
 *
 * 핵심은 여유분(ease)이다. 옷 실측(단면이면 ×2)에서 몸 치수를 빼고, 옷 종류마다 정해 둔
 * 여유 구간 표와 비교해 슬림·정·세미오버·오버 중 어디에 드는지 본다. 미터기(6칸)는 품으로만 정하고
 * (상의: 가슴·어깨 / 하의: 엉덩이·허벅지, 허리는 너무 작거나 큰지만 본다), 총장·소매는 따로 알린다.
 *
 * 보정 순서: 기본 여유 표 → "내 핏"을 표기한 옷으로 옮긴 기준(최대 ±4cm) → 사용자가 고친 추천 치수.
 * 숫자 표는 EASE 한곳에 모았다. 실제 입어 본 느낌과 다르면 여기 숫자만 고친다.
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

/** 사용자가 고친 추천 치수(옷 실측 기준: 가슴·허리·엉덩이·허벅지는 단면, 어깨·총장·소매는 그대로) */
export type FitOverrides = Partial<Record<FitGroupId, Partial<Record<WearableLevel, Partial<Record<RecKey, Band>>>>>>;

export interface BodyProfile {
  values: Partial<Record<BodyKey, number>>;
  /** "정확하지 않아요"로 표시한 치수: 느슨하게 적용하고 신뢰도를 낮춘다. */
  uncertain: BodyKey[];
  overrides: FitOverrides;
  updatedAt: string | null;
}

export const EMPTY_BODY: BodyProfile = { values: {}, uncertain: [], overrides: {}, updatedAt: null };

interface GroupDef {
  id: FitGroupId;
  name: string;
  kind: FitKind;
  /**
   * 폭 치수별 여유(옷 둘레 − 몸 둘레, 어깨는 옷 − 몸) 경계 5개: 너무 작음 | 슬림 | 레귤러 | 세미오버 | 오버 | 너무 큼.
   * 슬림은 몸에 착 붙는 정도, 레귤러는 몸 실루엣이 적당히 보이는 정도. 아우터·코트·패딩은 속에 겹쳐 입어 여유를 더 둔다.
   */
  width: Partial<Record<WidthKey, [number, number, number, number, number]>>;
}

// 오버핏은 드롭숄더라 어깨가 몸보다 10cm 넘게 넓은 옷이 흔하다(너무 큼 경계를 넉넉히).
const TEE_SHOULDER: [number, number, number, number, number] = [-4, -2, 1, 5, 14];
const OUTER_SHOULDER: [number, number, number, number, number] = [-3, -1, 2, 6, 15];
// 엉덩이는 비스판 슬림도 2cm 이상 여유가 있어야 앉을 수 있다. 허벅지 와이드는 국내 와이드 데님·슬랙스(몸 +17~26cm) 기준.
const PANTS_WIDTH = { hip: [0, 4, 8, 14, 22], thigh: [0, 4, 9, 15, 24] } satisfies GroupDef["width"];

export const FIT_GROUPS: GroupDef[] = [
  { id: "short_tee", name: "반팔 티셔츠", kind: "top", width: { chest: [0, 6, 12, 20, 30], shoulder: TEE_SHOULDER } },
  { id: "long_tee", name: "긴팔·맨투맨·후드", kind: "top", width: { chest: [2, 8, 14, 22, 32], shoulder: TEE_SHOULDER } },
  { id: "knit", name: "니트·카디건", kind: "top", width: { chest: [-2, 4, 10, 18, 28], shoulder: TEE_SHOULDER } },
  { id: "shirt", name: "셔츠", kind: "top", width: { chest: [2, 8, 14, 22, 32], shoulder: TEE_SHOULDER } },
  { id: "light_outer", name: "가벼운 아우터·바람막이", kind: "top", width: { chest: [4, 10, 16, 24, 34], shoulder: OUTER_SHOULDER } },
  { id: "leather", name: "레더·무스탕", kind: "top", width: { chest: [2, 6, 12, 18, 26], shoulder: [-3, -2, 1, 4, 8] } },
  { id: "coat", name: "코트", kind: "top", width: { chest: [8, 14, 22, 30, 40], shoulder: OUTER_SHOULDER } },
  { id: "padding", name: "패딩", kind: "top", width: { chest: [10, 16, 24, 32, 42], shoulder: OUTER_SHOULDER } },
  { id: "pants", name: "긴 바지", kind: "bottom", width: PANTS_WIDTH },
  { id: "shorts", name: "반바지", kind: "bottom", width: PANTS_WIDTH },
];

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

/** 하의 허리: 핏 단계와 거의 상관없어(와이드도 허리는 맞춘다) 너무 작거나 큰지만 본다. */
const WAIST_BANDS: Record<WearableLevel, Band> = { slim: [0, 3], regular: [1, 4], semi_over: [1, 5], over: [2, 6] };
const WAIST_TOO_SMALL = -2;
const WAIST_TOO_BIG = 8;


/** "정확하지 않아요" 치수는 이만큼(cm) 느슨하게 본다. */
const UNCERTAIN_TOLERANCE = 3;
/** 내 핏 표기로 옮기는 기준의 한계(cm) */
const CALIBRATION_LIMIT = 4;

/** 옷 실측 → 몸과 비교할 값(단면 치수는 둘레로) */
const HALF: Record<WidthKey, boolean> = { chest: true, shoulder: false, waist: true, hip: true, thigh: true };
const BODY_OF: Record<WidthKey, BodyKey> = { chest: "chest", shoulder: "shoulder", waist: "waist", hip: "hip", thigh: "thigh" };
const WIDTH_LABEL: Record<WidthKey, string> = { chest: "가슴", shoulder: "어깨", waist: "허리", hip: "엉덩이", thigh: "허벅지" };
const WEIGHT: Record<WidthKey, number> = { chest: 2, shoulder: 1, waist: 0, hip: 2, thigh: 2 };

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
/** 으로/로: 받침이 없거나 ㄹ 받침이면 "로" */
const euro = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  const jong = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
  return `${w}${jong === 0 || jong === 8 ? "로" : "으로"}`;
};

/** 기본 여유 구간(내 핏 보정 전) */
function baseBands(group: GroupDef, key: WidthKey): Record<WearableLevel, Band> | null {
  if (key === "waist") return group.kind === "bottom" ? WAIST_BANDS : null;
  const t = group.width[key];
  if (!t) return null;
  return { slim: [t[0], t[1]], regular: [t[1], t[2]], semi_over: [t[2], t[3]], over: [t[3], t[4]] };
}

const widthKeys = (group: GroupDef): WidthKey[] => (group.kind === "top" ? ["chest", "shoulder"] : ["hip", "thigh", "waist"]);

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
  const shift = key === "waist" ? 0 : (calibration[groupId]?.[key] ?? 0);
  const out = {} as Record<WearableLevel, Band>;
  for (const level of WEARABLE_LEVELS) {
    const o = body.overrides[groupId]?.[level]?.[key];
    out[level] = o ? [toEase(key, o[0], b), toEase(key, o[1], b)] : [base[level][0] + shift, base[level][1] + shift];
  }
  return out;
}

/** 여유 하나를 6칸 중 하나로. tol만큼 가까운 쪽으로 봐준다. */
function classify(ease: number, bands: Record<WearableLevel, Band>, tol: number): FitLevel {
  const lo = Math.min(...WEARABLE_LEVELS.map((l) => bands[l][0]));
  const hi = Math.max(...WEARABLE_LEVELS.map((l) => bands[l][1]));
  if (ease < lo - tol) return "too_small";
  if (ease > hi + tol) return "too_big";
  const e = clamp(ease, lo, hi);
  let best: WearableLevel = "regular";
  let bestDist = Infinity;
  for (const level of WEARABLE_LEVELS) {
    const [a, b] = bands[level];
    const outside = e < a ? a - e : e > b ? e - b : 0;
    const dist = outside * 100 + Math.abs(e - (a + b) / 2);
    if (dist < bestDist) {
      bestDist = dist;
      best = level;
    }
  }
  return best;
}

/** 구간 한가운데 100점, 경계 70점, 구간 폭만큼 더 벗어나면 35점, 두 배면 0점 */
function bandScore(ease: number, band: Band, tol: number): number {
  const h = Math.max((band[1] - band[0]) / 2, 1);
  const d = Math.max(0, Math.abs(ease - center(band)) - tol);
  return d <= h ? 100 - (30 * d) / h : Math.max(0, 70 - (35 * (d - h)) / h);
}

export interface BodyFitDimension {
  key: WidthKey;
  label: string;
  ease: number;
  level: FitLevel;
  uncertain: boolean;
  /** 판단 근거용: 옷 실측(표에 보이는 값), 내 치수, 단면이면 true */
  garmentValue: number;
  bodyValue: number;
  half: boolean;
  /** 판단에 쓴 핏 단계별 여유 구간(보정 반영). 허리는 null(너무 작음·큼만 본다) */
  bands: Record<WearableLevel, Band> | null;
  /** 내 핏 표기로 옮긴 기준(cm) */
  shift: number;
  /** 사용자가 고친 추천 치수를 썼는지 */
  overridden: boolean;
}

export interface BodyFitIssue {
  key: WidthKey;
  text: string;
  /** 너무 작음·너무 큼처럼 입기 어려운 문제 */
  severe: boolean;
}

export type Silhouette = "tapered" | "straight" | "flare";
export const SILHOUETTE_NAME: Record<Silhouette, string> = { tapered: "테이퍼드", straight: "스트레이트", flare: "플레어·부츠컷" };

export type BodyFitResult =
  | {
      status: "ok";
      group: FitGroupId;
      kind: FitKind;
      level: FitLevel;
      scores: Record<WearableLevel, number>;
      dimensions: BodyFitDimension[];
      /** 안 맞는 폭 치수 */
      issues: BodyFitIssue[];
      silhouette: Silhouette | null;
      /** 배기(품이 넉넉한데 밑단이 좁음) */
      baggy: boolean;
      /** 니트·스판 등 늘어나는 소재로 보이는지 */
      stretch: boolean;
      /** 정확하지 않은 치수를 썼거나 핵심 치수가 하나뿐이면 low */
      confidence: "normal" | "low";
      calibrated: boolean;
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
  const scores = Object.fromEntries(WEARABLE_LEVELS.map((l) => [l, 0])) as Record<WearableLevel, number>;
  let weightSum = 0;
  let severeSmall = false;
  let severeBig = false;
  const issues: BodyFitIssue[] = [];

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
      bands: key === "waist" ? null : bands,
      shift: key === "waist" ? 0 : (calibration[groupId]?.[key] ?? 0),
      overridden: WEARABLE_LEVELS.some((l) => body.overrides[groupId]?.[l]?.[key]),
    };

    if (key === "waist") {
      // 허리는 판정에 넣지 않고 너무 작거나 클 때만 알린다.
      const level: FitLevel = ease < WAIST_TOO_SMALL - tol ? "too_small" : ease > WAIST_TOO_BIG + tol ? "too_big" : "regular";
      dimensions.push({ key, label, ease, level, uncertain, ...facts });
      if (level === "too_small") {
        severeSmall = true;
        issues.push({ key, severe: true, text: `허리가 내 허리둘레보다 ${formatNum(Math.abs(ease))}cm 작아요. 잠기지 않거나 끼일 수 있어요.` });
      } else if (level === "too_big") {
        issues.push({ key, severe: false, text: `허리가 ${formatNum(ease)}cm 넉넉해요. 벨트가 필요할 수 있어요.` });
      }
      continue;
    }

    const level = classify(ease, bands, tol);
    dimensions.push({ key, label, ease, level, uncertain, ...facts });
    const w = WEIGHT[key] * (uncertain ? 0.5 : 1);
    for (const l of WEARABLE_LEVELS) scores[l] += bandScore(ease, bands[l], tol) * w;
    weightSum += w;
    if (core.includes(key) && level === "too_small") severeSmall = true;
    if (core.includes(key) && level === "too_big") severeBig = true;
  }
  for (const l of WEARABLE_LEVELS) scores[l] = weightSum ? Math.round(scores[l] / weightSum) : 0;

  const best = WEARABLE_LEVELS.reduce((a, b) => (scores[b] > scores[a] ? b : a), "regular" as WearableLevel);
  const level: FitLevel = severeSmall ? "too_small" : severeBig ? "too_big" : best;

  // 전체와 다른 폭 치수
  for (const d of dimensions) {
    if (d.key === "waist") continue;
    const bands = effectiveBands(groupId, d.key, body, calibration)!;
    if (d.level === "too_small") {
      const gap = Math.min(...WEARABLE_LEVELS.map((l) => bands[l][0])) - d.ease;
      issues.push({ key: d.key, severe: true, text: `${iga(d.label)} ${name("slim")} 기준보다도 ${formatNum(round1(gap))}cm 작아요. 끼거나 입기 어려울 수 있어요.` });
    } else if (d.level === "too_big") {
      const gap = d.ease - Math.max(...WEARABLE_LEVELS.map((l) => bands[l][1]));
      issues.push({ key: d.key, severe: true, text: `${iga(d.label)} ${name("over")} 기준보다도 ${formatNum(round1(gap))}cm 커요.` });
    } else if (level !== "too_small" && level !== "too_big" && d.level !== level) {
      issues.push({ key: d.key, severe: false, text: `${eunNeun(d.label)} ${name(d.level)}에 가까워요(전체는 ${name(level)}).` });
    }
  }

  const silhouette = kind === "bottom" ? silhouetteOf(m) : null;
  const usedUncertain = dimensions.some((d) => d.uncertain && d.key !== "waist");
  const coreCount = dimensions.filter((d) => core.includes(d.key)).length;

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
  };
}

/**
 * 한 핏 단계에서 권장하는 옷 실측 범위(표에 보이는 값: 가슴·허리·엉덩이·허벅지는 단면).
 * 계산에 필요한 내 치수가 없으면 null. 사용자가 고친 값이 있으면 그 값.
 */
export function garmentRange(
  groupId: FitGroupId,
  level: WearableLevel,
  key: RecKey,
  body: BodyProfile,
  calibration: Calibration = {},
): Band | null {
  const group = GROUP[groupId];
  const override = body.overrides[groupId]?.[level]?.[key];
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

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNum(Math.abs(round1(v)))}`;
const bandText = (b: Band) => `${signed(b[0])}~${signed(b[1])}cm`;

/**
 * 예상 핏 판단 근거(규칙 계산을 그대로 문장으로). 치수마다 "옷 실측 → 내 치수와의 여유 → 어느 핏 구간인지",
 * 마지막에 전체 판정이 어떻게 나왔는지 한 줄. 화면에 그대로 보여 준다.
 */
export function bodyFitReasons(r: Extract<BodyFitResult, { status: "ok" }>): { key: WidthKey | "overall"; label: string; text: string }[] {
  const name = (l: FitLevel) => fitLevelName(l, r.kind);
  const out: { key: WidthKey | "overall"; label: string; text: string }[] = [];
  for (const d of r.dimensions) {
    const bodyName = d.key === "shoulder" ? "어깨너비" : `${d.label}둘레`;
    const girth = d.half ? round1(d.garmentValue * 2) : d.garmentValue;
    const garment = d.half ? `옷 단면 ${formatNum(d.garmentValue)}cm(둘레 ${formatNum(girth)}cm)` : `옷 ${d.label} ${formatNum(d.garmentValue)}cm`;
    const diff =
      d.ease === 0
        ? `내 ${bodyName} ${formatNum(d.bodyValue)}cm와 같아요`
        : `내 ${bodyName} ${formatNum(d.bodyValue)}cm보다 ${formatNum(Math.abs(d.ease))}cm ${d.ease > 0 ? (d.half ? "여유가 있어요" : "넓어요") : d.half ? "작아요" : "좁아요"}`;
    let verdict: string;
    if (!d.bands) {
      const where = d.level === "too_small" ? "보다 작아요" : d.level === "too_big" ? "보다 커요" : " 안이에요";
      verdict = `허리는 핏 판정에 넣지 않고 여유 ${bandText([WAIST_TOO_SMALL, WAIST_TOO_BIG])}를 벗어날 때만 알려요. 이 범위${where}.`;
    } else {
      const range = (l: WearableLevel) => {
        const b = d.bands![l];
        const g = (e: number) => (d.half ? Math.round(((e + d.bodyValue) / 2) * 2) / 2 : round1(e + d.bodyValue));
        return `${d.half ? "여유" : "차이"} ${bandText(b)}, ${d.half ? "단면" : d.label} ${formatNum(g(b[0]))}~${formatNum(g(b[1]))}cm`;
      };
      if (d.level === "too_small") verdict = `가장 작은 ${name("slim")} 범위(${range("slim")})보다도 작아요.`;
      else if (d.level === "too_big") verdict = `가장 큰 ${name("over")} 범위(${range("over")})보다도 커요.`;
      else {
        const b = d.bands[d.level as WearableLevel];
        const inside = d.ease >= b[0] && d.ease <= b[1];
        verdict = `${name(d.level)} 범위(${range(d.level as WearableLevel)})${inside ? "에 들어요" : "에 가장 가까워요"}.`;
      }
      if (d.overridden) verdict += " 범위는 내가 고친 추천 치수 기준이에요.";
      else if (d.shift) verdict += ` 내 핏 표기 옷에 맞춰 기준을 ${signed(d.shift)}cm 옮겼어요.`;
    }
    if (d.uncertain) verdict += ` 정확하지 않다고 표시한 치수라 ${UNCERTAIN_TOLERANCE}cm 느슨하게 봤어요.`;
    out.push({ key: d.key, label: d.label, text: `${garment}는 ${diff}. ${verdict}` });
  }

  const scored = r.dimensions.filter((d) => d.bands);
  const severe = r.dimensions.find((d) => d.level === r.level && (r.level === "too_small" || r.level === "too_big"));
  let overall: string;
  if (severe) {
    const edge = r.level === "too_small" ? `가장 작은 ${name("slim")} 범위보다도 작아` : `가장 큰 ${name("over")} 범위보다도 커`;
    overall = `${iga(severe.label)} ${edge} 전체를 ${euro(name(r.level))} 봤어요.`;
  }
  else {
    const weights = scored.map((d) => `${d.label}${scored.length > 1 ? `(비중 ${WEIGHT[d.key] * (d.uncertain ? 0.5 : 1)})` : ""}`).join("·");
    const ranked = [...WEARABLE_LEVELS].sort((a, b) => r.scores[b] - r.scores[a]);
    const top = r.scores[r.level as WearableLevel];
    const second = ranked.find((l) => l !== r.level)!;
    overall =
      r.scores[second] === top
        ? `${weights} 기준으로 핏마다 점수를 매기면 ${name(r.level)}${hasBatchim(name(r.level)) ? "과" : "와"} ${iga(name(second))} ${top}점으로 같아 두 핏의 경계예요. ${euro(name(r.level))} 표시했어요.`
        : `${weights} 기준으로 핏마다 점수를 매기면 ${iga(name(r.level))} ${top}점으로 가장 높아요(다음은 ${name(second)} ${r.scores[second]}점).`;
    if (r.kind === "bottom") overall += " 허리는 점수에 넣지 않아요.";
  }
  out.push({ key: "overall", label: "종합", text: overall });
  return out;
}

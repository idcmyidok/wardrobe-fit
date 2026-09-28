/**
 * 내 치수(신체치수)와 핏 단계. 신체치수는 모두 선택 입력이고, 입력한 만큼만 예상 핏 계산에 쓴다.
 * 개인정보: 본인만 읽는 body_profiles에만 저장하고 AI·관리 화면·판단 기록에는 보내지 않는다(처리방침 2장).
 */

export const BODY_KEYS = ["height", "weight", "shoulder", "chest", "waist", "hip", "thigh"] as const;
export type BodyKey = (typeof BODY_KEYS)[number];

export interface BodyField {
  key: BodyKey;
  label: string;
  unit: "cm" | "kg";
  group: "basic" | "upper" | "lower";
  /** 재는 법 */
  hint: string;
  min: number;
  max: number;
}

export const BODY_FIELDS: BodyField[] = [
  { key: "height", label: "키", unit: "cm", group: "basic", hint: "기록용입니다. 지금은 계산에 쓰지 않습니다.", min: 100, max: 230 },
  { key: "weight", label: "몸무게", unit: "kg", group: "basic", hint: "기록용입니다. 지금은 계산에 쓰지 않습니다.", min: 25, max: 250 },
  { key: "shoulder", label: "어깨너비", unit: "cm", group: "upper", hint: "등 뒤에서 한쪽 어깨 끝 뼈부터 반대쪽 끝까지, 몸을 따라 잽니다.", min: 25, max: 70 },
  { key: "chest", label: "가슴둘레", unit: "cm", group: "upper", hint: "겨드랑이 바로 아래 가장 두꺼운 곳을 수평으로 한 바퀴 잽니다.", min: 50, max: 180 },
  { key: "waist", label: "허리둘레", unit: "cm", group: "lower", hint: "바지를 입는 높이에서 한 바퀴 잽니다.", min: 40, max: 180 },
  { key: "hip", label: "엉덩이둘레", unit: "cm", group: "lower", hint: "엉덩이가 가장 튀어나온 곳을 수평으로 한 바퀴 잽니다.", min: 50, max: 180 },
  { key: "thigh", label: "허벅지둘레", unit: "cm", group: "lower", hint: "가랑이 바로 아래 가장 굵은 곳을 한 바퀴 잽니다.", min: 25, max: 100 },
];

export const BODY_LABELS = Object.fromEntries(BODY_FIELDS.map((f) => [f.key, f.label])) as Record<BodyKey, string>;

/** 핏 단계 6칸(미터기 순서). 입을 수 있는 네 단계는 WEARABLE_LEVELS */
export const FIT_LEVELS = ["too_small", "slim", "regular", "semi_over", "over", "too_big"] as const;
export type FitLevel = (typeof FIT_LEVELS)[number];
export const WEARABLE_LEVELS = ["slim", "regular", "semi_over", "over"] as const;
export type WearableLevel = (typeof WEARABLE_LEVELS)[number];

/** 상의·아우터와 하의는 핏 이름이 다르다. */
export type FitKind = "top" | "bottom";

const LEVEL_NAMES: Record<FitKind, Record<FitLevel, string>> = {
  top: { too_small: "너무 작음", slim: "슬림핏", regular: "정핏", semi_over: "세미오버핏", over: "오버핏", too_big: "너무 큼" },
  bottom: { too_small: "너무 작음", slim: "슬림", regular: "레귤러", semi_over: "세미와이드", over: "와이드", too_big: "너무 큼" },
};

export function fitLevelName(level: FitLevel, kind: FitKind): string {
  return LEVEL_NAMES[kind][level];
}

export const isFitLevel = (v: unknown): v is FitLevel => typeof v === "string" && (FIT_LEVELS as readonly string[]).includes(v);

/** 처리방침의 신체정보 동의 문구 버전. 문구를 바꾸면 올린다. */
export const BODY_CONSENT_VERSION = "2026-09-28";

/**
 * 신발 착용감(PROJECT_SPEC.md 9장). 신발은 실측 대신 사이즈 표기와 이 세 가지를 저장하고,
 * 나중에 신발 추천에서 "이 브랜드 270은 발볼이 좁았다"처럼 쓴다. AI 없이 사용자가 고른다.
 */
export const SHOE_FIT_LEVELS = ["tight", "good", "loose"] as const;
export type ShoeFitLevel = (typeof SHOE_FIT_LEVELS)[number];
export type ShoeFitKey = "length" | "width" | "instep";
export type ShoeFit = Record<ShoeFitKey, ShoeFitLevel | null>;

export const SHOE_FIT_FIELDS: { key: ShoeFitKey; label: string; levels: Record<ShoeFitLevel, string> }[] = [
  { key: "length", label: "길이감", levels: { tight: "작음", good: "딱 맞음", loose: "큼" } },
  { key: "width", label: "발볼", levels: { tight: "좁음", good: "딱 맞음", loose: "넓음" } },
  { key: "instep", label: "발등", levels: { tight: "압박", good: "딱 맞음", loose: "여유" } },
];

export const EMPTY_SHOE_FIT: ShoeFit = { length: null, width: null, instep: null };

/** 값이 하나도 없으면 null로 저장·표시한다. */
export function shoeFitOrNull(fit: Partial<ShoeFit> | null | undefined): ShoeFit | null {
  if (!fit) return null;
  const v: ShoeFit = { length: fit.length ?? null, width: fit.width ?? null, instep: fit.instep ?? null };
  return v.length || v.width || v.instep ? v : null;
}

/** 표·상세용 한 칸 문구. 값이 없으면 "—" */
export function shoeFitText(key: ShoeFitKey, level: ShoeFitLevel | null | undefined): string {
  if (!level) return "—";
  return SHOE_FIT_FIELDS.find((f) => f.key === key)!.levels[level];
}

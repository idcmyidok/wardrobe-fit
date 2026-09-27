import type { CategoryId } from "@/lib/types/domain";

/** 옷장 표에 보이는 실측만 쓴다(PROJECT_SPEC.md 9장). cm, 단면 기준 */
export const TOP_MEASUREMENTS = ["length", "shoulder", "chest", "sleeve"] as const;
export const BOTTOM_MEASUREMENTS = ["length", "waist", "hip", "thigh", "rise", "legOpening"] as const;
export type MeasurementKey = (typeof TOP_MEASUREMENTS)[number] | (typeof BOTTOM_MEASUREMENTS)[number];

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  length: "총장",
  shoulder: "어깨",
  chest: "가슴",
  sleeve: "소매",
  waist: "허리단면",
  hip: "엉덩이단면",
  thigh: "허벅지단면",
  rise: "밑위",
  legOpening: "밑단단면",
};

/** 대분류별 입력·상세용 실측 목록(라벨 포함) */
export function measurementFields(categoryId: CategoryId): { key: MeasurementKey; label: string }[] {
  const keys = categoryId === "bottom" ? BOTTOM_MEASUREMENTS : TOP_MEASUREMENTS;
  return keys.map((key) => ({ key, label: MEASUREMENT_LABELS[key] }));
}

/** 옷장 표에 보여줄 실측 열. 좁은 열이라 짧은 이름을 쓴다. */
const TOP_TABLE: { key: MeasurementKey; label: string }[] = [
  { key: "length", label: "총장" },
  { key: "shoulder", label: "어깨" },
  { key: "chest", label: "가슴" },
  { key: "sleeve", label: "소매" },
];
export const TABLE_MEASUREMENTS: Record<CategoryId, { key: MeasurementKey; label: string }[]> = {
  outer: TOP_TABLE,
  top: TOP_TABLE,
  bottom: [
    { key: "length", label: "총장" },
    { key: "waist", label: "허리" },
    { key: "hip", label: "엉덩이" },
    { key: "thigh", label: "허벅지" },
    { key: "rise", label: "밑위" },
    { key: "legOpening", label: "밑단" },
  ],
};

/** 12.0 → "12.0", 값이 없으면 "—" */
export function formatCm(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(1);
}

import type { CategoryId } from "@/lib/types/domain";

/** PROJECT_SPEC.md 9장. cm, 단면 기준 */
export const TOP_MEASUREMENTS = ["shoulder", "chest", "length", "sleeve", "armhole", "hemWidth"] as const;
export const BOTTOM_MEASUREMENTS = ["waist", "length", "rise", "thigh", "legOpening", "inseam"] as const;
export type MeasurementKey = (typeof TOP_MEASUREMENTS)[number] | (typeof BOTTOM_MEASUREMENTS)[number];

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  shoulder: "어깨",
  chest: "가슴",
  length: "총장",
  sleeve: "소매",
  armhole: "암홀",
  hemWidth: "밑단너비",
  waist: "허리단면",
  rise: "밑위",
  thigh: "허벅지단면",
  legOpening: "밑단단면",
  inseam: "인심",
};

/** 옷장 표에 보여줄 실측 열. 좁은 열이라 짧은 이름을 쓴다. */
export const TABLE_MEASUREMENTS: Record<CategoryId, { key: MeasurementKey; label: string }[]> = {
  outer: [
    { key: "length", label: "총장" },
    { key: "shoulder", label: "어깨" },
    { key: "chest", label: "가슴" },
    { key: "sleeve", label: "소매" },
  ],
  top: [
    { key: "length", label: "총장" },
    { key: "shoulder", label: "어깨" },
    { key: "chest", label: "가슴" },
    { key: "sleeve", label: "소매" },
  ],
  bottom: [
    { key: "length", label: "총장" },
    { key: "waist", label: "허리" },
    { key: "rise", label: "밑위" },
    { key: "thigh", label: "허벅지" },
    { key: "legOpening", label: "밑단" },
  ],
};

import { MEASUREMENT_LABELS, formatNum, type MeasurementKey } from "@/lib/constants/measurements";

/** 규칙 요약 문구에 쓰는 낱말. 길이 치수는 길다/짧다, 폭 치수는 넓다/좁다 또는 크다/작다. */

type Kind = "length" | "span" | "girth";
const KIND: Record<MeasurementKey, Kind> = {
  length: "length",
  sleeve: "length",
  rise: "length",
  shoulder: "span",
  legOpening: "span",
  chest: "girth",
  waist: "girth",
  hip: "girth",
  thigh: "girth",
};

const WORDS: Record<Kind, Record<"above" | "below", { short: string; connect: string; end: string; feel: string }>> = {
  length: {
    above: { short: "김", connect: "길고", end: "깁니다", feel: "길게" },
    below: { short: "짧음", connect: "짧고", end: "짧습니다", feel: "짧게" },
  },
  span: {
    above: { short: "넓음", connect: "넓고", end: "넓습니다", feel: "넓게" },
    below: { short: "좁음", connect: "좁고", end: "좁습니다", feel: "좁게" },
  },
  girth: {
    above: { short: "큼", connect: "크고", end: "큽니다", feel: "여유 있게" },
    below: { short: "작음", connect: "작고", end: "작습니다", feel: "끼게" },
  },
};

export const words = (key: MeasurementKey, side: "above" | "below") => WORDS[KIND[key]][side];

/** 후기 방향을 사람이 읽는 말로 */
export const DIRECTION_WORD = { long: "길다", short: "짧다", tight: "작다", loose: "크다" } as const;

/** 받침이 있는지(한글 마지막 글자, 숫자는 읽는 소리 기준) */
export function hasBatchim(text: string): boolean {
  const ch = text.trim().slice(-1);
  if (/[0-9]/.test(ch)) return "013678".includes(ch);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

export const eunNeun = (word: string) => `${word}${hasBatchim(word) ? "은" : "는"}`;
export const gwaWa = (word: string) => `${word}${hasBatchim(word) ? "과" : "와"}`;

/** 요약 문장용 짧은 이름(허리단면 → 허리) */
export function shortLabel(key: MeasurementKey) {
  return MEASUREMENT_LABELS[key].replace(/단면$/, "");
}

export const cm = (v: number) => `${formatNum(Math.abs(v))}cm`;

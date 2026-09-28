import { fitLevelName, type WearableLevel } from "@/lib/constants/body";
import { MEASUREMENT_LABELS } from "@/lib/constants/measurements";
import type { Measurements } from "@/lib/types/domain";
import { computeBodyFit, type BodyFitGarment, type BodyFitResult, type BodyProfile, type Calibration } from "./body-fit";
import type { SizeReport } from "./types";

/**
 * VS 비교(구매 판단에 링크 2~3개): 옷마다 사이즈를 고르고, 어떤 옷이 원하는 핏에 더 가까운지 규칙으로 순위를 낸다(AI 없음).
 * 내 치수가 있으면 예상 핏 점수, 없으면 옷장 비교(만족 범위 안에 드는 치수 비율)로 본다.
 */

export interface VersusSizeRow {
  sizeLabel: string;
  measurements: Measurements;
}

export type VersusBasis = "body" | "wardrobe" | "none";

/** 한 사이즈의 점수(0~100). 내 치수 기준이면 원하는 핏 점수에서 입기 어려운 치수·길이 문제를 뺀다. */
export function bodyScore(result: BodyFitResult | null, target: WearableLevel): number | null {
  if (!result || result.status !== "ok") return null;
  const severe = result.issues.filter((i) => i.severe).length;
  return Math.max(0, result.scores[target] - severe * 30 - result.notes.length * 5);
}

/** 옷장 비교 점수: 비교할 수 있었던 치수 중 만족(기존) 범위 안에 든 비율 */
export function wardrobeScore(report: SizeReport | undefined): number | null {
  if (!report) return null;
  const judged = report.dimensions.filter((d) => d.verdict !== "unknown");
  if (!judged.length) return null;
  return Math.round((judged.filter((d) => d.verdict === "within").length / judged.length) * 100);
}

/**
 * 사이즈 자동 선택: 내 치수가 있으면 원하는 핏 점수가 가장 높은 사이즈,
 * 없으면 옷장 비교 점수가 가장 높은 사이즈, 둘 다 없으면 가운데 사이즈.
 */
export function pickSize(
  base: Omit<BodyFitGarment, "measurements">,
  rows: VersusSizeRow[],
  target: WearableLevel,
  body: BodyProfile | null,
  calibration: Calibration,
  wardrobeReports?: SizeReport[],
): string | null {
  if (!rows.length) return null;
  const scored = rows.map((r, i) => {
    const b = body ? bodyScore(computeBodyFit({ ...base, measurements: r.measurements }, body, calibration), target) : null;
    const w = wardrobeScore(wardrobeReports?.find((s) => s.sizeLabel === r.sizeLabel));
    return { label: r.sizeLabel, score: b ?? w, i };
  });
  const middle = Math.floor((rows.length - 1) / 2);
  const best = scored
    .filter((s) => s.score != null)
    .sort((a, b) => b.score! - a.score! || Math.abs(a.i - middle) - Math.abs(b.i - middle))[0];
  return best?.label ?? rows[middle].sizeLabel;
}

export interface VersusEntry {
  key: string;
  name: string;
  garment: BodyFitGarment;
  body: BodyFitResult | null;
  wardrobe: SizeReport | undefined;
}

export interface VersusRank {
  key: string;
  score: number | null;
  basis: VersusBasis;
  reasons: string[];
}

/** 순위(점수 높은 순). 이유는 한두 줄로 */
export function rankVersus(entries: VersusEntry[], target: WearableLevel): VersusRank[] {
  const useBody = entries.some((e) => bodyScore(e.body, target) != null);
  const ranks = entries.map((e): VersusRank => {
    if (useBody) {
      const r = e.body;
      const score = bodyScore(r, target);
      if (!r || r.status !== "ok" || score == null) return { key: e.key, score: null, basis: "none", reasons: ["실측이 부족해 내 치수와 비교하지 못했어요."] };
      const name = (l: typeof r.level) => fitLevelName(l, r.kind);
      const reasons = [
        r.level === target
          ? `원하는 ${name(target)}으로 입을 수 있어요(${score}점).`
          : `원하는 ${name(target)}보다 ${name(r.level)}에 가까워요(${name(target)} ${r.scores[target]}점).`,
        ...r.issues.filter((i) => i.severe).map((i) => i.text),
        ...r.notes.slice(0, 1).map((n) => n.text),
      ];
      return { key: e.key, score, basis: "body", reasons };
    }
    const score = wardrobeScore(e.wardrobe);
    if (score == null) return { key: e.key, score: null, basis: "none", reasons: ["비교할 옷장 기록이 부족해요."] };
    const out = e.wardrobe!.dimensions.filter((d) => d.verdict === "above" || d.verdict === "below");
    return {
      key: e.key,
      score,
      basis: "wardrobe",
      reasons: [
        out.length
          ? `${out.map((d) => MEASUREMENT_LABELS[d.key]).join("·")}가 만족했던 옷들의 범위를 벗어나요.`
          : "비교한 치수가 모두 만족했던 옷들의 범위 안이에요.",
      ],
    };
  });
  return ranks.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** VS 추천 문장. 1위와 2위 점수 차이가 작으면 비슷하다고 말한다. */
export function versusSummary(ranks: VersusRank[], names: Record<string, string>, target: WearableLevel, kind: "top" | "bottom"): string {
  const [first, second] = ranks;
  if (!first || first.score == null) return "비교할 수 있는 정보가 부족해 추천하지 못했어요. 내 치수를 입력하거나 옷장에 같은 종류 옷을 등록해 주세요.";
  const basis = first.basis === "body" ? `내 치수로 본 ${fitLevelName(target, kind)} 기준` : "옷장에서 만족했던 옷 기준";
  if (second?.score != null && first.score - second.score < 5) return `${basis}으로 ${names[first.key]}와(과) ${names[second.key]}이(가) 비슷해요. 아래 치수를 보고 골라 주세요.`;
  return `${basis}으로 ${names[first.key]}이(가) 가장 잘 맞을 것 같아요.`;
}


import { MEASUREMENT_LABELS, formatNum, type MeasurementKey } from "@/lib/constants/measurements";
import type { CategoryId, Measurements } from "@/lib/types/domain";
import { extractReviewSignals } from "./review-signals";
import { computeShoeSize, shoeSizeNote } from "./shoes";
import { measurementKeysFor, type SelectedComparable } from "./select-comparables";
import type {
  Anchor,
  ComparableSnapshot,
  Confidence,
  DimensionResult,
  FitComputed,
  RangeStat,
  SizeReport,
} from "./types";
import { DIRECTION_WORD, cm, eunNeun, gwaWa, itemWording, shortLabel, words } from "./wording";

/**
 * 치수 비교·통계 엔진(PROJECT_SPEC.md 16장). 결정적 순수 함수라 같은 입력이면 늘 같은 결과가 나온다.
 * 예상 핏 문장도 규칙으로 만든다. AI 키가 없어도 이 결과만으로 화면이 완성된다(비용 0).
 */

/** 치수별 허용오차(cm). 이 안이면 "비슷함"으로 본다. */
export const TOLERANCE: Record<MeasurementKey, number> = {
  shoulder: 1,
  chest: 1,
  waist: 1,
  hip: 1,
  thigh: 1,
  legOpening: 1,
  rise: 1,
  length: 1.5,
  sleeve: 1.5,
  head: 1,
  depth: 1,
  brim: 0.5,
};

/** 범위 경계에서 이만큼 벗어난 건 체감 차이가 작아 범위 안으로 본다. */
const WITHIN_SLACK = 0.5;

/** 그룹별 핵심 치수(가중치 2) */
export const CORE_DIMS: Record<CategoryId, readonly MeasurementKey[]> = {
  outer: ["shoulder", "chest", "length", "sleeve"],
  top: ["shoulder", "chest", "length", "sleeve"],
  bottom: ["waist", "thigh", "length", "rise"],
  hat: ["head", "depth", "brim"],
  shoes: [],
};

export interface FitCandidate {
  categoryId: CategoryId;
  subcategoryId: string | null;
  brand: string | null;
  productName: string | null;
  sizes: Array<{ sizeLabel: string; measurements: Measurements }>;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function stat(values: number[]): RangeStat | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { min: sorted[0], max: sorted[sorted.length - 1], median: round1(median), n: sorted.length };
}

export const garmentName = (c: Pick<ComparableSnapshot, "brand" | "productName" | "sizeLabel">) =>
  [c.brand, c.productName, c.sizeLabel].filter(Boolean).join(" ");

export function snapshotComparables(selected: SelectedComparable[]): ComparableSnapshot[] {
  return selected.map(({ garment: g, matchLevel }) => {
    const keys = measurementKeysFor(g.categoryId);
    const measurements: Measurements = {};
    for (const k of keys) if (g.measurements[k] != null) measurements[k] = g.measurements[k];
    const review = g.fitReview?.trim() ? g.fitReview.trim().slice(0, 2000) : null;
    return {
      garmentId: g.id,
      brand: g.brand,
      productName: g.productName,
      sizeLabel: g.sizeLabel,
      subcategoryId: g.subcategoryId,
      matchLevel,
      measurements,
      review,
      signals: extractReviewSignals(review, keys),
      ...(g.categoryId === "shoes" ? { shoeFit: g.shoeFit } : {}),
    };
  });
}

function dimension(key: MeasurementKey, cand: number | null, comps: ComparableSnapshot[]): DimensionResult {
  const withValue = comps.filter((c) => c.measurements[key] != null);
  const owned = stat(withValue.map((c) => c.measurements[key]!));
  // 후기가 있고, 이 치수(또는 전체)에 불만이 없는 옷의 값
  const comfortValues = withValue
    .filter((c) => c.review && !c.signals.some((s) => s.direction !== "good" && (s.dimension === key || s.dimension === "overall")))
    .map((c) => c.measurements[key]!);
  const comfort = comfortValues.length >= 2 ? stat(comfortValues) : null;
  const range = comfort ?? owned;
  const basis = comfort ? "comfort" : owned ? "owned" : null;

  const base = { key, candidate: cand, comfortRange: comfort, ownedRange: owned, basis } as const;
  if (cand == null) return { ...base, verdict: "unknown", distanceFromRange: null, anchors: [], tag: "none", judgement: "신규 실측 없음" };
  if (!range) return { ...base, verdict: "unknown", distanceFromRange: null, anchors: [], tag: "none", judgement: "기존 옷 실측 없음" };

  const raw = cand > range.max ? cand - range.max : cand < range.min ? cand - range.min : 0;
  const distance = round1(raw);
  const verdict = Math.abs(distance) <= WITHIN_SLACK ? "within" : distance > 0 ? "above" : "below";

  // 이 치수에 "길다/작다"처럼 적은 옷과 비교(신호 앵커)
  const tol = TOLERANCE[key];
  const anchors: Anchor[] = [];
  for (const c of withValue) {
    const v = c.measurements[key]!;
    for (const s of c.signals) {
      if (s.dimension !== key || s.direction === "good") continue;
      const bigger = s.direction === "long" || s.direction === "loose";
      const beyond = bigger ? cand >= v + tol : cand <= v - tol;
      if (Math.abs(cand - v) <= tol || beyond) {
        anchors.push({ garmentId: c.garmentId, value: v, direction: s.direction, evidence: s.evidence, relation: beyond ? "beyond" : "similar" });
        break;
      }
    }
  }

  let tag: DimensionResult["tag"];
  let judgement: string;
  const anchor = anchors[0];
  if (anchor) {
    const c = comps.find((x) => x.garmentId === anchor.garmentId)!;
    tag = "caution";
    const v = formatNum(anchor.value);
    judgement = `${DIRECTION_WORD[anchor.direction]}고 적은 ${c.brand || c.productName}(${v})${anchor.relation === "beyond" ? "보다 더" : `${gwaWa(v).slice(v.length)} 비슷`}`;
  } else if (verdict === "within") {
    tag = basis === "comfort" ? "within" : "weak";
    judgement = basis === "comfort" ? "만족했던 옷들과 비슷함" : "기존 옷과 비슷함 · 후기 근거 없음";
  } else {
    tag = basis === "comfort" ? "caution" : "weak";
    const w = words(key, verdict);
    judgement = `${basis === "comfort" ? "만족 범위" : "기존 옷"}보다 ${formatNum(Math.abs(distance))} ${w.short}`;
  }
  return { ...base, verdict, distanceFromRange: distance, anchors, tag, judgement };
}

function confidenceOf(categoryId: CategoryId, dims: DimensionResult[], comps: ComparableSnapshot[]): Confidence {
  const core = CORE_DIMS[categoryId];
  const candCore = dims.filter((d) => core.includes(d.key) && d.candidate != null).length;
  if (!comps.length || candCore <= 1) return "insufficient";
  const reviewed = comps.filter((c) => c.review).length;
  const sameSub = comps.filter((c) => c.matchLevel === "subcategory").length;
  const comparableCore = dims.filter((d) => core.includes(d.key) && d.candidate != null && d.ownedRange).length;
  if (sameSub >= 6 && reviewed >= 4 && comparableCore >= 3) return "high";
  if (sameSub >= 3 && reviewed >= 2) return "medium";
  return "low";
}

function nearest(categoryId: CategoryId, cand: Measurements, comps: ComparableSnapshot[]) {
  const core = CORE_DIMS[categoryId];
  return comps
    .map((c) => {
      let sum = 0;
      let weight = 0;
      for (const k of measurementKeysFor(categoryId)) {
        const a = cand[k];
        const b = c.measurements[k];
        if (a == null || b == null) continue;
        const w = core.includes(k) ? 2 : 1;
        sum += (Math.abs(a - b) / TOLERANCE[k]) * w;
        weight += w;
      }
      return { garmentId: c.garmentId, distance: weight ? round1(sum / weight) : Infinity };
    })
    .filter((x) => Number.isFinite(x.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
}

/** 판정 결과를 규칙으로 문장화한다. 예: "어깨·가슴은 만족했던 옷들과 비슷하고, 총장은 만족 범위보다 2cm 깁니다." */
export function ruleSummary(dims: DimensionResult[], comps: ComparableSnapshot[], confidence: Confidence): string {
  if (confidence === "insufficient") {
    return comps.length
      ? "신규 상품의 핵심 치수 실측이 부족해 예상 핏을 판단하지 않았습니다. 사이즈표의 실측을 두 개 이상 넣어 주세요."
      : "비교할 옷이 없어 예상 핏을 판단하지 않았습니다. 같은 종류의 옷을 옷장에 먼저 기록해 주세요.";
  }
  const sentences: string[] = [];
  for (const basis of ["comfort", "owned"] as const) {
    const judged = dims.filter((d) => d.basis === basis && d.verdict !== "unknown");
    if (!judged.length) continue;
    const ok = judged.filter((d) => d.verdict === "within").map((d) => shortLabel(d.key));
    const off = judged.filter((d) => d.verdict !== "within");
    const parts: string[] = [];
    if (ok.length) parts.push(`${eunNeun(ok.join("·"))} ${basis === "comfort" ? "만족했던 옷들과" : "기존 옷들과"} 비슷`);
    off.forEach((d, i) => {
      const w = words(d.key, d.verdict as "above" | "below");
      const last = i === off.length - 1;
      const where = i === 0 ? `${basis === "comfort" ? "만족 범위" : "기존 옷"}보다 ` : "";
      parts.push(`${eunNeun(shortLabel(d.key))} ${where}${cm(d.distanceFromRange!)} ${last ? w.end : w.connect}`);
    });
    let s = parts
      .map((p, i) => (i === parts.length - 1 ? p : p.endsWith("비슷") ? `${p}하고` : p))
      .join(", ");
    if (s.endsWith("비슷")) s += "합니다";
    if (basis === "owned") s = `착용 후기로 만족 범위를 정할 수 없는 치수는 기존 옷과 비교했습니다. ${s}`;
    sentences.push(`${s}.`);
  }

  // 후기에 불만을 적은 옷과 같거나 더한 치수 하나를 근거로 덧붙인다.
  const anchored = dims.find((d) => d.anchors.length);
  if (anchored) {
    const a = anchored.anchors[0];
    const c = comps.find((x) => x.garmentId === a.garmentId)!;
    const name = c.brand || c.productName;
    const w = words(anchored.key, a.direction === "long" || a.direction === "loose" ? "above" : "below");
    const label = shortLabel(anchored.key);
    sentences.push(
      a.relation === "similar"
        ? `${label} ${cm(anchored.candidate!)}는 "${DIRECTION_WORD[a.direction]}"고 기록한 ${name}의 ${label}(${cm(a.value)})${gwaWa(label).slice(label.length)} 비슷해, 같은 느낌일 수 있습니다.`
        : `${label} ${cm(anchored.candidate!)}는 "${DIRECTION_WORD[a.direction]}"고 기록한 ${name}(${cm(a.value)})보다도 ${w.end}.`,
    );
  }
  if (!sentences.length) return "비교할 수 있는 치수가 없어 수치만 표시했습니다.";
  if (confidence === "low") sentences.push("비교한 옷이나 후기가 적어 참고용으로 봐 주세요.");
  return sentences.join(" ");
}

function limitationsOf(dims: DimensionResult[], comps: ComparableSnapshot[], skippedCount: number): string[] {
  const out: string[] = [];
  if (comps.length && comps.length < 3) out.push(`비교할 수 있는 옷이 ${comps.length}벌뿐입니다. 기록이 늘면 범위가 더 정확해집니다.`);
  if (comps.length && !comps.some((c) => c.matchLevel === "subcategory"))
    out.push("같은 세부분류의 옷이 없어 같은 대분류나 비슷한 분류의 옷과 비교했습니다.");
  else if (comps.some((c) => c.matchLevel !== "subcategory")) out.push("같은 세부분류의 옷이 부족해 비슷한 분류의 옷도 함께 비교했습니다.");
  if (comps.length && !comps.some((c) => c.review)) out.push("후기가 있는 옷이 없어 만족 범위를 계산하지 못했습니다. 기존 옷의 치수와만 비교했습니다.");
  for (const d of dims) {
    const label = MEASUREMENT_LABELS[d.key];
    if (d.candidate == null) out.push(`신규 상품에 ${label} 실측이 없어 ${eunNeun(label)} 판단하지 않았습니다.`);
    else if (!d.ownedRange) out.push(`비교한 옷에 ${label} 실측이 없어 ${eunNeun(label)} 판단하지 않았습니다.`);
  }
  const weak = dims.filter((d) => d.basis === "owned" && d.candidate != null).map((d) => MEASUREMENT_LABELS[d.key]);
  if (weak.length && comps.some((c) => c.review))
    out.push(`${weak.join(", ")}: 불만 없는 후기가 2벌 미만이라 만족 범위 대신 기존 옷 범위와 비교했습니다.`);
  if (skippedCount) out.push(`실측이 겹치지 않는 옷 ${skippedCount}벌은 비교에서 뺐습니다.`);
  return out;
}

export function computeSize(
  categoryId: CategoryId,
  size: { sizeLabel: string; measurements: Measurements },
  comps: ComparableSnapshot[],
  skippedCount = 0,
): SizeReport {
  const t = (text: string) => itemWording(categoryId, text);
  const dims = measurementKeysFor(categoryId)
    .map((k) => dimension(k, size.measurements[k] ?? null, comps))
    .map((d) => ({ ...d, judgement: t(d.judgement) }));
  const confidence = confidenceOf(categoryId, dims, comps);
  return {
    sizeLabel: size.sizeLabel,
    measurements: size.measurements,
    confidence,
    dimensions: dims,
    nearest: nearest(categoryId, size.measurements, comps),
    sameBrandSameSize: [],
    limitations: limitationsOf(dims, comps, skippedCount).map(t),
    summary: t(ruleSummary(dims, comps, confidence)),
  };
}

export function computeFit(candidate: FitCandidate, selected: SelectedComparable[], skippedCount = 0): FitComputed {
  const comps = snapshotComparables(selected);
  if (candidate.categoryId === "shoes") {
    const sizes: SizeReport[] = candidate.sizes.map((size) => {
      const r = computeShoeSize(size.sizeLabel, candidate.brand, comps);
      if (skippedCount) r.limitations.push(`사이즈를 읽을 수 없는 신발 ${skippedCount}켤레는 비교에서 뺐습니다.`);
      return {
        sizeLabel: size.sizeLabel,
        measurements: {},
        confidence: r.confidence,
        dimensions: [],
        nearest: [],
        sameBrandSameSize: sameBrandSameSize(candidate.brand, size.sizeLabel, comps),
        limitations: r.limitations,
        summary: r.summary,
        shoe: r.report,
      };
    });
    return { version: 1, categoryId: "shoes", subcategoryId: candidate.subcategoryId, comparables: comps, skippedCount, sizes, sizeNote: shoeSizeNote(sizes) };
  }
  const sizes = candidate.sizes.map((size) => {
    const report = computeSize(candidate.categoryId, size, comps, skippedCount);
    report.sameBrandSameSize = sameBrandSameSize(candidate.brand, size.sizeLabel, comps);
    return report;
  });
  const note = sizeNote(sizes);
  return {
    version: 1,
    categoryId: candidate.categoryId,
    subcategoryId: candidate.subcategoryId,
    comparables: comps,
    skippedCount,
    sizes,
    sizeNote: note && itemWording(candidate.categoryId, note),
  };
}

function sameBrandSameSize(brandName: string | null, sizeLabel: string, comps: ComparableSnapshot[]) {
  const brand = (brandName ?? "").trim().toLowerCase();
  if (!brand) return [];
  const size = sizeLabel.trim().toLowerCase();
  return comps.filter((c) => c.brand.trim().toLowerCase() === brand && (c.sizeLabel ?? "").trim().toLowerCase() === size).map((c) => c.garmentId);
}

/** 사이즈를 여러 개 비교하면, 범위 안 치수가 많고 경계 거리 합이 작은 쪽을 알려 준다. */
function sizeNote(sizes: SizeReport[]): string | null {
  const judged = sizes.filter((s) => s.confidence !== "insufficient");
  if (judged.length < 2) return null;
  const score = (s: SizeReport) => ({
    within: s.dimensions.filter((d) => d.verdict === "within").length,
    off: s.dimensions.reduce((sum, d) => sum + Math.abs(d.distanceFromRange ?? 0), 0),
  });
  const ranked = [...judged].sort((a, b) => score(b).within - score(a).within || score(a).off - score(b).off);
  const best = ranked[0];
  const second = ranked[1];
  if (score(best).within === score(second).within && Math.abs(score(best).off - score(second).off) < 0.5)
    return `${judged.map((s) => s.sizeLabel).join("과 ")} 사이즈의 차이가 작아, 치수별 비교를 보고 골라 주세요.`;
  return `비교한 사이즈 중 ${best.sizeLabel}이(가) 기존 옷과 가장 가깝습니다(범위 안 치수 ${score(best).within}개).`;
}

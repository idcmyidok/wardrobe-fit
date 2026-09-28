import type { ShoeFit } from "@/lib/constants/shoe-fit";
import type { ComparableSnapshot, Confidence, ShoeSizeReport } from "./types";

/**
 * 신발 구매 판단(PROJECT_SPEC.md 16장). 신발은 실측이 없어 가진 신발의 사이즈(mm)와 착용감으로 판단한다.
 * - 신발마다 "맞았을 사이즈"를 추정한다: 길이감이 작았으면 +5mm, 컸으면 −5mm, 딱 맞았거나 기록이 없으면 그대로.
 * - 같은 브랜드 신발이 있으면 그 신발만으로, 없으면 비교한 신발 전체로 평소 사이즈(중앙값)를 정한다.
 * - 발볼·발등이 좁거나 압박이라고 적은 신발은 주의로 알려 준다(같은 브랜드면 반 치수 크게 고려).
 * 결정적 규칙이라 같은 입력이면 늘 같은 결과가 나오고 AI를 부르지 않는다(비용 0).
 */

export const SHOE_STEP_MM = 5;

/** "270", "270mm", "27cm", "27.5" → mm. 읽을 수 없거나 범위(200~330mm) 밖이면 null */
export function shoeSizeMm(label: string | null | undefined): number | null {
  const m = (label ?? "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  let v = Number(m[0]);
  if (v >= 20 && v <= 33) v *= 10;
  return v >= 200 && v <= 330 ? Math.round(v) : null;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** 5mm 단위로 반올림 */
const toStep = (v: number) => Math.round(v / SHOE_STEP_MM) * SHOE_STEP_MM;

/** 이 신발을 기준으로 추정한 맞는 사이즈 */
export function idealFrom(sizeMm: number, fit: ShoeFit | null | undefined): number {
  if (fit?.length === "tight") return sizeMm + SHOE_STEP_MM;
  if (fit?.length === "loose") return sizeMm - SHOE_STEP_MM;
  return sizeMm;
}

const nameOf = (c: ComparableSnapshot) => [c.brand, c.productName].filter(Boolean).join(" ") || "신발";

export function computeShoeSize(
  sizeLabel: string,
  brand: string | null,
  comps: ComparableSnapshot[],
): { report: ShoeSizeReport; confidence: Confidence; summary: string; limitations: string[] } {
  const candidateMm = shoeSizeMm(sizeLabel);
  const sized = comps.filter((c) => shoeSizeMm(c.sizeLabel) != null);
  const key = (brand ?? "").trim().toLowerCase();
  const sameBrand = key ? sized.filter((c) => c.brand.trim().toLowerCase() === key) : [];
  const pool = sameBrand.length ? sameBrand : sized;
  const basis: ShoeSizeReport["basis"] = sameBrand.length ? "sameBrand" : sized.length ? "all" : null;
  const idealMm = pool.length ? toStep(median(pool.map((c) => idealFrom(shoeSizeMm(c.sizeLabel)!, c.shoeFit)))) : null;
  const diffMm = candidateMm != null && idealMm != null ? candidateMm - idealMm : null;
  const lengthVerdict: ShoeSizeReport["lengthVerdict"] = diffMm == null ? "unknown" : diffMm === 0 ? "good" : diffMm > 0 ? "large" : "small";

  // 발볼·발등 주의: 같은 브랜드를 먼저 본다.
  const cautions: ShoeSizeReport["cautions"] = [];
  for (const part of ["width", "instep"] as const) {
    const tight = [...sameBrand, ...sized.filter((c) => !sameBrand.includes(c))].filter((c) => c.shoeFit?.[part] === "tight");
    if (tight.length) {
      const c = tight[0];
      cautions.push({ part, garmentId: c.garmentId, sameBrand: sameBrand.includes(c), text: `${nameOf(c)} ${c.sizeLabel}에서 ${part === "width" ? "발볼이 좁았다" : "발등이 압박됐다"}고 기록했습니다.` });
    }
  }

  const feedback = sized.filter((c) => c.shoeFit).length;
  const confidence: Confidence =
    candidateMm == null || !sized.length
      ? "insufficient"
      : sameBrand.length >= 2 && sameBrand.some((c) => c.shoeFit?.length)
        ? "high"
        : sized.length >= 3 && feedback >= 2
          ? "medium"
          : "low";

  const sentences: string[] = [];
  if (candidateMm == null) sentences.push("사이즈를 mm로 읽지 못해 판단하지 않았습니다. 270처럼 mm 숫자로 넣어 주세요.");
  else if (idealMm == null) sentences.push("비교할 신발이 없어 판단하지 않았습니다. 가진 신발을 사이즈와 함께 옷장에 먼저 기록해 주세요.");
  else {
    sentences.push(`가진 ${basis === "sameBrand" ? "같은 브랜드 " : ""}신발로 보면 평소 맞는 사이즈는 ${idealMm}mm입니다.`);
    sentences.push(
      diffMm === 0 ? `${candidateMm}mm는 평소 사이즈와 같습니다.` : `${candidateMm}mm는 평소 사이즈보다 ${Math.abs(diffMm!)}mm ${diffMm! > 0 ? "커서 헐렁할 수 있습니다" : "작아서 낄 수 있습니다"}.`,
    );
    for (const c of cautions) {
      if (!c.sameBrand) sentences.push(c.text);
      else if (diffMm === SHOE_STEP_MM) sentences.push(`다만 같은 브랜드 ${c.text} 그 점을 생각하면 반 치수 큰 이 사이즈가 맞을 수 있습니다.`);
      else if (diffMm! <= 0) sentences.push(`같은 브랜드 ${c.text} 반 치수(5mm) 크게도 고려해 보세요.`);
      else sentences.push(`같은 브랜드 ${c.text}`);
    }
    if (confidence === "low") sentences.push("비교한 신발이나 착용감 기록이 적어 참고용으로 봐 주세요.");
  }

  const limitations: string[] = [];
  const unsized = comps.length - sized.length;
  if (sized.length && sized.length < 3) limitations.push(`사이즈를 읽을 수 있는 신발이 ${sized.length}켤레뿐입니다. 기록이 늘면 더 정확해집니다.`);
  if (sized.length && !feedback) limitations.push("착용감(길이감·발볼·발등)을 기록한 신발이 없어 사이즈만 비교했습니다.");
  if (key && !sameBrand.length && sized.length) limitations.push("같은 브랜드 신발이 없어 다른 브랜드 신발과 비교했습니다. 브랜드마다 사이즈 감이 다를 수 있습니다.");
  if (unsized) limitations.push(`사이즈를 mm로 읽지 못한 신발 ${unsized}켤레는 빼고 비교했습니다.`);

  return {
    report: { candidateMm, idealMm, diffMm, basis, lengthVerdict, cautions },
    confidence,
    summary: sentences.join(" "),
    limitations,
  };
}

/** 사이즈를 여러 개 비교하면, 평소 사이즈(발볼·발등 주의가 같은 브랜드에서 나오면 +5mm)에 가까운 쪽을 알려 준다. */
export function shoeSizeNote(reports: Array<{ sizeLabel: string; shoe?: ShoeSizeReport }>): string | null {
  const judged = reports.filter((r) => r.shoe?.diffMm != null);
  if (judged.length < 2) return null;
  const bump = judged[0].shoe!.cautions.some((c) => c.sameBrand) ? SHOE_STEP_MM : 0;
  const target = judged[0].shoe!.idealMm! + bump;
  const best = [...judged].sort((a, b) => Math.abs(a.shoe!.candidateMm! - target) - Math.abs(b.shoe!.candidateMm! - target))[0];
  return `비교한 사이즈 중 ${best.sizeLabel}이(가) 가장 알맞아 보입니다${bump ? "(같은 브랜드에서 발볼·발등이 좁았다는 기록이 있어 반 치수 크게 봤습니다)" : ""}.`;
}


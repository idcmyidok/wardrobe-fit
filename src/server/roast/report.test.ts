import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze } from "./analyze";
import { buildScript } from "./compose";
import { buildReport, SCORE_HIGH, SCORE_LOW } from "./report";
import { REPORT_TEXT } from "./report-text";

const now = new Date("2026-09-29T12:00:00+09:00");
const g = (i: number, over: Partial<Garment> = {}): Garment =>
  ({
    id: `g${i}`,
    categoryId: "top",
    subcategoryId: "top.short_tee",
    brand: "COS",
    productName: `티셔츠 ${i}`,
    sizeLabel: "M",
    colorName: "블랙",
    seasons: [],
    purchasedOn: null,
    purchasePrice: null,
    productUrl: null,
    imageUrl: `https://x/${i}.jpg`,
    measurements: {},
    fitReview: null,
    shoeFit: null,
    ...over,
  }) as Garment;

describe("결과 페이지(옷장 진단 리포트)", () => {
  // 검정 반팔을 여러 벌, 최근에도 또 산 옷장
  const wardrobe = [
    ...Array.from({ length: 7 }, (_, i) => g(i, { purchasedOn: i < 2 ? "2026-08-01" : "2023-03-01", purchasePrice: 39000 })),
    ...Array.from({ length: 4 }, (_, i) => g(10 + i, { categoryId: "bottom", subcategoryId: null, brand: "Levi's", colorName: "인디고", purchasedOn: "2024-05-01", purchasePrice: 129000 })),
    g(20, { categoryId: "outer", subcategoryId: null, brand: "Lemaire", colorName: "베이지", purchasedOn: "2025-10-01", purchasePrice: 1450000 }),
  ];
  const a = analyze(wardrobe, null, 1360, now);
  const report = buildReport(a, "세현", 1, REPORT_TEXT);

  it("한 줄 정의·진단 카드·점수·DNA를 채우고, 캐릭터는 세 개까지", () => {
    expect(report.headline).toContain("세현님의 옷장");
    expect(report.diagnoses.length).toBeGreaterThanOrEqual(3);
    expect(report.diagnoses.length).toBeLessThanOrEqual(5);
    expect(report.diagnoses.map((d) => d.id)).toContain("duplicate");
    expect(report.characters.length).toBeLessThanOrEqual(3);
    expect(report.dna.length).toBeGreaterThan(0);
  });

  it("점수는 0~100이고, 비꼬는 한 줄은 95점 이상·30점 이하에만, 두 개까지 붙는다", () => {
    for (const s of report.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      if (s.text) expect(s.score >= SCORE_HIGH || s.score <= SCORE_LOW).toBe(true);
    }
    expect(report.scores.filter((s) => s.text).length).toBeLessThanOrEqual(2);
  });

  it("이미 많은 옷을 최근에도 또 샀으면 가장 수상한 부분에 쓴다", () => {
    expect(report.suspicious?.text).toContain("최근 6개월에도 2벌");
  });

  it("핏은 치수가 없어도 직접 적은 핏이 5벌 이상이면 점수를 낸다", () => {
    const fitWardrobe = wardrobe.map((x, i) => (i < 6 ? { ...x, userFit: i % 2 ? "over" : "regular" } : x)) as Garment[];
    const withFit = buildReport(analyze(fitWardrobe, null, 1360, now), null, 1, REPORT_TEXT);
    expect(withFit.scores.map((s) => s.id)).toContain("fit");
    expect(report.scores.map((s) => s.id)).not.toContain("fit");
  });

  it("대화에서 받은 답을 관련 진단 카드에 붙이고, 세 개를 넘지 않는다", () => {
    const plan = buildScript(a, 3, null);
    const answers = Object.fromEntries(plan.asked.map((q) => [q.id, q.options[0].id]));
    const withAnswers = buildReport(a, null, 3, REPORT_TEXT, plan.asked, answers);
    const n = withAnswers.diagnoses.filter((d) => d.answer).length + (withAnswers.suspicious?.answer ? 1 : 0);
    expect(n).toBeLessThanOrEqual(3);
  });
});

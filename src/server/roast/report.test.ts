import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze } from "./analyze";
import { buildScript } from "./compose";
import type { AskedQuestion } from "./questions";
import { buildReport } from "./report";
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

  it("한 줄 정의·\"> \" 문장·목록·진단 문단·DNA를 글로 채운다", () => {
    expect(report.headline).toContain("세현님의 옷장");
    expect(report.intro.length).toBeGreaterThan(0);
    expect(report.points.map((p) => p.id)).toContain("duplicate");
    for (const p of report.points) expect(p.lead).toMatch(/[.!?]$/);
    expect(report.lists[0]?.items[0]).toBe("블랙 반소매 티셔츠 7벌");
    expect(report.dna.length).toBeGreaterThan(0);
    expect(report.shelf.length).toBeLessThanOrEqual(12);
  });

  it("총 옷장 점수는 0~100이고, 질문·퀴즈 답의 증감을 더한다", () => {
    expect(report.total.score).toBeGreaterThanOrEqual(0);
    expect(report.total.score).toBeLessThanOrEqual(100);
    expect(report.total.lead).toContain(`${report.total.score}점`);
    const plan = buildScript(a, 3, null);
    const q = plan.asked.find((x) => x.options.length && !x.scoreKey)!;
    const opt = q.options[0].id;
    const base = buildReport(a, null, 3, REPORT_TEXT, plan.asked, { [q.id]: opt }, {});
    const plus = buildReport(a, null, 3, REPORT_TEXT, plan.asked, { [q.id]: opt }, { [q.id]: { [opt]: 5 } });
    const minus = buildReport(a, null, 3, REPORT_TEXT, plan.asked, { [q.id]: opt }, { [q.id]: { [opt]: -5 } });
    expect(plus.total.score - base.total.score).toBe(Math.min(5, 100 - base.total.score));
    expect(base.total.score - minus.total.score).toBe(Math.min(5, base.total.score));
  });

  it("선택지를 코드가 만드는 질문(퀴즈 등)은 반응 종류로 증감을 찾는다", () => {
    const q = { id: "count_guess", text: "", options: [{ id: "7", label: "7" }], reactions: {}, roast: {}, photos: [], scoreKey: { "7": "right" } } as unknown as AskedQuestion;
    const base = buildReport(a, null, 3, REPORT_TEXT, [q], { count_guess: "7" }, {});
    const right = buildReport(a, null, 3, REPORT_TEXT, [q], { count_guess: "7" }, { count_guess: { right: 4 } });
    expect(right.total.score - base.total.score).toBe(Math.min(4, 100 - base.total.score));
  });

  it("이미 많은 옷을 최근에도 또 샀으면 수상한 부분을 문단으로 쓴다", () => {
    const p = report.points.find((x) => x.id === "suspicious");
    expect(`${p?.lead} ${p?.text}`).toContain("최근 6개월에도 2벌");
  });

  it("핏은 치수가 없어도 직접 적은 핏이 5벌 이상이면 진단한다", () => {
    const fitWardrobe = wardrobe.map((x, i) => (i < 6 ? { ...x, userFit: "over" } : x)) as Garment[];
    const withFit = buildReport(analyze(fitWardrobe, null, 1360, now), null, 1, REPORT_TEXT);
    expect(withFit.points.map((p) => p.id)).toContain("fit");
    expect(report.points.map((p) => p.id)).not.toContain("fit");
  });

  it("대화에서 받은 답은 세 개까지만 문단에 붙인다", () => {
    const plan = buildScript(a, 3, null);
    const answers = Object.fromEntries(plan.asked.map((q) => [q.id, q.options[0].id]));
    const withAnswers = buildReport(a, null, 3, REPORT_TEXT, plan.asked, answers);
    const n = withAnswers.points.filter((p) => p.answer || p.id === "answer").length;
    expect(n).toBeLessThanOrEqual(3);
  });
});

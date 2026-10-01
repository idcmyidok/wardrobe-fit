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
    productName: `프린트 티셔츠 ${i}`, // 무지 티(분석에서 빠짐)가 아니게
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

  it("한 줄 정의·요약 한 문장·\"> \" 문장·목록·진단 문단을 글로 채운다", () => {
    expect(report.headline).toContain("세현님의 옷장");
    expect(report.intro.length).toBeGreaterThan(0);
    expect(report.points.map((p) => p.id)).toContain("duplicate");
    for (const p of report.points) expect(p.lead).toMatch(/[.!?]$/);
    expect(report.lists[0]?.items[0]).toBe("블랙 반소매 티셔츠 7벌");
    // 옷장 DNA 대신 제목 아래 요약 한 문장(특징 두세 개를 잇는다)
    expect(report.summary).toMatch(/^옷장이 전체적으로 .+이고, .+인 옷장이네요\. .+점.+\.$/);
    expect(report.dna).toBeUndefined();
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
    const q = { id: "quiz", text: "", options: [{ id: "2", label: "2" }], reactions: {}, roast: {}, photos: [], scoreKey: { "2": "right" } } as unknown as AskedQuestion;
    const base = buildReport(a, null, 3, REPORT_TEXT, [q], { quiz: "2" }, {});
    const right = buildReport(a, null, 3, REPORT_TEXT, [q], { quiz: "2" }, { quiz: { right: 4 } });
    expect(right.total.score - base.total.score).toBe(Math.min(4, 100 - base.total.score));
  });

  it("이미 많은 옷을 최근에도 또 샀으면 중복 문단 하나에 이어 쓴다", () => {
    const dups = report.points.filter((x) => `${x.lead} ${x.text}`.includes("블랙 반소매 티셔츠"));
    expect(dups).toHaveLength(1);
    expect(dups[0].text).toContain("최근 6개월에도 2벌");
    expect(dups[0].photos?.length).toBeGreaterThan(0);
  });

  it("첫 줄은 총점 구간 문장, 컬러 한마디는 늘 들어간다", () => {
    expect(report.headline).toContain("세현님의 옷장");
    expect(report.points.some((x) => x.id === "color")).toBe(true);
  });

  it("점수 기준(rules)을 바꾸면 총점이 바뀐다", () => {
    const up = buildReport(a, "세현", 1, REPORT_TEXT, [], {}, { rules: { base: 60 } });
    const base = buildReport(a, "세현", 1, REPORT_TEXT, [], {}, {});
    expect(up.total.score - base.total.score).toBe(Math.min(15, 100 - base.total.score));
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

  it("많이 가진 옷 목록은 같은 옷(세부분류·색·핏) 3벌 이상만, 없으면 목록을 뺀다", () => {
    // 2벌씩만 겹치는 옷장
    const pairs = Array.from({ length: 12 }, (_, i) =>
      g(100 + i, { colorName: ["블랙", "화이트", "그레이", "네이비", "베이지", "카키"][Math.floor(i / 2)], brand: ["COS", "Uniqlo", "Nike", "Lemaire", "A.P.C.", "Levi's"][i % 6] }),
    );
    const r2 = buildReport(analyze(pairs, null, 1360, now), null, 1, REPORT_TEXT);
    expect(r2.lists.find((l) => l.title === REPORT_TEXT.LIST_DUP[0])).toBeUndefined();
  });

  it("브랜드 목록은 몇 개만 %로, 1위가 기준 미만이면 뺀다", () => {
    const brands = report.lists.find((l) => l.title === REPORT_TEXT.LIST_BRAND[0]);
    expect(brands?.items.length).toBeLessThanOrEqual(REPORT_TEXT.layout.count.brand_rows);
    for (const row of brands?.items ?? []) expect(row).toMatch(/ \d+%$/);
    // 브랜드가 고르게 흩어진 옷장(1위가 15% 미만)은 목록을 뺀다
    const spread = Array.from({ length: 16 }, (_, i) => g(200 + i, { brand: `브랜드${Math.floor(i / 2)}`, colorName: i % 2 ? "레드" : "블루" }));
    const r3 = buildReport(analyze(spread, null, 1360, now), null, 1, REPORT_TEXT);
    expect(r3.lists.find((l) => l.title === REPORT_TEXT.LIST_BRAND[0])).toBeUndefined();
  });

  it("결과 사진은 가장 특이한 문단 몇 개에만 넣는다", () => {
    const withPhotos = report.points.filter((p) => p.photos?.length);
    expect(withPhotos.length).toBeLessThanOrEqual(REPORT_TEXT.layout.count.photo_blocks);
  });

  it("무채색이 많다는 말 뒤에 색 종류가 많다는 말을 잇지 않는다", () => {
    const colors = ["블랙", "블랙", "블랙", "블랙", "그레이", "그레이", "화이트", "화이트", "레드", "블루", "옐로", "그린", "핑크", "퍼플", "오렌지", "브라운"];
    const mixed = colors.concat(Array(12).fill("블랙")).map((c, i) => g(300 + i, { colorName: c, brand: `브랜드${i}` }));
    const r4 = buildReport(analyze(mixed, null, 1360, now), null, 1, REPORT_TEXT);
    const color = r4.points.find((p) => p.id === "color");
    expect(color).toBeDefined();
    expect(`${color!.lead} ${color!.text}`).not.toContain("색 계열이");
  });

  it("실측이 비슷한 옷은 묶음 안의 모든 옷끼리 가슴·총장·소매가 2cm 이내여야 한다", () => {
    const tee = (i: number, length: number, sleeve: number) =>
      g(400 + i, { brand: `브랜드${i}`, colorName: ["레드", "블루", "그린", "옐로", "핑크"][i % 5], measurements: { chest: 55, length, sleeve } });
    const filler = Array.from({ length: 8 }, (_, i) => g(450 + i, { categoryId: "bottom", subcategoryId: "bottom.denim", brand: `바지${i}` }));
    const near = (list: Garment[]) => analyze([...list, ...filler], null, 1360, now).patterns.find((p) => p.id === "measure_repeat");
    // 총장 68·70·72·74: 이웃끼리만 비슷하고 끝끼리는 4cm 이상 차이 → 세 벌 묶음이 없다
    expect(near([tee(0, 68, 20), tee(1, 70, 20), tee(2, 72, 20), tee(3, 74, 20)])).toBeUndefined();
    // 가슴·총장이 같아도 소매가 10cm 다르면 따로 본다
    expect(near([tee(0, 70, 20), tee(1, 70, 20), tee(2, 70, 30)])).toBeUndefined();
    expect(near([tee(0, 70, 20), tee(1, 71, 21), tee(2, 70, 20)])?.stats.n).toBe(3);
  });

  it("질문은 관련 분석 문장과 묶여 나오고, 패셔너블 질문은 늘 마지막이다", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = buildScript(a, seed, null);
      const asks = plan.script.steps.flatMap((x) => (x.t === "ask" ? [plan.script.questions[x.q].id] : []));
      expect(asks.length).toBe(plan.asked.length);
      if (asks.includes("fashionable_q")) expect(asks[asks.length - 1]).toBe("fashionable_q");
    }
  });

  it("점수 풀이: 기본 점수 + 항목별 증감이 총점과 맞는다", () => {
    const d = report.scoreDetail!;
    expect(d.base).toBe(45);
    const sum = d.base + d.items.reduce((x, i) => x + i.delta, 0);
    expect(Math.max(0, Math.min(100, Math.round(sum)))).toBe(report.total.score);
    for (const i of d.items) {
      expect(i.label).not.toMatch(/^[a-z_]+$/);
      // 항목마다 실제로 적용된 판단 기준(숫자 포함)이 붙는다
      expect(i.why.length).toBeGreaterThan(0);
    }
  });

  it("점수 풀이에 그 항목에 반영된 옷이 나온다", () => {
    const withGarments = report.scoreDetail!.items.filter((x) => x.garments?.length);
    expect(withGarments.length).toBeGreaterThan(0);
    for (const x of withGarments) for (const label of x.garments!) expect(label.length).toBeGreaterThan(0);
  });

  it("데님 팬츠가 많으면 \"데님 팬츠\"와 \"데님\" 이야기가 따로 나오지 않는다(데님 팬츠 우선)", () => {
    const denim = Array.from({ length: 9 }, (_, i) => g(500 + i, { categoryId: "bottom", subcategoryId: "bottom.denim", brand: `브랜드${i}`, colorName: "데님", productName: `데님 팬츠 ${i}` }));
    const tees = Array.from({ length: 6 }, (_, i) => g(600 + i, { brand: `티${i}`, colorName: ["블랙", "레드", "블루", "그린", "옐로", "핑크"][i] }));
    const pats = analyze([...denim, ...tees], null, 1360, now).patterns;
    expect(pats.some((p) => p.id === "subcategory_bias" && p.stats.sub === "데님 팬츠")).toBe(true);
    expect(pats.some((p) => p.id === "family_repeat" && p.stats.family === "denim")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze, brandKindOf, colorCounted } from "./analyze";
import { buildReport } from "./report";
import { REPORT_TEXT } from "./report-text";
import { SCORE_DELTAS } from "./score-deltas";
import { ageAt, bandOf, scoreWardrobe, tierOf } from "./score";

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

describe("옷장 점수(점수 계획서)", () => {
  it("데님은 컬러 계산에서 빠진다", () => {
    const a = analyze(
      [
        ...Array.from({ length: 10 }, (_, i) => g(i)),
        g(20, { categoryId: "bottom", subcategoryId: null, colorName: "블랙", productName: "블랙 청바지" }),
        g(21, { categoryId: "bottom", subcategoryId: null, colorName: "데님" }),
      ],
      null,
      1360,
      now,
    );
    const denim = a.items.filter((i) => i.id === "g20" || i.id === "g21");
    expect(denim.every((i) => i.denim && !colorCounted(i))).toBe(true);
    expect(colorCounted(a.items.find((i) => i.id === "g0")!)).toBe(true);
  });

  it("보세·모름은 노브랜드, 빈티지·구제는 빈티지, 자료에 없는 이름은 모르는 브랜드", () => {
    expect(brandKindOf("보세", false)).toBe("nobrand");
    expect(brandKindOf("모름", false)).toBe("nobrand");
    expect(brandKindOf("빈티지", false)).toBe("vintage");
    expect(brandKindOf("구제", false)).toBe("vintage");
    expect(brandKindOf("아무도모르는브랜드", false)).toBe("unknown");
    expect(brandKindOf("COS", true)).toBe("known");
  });

  it("나이는 옷마다 산 때의 나이로 보고, 구간으로 나눈다", () => {
    const a = analyze([g(1, { purchasedOn: "2021-09-01" })], null, 1360, now);
    expect(ageAt(30, a.items[0], now.getTime())).toBe(25);
    expect(bandOf(19)).toBe("b0");
    expect(bandOf(22)).toBe("b20");
    expect(bandOf(25)).toBe("b24");
    expect(bandOf(28)).toBe("b27");
    expect(bandOf(45)).toBe("b41");
    expect(bandOf(70)).toBe("b61");
  });

  it("마지막 질문의 점수 구간: 70 이상 high, 40 미만 low", () => {
    expect(tierOf(70)).toBe("high");
    expect(tierOf(55)).toBe("mid");
    expect(tierOf(39)).toBe("low");
    expect(tierOf(55, { tier_high: 50 })).toBe("high");
  });

  it("연속으로 옷을 안 산 달이 4개월 이상이면 그만큼 감점한다", () => {
    // 2025-01 ~ 2025-08 매달 한 벌, 그 뒤로 안 삼
    const list = Array.from({ length: 10 }, (_, i) => g(i, { purchasedOn: `2025-${String(Math.min(i, 7) + 1).padStart(2, "0")}-10` }));
    const s = scoreWardrobe(analyze(list, null, 1360, now), { age: null });
    const gap = s.parts.find((p) => p.id === "gap");
    expect(gap?.delta).toBeLessThanOrEqual(-4);
  });

  it("시작 점수는 규칙의 base이고 0~100 밖으로 나가도 결과는 자른다", () => {
    const a = analyze(Array.from({ length: 10 }, (_, i) => g(i)), null, 1360, now);
    const s = scoreWardrobe(a, { age: null });
    const s2 = scoreWardrobe(a, { age: null, rules: { base: 60 } });
    expect(s2.score - s.score).toBe(15);
    const r = buildReport(a, null, 1, REPORT_TEXT, [], {}, { rules: { base: 500 } });
    expect(r.total.score).toBe(100);
  });

  it("중고가 가점: 스트릿·컨템포러리 중고가는 하나당 +1(최대 +3), 대중적 브랜드는 제외", () => {
    const part = (brand: string, n: number) => {
      const a = analyze(Array.from({ length: n }, (_, i) => g(i, { brand })), null, 1360, now);
      return scoreWardrobe(a, { age: null }).parts.find((p) => p.id === "mid")?.delta;
    };
    expect(part("Pop Trading Company", 2)).toBe(2);
    expect(part("Pop Trading Company", 8)).toBe(3);
    expect(part("COS", 6)).toBeUndefined();
  });

  it("인기 대중 브랜드(좋아요 5만 이상, 고가 미만, 대중적) 40%를 넘으면 10%p마다 -5", () => {
    const a = analyze(Array.from({ length: 10 }, (_, i) => g(i, { brand: "무신사 스탠다드" })), null, 1360, now);
    const p = scoreWardrobe(a, { age: null }).parts.find((x) => x.id === "popular");
    expect(p?.delta).toBeLessThan(0);
    expect(p?.delta).toBeGreaterThanOrEqual(-20);
  });

  it("빈티지·구제는 헤리티지 취향 점수에 들어가지 않는다", () => {
    const a = analyze(Array.from({ length: 10 }, (_, i) => g(i, { brand: i < 5 ? "빈티지" : "COS" })), null, 1360, now);
    expect(scoreWardrobe(a, { age: null }).parts.find((p) => p.id === "taste")).toBeUndefined();
  });

  it("핏: 슬림·레귤러 위주는 가점, 오버 위주는 감점, 결과에 핏 문단이 생긴다", () => {
    const list = (fit: "slim" | "over") => Array.from({ length: 10 }, (_, i) => g(i, { userFit: fit }));
    const trim = analyze(list("slim"), null, 1360, now);
    const big = analyze(list("over"), null, 1360, now);
    expect(scoreWardrobe(trim, { age: null }).parts.find((p) => p.id === "fit_trim")?.delta).toBe(3);
    expect(scoreWardrobe(big, { age: null }).parts.find((p) => p.id === "fit_big")?.delta).toBe(-2);
    expect(buildReport(trim, null, 1, REPORT_TEXT).points.map((p) => p.id)).toContain("fit");
  });

  it("결과 구성: 섹션 순서와 문단 켜기·끄기를 따른다", () => {
    const a = analyze(Array.from({ length: 10 }, (_, i) => g(i, { userFit: "slim" })), null, 1360, now);
    const layout = { ...REPORT_TEXT.layout, order: { ...REPORT_TEXT.layout.order, dna: 0 }, point_show: { ...REPORT_TEXT.layout.point_show, fit: 0 } };
    const r = buildReport(a, null, 1, { ...REPORT_TEXT, layout });
    expect(r.order?.[0]).toBe("dna");
    expect(r.points.map((p) => p.id)).not.toContain("fit");
  });
  it("SPA(가격 레벨 3 이하)는 좋아요와 상관없이 인기 대중 쏠림에 들어가고 10%p마다 -3, 최대 -12", () => {
    const a = analyze(Array.from({ length: 10 }, (_, i) => g(i, { brand: "UNIQLO" })), null, 1360, now);
    expect(scoreWardrobe(a, { age: null }).parts.find((p) => p.id === "popular")?.delta).toBe(-12);
  });

  it("일본 브랜드 가점은 중고가 이상만 센다(유니클로 제외)", () => {
    const jp = (brand: string) => scoreWardrobe(analyze(Array.from({ length: 5 }, (_, i) => g(i, { brand })), null, 1360, now), { age: null }).parts.find((p) => p.id === "jp");
    expect(jp("UNIQLO")).toBeUndefined();
    expect(jp("Needles")?.delta).toBe(2);
  });

  it("후르츠패밀리 가점은 3벌 이상이어도 전부 중저가 이하 브랜드면 없다", () => {
    const fruits = (brand: string) =>
      scoreWardrobe(analyze(Array.from({ length: 5 }, (_, i) => g(i, { brand, productUrl: i < 3 ? "https://fruitsfamily.com/p/1" : null })), null, 1360, now), { age: null }).parts.find((p) => p.id === "fruits");
    expect(fruits("UNIQLO")).toBeUndefined();
    expect(fruits("Needles")?.delta).toBe(3);
  });

  it("퀴즈는 맞혀도 가점이 없고 틀리면 감점만 있다", () => {
    expect(SCORE_DELTAS.quiz).toEqual({ right: 0, wrong: -9 });
    expect(SCORE_DELTAS.band_quiz).toEqual({ right: 0, wrong: -9 });
  });
});

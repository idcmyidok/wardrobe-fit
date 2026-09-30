import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze, brandKindOf, colorCounted } from "./analyze";
import { buildReport } from "./report";
import { REPORT_TEXT } from "./report-text";
import { ageAt, bandOf, scoreWardrobe, tierOf } from "./score";

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
    expect(s2.score - s.score).toBe(10);
    const r = buildReport(a, null, 1, REPORT_TEXT, [], {}, { rules: { base: 500 } });
    expect(r.total.score).toBe(100);
  });

  it("\"링크만 무신사\"를 고르면 무신사 감점이 줄어든다", () => {
    const a = analyze(Array.from({ length: 12 }, (_, i) => g(i, { brand: "무신사 스탠다드" })), null, 1360, now);
    const full = scoreWardrobe(a, { age: 32 });
    const half = scoreWardrobe(a, { age: 32, musinsaLinkOnly: true });
    expect(half.score).toBeGreaterThanOrEqual(full.score);
  });
});

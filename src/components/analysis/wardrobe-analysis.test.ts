import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { colorSummary, halfYearAverage, monthlySummary, priceComment, recentSixMonths } from "./wardrobe-analysis";

const pc = (count: number, total: number, avg: number, topPrice: number, perHalfYear = total) =>
  priceComment({ count, total, avg, topPrice, perHalfYear });

describe("priceComment", () => {
  it("가격 입력이 없으면 안내 문구", () => {
    expect(pc(0, 0, 0, 0).title).toBe("아직 가격 기록이 없는 옷장");
  });

  it("제목은 6개월 평균 구매액, 설명은 평균가 구간으로 고른다", () => {
    const c = pc(20, 2500000, 125000, 300000, 1200000);
    expect(c.title).toBe("밥보다 패션이 중요한 패션 러버!");
    expect(c.body).toBe("한 벌 한 벌 품질을 따져 고르는 옷장입니다. 한 벌 평균 12.5만원, 6개월마다 평균 120만원을 옷에 씁니다.");
  });

  it("총액이 커도 오래 모은 옷장이면 6개월 평균으로 판단한다", () => {
    expect(pc(40, 6000000, 150000, 300000, 400000).title).toBe("옷 고르는 재미를 아는 패션 러버!");
  });

  it("구간 경계는 상한 미만", () => {
    expect(pc(10, 1000000, 100000, 150000, 1000000).title).toBe("밥보다 패션이 중요한 패션 러버!");
    expect(pc(10, 999999, 99999, 150000, 999999).title).toBe("패션에 돈을 좀 쓴 패션 러버!");
  });

  it("한 벌이 총액의 절반 이상이면 덧붙인다", () => {
    expect(pc(4, 1000000, 250000, 700000).body).toContain("가장 비싼 한 벌이 총액의 70%");
  });

  it("가격 입력이 2벌 이하면 덧붙인다", () => {
    expect(pc(2, 60000, 30000, 40000).body).toContain("2벌뿐이라");
  });
});

const garment = (purchasedOn: string | null, purchasePrice: number | null, productName = "옷") =>
  ({ categoryId: "top", colorName: null, brand: "", productName, purchasedOn, purchasePrice }) as unknown as Garment;
const NOW = new Date(2026, 8, 28); // 2026-09-28

describe("halfYearAverage", () => {
  it("가장 이른 구매월부터 이번 달까지를 6개월 구간으로 나눠 평균낸다", () => {
    // 2025-04 ~ 2026-09 = 18개월 = 3구간, 총액 90만(구매일 없는 옷 포함)
    const r = halfYearAverage([garment("2025-04-10", 300000), garment("2026-09-01", 300000), garment(null, 300000)], NOW);
    expect(r).toEqual({ perHalfYear: 300000, periods: 3 });
  });

  it("구매일이 없으면 한 구간", () => {
    expect(halfYearAverage([garment(null, 100000)], NOW)).toEqual({ perHalfYear: 100000, periods: 1 });
  });
});

describe("recentSixMonths", () => {
  it("오늘부터 6개월 전 같은 날 이후 산 옷만 더한다", () => {
    expect(recentSixMonths([garment("2026-03-28", 1000), garment("2026-03-27", 20000), garment(null, 5000)], NOW)).toBe(1000);
  });
});

describe("monthlySummary", () => {
  it("구매한 달만 막대로 만들고, 해가 바뀌면 연도를 적는다", () => {
    const m = monthlySummary([garment("2025-11-02", 10000, "A"), garment("2026-02-03", 50000, "B"), garment("2026-02-20", 10000, "C")]);
    expect(m.bars.map((b) => [b.key, b.year])).toEqual([
      ["2025-11", "2025"],
      ["2026-02", "2026"],
    ]);
    expect(m.top).toEqual({ month: "2026.02", amount: "60,000원 · 2벌", note: "B, C" });
    expect(m.bars[0].detail.note).toBe("A");
    expect(m.span).toBe("4개월 중 2개월 구매");
  });
});

describe("colorSummary", () => {
  const g = (colorName: string | null) => ({ categoryId: "top", colorName }) as unknown as Garment;

  it("비슷한 색은 계열로 묶고, 계열 안의 색별 벌 수를 많은 순으로 담는다", () => {
    const { slices, totalLabel } = colorSummary([g("블루"), g("아쿠아 블루"), g("라이트 블루"), g("라이트 블루"), g("블랙"), g(null)], "all");
    expect(slices.map((s) => [s.name, s.count])).toEqual([
      ["블루", 4],
      ["미입력", 1],
      ["블랙", 1],
    ]);
    expect(slices[0].members).toEqual([
      { name: "라이트 블루", count: 2 },
      { name: "블루", count: 1 },
      { name: "아쿠아 블루", count: 1 },
    ]);
    expect(totalLabel).toBe("전체 · 3가지 컬러");
  });
});

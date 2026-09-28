import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { colorSummary, priceComment } from "./wardrobe-analysis";

describe("priceComment", () => {
  it("가격 입력이 없으면 안내 문구", () => {
    expect(priceComment(0, 0, 0, 0).title).toBe("아직 가격 기록이 없는 옷장");
  });

  it("제목은 총액, 설명은 평균가 구간으로 고른다", () => {
    const c = priceComment(20, 2500000, 125000, 300000);
    expect(c.title).toBe("밥보다 패션이 중요한 패션 러버!");
    expect(c.body).toBe("한 벌 한 벌 품질을 따져 고르는 옷장입니다. 한 벌 평균 12.5만원입니다.");
  });

  it("구간 경계는 상한 미만", () => {
    expect(priceComment(10, 1000000, 100000, 150000).title).toBe("패션에 돈을 좀 쓴 패션 러버!");
    expect(priceComment(10, 999999, 99999, 150000).title).toBe("옷 고르는 재미를 아는 패션 러버!");
  });

  it("한 벌이 총액의 절반 이상이면 덧붙인다", () => {
    expect(priceComment(4, 1000000, 250000, 700000).body).toContain("가장 비싼 한 벌이 총액의 70%");
  });

  it("가격 입력이 2벌 이하면 덧붙인다", () => {
    expect(priceComment(2, 60000, 30000, 40000).body).toContain("2벌뿐이라");
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

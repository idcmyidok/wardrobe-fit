import { describe, expect, it } from "vitest";
import { matchScore, scanGoods, searchKeyword } from "./musinsa-search";

describe("musinsa search helpers", () => {
  it("검색어에서 태그·괄호·색상 꼬리를 뺀다", () => {
    expect(searchKeyword("르아르", "[2PACK] 에센셜 크롭 티셔츠")).toBe("르아르 에센셜 크롭 티셔츠");
    expect(searchKeyword("아캄", "High-Neck Leather Jacket (Brown)")).toBe("아캄 High-Neck Leather Jacket");
    expect(searchKeyword("아디다스", "BB 트랙탑 - 블랙:크림화이트 / KC9299")).toBe("아디다스 BB 트랙탑");
    expect(searchKeyword("쿠코", "캡스튜디오쿠코 트러커 메쉬 캡_챠콜")).toBe("쿠코 캡스튜디오쿠코 트러커 메쉬 캡");
  });

  it("상품명 낱말이 많이 겹치고 브랜드가 같을수록 점수가 높다", () => {
    const order = { brand: "아캄", name: "High-Neck Leather Jacket (Brown)" };
    expect(matchScore(order, { brand: "아캄", name: "High-Neck Leather Jacket (Brown)" })).toBe(1);
    expect(matchScore(order, { brand: "다른", name: "Leather Belt" })).toBeLessThan(0.4);
  });

  it("JSON 어디에 있든 상품 객체를 찾는다", () => {
    const json = { data: { list: [{ goodsNo: 123456, goodsName: "셔츠", brandName: "A", thumbnail: "/images/a.jpg" }, { foo: 1 }] } };
    expect(scanGoods(json)).toEqual([{ goodsNo: "123456", name: "셔츠", brand: "A", imageUrl: "/images/a.jpg" }]);
  });
});

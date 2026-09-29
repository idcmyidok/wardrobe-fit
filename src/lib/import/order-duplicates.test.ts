import { describe, expect, it } from "vitest";
import { findDuplicates, goodsNoOf, type ExistingGarment, type OrderCandidate } from "./order-duplicates";

const g = (o: Partial<ExistingGarment> & { id: string }): ExistingGarment => ({ brand: "", productName: "", sizeLabel: null, colorName: null, productUrl: null, ...o });
const c = (o: Partial<OrderCandidate> & { key: string }): OrderCandidate => ({ brand: "", productName: "", size: "", color: "", productUrl: null, ...o });

describe("goodsNoOf", () => {
  it("무신사 상품 주소에서 번호를 뽑는다", () => {
    expect(goodsNoOf("https://www.musinsa.com/products/1234567")).toBe("1234567");
    expect(goodsNoOf("https://www.musinsa.com/app/goods/1234567")).toBe("1234567");
    expect(goodsNoOf("https://example.com/products/1234567")).toBeNull();
    expect(goodsNoOf(null)).toBeNull();
  });
});

describe("findDuplicates", () => {
  const url = "https://www.musinsa.com/products/1234567";
  it("상품번호와 사이즈가 같으면 중복", () => {
    const r = findDuplicates([c({ key: "a", productUrl: url, size: "M" })], [g({ id: "1", productUrl: url, sizeLabel: "M" })]);
    expect(r.get("a")).toBe("1");
  });
  it("같은 상품이라도 사이즈가 다르면 다른 옷", () => {
    expect(findDuplicates([c({ key: "a", productUrl: url, size: "L" })], [g({ id: "1", productUrl: url, sizeLabel: "M" })]).size).toBe(0);
  });
  it("색이 서로 알려져 있고 다르면 다른 옷, 한쪽이 비면 같은 옷", () => {
    const ex = [g({ id: "1", productUrl: url, sizeLabel: "M", colorName: "블랙" })];
    expect(findDuplicates([c({ key: "a", productUrl: url, size: "M", color: "화이트" })], ex).size).toBe(0);
    expect(findDuplicates([c({ key: "a", productUrl: url, size: "M", color: "black" })], ex).size).toBe(1);
    expect(findDuplicates([c({ key: "a", productUrl: url, size: "M" })], ex).size).toBe(1);
  });
  it("상품번호를 모르면 브랜드+제품명으로 찾는다(띄어쓰기·대소문자 무시)", () => {
    const r = findDuplicates(
      [c({ key: "a", brand: "Musinsa Standard", productName: "릴렉스드  티셔츠", size: "M" })],
      [g({ id: "1", brand: "musinsa standard", productName: "릴렉스드 티셔츠", sizeLabel: "M" })],
    );
    expect(r.get("a")).toBe("1");
  });
  it("제품명이 비면 이름으로는 같다고 보지 않는다", () => {
    expect(findDuplicates([c({ key: "a", brand: "브랜드" })], [g({ id: "1", brand: "브랜드" })]).size).toBe(0);
  });
  it("FREE·F·프리는 같은 사이즈", () => {
    expect(findDuplicates([c({ key: "a", productUrl: url, size: "FREE" })], [g({ id: "1", productUrl: url, sizeLabel: "F" })]).size).toBe(1);
  });
  it("옷장 한 벌은 주문 한 벌하고만 짝이 된다", () => {
    const r = findDuplicates(
      [c({ key: "a", productUrl: url, size: "M" }), c({ key: "b", productUrl: url, size: "M" })],
      [g({ id: "1", productUrl: url, sizeLabel: "M" })],
    );
    expect([...r.keys()]).toEqual(["a"]);
  });
  it("옷장에 두 벌 있으면 두 주문 모두 제외", () => {
    const r = findDuplicates(
      [c({ key: "a", productUrl: url, size: "M" }), c({ key: "b", productUrl: url, size: "M" })],
      [g({ id: "1", productUrl: url, sizeLabel: "M" }), g({ id: "2", productUrl: url, sizeLabel: "M" })],
    );
    expect(r.size).toBe(2);
  });
});

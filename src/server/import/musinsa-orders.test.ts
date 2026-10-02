import { describe, expect, it } from "vitest";
import { garmentFromCategoryPath, matchSizeRow, optionPairs, packCount, parseMusinsaOrders, parseOrdersForRoast, parseOrdersToGarments } from "./musinsa-orders";

// 무신사 주문내역을 Ctrl+A로 복사한 글과 같은 모양(상품은 지어낸 것)
const TEXT = `126건
26.07.23(목)
주문 상세
구매 확정
[2PACK] 에센셜 크롭 티셔츠
브랜드A
[2PACK] 에센셜 크롭 티셔츠
아쿠아블루·L · 화이트 / XL / 1개
45,900원

배송 조회
재구매
구매 확정
바디트리머 제모기
브랜드B
바디트리머 제모기
FREE / 1개
29,090원
26.07.15(수)
주문 상세
반품 완료
T-SHIRT / BLACK
브랜드C
T-SHIRT / BLACK
1 / 1개
1 / 1개
38,170원
반품 상세
26.07.03(금)
주문 상세
구매 확정
⟦G:1234567⟧
코튼메쉬 버뮤다 쇼츠(6color)
브랜드D
코튼메쉬 버뮤다 쇼츠(6color)
블랙L / 1개
34,110원
오프라인 구매 완료
아노락 쓰리피스 풀 셋업_민트
브랜드E
아노락 쓰리피스 풀 셋업_민트
L / 1개
54,900원
사용 완료
장*현님에게 선물
[무진장] 무신사머니 5천원 상품권
무신사머니 상품권
[무진장] 무신사머니 5천원 상품권
3,000원
`;

describe("parseMusinsaOrders", () => {
  it("상태 줄과 가격 줄 사이를 한 주문으로 읽는다", () => {
    const orders = parseMusinsaOrders(TEXT);
    expect(orders.map((o) => o.status)).toEqual(["구매 확정", "구매 확정", "반품 완료", "구매 확정", "오프라인 구매 완료", "사용 완료"]);
    expect(orders[0]).toMatchObject({ date: "2026-07-23", brand: "브랜드A", option: "아쿠아블루·L · 화이트 / XL", price: 45900, goodsNo: null });
    expect(orders[1].date).toBe("2026-07-23");
    expect(orders[2]).toMatchObject({ name: "T-SHIRT / BLACK", option: "1" });
    expect(orders[3]).toMatchObject({ date: "2026-07-03", goodsNo: "1234567" });
    expect(orders[5]).toMatchObject({ name: "[무진장] 무신사머니 5천원 상품권", price: 3000 });
  });
});

describe("parseOrdersToGarments", () => {
  it("구매 확정·오프라인 구매만, 옷만 남기고 팩과 셋업을 나눈다", () => {
    const r = parseOrdersToGarments(TEXT);
    expect(r.droppedByStatus).toHaveLength(2);
    expect(r.droppedByCategory.map((o) => o.name)).toEqual(["바디트리머 제모기"]);
    expect(r.garments.map((g) => [g.part, g.size, g.price, g.subcategoryId])).toEqual([
      ["1/2 · 아쿠아블루", "L", 22950, "top.short_tee"],
      ["2/2 · 화이트", "XL", 22950, "top.short_tee"],
      [null, "L", 34110, "bottom.shorts"],
      ["1/2 · 상의", "L", 27450, "outer.anorak"],
      ["2/2 · 하의", "L", 27450, "bottom.etc"],
    ]);
  });
});

describe("optionPairs / packCount", () => {
  it.each([
    ["1. 피그먼트 차콜 / 멜란지 그레이·L", [["피그먼트 차콜", "L"], ["멜란지 그레이", "L"]]],
    ["ivoryL·blackL", [["ivory", "L"], ["black", "L"]]],
    ["(70)VIOLET·270", [["VIOLET", "270"]]],
    ["free (one size)", [[null, "FREE"]]],
    ["UNISEX - M", [[null, "M"]]],
    ["2 (L)", [[null, "2 (L)"]]],
  ])("%s", (option, want) => {
    expect(optionPairs(option).map((p) => [p.color, p.size])).toEqual(want);
  });

  it("묶음 수", () => {
    expect(packCount("[2PACK] 티셔츠")).toBe(2);
    expect(packCount("2팩 스웨트 셔츠")).toBe(2);
    expect(packCount("하프 터틀넥 니트 세트")).toBe(2);
    expect(packCount("[넥타이 SET] 옥스포드 셔츠")).toBe(1);
    expect(packCount("릴렉스 핏 티셔츠")).toBe(1);
  });
});

describe("garmentFromCategoryPath", () => {
  it("옷장 분류가 있는 카테고리는 세부분류로, 없는 카테고리는 옷 아님으로", () => {
    expect(garmentFromCategoryPath(["상의", "반소매 티셔츠"])).toEqual({ categoryId: "top", subcategoryId: "top.short_tee" });
    expect(garmentFromCategoryPath(["신발", "스니커즈", "캔버스/단화"])).toEqual({ categoryId: "shoes", subcategoryId: "shoes.sneakers" });
    expect(garmentFromCategoryPath(["가방", "크로스백"])).toBe("not_garment");
    expect(garmentFromCategoryPath(["뷰티", "헤어케어"])).toBe("not_garment");
    expect(garmentFromCategoryPath(["패션소품", "키링"])).toBe("not_garment");
    expect(garmentFromCategoryPath([])).toBeNull();
  });
});

describe("matchSizeRow", () => {
  const rows = [{ sizeLabel: "S" }, { sizeLabel: "M" }, { sizeLabel: "L" }];
  it.each([
    ["L", "L"],
    ["LARGE", "L"],
    ["2 (L)", "L"],
    ["XL", null],
  ])("%s → %s", (size, want) => {
    expect(matchSizeRow(rows, size)?.sizeLabel ?? null).toBe(want);
  });
  it("원사이즈", () => {
    expect(matchSizeRow([{ sizeLabel: "ONE SIZE" }], "FREE")?.sizeLabel).toBe("ONE SIZE");
    expect(matchSizeRow([{ sizeLabel: "F" }], "FREE")?.sizeLabel).toBe("F");
  });
});

describe("북마크 버튼 글(화면에 보이는 글만)", () => {
  it("[브랜드, 상품명] 순서도 상품명·브랜드를 바르게 읽는다", () => {
    const [order] = parseMusinsaOrders(`25.10.15(수)\n구매 확정\n⟦G:4567890⟧\n아캄\nSmall Sun Jacquard Beanie (Brown)\nFREE / 1개\n31,870원\n`);
    expect(order).toMatchObject({ brand: "아캄", name: "Small Sun Jacquard Beanie (Brown)", goodsNo: "4567890" });
  });
});

describe("parseOrdersForRoast", () => {
  it("상품 준비중·배송중·배송 완료도 가진 옷으로 센다", () => {
    const text = ["26.09.30(수)", "상품 준비중", "후드 집업", "브랜드E", "후드 집업", "그레이 / L / 1개", "89,000원", "배송중", "와이드 데님", "브랜드F", "와이드 데님", "30 / 1개", "59,000원", "배송 완료", "옥스포드 셔츠", "브랜드G", "옥스포드 셔츠", "M / 1개", "49,000원"].join("\n");
    const { garments } = parseOrdersForRoast(text);
    expect(garments.map((g) => [g.order.name, g.status])).toEqual([
      ["후드 집업", "kept"],
      ["와이드 데님", "kept"],
      ["옥스포드 셔츠", "kept"],
    ]);
  });
});

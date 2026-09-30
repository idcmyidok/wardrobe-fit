import { describe, expect, it } from "vitest";
import { popularityIn } from "./parsers/musinsa";

describe("무신사 상품 하트·후기 수 읽기", () => {
  it("likeCount·reviewCount 칸과 like·review 객체 안의 수를 읽는다", () => {
    expect(popularityIn({ goodsNo: 1, likeCount: 12_345, goodsReview: { totalCount: "1,020" } })).toMatchObject({ likes: 12_345, reviews: 1020 });
    expect(popularityIn({ data: { contents: { items: [{ relationId: "123", count: 55 }] } }, like: { count: 7 } })).toMatchObject({ likes: 7 });
  });
  it("브랜드 좋아요는 상품 하트로 읽지 않는다", () => {
    expect(popularityIn({ brandInfo: { likeCount: 999_999 }, goodsNm: "티" })).toMatchObject({ likes: null, reviews: null });
  });
});

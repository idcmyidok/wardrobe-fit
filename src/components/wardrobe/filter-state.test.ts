import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { parseWardrobeParams, sizeRank } from "./filter-state";

describe("sizeRank", () => {
  const order = (labels: string[]) => labels.slice().sort((a, b) => sizeRank(a) - sizeRank(b));

  it("문자 사이즈는 알파벳이 아니라 치수 순서", () => {
    expect(order(["L", "XL", "S", "M", "XS", "XXL"])).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
  });

  it("괄호에 문자가 함께 적힌 사이즈와 2XL 표기", () => {
    expect(order(["3(M)", "M(95)", "2XL", "1(S)", "l"])).toEqual(["1(S)", "3(M)", "M(95)", "l", "2XL"]);
    expect(sizeRank("2XL")).toBe(sizeRank("XXL"));
  });

  it("FREE는 문자 사이즈 뒤, 숫자 사이즈는 그 뒤에 숫자 순서", () => {
    expect(order(["32", "FREE", "28", "M", "4", "Free"])).toEqual(["M", "FREE", "Free", "4", "28", "32"]);
  });
});

describe("parseWardrobeParams", () => {
  it("시즌 정렬은 더 이상 받지 않는다", () => {
    expect(parseWardrobeParams(new URLSearchParams("sort_top=season.asc")).sorts.top).toEqual({ key: "purchasedOn", dir: "desc" });
  });
});

describe("가격 정렬(달러 환산)", () => {
  it("달러는 환율로 원으로 바꿔 함께 정렬한다", async () => {
    const { sortGarments } = await import("./filter-state");
    const g = (id: string, purchasePrice: number, currency: "KRW" | "USD"): Garment => ({
      id, categoryId: "top", subcategoryId: null, brand: "", productName: id, sizeLabel: null, colorName: null, seasons: [], purchasedOn: null,
      purchasePrice, currency, productUrl: null, imageUrl: null, measurements: {}, fitReview: null, shoeFit: null,
    });
    const sorted = sortGarments([g("a", 60000, "KRW"), g("b", 4999, "USD"), g("c", 70000, "KRW")], { key: "price", dir: "desc" }, 1360);
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});

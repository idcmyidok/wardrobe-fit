import { describe, expect, it } from "vitest";
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

import { describe, expect, it } from "vitest";
import { formatPrice, krwHint, parsePriceInput, priceInKrw, priceInputText } from "./price";

describe("달러 가격", () => {
  it("원은 원 단위, 달러는 센트로 받는다", () => {
    expect(parsePriceInput("12,900", "KRW")).toBe(12900);
    expect(parsePriceInput("49.99", "USD")).toBe(4999);
    expect(parsePriceInput("$120", "USD")).toBe(12000);
    expect(parsePriceInput("", "USD")).toBeNull();
    expect(parsePriceInput("1.234", "USD")).toBeNull();
  });

  it("보여 줄 때와 입력 칸으로 되돌릴 때", () => {
    expect(formatPrice(4999, "USD")).toBe("$49.99");
    expect(formatPrice(12000, "USD")).toBe("$120");
    expect(formatPrice(12900)).toBe("12,900원");
    expect(priceInputText(4999, "USD")).toBe("49.99");
    expect(priceInputText(12000, "USD")).toBe("120");
    expect(priceInputText(12900, "KRW")).toBe("12900");
  });

  it("정렬·합계는 환율로 원으로 바꾼다", () => {
    expect(priceInKrw(4999, "USD", 1360)).toBe(67986);
    expect(priceInKrw(50000, "KRW", 1360)).toBe(50000);
    expect(priceInKrw(null, "USD", 1360)).toBeNull();
    expect(krwHint(4999, "USD", 1360)).toBe("약 67,986원");
    expect(krwHint(50000, "KRW", 1360)).toBeNull();
  });
});

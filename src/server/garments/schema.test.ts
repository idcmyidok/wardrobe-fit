import { describe, expect, it } from "vitest";
import { garmentInputSchema } from "./schema";

const base = { categoryId: "top", productName: "티셔츠", seasons: ["summer"], purchasedOn: "2026-09-01", userFit: "slim" };

describe("구매 보류 옷·달러 입력", () => {
  it("보류 옷은 구매일·시즌·내 핏을 비운다", () => {
    const r = garmentInputSchema.parse({ ...base, held: true, purchasePrice: 4999, currency: "USD" });
    expect(r).toMatchObject({ held: true, seasons: [], purchasedOn: null, userFit: null, purchasePrice: 4999, currency: "USD" });
  });

  it("옷장 옷은 그대로 두고, 통화를 안 보내면 원", () => {
    const r = garmentInputSchema.parse(base);
    expect(r).toMatchObject({ held: false, seasons: ["summer"], purchasedOn: "2026-09-01", userFit: "slim", currency: "KRW" });
  });

  it("원·달러 말고는 받지 않는다", () => {
    expect(garmentInputSchema.safeParse({ ...base, currency: "EUR" }).success).toBe(false);
  });
});

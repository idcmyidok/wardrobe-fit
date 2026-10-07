import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { formatHeight, stackSummary, thicknessTable } from "./stack-height";

const g = (categoryId: Garment["categoryId"], subcategoryId: string | null) => ({ categoryId, subcategoryId }) as Garment;

describe("stackSummary", () => {
  it("세부분류 두께를 더하고 비슷한 높이의 것을 고른다", () => {
    const s = stackSummary([g("top", "top.short_tee"), g("top", "top.short_tee"), g("outer", "outer.long_padding")]);
    expect(s.total).toBe(9);
    expect(s.near?.cm).toBe(10);
    expect(s.byCategory.map((x) => x.id)).toEqual(["outer", "top"]);
  });
  it("세부분류가 없으면 대분류 평균을 쓴다", () => {
    expect(stackSummary([g("bottom", null)]).total).toBe(1.2);
  });
  it("모자·신발은 계산에서 뺀다", () => {
    const s = stackSummary([g("hat", "hat.cap"), g("shoes", "shoes.sneakers")]);
    expect(s.total).toBe(0);
    expect(s.near).toBeNull();
    expect(s.range).toBe("—");
  });
  it("옷이 없으면 비운다", () => {
    expect(stackSummary([]).near).toBeNull();
  });
  it("10cm 미만은 소수 한 자리, 100cm부터 m로 보여 준다", () => {
    expect(formatHeight(7.45)).toBe("7.5cm");
    expect(formatHeight(85)).toBe("85cm");
    expect(formatHeight(140)).toBe("1.4m");
    expect(formatHeight(1250)).toBe("13m");
  });
});

describe("thicknessTable", () => {
  it("아우터·상의·하의만 담고 모자·신발은 뺀다", () => {
    const t = thicknessTable();
    expect(t.map((c) => c.id)).toEqual(["outer", "top", "bottom"]);
    expect(t.find((c) => c.id === "top")?.rows.find((r) => r.id === "top.short_tee")?.cm).toBe(0.5);
  });
});

import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { formatHeight, stackSummary } from "./stack-height";

const g = (categoryId: Garment["categoryId"], subcategoryId: string | null) => ({ categoryId, subcategoryId }) as Garment;

describe("stackSummary", () => {
  it("세부분류 두께를 더하고 비슷한 높이의 것을 고른다", () => {
    const s = stackSummary([g("top", "top.short_tee"), g("top", "top.short_tee"), g("outer", "outer.long_padding")]);
    expect(s.total).toBe(17);
    expect(s.near?.cm).toBe(21);
    expect(s.byCategory.map((x) => x.id)).toEqual(["outer", "top"]);
  });
  it("세부분류가 없으면 대분류 평균을 쓴다", () => {
    expect(stackSummary([g("shoes", null)]).total).toBe(12);
  });
  it("옷이 없으면 비운다", () => {
    const s = stackSummary([]);
    expect(s.near).toBeNull();
    expect(s.range).toBe("—");
  });
  it("100cm부터 m로 보여 준다", () => {
    expect(formatHeight(85)).toBe("85cm");
    expect(formatHeight(140)).toBe("1.4m");
    expect(formatHeight(1250)).toBe("13m");
  });
});

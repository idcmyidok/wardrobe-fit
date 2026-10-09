import { describe, expect, it } from "vitest";
import { computeBodyFit, type BodyProfile } from "./body-fit";
import { pickSize, rankVersus, versusSummary, type VersusEntry } from "./versus";

const body: BodyProfile = {
  values: { height: 175, shoulder: 45, chest: 94 },
  uncertain: [],
  overrides: {},
  updatedAt: null,
};
const base = { categoryId: "top" as const, subcategoryId: "top.short_tee", productName: "티셔츠" };
const rows = [
  // 새 어깨 기준(−1cm 미만은 너무 작음)에서 S가 평범한 슬림핏이 되도록 어깨 44cm
  { sizeLabel: "S", measurements: { chest: 48.5, shoulder: 44, length: 68 } },
  { sizeLabel: "M", measurements: { chest: 51.5, shoulder: 44.5, length: 71 } },
  { sizeLabel: "L", measurements: { chest: 55, shoulder: 48, length: 73 } },
  { sizeLabel: "XL", measurements: { chest: 60, shoulder: 54, length: 75 } },
];
const entry = (key: string, chest: number, shoulder: number): VersusEntry => {
  const garment = { ...base, measurements: { chest, shoulder, length: 71 } };
  return { key, name: key, garment, body: computeBodyFit(garment, body), wardrobe: undefined };
};

describe("VS 비교", () => {
  it("원하는 핏 점수가 가장 높은 사이즈를 고른다", () => {
    expect(pickSize(base, rows, "regular", body)).toBe("M");
    expect(pickSize(base, rows, "over", body)).toBe("XL");
    expect(pickSize(base, rows, "slim", body)).toBe("S");
  });
  it("내 치수도 옷장 기록도 없으면 가운데 사이즈", () => {
    expect(pickSize(base, rows, "regular", null)).toBe("M");
  });
  it("원하는 핏에 가까운 옷이 1위", () => {
    const ranks = rankVersus([entry("A", 60, 54), entry("B", 51.5, 44.5)], "regular");
    expect(ranks[0].key).toBe("B");
    expect(ranks[0].basis).toBe("body");
    expect(versusSummary(ranks, { A: "A", B: "B" }, "regular", "top")).toContain("B");
  });
  it("어깨만 넓은 옷(드롭숄더)은 감점하지 않고, 이유는 한 줄로만", () => {
    const [r] = rankVersus([entry("A", 51.5, 56)], "regular");
    const e = entry("A", 51.5, 56);
    if (e.body?.status !== "ok") throw new Error("body");
    expect(r.score).toBe(e.body.scores.regular);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).not.toContain("점");
  });
  it("가슴이 너무 작으면 감점 이유를 한 줄 붙인다", () => {
    const [r] = rankVersus([entry("A", 44, 45)], "regular");
    expect(r.reasons.at(-1)).toContain("가슴");
    expect(r.reasons.at(-1)).toContain("감점");
  });
  it("정보가 없으면 추천하지 않는다", () => {
    const ranks = rankVersus([{ key: "A", name: "A", garment: { ...base, measurements: {} }, body: null, wardrobe: undefined }], "regular");
    expect(ranks[0].score).toBeNull();
    expect(versusSummary(ranks, { A: "A" }, "regular", "top")).toContain("부족");
  });
});

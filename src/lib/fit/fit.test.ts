import { describe, expect, it } from "vitest";
import { BOTTOM_MEASUREMENTS, TOP_MEASUREMENTS } from "@/lib/constants/measurements";
import type { Garment } from "@/lib/types/domain";
import { computeFit } from "./compute";
import { extractReviewSignals } from "./review-signals";
import { fitCandidateSchema } from "./schema";
import { selectComparables } from "./select-comparables";

const pick = (review: string, keys: readonly string[] = TOP_MEASUREMENTS) =>
  extractReviewSignals(review, keys as typeof TOP_MEASUREMENTS).map((s) => `${s.dimension}:${s.direction}:${s.strength}`);

describe("후기 신호 규칙 v1", () => {
  it("절마다 치수와 방향을 찾는다", () => {
    expect(pick("어깨와 가슴은 마음에 드는데 총장이 조금 길다.")).toEqual(["shoulder:good:2", "chest:good:2", "length:long:1"]);
  });
  it("다른 대분류 치수 낱말은 치수로 보지 않는다(상의 후기의 엉덩이)", () => {
    expect(pick("어깨와 가슴은 딱 좋다. 총장은 엉덩이를 반쯤 덮어서 적당하다. 소매는 조금 긴 편.")).toEqual([
      "shoulder:good:2",
      "chest:good:2",
      "length:good:2",
      "sleeve:long:1",
    ]);
  });
  it("'고'로 이어진 새 주어를 나누고, '여유 적당'은 good", () => {
    expect(pick("어깨 딱 맞고 가슴도 여유 적당.")).toEqual(["shoulder:good:2", "chest:good:2"]);
  });
  it("부정은 good, 치수 없는 방향은 overall", () => {
    expect(pick("니트 위에 입어도 답답하지 않다")).toEqual(["overall:good:2"]);
    expect(pick("총장이 안 길다")).toEqual(["length:good:2"]);
    expect(pick("몸에 붙는 편")).toEqual(["overall:tight:2"]);
  });
  it("정도 표현", () => {
    expect(pick("소매가 너무 짧다")).toEqual(["sleeve:short:3"]);
    expect(pick("허벅지가 살짝 붙는다", BOTTOM_MEASUREMENTS)).toEqual(["thigh:tight:1"]);
  });
  it("후기가 없으면 신호도 없다", () => {
    expect(pick("")).toEqual([]);
  });
});

let seq = 0;
const g = (over: Partial<Garment>): Garment => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  categoryId: "outer",
  subcategoryId: "outer.blouson",
  brand: "",
  productName: "자켓",
  sizeLabel: "M",
  colorName: null,
  seasons: [],
  purchasedOn: "2025-01-01",
  purchasePrice: 100000,
  productUrl: "https://shop.example/p",
  imageUrl: null,
  measurements: {},
  fitReview: null,
  ...over,
});

describe("비교 대상 선정", () => {
  const jackets = [
    g({ brand: "A", measurements: { shoulder: 46, chest: 58, length: 70 } }),
    g({ brand: "B", measurements: { shoulder: 47, chest: 60, length: 71 } }),
  ];
  const blazer = g({ brand: "C", subcategoryId: "outer.blazer", measurements: { shoulder: 46, chest: 59, length: 72 } });
  const coat = g({ brand: "D", subcategoryId: "outer.winter_coat", measurements: { shoulder: 47, chest: 61, length: 100 } });
  const knit = g({ brand: "E", categoryId: "top", subcategoryId: "top.knit", measurements: { shoulder: 46, chest: 58 } });
  const pants = g({ brand: "F", categoryId: "bottom", subcategoryId: "bottom.denim", measurements: { waist: 40, length: 100 } });
  const thin = g({ brand: "G", measurements: { shoulder: 46 } });
  const cand = { categoryId: "outer" as const, subcategoryId: "outer.blouson", sizes: [{ measurements: { shoulder: 46, chest: 59, length: 72 } }] };

  it("세부분류가 3벌 미만이면 같은 대분류까지 넓히고, 실측이 1개만 겹치는 옷은 뺀다", () => {
    const { selected, lacking } = selectComparables(cand, [...jackets, blazer, coat, knit, pants, thin]);
    expect(selected.map((s) => [s.garment.brand, s.matchLevel])).toEqual([
      ["A", "subcategory"],
      ["B", "subcategory"],
      ["C", "category"],
      ["D", "category"],
    ]);
    expect(lacking.map((x) => x.brand)).toEqual(["G"]);
  });
  it("같은 대분류가 없으면 유사 세부분류(다른 대분류 가능), 하의는 섞지 않는다", () => {
    const { selected } = selectComparables({ ...cand, categoryId: "outer", subcategoryId: "outer.cardigan" }, [knit, pants]);
    expect(selected.map((s) => [s.garment.brand, s.matchLevel])).toEqual([["E", "similar"]]);
  });
  it("세부분류가 충분하면 넓히지 않는다", () => {
    const more = [...jackets, g({ brand: "H", measurements: { shoulder: 45, chest: 57, length: 69 } })];
    const { selected } = selectComparables(cand, [...more, blazer]);
    expect(selected.every((s) => s.matchLevel === "subcategory")).toBe(true);
  });
});

describe("통계 엔진", () => {
  const comps = [
    g({ brand: "APC", measurements: { shoulder: 46, chest: 58, length: 69, sleeve: 63 }, fitReview: "어깨 딱 맞고 가슴도 여유 적당." }),
    g({ brand: "Nanamica", measurements: { shoulder: 47, chest: 60, length: 70, sleeve: 64 }, fitReview: "어깨와 가슴은 딱 좋다. 소매는 조금 긴 편." }),
    g({ brand: "EG", measurements: { shoulder: 46.5, chest: 59, length: 71.5, sleeve: 63.5 }, fitReview: "어깨와 가슴은 마음에 드는데 총장이 조금 길다." }),
  ];
  const candidate = {
    categoryId: "outer" as const,
    subcategoryId: "outer.blouson",
    brand: "Our Legacy",
    productName: "워크 자켓",
    sizes: [{ sizeLabel: "48", measurements: { shoulder: 46.5, chest: 59, length: 72, sleeve: 64.5 } }],
  };
  const selected = selectComparables(candidate, comps).selected;
  const result = computeFit(candidate, selected);
  const size = result.sizes[0];
  const dim = (k: string) => size.dimensions.find((d) => d.key === k)!;

  it("만족 범위는 후기에 불만이 없는 옷으로만, 2벌 이상일 때 정한다", () => {
    expect(dim("shoulder").comfortRange).toEqual({ min: 46, max: 47, median: 46.5, n: 3 });
    // 총장은 "길다"고 적은 EG를 빼고 2벌
    expect(dim("length").comfortRange).toEqual({ min: 69, max: 70, median: 69.5, n: 2 });
    // 소매는 "조금 긴 편"이라 적은 Nanamica를 뺀 2벌
    expect(dim("sleeve").comfortRange).toMatchObject({ min: 63, max: 63.5, n: 2 });
  });
  it("범위 안·밖 판정과 경계 거리", () => {
    expect(dim("shoulder")).toMatchObject({ verdict: "within", distanceFromRange: 0, tag: "within" });
    expect(dim("length")).toMatchObject({ verdict: "above", distanceFromRange: 2 });
  });
  it("길다고 적은 옷보다 긴 치수는 그 후기를 근거로 든다", () => {
    expect(dim("length").anchors).toEqual([expect.objectContaining({ value: 71.5, direction: "long", relation: "similar" })]);
    expect(dim("length").judgement).toBe("길다고 적은 EG(71.5)와 비슷");
    expect(dim("sleeve").anchors[0]).toMatchObject({ value: 64, relation: "similar" });
  });
  it("규칙 요약 문장", () => {
    expect(size.summary).toContain("어깨·가슴은 만족했던 옷들과 비슷하고, 총장은 만족 범위보다 2cm 길고, 소매는 1cm 깁니다.");
    expect(size.summary).toContain('"길다"고 기록한 EG의 총장(71.5cm)과 비슷');
  });
  it("신뢰도: 동일 세부분류 3벌·후기 3개면 보통", () => {
    expect(size.confidence).toBe("medium");
  });
  it("스냅샷에는 가격·구매일·링크를 담지 않는다", () => {
    const text = JSON.stringify(result);
    expect(text).not.toContain("100000");
    expect(text).not.toContain("2025-01-01");
    expect(text).not.toContain("shop.example");
  });
  it("핵심 실측이 1개 이하면 insufficient", () => {
    const one = computeFit({ ...candidate, sizes: [{ sizeLabel: "M", measurements: { length: 70 } }] }, selected);
    expect(one.sizes[0].confidence).toBe("insufficient");
    expect(computeFit(candidate, []).sizes[0].confidence).toBe("insufficient");
  });
  it("후기 없는 옷만 있으면 기존 옷 범위와 비교하고 낮음", () => {
    const bare = comps.map((c) => ({ ...c, fitReview: null }));
    const r = computeFit(candidate, selectComparables(candidate, bare).selected).sizes[0];
    expect(r.confidence).toBe("low");
    expect(r.dimensions.every((d) => d.basis === "owned")).toBe(true);
    expect(r.limitations).toContain("후기가 있는 옷이 없어 만족 범위를 계산하지 못했습니다. 기존 옷의 치수와만 비교했습니다.");
  });
  it("여러 사이즈면 가까운 사이즈를 알려 준다", () => {
    const multi = computeFit(
      { ...candidate, sizes: [candidate.sizes[0], { sizeLabel: "50", measurements: { shoulder: 48.5, chest: 62, length: 74, sleeve: 66 } }] },
      selected,
    );
    expect(multi.sizeNote).toContain("48");
  });
});

describe("입력 검증", () => {
  it("대분류에 없는 실측과 4개 이상 사이즈는 거절", () => {
    const base = { categoryId: "top", subcategoryId: "top.knit", sizes: [{ sizeLabel: "M", measurements: { waist: 40 } }] };
    expect(fitCandidateSchema.safeParse(base).success).toBe(false);
    const four = { ...base, sizes: ["S", "M", "L", "XL"].map((s) => ({ sizeLabel: s, measurements: { chest: 50 } })) };
    expect(fitCandidateSchema.safeParse(four).success).toBe(false);
    expect(fitCandidateSchema.safeParse({ ...base, sizes: [{ sizeLabel: "M", measurements: { chest: 50, length: 70 } }] }).success).toBe(true);
  });
  it("세부분류가 대분류와 맞아야 한다", () => {
    const r = fitCandidateSchema.safeParse({ categoryId: "top", subcategoryId: "bottom.denim", sizes: [{ sizeLabel: "M", measurements: {} }] });
    expect(r.success).toBe(false);
  });
});

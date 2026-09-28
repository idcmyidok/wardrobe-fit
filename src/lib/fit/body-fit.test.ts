import { describe, expect, it } from "vitest";
import { computeBodyFit, computeCalibration, estimateBodyFromGarments, fitGroupOf, garmentRange, silhouetteOf, type BodyProfile } from "./body-fit";

const body: BodyProfile = {
  values: { height: 175, shoulder: 45, chest: 94, waist: 80, hip: 94, thigh: 56 },
  uncertain: [],
  overrides: {},
  updatedAt: null,
};
const tee = (chest: number, shoulder = 46, extra = {}) => ({
  categoryId: "top" as const,
  subcategoryId: "top.short_tee",
  measurements: { chest, shoulder, length: 71, ...extra },
});
const ok = (r: ReturnType<typeof computeBodyFit>) => {
  if (r.status !== "ok") throw new Error(`status ${r.status}`);
  return r;
};

describe("예상 핏(내 치수)", () => {
  it("반팔 가슴 단면으로 슬림·정·세미오버·오버를 가른다", () => {
    expect(ok(computeBodyFit(tee(50, 45), body)).level).toBe("slim");
    expect(ok(computeBodyFit(tee(53), body)).level).toBe("regular");
    expect(ok(computeBodyFit(tee(57, 50), body)).level).toBe("semi_over");
    expect(ok(computeBodyFit(tee(62, 55), body)).level).toBe("over");
  });
  it("너무 작거나 큰 옷", () => {
    const small = ok(computeBodyFit(tee(47, 44), body));
    expect(small.level).toBe("too_small");
    expect(small.issues[0].severe).toBe(true);
    expect(ok(computeBodyFit(tee(70, 60), body)).level).toBe("too_big");
  });
  it("가장 높은 점수의 핏이 예상 핏", () => {
    const r = ok(computeBodyFit(tee(53), body));
    expect(r.scores.regular).toBeGreaterThan(r.scores.slim);
    expect(r.scores.regular).toBeGreaterThan(r.scores.over);
  });
  it("같은 옷이라도 아우터는 여유를 더 본다", () => {
    const outer = ok(computeBodyFit({ categoryId: "outer", subcategoryId: "outer.coach", measurements: { chest: 53, shoulder: 46 } }, body));
    expect(outer.level).toBe("slim");
  });
  it("가슴 실측이나 가슴둘레가 없으면 계산하지 않는다", () => {
    expect(computeBodyFit({ categoryId: "top", subcategoryId: null, measurements: { shoulder: 46 } }, body)).toEqual({
      status: "insufficient",
      missingBody: [],
      missingGarment: ["chest"],
    });
    const noChest = { ...body, values: { height: 175 } };
    expect(computeBodyFit(tee(53), noChest).status).toBe("insufficient");
  });
  it("점프슈트·모자는 계산하지 않는다", () => {
    expect(computeBodyFit({ categoryId: "bottom", subcategoryId: "bottom.jumpsuit", measurements: { hip: 50 } }, body).status).toBe("unsupported");
    expect(computeBodyFit({ categoryId: "hat", subcategoryId: "hat.cap", measurements: { head: 58 } }, body).status).toBe("unsupported");
  });
  it("정확하지 않은 치수는 느슨하게 보고 신뢰도를 낮춘다", () => {
    // 가슴 여유 3cm: 원래는 너무 작음, 3cm 봐주면 슬림
    expect(ok(computeBodyFit(tee(48.5, 45), body)).level).toBe("too_small");
    const loose = ok(computeBodyFit(tee(48.5, 45), { ...body, uncertain: ["chest"] }));
    expect(loose.level).toBe("slim");
    expect(loose.confidence).toBe("low");
  });
  it("총장·소매는 핏 판정에 넣지 않는다", () => {
    const r = ok(computeBodyFit({ categoryId: "top", subcategoryId: "top.long_tee", measurements: { chest: 55, shoulder: 46, length: 80, sleeve: 50 } }, body));
    expect(r.level).toBe("regular");
    expect(r.issues).toEqual([]);
  });
  it("하의: 품과 실루엣, 배기, 허리", () => {
    const wide = ok(computeBodyFit({ categoryId: "bottom", subcategoryId: "bottom.denim", measurements: { waist: 41, hip: 55, thigh: 36, legOpening: 22, length: 104 } }, body));
    expect(wide.kind).toBe("bottom");
    expect(["semi_over", "over"]).toContain(wide.level);
    expect(wide.silhouette).toBe("tapered");
    expect(wide.baggy).toBe(true);
    const tight = ok(computeBodyFit({ categoryId: "bottom", subcategoryId: "bottom.slacks", measurements: { waist: 38, hip: 49, thigh: 31 } }, body));
    expect(tight.level).toBe("too_small");
    expect(tight.issues.some((i) => i.key === "waist")).toBe(true);
    expect(silhouetteOf({ thigh: 30, legOpening: 31 })).toBe("flare");
  });
  it("니트·스판은 소재 안내", () => {
    expect(ok(computeBodyFit({ ...tee(53), productName: "코튼 스판 티셔츠" }, body)).stretch).toBe(true);
    expect(ok(computeBodyFit(tee(53), body)).stretch).toBe(false);
  });
});

describe("추천 치수·보정·역산", () => {
  it("권장 실측 범위(단면)", () => {
    expect(garmentRange("short_tee", "regular", "chest", body)).toEqual([52, 55]);
  });
  it("사용자가 고친 범위가 추천과 판정에 모두 쓰인다", () => {
    const edited: BodyProfile = { ...body, overrides: { short_tee: { regular: { chest: [55, 57] } } } };
    expect(garmentRange("short_tee", "regular", "chest", edited)).toEqual([55, 57]);
    expect(ok(computeBodyFit(tee(56), edited)).level).toBe("regular");
  });
  it("내 핏 표기로 기준을 옮긴다(최대 ±4cm)", () => {
    const labeled = [
      { ...tee(56), userFit: "regular" as const },
      { ...tee(56.5), userFit: "regular" as const },
    ];
    const cal = computeCalibration(body, labeled);
    expect(cal.short_tee?.chest).toBe(4);
    expect(ok(computeBodyFit(tee(56), body, cal)).level).toBe("regular");
  });
  it("잘 맞는 옷으로 내 치수 추정", () => {
    const est = estimateBodyFromGarments([tee(53, 46), { categoryId: "bottom", subcategoryId: "bottom.denim", measurements: { waist: 41, hip: 51, thigh: 32, length: 103 } }]);
    expect(est.chest).toBe(93);
    expect(est.shoulder).toBe(45.5);
    expect(est.hip).toBe(93.5);
  });
  it("세부분류 묶음", () => {
    expect(fitGroupOf("outer", "outer.coach")).toBe("light_outer");
    expect(fitGroupOf("outer", "outer.leather")).toBe("leather");
    expect(fitGroupOf("top", null)).toBe("long_tee");
  });
});

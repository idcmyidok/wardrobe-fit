import { describe, expect, it } from "vitest";
import { EMPTY_BODY, bodyFitReasons, computeBodyFit, estimateBodyFromGarments, fitGroupOf, garmentRange, silhouetteOf, type BodyProfile } from "./body-fit";

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
const pants = (m: { waist?: number; hip?: number; thigh?: number; legOpening?: number }) => ({
  categoryId: "bottom" as const,
  subcategoryId: "bottom.denim",
  measurements: m,
});
const ok = (r: ReturnType<typeof computeBodyFit>) => {
  if (r.status !== "ok") throw new Error(`status ${r.status}`);
  return r;
};

describe("예상 핏(내 치수)", () => {
  it("반팔 가슴 단면으로 슬림·레귤러·세미오버·오버를 가른다", () => {
    expect(ok(computeBodyFit(tee(48.5, 42), body)).level).toBe("slim");
    expect(ok(computeBodyFit(tee(51.5), body)).level).toBe("regular");
    expect(ok(computeBodyFit(tee(55, 48), body)).level).toBe("semi_over");
    expect(ok(computeBodyFit(tee(60, 54), body)).level).toBe("over");
  });
  it("너무 작거나 큰 옷", () => {
    const small = ok(computeBodyFit(tee(45, 41), body));
    expect(small.level).toBe("too_small");
    expect(small.issues[0].severe).toBe(true);
    expect(ok(computeBodyFit(tee(70, 60), body)).level).toBe("too_big");
  });
  it("예상 핏의 점수가 가장 높다", () => {
    const r = ok(computeBodyFit(tee(51.5), body));
    expect(r.scores.regular).toBeGreaterThan(r.scores.slim);
    expect(r.scores.regular).toBeGreaterThan(r.scores.over);
  });
  it("같은 옷이라도 아우터는 여유를 더 본다", () => {
    const outer = ok(computeBodyFit({ categoryId: "outer", subcategoryId: "outer.coach", measurements: { chest: 53, shoulder: 46 } }, body));
    expect(outer.level).toBe("slim");
    expect(ok(computeBodyFit(tee(53, 46), body)).level).toBe("regular");
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
    // 가슴 여유 −1cm: 원래는 너무 작음, 3cm 봐주면 슬림
    expect(ok(computeBodyFit(tee(46.5, 42), body)).level).toBe("too_small");
    const loose = ok(computeBodyFit(tee(46.5, 42), { ...body, uncertain: ["chest"] }));
    expect(loose.level).toBe("slim");
    expect(loose.confidence).toBe("low");
  });
  it("총장·소매는 핏 판정에 넣지 않는다", () => {
    const r = ok(computeBodyFit({ categoryId: "top", subcategoryId: "top.long_tee", measurements: { chest: 52.5, shoulder: 47, length: 80, sleeve: 50 } }, body));
    expect(r.level).toBe("regular");
    expect(r.issues).toEqual([]);
  });
  it("하의: 품과 실루엣, 배기", () => {
    const wide = ok(computeBodyFit(pants({ waist: 41, hip: 58, thigh: 38, legOpening: 22 }), body));
    expect(wide.kind).toBe("bottom");
    expect(wide.level).toBe("over");
    expect(wide.silhouette).toBe("tapered");
    expect(wide.baggy).toBe(true);
    expect(silhouetteOf({ thigh: 30, legOpening: 31 })).toBe("flare");
  });
  it("니트·스판은 소재 안내만 하고 판정은 바꾸지 않는다", () => {
    const stretchy = ok(computeBodyFit({ ...tee(53), productName: "코튼 스판 티셔츠" }, body));
    expect(stretchy.stretch).toBe(true);
    expect(stretchy.level).toBe(ok(computeBodyFit(tee(53), body)).level);
    expect(ok(computeBodyFit(tee(53), body)).stretch).toBe(false);
  });
  it("제품명에 핏 이름이 있어도 실측 계산이 우선한다", () => {
    expect(ok(computeBodyFit({ ...tee(51.5), productName: "오버핏 반팔 티셔츠" }, body)).level).toBe("regular");
  });
  it("경계에서 1cm 차이로 두 단계를 건너뛰지 않는다", () => {
    const levels = [51.5, 52, 52.5, 53, 53.5].map((c) => ok(computeBodyFit(tee(c, 47), body)).level);
    const order = ["slim", "regular", "semi_over", "over"];
    for (let i = 1; i < levels.length; i++) expect(Math.abs(order.indexOf(levels[i]) - order.indexOf(levels[i - 1]))).toBeLessThanOrEqual(1);
  });
});

describe("상의: 가슴이 기본 축, 어깨는 실루엣", () => {
  it("셔츠(어깨 비중 35%): 가슴 레귤러 + 어깨 너무 큼 → 한 단계만 올려 세미오버(드롭형 가능성)", () => {
    const shirt = (chest: number, shoulder: number) => ({ categoryId: "outer" as const, subcategoryId: "outer.shirt", measurements: { chest, shoulder } });
    const r = ok(computeBodyFit(shirt(51.5, 56), body));
    expect(r.dimensions.find((d) => d.key === "shoulder")!.level).toBe("too_big");
    expect(r.level).toBe("semi_over");
    expect(r.basis.rule).toBe("axis_shift");
    expect(bodyFitReasons(r).at(-1)!.text).toContain("드롭형");
  });
  it("어깨 비중이 낮은 상의(반팔 20%)는 어깨가 아주 넓어도 가슴 기준 핏을 옮기지 않는다", () => {
    const r = ok(computeBodyFit(tee(51.5, 56), body));
    expect(r.dimensions.find((d) => d.key === "shoulder")!.level).toBe("too_big");
    expect(r.basis.rule).toBe("average");
  });
  it("어깨만 범위를 크게 벗어나면 감점 없이 주의로만 알린다", () => {
    const wide = ok(computeBodyFit(tee(51.5, 56), body));
    const issue = wide.issues.find((i) => i.key === "shoulder")!;
    expect(issue.severe).toBe(false);
    expect(issue.caution).toBe(true);
    expect(issue.text).toContain("드롭숄더");
    const reasons = bodyFitReasons(wide);
    expect(reasons.find((x) => x.key === "shoulder")!.verdict).toContain("드롭숄더");
    expect(reasons.at(-1)!.text).toContain("어깨는 보조 기준");
    const narrow = ok(computeBodyFit(tee(51.5, 43), body));
    expect(narrow.dimensions.find((d) => d.key === "shoulder")!.level).toBe("too_small");
    expect(narrow.level).toBe("regular");
    expect(narrow.issues.find((i) => i.key === "shoulder")).toMatchObject({ severe: false, caution: true });
  });
  it("가슴 너무 작음은 어깨가 넉넉해도 전체 너무 작음", () => {
    expect(ok(computeBodyFit(tee(47, 49), body)).level).toBe("too_small");
  });
  it("가슴이 슬림 하한보다 1cm 안으로 작으면 매우 타이트한 슬림", () => {
    const r = ok(computeBodyFit(tee(47.5, 47), body));
    expect(r.dimensions.find((d) => d.key === "chest")!.level).toBe("too_small");
    expect(r.level).toBe("slim");
    expect(r.basis.chestEdge).toBe(true);
  });
  it("가슴 너무 큼 + 어깨 레귤러 → 박스형 오버핏", () => {
    const r = ok(computeBodyFit(tee(62, 47), body));
    expect(r.level).toBe("over");
    expect(r.basis.rule).toBe("chest_big");
  });
  it("가슴·어깨 모두 너무 큼 → 너무 큼", () => {
    expect(ok(computeBodyFit(tee(62, 57), body)).basis.rule).toBe("both_big");
  });
  it("패딩은 가슴 단면 57~61이 레귤러(가슴둘레 98 기준)", () => {
    const b98: BodyProfile = { ...body, values: { chest: 98 } };
    const padding = (chest: number) => ok(computeBodyFit({ categoryId: "outer", subcategoryId: "outer.short_padding", measurements: { chest } }, b98)).level;
    expect(padding(55)).toBe("slim");
    expect(padding(58)).toBe("regular");
    expect(padding(61)).toBe("regular");
    expect(padding(63)).toBe("semi_over");
  });
  it("종류마다 가중치가 다르다(패딩은 가슴 85%)", () => {
    const r = ok(computeBodyFit({ categoryId: "outer", subcategoryId: "outer.short_padding", measurements: { chest: 60, shoulder: 47 } }, body));
    expect(r.basis.weights).toEqual({ chest: 85, shoulder: 15 });
  });
});

describe("하의: 허벅지가 기본 축, 허리는 크기만", () => {
  it("엉덩이만 너무 큼이면 전체 너무 큼으로 만들지 않는다", () => {
    const r = ok(computeBodyFit(pants({ hip: 63, thigh: 33 }), body));
    expect(r.dimensions.find((d) => d.key === "hip")!.level).toBe("too_big");
    expect(r.level).toBe("over");
  });
  it("엉덩이·허벅지 모두 너무 큼이면 너무 큼", () => {
    expect(ok(computeBodyFit(pants({ hip: 63, thigh: 42 }), body)).level).toBe("too_big");
  });
  it("허벅지가 내 몸보다 좁으면 전체 너무 작음", () => {
    const r = ok(computeBodyFit(pants({ hip: 52, thigh: 27 }), body));
    expect(r.level).toBe("too_small");
    expect(r.basis.rule).toBe("no_room");
  });
  it("허벅지가 슬림보다 작지만 몸보다는 넓으면 한 단계 작게만 본다", () => {
    const r = ok(computeBodyFit(pants({ hip: 52, thigh: 28.5 }), body));
    expect(r.dimensions.find((d) => d.key === "thigh")!.level).toBe("too_small");
    expect(r.level).toBe("slim");
  });
  it("허리는 핏 판정에 쓰지 않는다(스판처럼 실측이 작게 나오는 옷)", () => {
    const base = ok(computeBodyFit(pants({ hip: 52, thigh: 32 }), body));
    for (const w of [30, 36, 41, 50]) {
      const r = ok(computeBodyFit(pants({ waist: w, hip: 52, thigh: 32 }), body));
      expect(r.level).toBe(base.level);
      expect(r.scores).toEqual(base.scores);
      expect(r.dimensions.map((d) => d.key)).toEqual(["hip", "thigh"]);
      expect(r.issues).toEqual(base.issues);
    }
  });
  it("반바지는 긴 바지와 기준이 다르다", () => {
    // 허벅지 여유 +24cm: 반바지는 오버 상한(+23)을 넘어 너무 큼, 긴 바지는 오버(15~24)
    const shorts = ok(computeBodyFit({ categoryId: "bottom", subcategoryId: "bottom.shorts", measurements: { hip: 55, thigh: 40 } }, body));
    expect(shorts.dimensions.find((d) => d.key === "thigh")!.level).toBe("too_big");
    expect(ok(computeBodyFit(pants({ hip: 55, thigh: 40 }), body)).dimensions.find((d) => d.key === "thigh")!.level).toBe("over");
  });
});

describe("추천 치수·보정·역산", () => {
  it("권장 실측 범위(단면)", () => {
    expect(garmentRange("short_tee", "regular", "chest", body)).toEqual([50, 53]);
  });
  it("허리는 핏 단계와 관계없이 적정 범위 하나", () => {
    expect(garmentRange("pants", "slim", "waist", body)).toEqual([39, 41]);
    expect(garmentRange("pants", "over", "waist", body)).toEqual([39, 41]);
    const edited: BodyProfile = { ...body, overrides: { pants: { regular: { waist: [40, 43] } } } };
    expect(garmentRange("pants", "slim", "waist", edited)).toEqual([40, 43]);
  });
  it("사용자가 고친 범위가 추천과 판정에 모두 쓰인다", () => {
    const edited: BodyProfile = { ...body, overrides: { short_tee: { regular: { chest: [55, 57] } } } };
    expect(garmentRange("short_tee", "regular", "chest", edited)).toEqual([55, 57]);
    expect(ok(computeBodyFit(tee(56), edited)).dimensions.find((d) => d.key === "chest")!.level).toBe("regular");
  });
  it("내 핏 표기는 판정 기준을 옮기지 않는다", () => {
    const plain = ok(computeBodyFit(tee(54.5, 48), body));
    const labeled = ok(computeBodyFit({ ...tee(54.5, 48), userFit: "regular" }, body));
    expect(labeled.level).toBe(plain.level);
    expect(garmentRange("short_tee", "regular", "chest", body)).toEqual([50, 53]);
  });
  it("잘 맞는 옷으로 내 치수 추정", () => {
    const est = estimateBodyFromGarments([tee(51.5, 44.5), { categoryId: "bottom", subcategoryId: "bottom.denim", measurements: { waist: 41, hip: 51, thigh: 32, length: 103 } }]);
    expect(est.chest).toBe(94);
    expect(est.shoulder).toBe(42.5);
    expect(est.hip).toBe(92);
    expect(est.waist).toBe(82);
  });
  it("세부분류 묶음", () => {
    expect(fitGroupOf("outer", "outer.coach")).toBe("light_outer");
    expect(fitGroupOf("outer", "outer.leather")).toBe("leather");
    expect(fitGroupOf("top", null)).toBe("long_tee");
    expect(fitGroupOf("outer", "outer.long_padding")).toBe("long_padding");
    expect(fitGroupOf("outer", "outer.short_padding")).toBe("padding");
  });
});

describe("예상 핏 판단 근거", () => {
  it("치수마다 옷 실측·내 치수·여유·핏 구간을, 마지막에 종합 판정을 쓴다", () => {
    const body = { ...EMPTY_BODY, values: { chest: 96, shoulder: 45 } };
    const r = computeBodyFit({ categoryId: "top", subcategoryId: "top.short_tee", measurements: { chest: 54, shoulder: 46 } }, body);
    if (r.status !== "ok") throw new Error(r.status);
    const reasons = bodyFitReasons(r);
    const chest = reasons.find((x) => x.key === "chest")!.text;
    expect(chest).toContain("옷 단면 54cm(둘레 108cm)");
    expect(chest).toContain("내 가슴둘레 96cm보다 12cm 여유");
    expect(chest).toContain("레귤러핏 범위(여유 +6~+12cm, 단면 51~54cm)에 들어요");
    expect(reasons.find((x) => x.key === "shoulder")!.text).toContain("내 어깨너비 45cm보다 1cm 넓어요");
    const overall = reasons.at(-1)!;
    expect(overall.key).toBe("overall");
    expect(overall.text).toBe("가슴 80%·어깨 20% 비중으로 합치면 레귤러핏이에요.");
  });
  it("너무 작으면 그 치수 때문이라고 쓴다", () => {
    const body = { ...EMPTY_BODY, values: { hip: 100, thigh: 60, waist: 80 } };
    const r = computeBodyFit({ categoryId: "bottom", subcategoryId: null, measurements: { hip: 48, thigh: 32, waist: 38 } }, body);
    if (r.status !== "ok") throw new Error(r.status);
    const reasons = bodyFitReasons(r);
    expect(r.level).toBe("too_small");
    expect(reasons.at(-1)!.text).toMatch(/엉덩이가 내 몸보다도 좁아 전체를 너무 작음으로 봤어요/);
    expect(reasons.some((x) => x.key === "waist")).toBe(false);
    expect(reasons.at(-1)!.text).toContain("허리는 핏 판정에 넣지 않아요");
  });
});

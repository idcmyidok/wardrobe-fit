import { describe, expect, it } from "vitest";
import { computeLengthFit, lengthBands, lengthGroupOf, lengthGroupOfFitGroup, lengthLevelLabel } from "./length-fit";

const tee = (length: number) => ({ categoryId: "top" as const, subcategoryId: "top.short_tee", measurements: { length } });
const jacket = (length: number) => ({ categoryId: "outer" as const, subcategoryId: "outer.blouson", measurements: { length } });
const ok = (r: ReturnType<typeof computeLengthFit>) => {
  if (r.status !== "ok") throw new Error(r.status);
  return r;
};

describe("총장 길이감", () => {
  it("키 177 기준 이너: 크롭 60~64, 세미크롭 64~67, 정핏 67~71, 세미오버 71~74, 오버핏 74~78", () => {
    const b = lengthBands("inner", 177);
    expect(b).toEqual({ crop: [60, 64], semi_crop: [64, 67], regular: [67, 71], semi_over: [71, 74], over: [74, 78] });
    expect(ok(computeLengthFit(tee(62), 177)).level).toBe("crop");
    expect(ok(computeLengthFit(tee(66), 177)).level).toBe("semi_crop");
    expect(ok(computeLengthFit(tee(69), 177)).level).toBe("regular");
    expect(ok(computeLengthFit(tee(71), 177)).level).toBe("regular");
    expect(ok(computeLengthFit(tee(72), 177)).level).toBe("semi_over");
    expect(ok(computeLengthFit(tee(76), 177)).level).toBe("over");
  });
  it("아우터는 이너보다 2cm 길게 본다", () => {
    expect(lengthBands("outer", 177).regular).toEqual([69, 73]);
    expect(ok(computeLengthFit(jacket(70), 177)).level).toBe("regular");
    expect(ok(computeLengthFit(tee(72), 177)).level).toBe("semi_over");
    expect(ok(computeLengthFit(jacket(72), 177)).level).toBe("regular");
  });
  it("키에 비례해 기준이 바뀐다", () => {
    expect(lengthBands("inner", 170).regular).toEqual([64.5, 68]);
    expect(ok(computeLengthFit(tee(69), 170)).level).toBe("semi_over");
  });
  it("범위를 벗어나면 크롭(매우 짧음)·오버핏(매우 김)", () => {
    const short = ok(computeLengthFit(tee(55), 177));
    expect(short.extreme).toBe("short");
    expect(lengthLevelLabel(short)).toBe("크롭(매우 짧음)");
    expect(lengthLevelLabel(ok(computeLengthFit(tee(82), 177)))).toBe("오버핏(매우 김)");
  });
  it("셔츠·블레이저·코트·롱패딩·하의·모자·신발은 보지 않는다", () => {
    for (const sub of ["outer.shirt", "outer.blazer", "outer.single_coat", "outer.long_padding"]) expect(lengthGroupOf("outer", sub)).toBeNull();
    expect(lengthGroupOf("bottom", "bottom.denim")).toBeNull();
    expect(lengthGroupOf("hat", "hat.cap")).toBeNull();
    expect(lengthGroupOf("outer", "outer.short_padding")).toBe("outer");
    expect(computeLengthFit({ categoryId: "outer", subcategoryId: "outer.single_coat", measurements: { length: 110 } }, 177).status).toBe("unsupported");
  });
  it("키나 총장이 없으면 계산하지 않는다", () => {
    expect(computeLengthFit(tee(70), null)).toEqual({ status: "insufficient", missingHeight: true, missingLength: false });
    expect(computeLengthFit({ categoryId: "top", subcategoryId: null, measurements: {} }, 177)).toEqual({ status: "insufficient", missingHeight: false, missingLength: true });
  });
  it("고친 범위가 있으면 그 범위로 판정한다", () => {
    const edited = { inner: { regular: [68, 73] as [number, number] } };
    expect(lengthBands("inner", 177, edited).regular).toEqual([68, 73]);
    const r = ok(computeLengthFit(tee(72.5), 177, edited));
    expect(r.level).toBe("regular");
    expect(r.edited).toBe(true);
  });
  it("추천 실측 탭마다 필요한 총장 기준만 붙는다", () => {
    expect(lengthGroupOfFitGroup("short_tee")).toBe("inner");
    expect(lengthGroupOfFitGroup("knit")).toBe("inner");
    expect(lengthGroupOfFitGroup("light_outer")).toBe("outer");
    expect(lengthGroupOfFitGroup("padding")).toBe("outer");
    for (const id of ["shirt", "coat", "long_padding", "pants", "shorts"]) expect(lengthGroupOfFitGroup(id)).toBeNull();
  });
});

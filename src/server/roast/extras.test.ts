import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze, BASIC_TEE_SKIP } from "./analyze";
import { findBand } from "./bands";
import { brandGroups, findBrand } from "./brands";
import { buildScript } from "./compose";
import { QUIZ } from "./quiz";

const now = new Date("2026-09-30T12:00:00+09:00");
const g = (i: number, over: Partial<Garment> = {}): Garment =>
  ({
    id: `g${i}`,
    categoryId: "top",
    subcategoryId: "top.short_tee",
    brand: "Stüssy",
    productName: `그래픽 티셔츠 ${i}`,
    sizeLabel: "M",
    colorName: "레드",
    seasons: [],
    purchasedOn: null,
    purchasePrice: null,
    productUrl: null,
    imageUrl: `https://x/${i}.jpg`,
    measurements: {},
    fitReview: null,
    shoeFit: null,
    ...over,
  }) as Garment;
const wardrobe = (extra: Garment[]) => [...Array.from({ length: 11 }, (_, i) => g(i, { brand: `브랜드${i}` })), ...extra];
const questionIds = (list: Garment[]) => {
  const a = analyze(list, null, 1360, now);
  return new Set(Array.from({ length: 10 }, (_, s) => buildScript(a, s, null).asked.map((q) => q.id)).flat());
};

describe("밴드 퀴즈", () => {
  it("옷 이름에 밴드 이름이 있으면 찾는다(한글·영문)", () => {
    expect(findBand(analyze(wardrobe([g(90, { productName: "Metallica 빈티지 반팔" })]), null, 1360, now))?.band.id).toBe("metallica");
    expect(findBand(analyze(wardrobe([g(90, { productName: "잔나비 투어 티셔츠" })]), null, 1360, now))?.band.id).toBe("jannabi");
  });
  it("흔한 단어 이름은 밴드·투어·티셔츠 같은 말이 같이 있을 때만", () => {
    expect(findBand(analyze(wardrobe([g(90, { productName: "퀸 사이즈 블랭킷 셔츠", subcategoryId: "outer.shirt", categoryId: "outer" })]), null, 1360, now))).toBeNull();
    expect(findBand(analyze(wardrobe([g(90, { productName: "Queen 밴드 티셔츠" })]), null, 1360, now))?.band.id).toBe("queen");
    // 영문은 단어 단위: Kissing은 Kiss가 아니다
    expect(findBand(analyze(wardrobe([g(90, { productName: "Kissing band tee" })]), null, 1360, now))).toBeNull();
  });
  it("밴드 옷이 있으면 밴드 퀴즈를 꼭 내고, 정답은 다른 밴드의 곡", () => {
    const a = analyze(wardrobe([g(90, { productName: "Nirvana 티셔츠" })]), null, 1360, now);
    for (let s = 0; s < 10; s++) {
      const q = buildScript(a, s, null).asked.find((x) => x.id === "band_quiz");
      expect(q).toBeDefined();
      expect(q!.options.find((o) => o.id === q!.answer)?.label).toBe("Black Hole Sun");
      expect(q!.text).toContain("너바나");
    }
  });
});

describe("3대 500", () => {
  it("언더아머 옷이 있으면 꼭 묻고, 세 번째 선택지는 점만", () => {
    expect(questionIds(wardrobe([g(90, { brand: "Under Armour" })])).has("three_500")).toBe(true);
    expect(questionIds(wardrobe([])).has("three_500")).toBe(false);
    const a = analyze(wardrobe([g(90, { brand: "Under Armour" })]), null, 1360, now);
    const q = buildScript(a, 1, null).asked.find((x) => x.id === "three_500")!;
    expect(q.options.map((o) => o.label)).toEqual(["넘음", "곧 넘음", ".........", "그냥 편해서 삼"]);
  });
});

describe("무지 티", () => {
  const basic = (i: number) => g(100 + i, { productName: "무지 반팔 티셔츠", colorName: i % 2 ? "블랙" : "화이트", brand: "UNIQLO" });
  it(`무채색 무지 티는 ${BASIC_TEE_SKIP}벌까지 분석에서 빼고, 벌 수에는 넣는다`, () => {
    const a = analyze(wardrobe(Array.from({ length: 7 }, (_, i) => basic(i))), null, 1360, now);
    expect(a.basicIds.length).toBe(BASIC_TEE_SKIP);
    expect(a.clothes.length).toBe(11 + 7 - BASIC_TEE_SKIP);
    expect(a.clothesTotal).toBe(18);
    expect(a.allItems.length).toBe(18);
  });
  it("프린트·로고 티나 색 있는 티는 무지 티가 아니다", () => {
    const a = analyze(
      wardrobe([g(120, { productName: "로고 반팔 티셔츠", colorName: "블랙", brand: "UNIQLO" }), g(121, { productName: "무지 반팔 티셔츠", colorName: "레드", brand: "UNIQLO" })]),
      null,
      1360,
      now,
    );
    expect(a.basicIds).toEqual([]);
  });
});

describe("새로 넣은 브랜드", () => {
  it("힙합 아티스트 브랜드는 스트릿으로 잡히고 퀴즈가 있다", () => {
    for (const name of ["Cactus Jack", "Yeezy", "Yeezy Gap", "OVO", "NOCTA", "Drew House", "Vlone"]) {
      const b = findBrand(name)!;
      expect(b.name).toBe(name);
      expect(brandGroups(b)).toContain("street");
      expect(Object.values(QUIZ).some((q) => q.brand === name)).toBe(true);
    }
    // 긴 이름이 먼저: Yeezy Gap은 Yeezy가 아니다
    expect(findBrand("YEEZY GAP")?.name).toBe("Yeezy Gap");
    expect(findBrand("트래비스 스캇")?.name).toBe("Cactus Jack");
    expect(findBrand("INNIR")?.name).toBe("INNIR");
  });
});

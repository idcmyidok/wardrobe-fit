import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze } from "./analyze";
import { BRANDS, brandGroups, findBrand, isTrendBrand } from "./brands";
import { buildScript, composeResult } from "./compose";
import { productFamilies } from "./keywords";
import { QUESTIONS, Q_TEXT } from "./questions";
import { QUIZ, QUIZ_TEXT } from "./quiz";
import { applyTextEdits, checkText, flattenTexts } from "./texts";
import { fill, josa, MissingVar } from "./text";

describe("브랜드 이름 맞추기", () => {
  it("대소문자·띄어쓰기·기호·한글 별칭·악센트를 무시한다", () => {
    expect(findBrand("uniqlo")?.name).toBe("UNIQLO");
    expect(findBrand("유 니 클 로")?.name).toBe("UNIQLO");
    expect(findBrand("Stussy")?.name).toBe(findBrand("Stüssy")?.name);
    expect(findBrand("메종마르지엘라")?.name).toBe("Maison Margiela");
  });
  it("앞부분 일치, 긴 별칭 우선, 짧은 별칭은 앞부분 일치에 쓰지 않는다", () => {
    expect(findBrand("Rick Owens Mainline 24FW")?.name).toBe("Rick Owens");
    expect(findBrand("Rick Owens DRKSHDW")?.name).toBe("DRKSHDW");
    expect(findBrand("MISEKI SEOUL MAN")?.name).not.toBe(undefined);
    expect(findBrand("COS")?.name).toBe("COS");
    expect(findBrand("Cosmic Wonder")?.name).not.toBe("COS");
    expect(findBrand("AMI")?.name).toBe("AMI Paris");
    expect(findBrand("Amiri")?.name).toBe("Amiri");
  });
  it("목록에 없는 브랜드는 null(분석에서 뺀다)", () => {
    expect(findBrand("우리동네 작은 공방")).toBeNull();
    expect(findBrand("")).toBeNull();
  });
});

describe("브랜드 그룹", () => {
  it("아디다스는 스포츠와 전통 둘 다", () => {
    const g = brandGroups(findBrand("adidas")!);
    expect(g).toContain("sports");
    expect(g).toContain("heritage");
  });
  it("트렌드 표시 브랜드", () => {
    for (const n of ["포스트아카이브팩션", "르메르", "아워레가시", "오라리", "아크테릭스", "살로몬", "Stüssy", "산산기어", "아이앱 스튜디오", "마뗑킴"]) {
      const b = findBrand(n);
      expect(b, n).not.toBeNull();
      expect(isTrendBrand(b!), n).toBe(true);
    }
  });
  it("퀴즈 브랜드는 모두 자료에 있는 명품·디자이너·일본 데님이고, 문구와 정답 번호가 맞다", () => {
    const byName = new Map(BRANDS.map((b) => [b.name, b]));
    for (const q of QUIZ) {
      const b = byName.get(q.brand);
      expect(b, q.brand).toBeDefined();
      expect(brandGroups(b!).some((x) => x === "luxury" || x === "designer" || x === "jp_denim"), q.brand).toBe(true);
      const t = QUIZ_TEXT[q.id];
      expect(t, q.id).toBeDefined();
      expect(t.options).toHaveLength(4);
      expect(new Set(t.options).size).toBe(4);
      expect(t.options[q.answer], q.id).toBeDefined();
    }
  });
});

describe("제품명 키워드", () => {
  it("티셔츠는 셔츠가 아니다", () => {
    expect(productFamilies("오버핏 그래픽 티셔츠")).not.toContain("shirt");
    expect(productFamilies("옥스포드 셔츠")).toContain("shirt");
    expect(productFamilies("Heavy Sweatshirt")).not.toContain("shirt");
    expect(productFamilies("와이드 카고 팬츠")).toEqual(expect.arrayContaining(["wide", "cargo"]));
  });
});

describe("문구 채우기", () => {
  it("자리와 조사", () => {
    expect(fill("{brand|이} {n}벌", { brand: "유니클로", n: 3 })).toBe("유니클로가 3벌");
    expect(josa("블랙", "을")).toBe("블랙을");
    expect(josa("네이비", "을")).toBe("네이비를");
    expect(josa("Kapital", "으로")).toBe("Kapital로");
  });
  it("모르는 자리가 있으면 오류", () => {
    expect(() => fill("{brand_X}", {})).toThrow(MissingVar);
  });
});

const g = (i: number, over: Partial<Garment>): Garment => ({
  id: `g${i}`,
  categoryId: "top",
  subcategoryId: "top.short_tee",
  brand: "UNIQLO",
  productName: "티셔츠",
  sizeLabel: "M",
  colorName: "블랙",
  seasons: ["summer"],
  purchasedOn: "2026-09-01",
  purchasePrice: 20000,
  productUrl: null,
  imageUrl: null,
  measurements: {},
  fitReview: null,
  shoeFit: null,
  ...over,
});

describe("분석과 결과", () => {
  const wardrobe = Array.from({ length: 14 }, (_, i) =>
    g(i, {
      brand: i < 6 ? "UNIQLO" : i < 9 ? "Maison Margiela" : "우리동네 공방",
      colorName: i < 9 ? "블랙" : "레드",
      purchasePrice: i === 0 ? 900000 : 20000 + i * 1000,
      purchasedOn: i < 5 ? "2026-09-20" : "2025-03-01",
      held: i === 13,
    }),
  );
  const now = new Date("2026-09-29T12:00:00+09:00");
  const a = analyze(wardrobe, null, 1360, now);

  it("보류 옷은 빼고, 모자·신발을 뺀 옷을 센다", () => {
    expect(a.clothes).toHaveLength(13);
  });
  it("패턴의 숫자는 실제 옷장과 같다", () => {
    const black = a.patterns.find((p) => p.id === "black_bias")!;
    expect(black.stats.n).toBe(9);
    const brand = a.patterns.find((p) => p.id === "brand_focus")!;
    expect(brand.stats.brand).toBe("UNIQLO");
    expect(brand.stats.n).toBe(6);
    expect(a.patterns.find((p) => p.id === "recent_30")?.stats.n).toBe(5);
  });
  it("같은 seed면 같은 대화와 결과", () => {
    const p1 = buildScript(a, 42, "세현");
    const p2 = buildScript(a, 42, "세현");
    expect(p1.script).toEqual(p2.script);
    expect(p1.script.questions.length).toBeGreaterThan(0);
    expect(p1.script.questions.length).toBeLessThanOrEqual(3);
    const r = composeResult(a, "세현", 42);
    expect(r.headline).not.toMatch(/[{}]/);
    expect(r.paragraphs.map((x) => x.text).join(" ")).not.toMatch(/[{}]/);
  });
});

describe("질문 문구", () => {
  it("질문마다 문구가 있고, 선택지마다 반응이 있다", () => {
    for (const q of QUESTIONS) {
      const t = Q_TEXT[q.id];
      expect(t, q.id).toBeDefined();
      for (const id of q.options) {
        expect(t.options[id], `${q.id}.${id}`).toBeTruthy();
        if (q.id !== "max_budget") expect(t.react[id]?.length, `${q.id}.${id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("관리자 문장 수정", () => {
  it("모든 문장에 위치(key)가 있다", () => {
    const keys = flattenTexts().map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("lines.black_bias.say.0");
    expect(keys).toContain("quiz.cdg-meaning.options.0");
  });
  it("그 문장에 없는 자리는 막는다", () => {
    expect(checkText("lines.black_bias.say.0", "검정이 {n}벌, {pct}%")).toBeNull();
    expect(checkText("lines.black_bias.say.0", "검정이 {amountWon}")).toMatch(/자리/);
    expect(checkText("lines.nope.say.0", "x")).toMatch(/없는/);
    expect(checkText("lines.black_bias.say.0", " ")).toMatch(/비워/);
  });
  it("고친 문장이 분석에 쓰인다", () => {
    const T = applyTextEdits({ "common.THINKING.0": "헐 대박.", "lines.black_bias.say.0": "{bad}" });
    expect(T.common.THINKING[0]).toBe("헐 대박.");
    expect(T.lines.black_bias.say[0]).not.toBe("{bad}");
  });
});

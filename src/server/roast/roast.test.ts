import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze } from "./analyze";
import { BRANDS, brandGroups, brandLabels, findBrand, isTrendBrand, MUSINSA_POPULAR } from "./brands";
import { buildScript, composeResult, outfitCounts } from "./compose";
import { productFamilies } from "./keywords";
import { QUESTIONS, Q_TEXT } from "./questions";
import { QUIZ } from "./quiz";
import { applyTextEdits, checkUnit, fromRows, toRows, unitsOf } from "./texts";
import { fill, josa, MissingVar } from "./text";
import { joinBubbles, splitSentences } from "@/lib/roast/bubbles";

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

describe("무신사 인기 태그", () => {
  it("인기 순위 브랜드에만 붙고 유명 글로벌 브랜드는 뺀다", () => {
    for (const b of ["Matin Kim", "마뗑킴", "무신사 스탠다드 키즈", "thisisneverthat", "MLB"]) expect(brandLabels(b)).toContain(MUSINSA_POPULAR);
    for (const b of ["Nike", "adidas", "The North Face", "New Balance", "Arc'teryx", "UNIQLO"]) expect(brandLabels(b)).not.toContain(MUSINSA_POPULAR);
  });
  it("태그만 있는 브랜드는 분석 자료에 넣지 않는다", () => {
    expect(brandLabels("레더리")).toContain(MUSINSA_POPULAR);
    expect(findBrand("Leathery")).toBeNull();
    expect(BRANDS.every((b) => typeof b.price === "number")).toBe(true);
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
  it("퀴즈 브랜드는 모두 자료에 있고, 선택지 4개에 정답 번호가 맞고, 정답 번호가 한쪽에 몰리지 않는다", () => {
    const byName = new Map(BRANDS.map((b) => [b.name, b]));
    const answers = [0, 0, 0, 0];
    for (const [id, q] of Object.entries(QUIZ)) {
      expect(byName.get(q.brand), `${id} ${q.brand}`).toBeDefined();
      expect(q.options, id).toHaveLength(4);
      expect(new Set(q.options).size, id).toBe(4);
      expect(q.options[q.answer], id).toBeDefined();
      expect(q.correct.length && q.wrong.length, id).toBeTruthy();
      answers[q.answer]++;
    }
    const total = Object.keys(QUIZ).length;
    for (const n of answers) expect(n / total).toBeLessThan(0.4);
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

  it("코디 조합 수: 상의×하의×신발 × (1+아우터) × (1+모자)", () => {
    const mixed = analyze(
      [
        ...Array.from({ length: 3 }, (_, i) => g(i, { categoryId: "top" })),
        ...Array.from({ length: 2 }, (_, i) => g(10 + i, { categoryId: "bottom" })),
        ...Array.from({ length: 2 }, (_, i) => g(20 + i, { categoryId: "shoes" })),
        g(30, { categoryId: "outer" }),
        ...Array.from({ length: 2 }, (_, i) => g(40 + i, { categoryId: "hat" })),
      ],
      null,
      1360,
      now,
    );
    // 기본 12 + 아우터만 12 + 모자만 24 + 둘 다 24 = 72
    expect(outfitCounts(mixed)).toMatchObject({ base: 12, combos: 72 });
    const noShoes = analyze(wardrobe.filter((x) => x.categoryId !== "shoes"), null, 1360, now);
    expect(outfitCounts(noShoes).combos).toBe(0);
    expect(composeResult(noShoes, null, 1).outfit).toMatch(/0가지/);
  });
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
    expect(p1.script.questions.length).toBeLessThanOrEqual(5);
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
  it("고치는 단위: 문장 목록은 통째로, 퀴즈 정답은 숫자로", () => {
    const units = new Map(unitsOf().map((u) => [u.key, u]));
    expect(units.get("lines.black_bias.say")?.kind).toBe("list");
    expect(units.get("lines.black_bias.head")?.kind).toBe("pairs");
    expect(units.get("questions.odd_photo.text")?.kind).toBe("text");
    expect(units.get("quiz.cdg-play.answer")?.kind).toBe("number");
    expect(units.has("lines.black_bias.say.0")).toBe(false);
  });
  it("그 문장에 없는 자리는 막고, 목록은 비울 수 없다", () => {
    expect(checkUnit("lines.black_bias.say", ["검정이 {n}벌, {pct}%", "새 문장"])).toEqual({ value: ["검정이 {n}벌, {pct}%", "새 문장"] });
    expect(checkUnit("lines.black_bias.say", ["검정이 {amountWon}"])).toMatchObject({ error: expect.stringMatching(/자리/) });
    expect(checkUnit("lines.black_bias.say", [])).toMatchObject({ error: expect.stringMatching(/이상/) });
    expect(checkUnit("lines.nope.say", ["x"])).toMatchObject({ error: expect.stringMatching(/없는/) });
    expect(checkUnit("questions.odd_photo.text", " ")).toMatchObject({ error: expect.stringMatching(/비워/) });
    expect(checkUnit("common.HEAD_SINGLE_PREFIX", ["", "결론은,"])).toEqual({ value: ["", "결론은,"] });
  });
  it("고친 문장이 분석에 쓰이고, 예전 방식(목록 안 한 줄)과 잘못된 값은 무시한다", () => {
    const T = applyTextEdits({
      "common.THINKING": JSON.stringify(["헐 대박.", "음."]),
      "lines.black_bias.say": JSON.stringify(["{bad}"]),
      "common.CLOSING.0": "예전 방식",
    });
    expect(T.common.THINKING).toEqual(["헐 대박.", "음."]);
    expect(T.lines.black_bias.say[0]).not.toBe("{bad}");
    expect(T.common.CLOSING[0]).not.toBe("예전 방식");
  });
  it("긴 목록은 나눠 저장하고 다시 합친다", () => {
    const long = Array.from({ length: 30 }, (_, i) => `아주 긴 마무리 문장 ${i}번입니다. `.repeat(3));
    const rows = toRows("common.CLOSING", long);
    expect(Object.keys(rows).length).toBeGreaterThan(1);
    for (const body of Object.values(rows)) expect(body.length).toBeLessThanOrEqual(1000);
    expect(fromRows(rows)["common.CLOSING"]).toEqual(long);
  });
  it("퀴즈를 새로 만들고, 기본 퀴즈를 지울 수 있다", () => {
    const T = applyTextEdits({
      "quiz.c-test1.brand": "Stüssy",
      "quiz.c-test1.question": "문제?",
      "quiz.c-test1.options": JSON.stringify(["가", "나", "다"]),
      "quiz.c-test1.answer": "2",
      "quiz.c-test1.correct": JSON.stringify(["맞음"]),
      "quiz.c-test1.wrong": JSON.stringify(["틀림"]),
      "quiz.c-half.question": "칸이 모자란 퀴즈",
      "quiz.cdg-play.deleted": "1",
    });
    expect(T.quiz["c-test1"]).toMatchObject({ brand: "Stüssy", answer: 2, options: ["가", "나", "다"] });
    expect(T.quiz["c-half"]).toBeUndefined();
    expect(T.quiz["cdg-play"]).toBeUndefined();
  });
});

describe("새 패턴", () => {
  const now = new Date("2026-09-29T12:00:00+09:00");
  it("같은 달 구매는 연도를 합쳐 센다(9월)", () => {
    const w = Array.from({ length: 16 }, (_, i) =>
      g(i, { purchasedOn: i < 3 ? "2025-09-10" : i < 6 ? "2024-09-03" : `2025-${String((i % 8) + 1).padStart(2, "0")}-15`, productName: `옷${i}` }),
    );
    const p = analyze(w, null, 1360, now).patterns.find((x) => x.id === "month_binge");
    expect(p?.stats).toEqual({ month: 9, n: 6 });
  });
  it("이름·색이 같은 옷 3벌 이상은 짱구 질문", () => {
    const w = Array.from({ length: 12 }, (_, i) => g(i, { productName: i < 3 ? "베이직 반팔 티셔츠" : `옷${i}`, colorName: i < 3 ? "화이트" : "블랙" }));
    const a = analyze(w, null, 1360, now);
    expect(a.patterns.find((x) => x.id === "identical_items")?.stats.n).toBe(3);
    const asked = buildScript(a, 7, null).asked.map((q) => q.id);
    expect(asked).toContain("jjanggu_q");
  });
  it("무신사 링크가 많고 국내 대중 브랜드가 많으면 무신사 패턴", () => {
    const w = Array.from({ length: 12 }, (_, i) =>
      g(i, { brand: i < 8 ? "Musinsa Standard" : "UNIQLO", productName: `옷${i}`, productUrl: i < 9 ? `https://www.musinsa.com/products/${i}` : "https://www.29cm.co.kr/p/1" }),
    );
    const a = analyze(w, null, 1360, now);
    expect(a.patterns.find((x) => x.id === "musinsa_kr")).toBeDefined();
    expect(a.patterns.find((x) => x.id === "shop_focus")).toBeUndefined();
  });
  it("질문과 같은 사진이면 같은 섹션의 앞 문장에서는 사진을 뺀다", () => {
    const w = Array.from({ length: 12 }, (_, i) =>
      g(i, { productName: i < 4 ? "베이직 반팔 티셔츠" : `옷${i}`, colorName: i < 4 ? "화이트" : "블랙", imageUrl: "https://x/y.jpg" }),
    );
    const a = analyze(w, null, 1360, now);
    for (let seed = 1; seed < 20; seed++) {
      const { script } = buildScript(a, seed, null);
      script.steps.forEach((s, i) => {
        if (s.t !== "ask") return;
        const q = script.questions[s.q];
        const before = script.steps.slice(0, i);
        const since = before.slice(before.map((x) => x.t).lastIndexOf("status") + 1);
        for (const x of since) if (x.t === "say" && x.photos && q.photos.length) expect(x.photos.some((id) => q.photos.includes(id))).toBe(false);
      });
    }
  });
  it("결과 글에 답을 두고 비꼬는 문단이 들어간다", () => {
    const w = Array.from({ length: 12 }, (_, i) => g(i, { productName: i < 3 ? "베이직 반팔 티셔츠" : `옷${i}`, colorName: i < 3 ? "화이트" : "블랙" }));
    const a = analyze(w, null, 1360, now);
    const plan = buildScript(a, 7, null);
    const answers = Object.fromEntries(plan.asked.map((q) => [q.id, q.options[0].id]));
    const r = composeResult(a, null, 7, undefined, plan.asked, answers);
    const roastTexts = plan.asked.map((q) => q.roast[answers[q.id]]).filter(Boolean);
    expect(roastTexts.length).toBeGreaterThan(0);
    expect(r.paragraphs.map((p) => p.text)).toEqual(expect.arrayContaining([roastTexts[0]]));
  });
});

describe("말풍선 나누기", () => {
  it("문장 끝마다 줄을 바꾸고, 말줄임은 나누지 않는다", () => {
    expect(splitSentences("반소매 티셔츠, 13벌. 취향이라기보다는 운영 방침에 가까워 보입니다.")).toBe("반소매 티셔츠, 13벌.\n취향이라기보다는 운영 방침에 가까워 보입니다.");
    expect(splitSentences("흠... interesting")).toBe("흠... interesting");
    expect(joinBubbles("가.\n나.")).toBe("가. 나.");
  });
  it("대화 문장 기본값은 나뉘어 있고, 결과 글은 그대로다", () => {
    const say = unitsOf().filter((u) => u.key.endsWith(".say"));
    expect(say.some((u) => (u.value as string[]).some((s) => s.includes("\n")))).toBe(true);
    const para = unitsOf().filter((u) => u.key.endsWith(".para"));
    expect(para.every((u) => (u.value as string[]).every((s) => !s.includes("\n")))).toBe(true);
  });
});

describe("퀴즈", () => {
  it("가진 브랜드의 퀴즈가 있으면 어떤 seed에서도 퀴즈를 낸다", () => {
    const wardrobe = Array.from({ length: 12 }, (_, i) => g(i, { brand: i === 0 ? "메종 마르지엘라" : "우리동네 공방" }));
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    for (let seed = 0; seed < 30; seed++) expect(buildScript(a, seed, null).script.questions.some((q) => q.id === "quiz")).toBe(true);
  });
});

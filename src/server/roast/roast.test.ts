import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/types/domain";
import { analyze } from "./analyze";
import { BRANDS, brandGroups, brandLabels, findBrand, isTrendBrand, MUSINSA_POPULAR } from "./brands";
import { buildScript, composeResult, quotesAnswer } from "./compose";
import { productFamilies } from "./keywords";
import { QUESTIONS, Q_TEXT } from "./questions";
import { QUIZ } from "./quiz";
import { applyTextEdits, checkUnit, DEFAULT_TEXTS, fromRows, toRows, unitsOf } from "./texts";
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
  it("분석 자료의 브랜드는 모두 가격 레벨 값이 있다", () => {
    expect(brandLabels("레더리")).toContain(MUSINSA_POPULAR);
    expect(BRANDS.every((b) => typeof b.price === "number")).toBe(true);
  });
});

describe("브랜드 그룹", () => {
  it("캐주얼은 프리미엄 캐주얼과 같은 그룹", () => {
    const casual = BRANDS.find((b) => b.positions.includes("캐주얼") && !b.positions.includes("프리미엄 캐주얼"))!;
    expect(brandGroups(casual)).toContain("premium_casual");
  });
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
  productName: "프린트 티셔츠", // 무지 티(분석에서 빠짐)가 아니게
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
  it("질문이 같은 사실을 되풀이하면 패턴 문장은 대화에서 뺀다(최근 한 달 구매)", () => {
    let seen = 0;
    for (let seed = 0; seed < 60; seed++) {
      const { script } = buildScript(a, seed, null);
      if (!script.questions.some((q) => q.id === "recent_reason")) continue;
      seen++;
      const says = script.steps.filter((s) => s.t === "say").map((s) => s.text).join("\n");
      expect(says).not.toMatch(/최근 한 달 사이에 5벌을 샀습니다|30일 안에 5벌/);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it("섹션 사이 혼잣말과 추임새는 한 번의 분석에서 같은 문장이 두 번 나오지 않는다", () => {
    for (let seed = 0; seed < 60; seed++) {
      const texts = buildScript(a, seed, null).script.steps.filter((s) => s.t === "say").map((s) => s.text);
      const extra = texts.filter((t) => DEFAULT_TEXTS.common.MID_REMARKS.includes(t) || DEFAULT_TEXTS.common.THINKING.includes(t));
      expect(new Set(extra).size).toBe(extra.length);
    }
  });
  it("같은 seed면 같은 대화와 결과", () => {
    const p1 = buildScript(a, 42, "세현");
    const p2 = buildScript(a, 42, "세현");
    expect(p1.script).toEqual(p2.script);
    expect(p1.script.questions.length).toBeGreaterThan(0);
    // 일반 질문은 최대 10개, 끝에 늘 붙는 질문(무신사 링크·패셔너블)은 따로 센다.
    expect(p1.script.questions.filter((q) => !["chimchak_q", "fashionable_q"].includes(q.id)).length).toBeLessThanOrEqual(10);
    expect(p1.script.steps.filter((s) => s.t === "status").length).toBeLessThanOrEqual(15);
    const r = composeResult(a, 42);
    expect(r.closing.length).toBeGreaterThanOrEqual(2);
    expect(r.closing.join(" ")).not.toMatch(/[{}]/);
  });
});

describe("질문 문구", () => {
  it("질문마다 문구가 있고, 선택지마다 반응이 있다", () => {
    for (const q of QUESTIONS) {
      const t = Q_TEXT[q.id];
      expect(t, q.id).toBeDefined();
      for (const id of q.options) {
        expect(t.options[id], `${q.id}.${id}`).toBeTruthy();
        // "패셔너블한가요?"는 점수 구간(high/mid/low)마다 반응이 따로 있다
        const keys = q.id === "fashionable_q" ? ["high", "mid", "low"].map((tier) => `${tier}_${id}`) : [id];
        if (q.id !== "max_budget") for (const k of keys) expect(t.react[k]?.length, `${q.id}.${k}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("관리자 문장 수정", () => {
  it("고치는 단위: 문장 목록은 통째로, 퀴즈 정답은 숫자로", () => {
    const units = new Map(unitsOf().map((u) => [u.key, u]));
    expect(units.get("lines.black_bias.say")?.kind).toBe("list");
    expect(units.has("lines.black_bias.head")).toBe(false);
    expect(units.get("questions.odd_photo.text")?.kind).toBe("text");
    expect(units.get("quiz.cdg-play.answer")?.kind).toBe("number");
    expect(units.has("lines.black_bias.say.0")).toBe(false);
  });
  it("그 문장에 없는 자리는 막고, 목록은 비울 수 없다", () => {
    expect(checkUnit("lines.black_bias.say", ["검정이 {n}벌", "새 문장"])).toEqual({ value: ["검정이 {n}벌", "새 문장"] });
    expect(checkUnit("lines.black_bias.say", ["검정이 {amountWon}"])).toMatchObject({ error: expect.stringMatching(/자리/) });
    expect(checkUnit("lines.black_bias.say", [])).toMatchObject({ error: expect.stringMatching(/이상/) });
    expect(checkUnit("lines.nope.say", ["x"])).toMatchObject({ error: expect.stringMatching(/없는/) });
    expect(checkUnit("questions.odd_photo.text", " ")).toMatchObject({ error: expect.stringMatching(/비워/) });
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
      g(i, { purchasedOn: i < 3 ? "2025-09-10" : i < 6 ? "2024-09-03" : `2025-${String((i % 8) + 1).padStart(2, "0")}-15`, productName: `프린트 옷${i}` }),
    );
    const p = analyze(w, null, 1360, now).patterns.find((x) => x.id === "month_binge");
    expect(p?.stats).toEqual({ month: 9, n: 6 });
  });
  it("이름·색이 같은 옷 3벌 이상은 짱구 질문", () => {
    const w = Array.from({ length: 12 }, (_, i) => g(i, { productName: i < 3 ? "그래픽 반팔 티셔츠" : `프린트 옷${i}`, colorName: i < 3 ? "화이트" : "블랙" }));
    const a = analyze(w, null, 1360, now);
    expect(a.patterns.find((x) => x.id === "identical_items")?.stats.n).toBe(3);
    const asked = buildScript(a, 7, null).asked.map((q) => q.id);
    expect(asked).toContain("jjanggu_q");
  });
  it("무신사 링크가 많고 국내 대중 브랜드가 많으면 무신사 패턴", () => {
    const w = Array.from({ length: 12 }, (_, i) =>
      g(i, { brand: i < 8 ? "Musinsa Standard" : "UNIQLO", productName: `프린트 옷${i}`, productUrl: i < 9 ? `https://www.musinsa.com/products/${i}` : "https://www.29cm.co.kr/p/1" }),
    );
    const a = analyze(w, null, 1360, now);
    expect(a.patterns.find((x) => x.id === "musinsa_kr")).toBeDefined();
    expect(a.patterns.find((x) => x.id === "shop_focus")).toBeUndefined();
  });
  it("질문과 같은 사진이면 같은 섹션의 앞 문장에서는 사진을 뺀다", () => {
    const w = Array.from({ length: 12 }, (_, i) =>
      g(i, { productName: i < 4 ? "그래픽 반팔 티셔츠" : `프린트 옷${i}`, colorName: i < 4 ? "화이트" : "블랙", imageUrl: "https://x/y.jpg" }),
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
  it("질문 답 문단마다 답을 옮겨 말하지 않고 시작하는 문장이 하나 이상 있다", () => {
    for (const [id, t] of Object.entries(Q_TEXT))
      for (const [k, list] of Object.entries(t.roast ?? {})) expect(list.some((x) => !quotesAnswer(x)), `${id}.${k}`).toBe(true);
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

describe("지출 비중 패턴", () => {
  it("아우터에 돈이 몰린 건 당연하니 '벌 수보다 돈이 크다' 패턴을 내지 않는다", () => {
    const wardrobe = [
      ...Array.from({ length: 3 }, (_, i) => g(i, { categoryId: "outer", subcategoryId: null, purchasePrice: 400000 })),
      ...Array.from({ length: 9 }, (_, i) => g(i + 10, { purchasePrice: 20000 })),
    ];
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    expect(a.patterns.some((p) => p.id === "category_spend" && p.stats.cat === "outer")).toBe(false);
  });
});

describe("무신사 패턴", () => {
  it("무신사 옷장이면 가진 브랜드 중 요즘 뜨는 브랜드 이름을 세 개까지 읊는다", () => {
    const pop = [...BRANDS].filter((b) => b.country === "한국" && brandLabels(b.name).includes(MUSINSA_POPULAR)).slice(0, 4);
    const wardrobe = Array.from({ length: 12 }, (_, i) =>
      g(i, { brand: pop[i % pop.length].name, productUrl: "https://www.musinsa.com/products/" + i }),
    );
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    const p = a.patterns.find((x) => x.id === "musinsa_kr")!;
    expect(p).toBeTruthy();
    const names = String(p.stats.names).split(", ");
    expect(names.length).toBe(3);
    for (const n of names) expect(pop.map((b) => b.name)).toContain(n);
  });
});

describe("항상 내는 질문", () => {
  it("비싼 옷 셋 중 버리기와 브랜드 셋 중 고르기는 어떤 seed에서도 나오고, 비싼 옷 셋에는 모자·신발이 없다", () => {
    const brands = ["UNIQLO", "UNIQLO", "COS", "COS", "COS", "Levi's", "Levi's", "A.P.C.", "A.P.C.", "UNIQLO", "COS", "A.P.C."];
    const wardrobe = [
      ...brands.map((b, i) => g(i, { brand: b, purchasePrice: 10000 * (i + 1) })),
      g(20, { brand: "Z", categoryId: "shoes", subcategoryId: null, purchasePrice: 9000000 }),
      g(21, { brand: "Z", categoryId: "hat", subcategoryId: null, purchasePrice: 8000000 }),
    ];
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildScript(a, seed, null).script.questions;
      expect(qs.some((q) => q.id === "brand_best")).toBe(true);
      const drop = qs.find((q) => q.id === "drop_item");
      expect(drop).toBeTruthy();
      expect(drop!.options.map((o) => o.id)).not.toContain(a.items.find((i) => i.cat === "shoes")!.id);
      expect(drop!.options.map((o) => o.id)).not.toContain(a.items.find((i) => i.cat === "hat")!.id);
    }
  });
});

describe("가장 비싼 항목", () => {
  it("'옷' 대신 '항목'이라 하고, 바로 다음 줄에 '브랜드의 상품명입니다.'를 붙인다", () => {
    const wardrobe = [
      ...Array.from({ length: 10 }, (_, i) => g(i, { purchasePrice: 30000 })),
      g(20, { brand: "Nike", productName: "에어 포스 1", categoryId: "shoes", subcategoryId: null, purchasePrice: 229000 }),
    ];
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    const p = a.patterns.find((x) => x.id === "top_item")!;
    expect(p.stats.itemName).toBe(`${a.items.find((i) => i.cat === "shoes")!.brandLabel}의 에어 포스 1`);
    const says = Array.from({ length: 80 }, (_, seed) => buildScript(a, seed, null).script.steps)
      .flat()
      .flatMap((s) => (s.t === "say" && s.text.includes("가장 비싼") ? [s.text] : []));
    expect(says.length).toBeGreaterThan(0);
    for (const t of says) {
      expect(t).not.toContain("가장 비싼 옷");
      expect(t.split("\n")[1]).toContain(p.stats.itemName as string);
    }
  });
});

describe("데님 반복", () => {
  const now = new Date("2026-09-29T12:00:00+09:00");
  const denim = (i: number, categoryId: "top" | "outer" | "bottom") =>
    g(i, { categoryId, subcategoryId: null, productName: categoryId === "bottom" ? `데님 팬츠 ${i}` : `데님 재킷 ${i}` });

  it("데님은 바지만 세고, 질문은 '평생 한 종류의 바지만'으로 묻는다", () => {
    const wardrobe = [...[0, 1, 2, 3, 4].map((i) => denim(i, "bottom")), ...[5, 6, 7, 8, 9, 10].map((i) => denim(i, i % 2 ? "top" : "outer"))];
    const a = analyze(wardrobe, null, 1360, now);
    const p = a.patterns.find((x) => x.id === "family_repeat")!;
    expect(p.stats).toMatchObject({ family: "denim", n: 5, kind: "바지" });
    expect(p.garmentIds.every((id) => a.items.find((i) => i.id === id)!.cat === "bottom")).toBe(true);
    const q = Array.from({ length: 60 }, (_, seed) => buildScript(a, seed, null).script.questions.find((x) => x.id === "extreme_one")).find(Boolean);
    expect(q!.text).toBe("내일부터 평생 한 종류의 바지만 입을 수 있다면, 역시 데님을 고르겠나요?");
  });

  it("상의·아우터 데님만 많으면 데님 반복으로 보지 않는다", () => {
    const wardrobe = [...[0, 1, 2, 3, 4, 5].map((i) => denim(i, i % 2 ? "top" : "outer")), ...[6, 7, 8, 9, 10, 11].map((i) => g(i, {}))];
    const a = analyze(wardrobe, null, 1360, now);
    expect(a.patterns.find((x) => x.id === "family_repeat" && x.stats.family === "denim")).toBeUndefined();
  });
});

describe("고른 뒤 보여 주는 금액", () => {
  const now = new Date("2026-09-29T12:00:00+09:00");

  it("비싼 옷 셋은 옷 가격, 브랜드 셋은 그 브랜드에 쓴 돈을 \"N ￦\"로 붙인다", () => {
    const brands = ["UNIQLO", "UNIQLO", "COS", "COS", "COS", "Levi's", "Levi's", "A.P.C.", "A.P.C.", "UNIQLO", "COS", "A.P.C."];
    const wardrobe = brands.map((b, i) => g(i, { brand: b, purchasePrice: 10000 * (i + 1) }));
    const a = analyze(wardrobe, null, 1360, now);
    const qs = buildScript(a, 3, null).script.questions;
    const drop = qs.find((q) => q.id === "drop_item")!;
    for (const o of drop.options) {
      const price = wardrobe[a.items.findIndex((i) => i.id === o.id)].purchasePrice!;
      expect(o.amount).toBe(`${price.toLocaleString("ko-KR")} ￦`);
    }
    const best = qs.find((q) => q.id === "brand_best")!;
    for (const o of best.options) {
      const total = wardrobe.filter((x) => x.brand === o.label).reduce((s, x) => s + x.purchasePrice!, 0);
      expect(o.amount).toBe(`${total.toLocaleString("ko-KR")} ￦`);
    }
  });

  it("브랜드에 쓴 돈 질문은 답한 뒤 그 브랜드 옷 사진과 가격을 비싼 순으로 보여 준다", () => {
    const wardrobe = Array.from({ length: 12 }, (_, i) =>
      g(i, { brand: i < 4 ? "COS" : `B${i}`, purchasePrice: i < 4 ? 400000 + i * 10000 : 20000, imageUrl: `https://x/${i}.jpg` }),
    );
    const a = analyze(wardrobe, null, 1360, now);
    const q = Array.from({ length: 60 }, (_, seed) => buildScript(a, seed, null).script.questions.find((x) => x.id === "brand_spend_q")).find(Boolean);
    expect(q).toBeTruthy();
    const cos = a.items.filter((i) => i.brandLabel === "COS").sort((x, y) => y.price! - x.price!);
    expect(q!.reveal).toEqual(cos.map((i) => ({ id: i.id, amount: `${i.price!.toLocaleString("ko-KR")} ￦` })));
  });
});

describe("퀴즈", () => {
  it("가진 브랜드의 퀴즈가 있으면 어떤 seed에서도 퀴즈를 낸다", () => {
    const wardrobe = Array.from({ length: 12 }, (_, i) => g(i, { brand: i === 0 ? "메종 마르지엘라" : "우리동네 공방" }));
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    for (let seed = 0; seed < 30; seed++) expect(buildScript(a, seed, null).script.questions.some((q) => q.id === "quiz")).toBe(true);
  });

  it("퀴즈 앞 멘트에 브랜드 이름을 넣고, 브랜드가 처음 나오는 문장에 그 브랜드 옷 사진을 붙인다", () => {
    const wardrobe = Array.from({ length: 12 }, (_, i) =>
      g(i, { brand: i === 0 ? "메종 마르지엘라" : "우리동네 공방", imageUrl: i === 0 ? "https://x/m.jpg" : null }),
    );
    const a = analyze(wardrobe, null, 1360, new Date("2026-09-29T12:00:00+09:00"));
    const quiz = buildScript(a, 1, null).script.questions.find((q) => q.id === "quiz")!;
    expect(quiz.lead.join(" ")).toContain("메종 마르지엘라 옷이 있네요.");
    expect(quiz.lead.join(" ")).toContain("메종 마르지엘라를 가지고 있으면");
    const at = quiz.lead.findIndex((l) => l.includes("옷이 있네요"));
    expect(quiz.leadPhotos?.[at]).toEqual([a.items.find((i) => i.brandLabel === "메종 마르지엘라")!.id]);
  });
});

describe("반응별 조건 저장 검사", () => {
  it("빈 칸은 두고 끝의 빈 칸은 지운다, 모르는 조건은 막는다", () => {
    expect(checkUnit("questions.o_only_musinsa.when.offline", ["", "count_lte:20|pat:black_bias", ""])).toEqual({ value: ["", "count_lte:20|pat:black_bias"] });
    expect(checkUnit("questions.o_only_musinsa.when.offline", ["nope"])).toHaveProperty("error");
    expect(checkUnit("questions.o_only_musinsa.when.offline", ["count_lte"])).toHaveProperty("error");
    expect(checkUnit("questions.o_only_musinsa.result.offline", ["", "결과 글"])).toEqual({ value: ["", "결과 글"] });
  });
});

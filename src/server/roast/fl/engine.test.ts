import { describe, expect, it } from "vitest";
import type { FitLevel } from "@/lib/constants/body";
import type { Garment } from "@/lib/types/domain";
import { prepare } from "../analyze";
import { DEFAULT_CONFIG } from "./config";
import { evaluate } from "./engine";
import { buildPlan, buildReport } from "./script";
import { TYPE_DEFS } from "./types";
import { applyEdits, sanitizeSection, toRows } from "./store";

const now = new Date("2026-10-11T12:00:00+09:00");

type Row = { brand: string; cat: Garment["categoryId"]; sub?: string; color: string; fit?: FitLevel; name?: string; price?: number; date?: string; url?: string; seasons?: Garment["seasons"] };
let seq = 0;
const g = (r: Row): Garment => ({
  id: `g${++seq}`,
  categoryId: r.cat,
  subcategoryId: r.sub ?? null,
  brand: r.brand,
  productName: r.name ?? `${r.brand} 상품 ${seq}`,
  sizeLabel: "M",
  colorName: r.color,
  seasons: r.seasons ?? [],
  purchasedOn: r.date ?? null,
  purchasePrice: r.price ?? null,
  productUrl: r.url ?? null,
  imageUrl: `https://x/${seq}.jpg`,
  measurements: {},
  fitReview: null,
  shoeFit: null,
  userFit: r.cat === "hat" || r.cat === "shoes" ? null : (r.fit ?? "regular"),
}) as Garment;

/** brands를 돌려 가며 40벌(아우터 8, 상의 14, 하의 10, 신발 6, 모자 2) */
function wardrobe(brands: string[], colors: string[], fits: FitLevel[], opts: { cats?: Row["cat"][]; extra?: Partial<Row> } = {}): Garment[] {
  const cats: Row["cat"][] = opts.cats ?? [...Array(8).fill("outer"), ...Array(14).fill("top"), ...Array(10).fill("bottom"), ...Array(6).fill("shoes"), ...Array(2).fill("hat")];
  return cats.map((cat, i) => g({ brand: brands[i % brands.length], cat, color: colors[i % colors.length], fit: fits[i % fits.length], ...opts.extra }));
}

/** [분류, 브랜드, 색, 이름, 핏] 목록을 n번 돌려 옷장을 만든다 */
const listOf = (rows: [Row["cat"], string, string, string, FitLevel?][]) => rows.map(([cat, brand, color, name, fit]) => g({ cat, brand, color, name, fit }));

/** 같은 무신사 중저가 대학생 3명: 고르는 실력만 다르다 */
const campusGood = listOf([
  ...(["네이비", "차콜", "베이지", "블랙", "카키", "네이비"] as const).map((c, i) => ["outer", ["Musinsa Standard", "Partimento", "UNIQLO", "Covernat", "Lee", "Musinsa Standard"][i], c, ["울 블렌드 코트", "MA-1 자켓", "코튼 재킷", "후드 집업", "필드 재킷", "가디건"][i], "regular"] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 13 }, (_, i) => ["top", ["UNIQLO", "Musinsa Standard", "Lee", "Covernat", "Partimento"][i % 5], ["화이트", "그레이", "블랙", "네이비", "베이지", "블루"][i % 6], ["옥스퍼드 셔츠", "크루넥 니트", "무지 티셔츠", "스웨트셔츠", "스트라이프 셔츠", "헨리넥 티"][i % 6], (["regular", "semi_over"] as FitLevel[])[i % 2]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 9 }, (_, i) => ["bottom", ["Lee", "Musinsa Standard", "UNIQLO", "Partimento"][i % 4], ["데님", "블랙", "베이지", "그레이", "네이비"][i % 5], ["스트레이트 데님 팬츠", "와이드 슬랙스", "치노 팬츠", "스웨트 팬츠", "카고 팬츠"][i % 5], "regular"] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 5 }, (_, i) => ["shoes", ["New Balance", "Converse", "Vans", "Dr. Martens", "adidas"][i], ["그레이", "화이트", "블랙", "블랙", "화이트"][i], "스니커즈", undefined] as [Row["cat"], string, string, string, FitLevel?]),
]);
const campusBad = listOf([
  ...Array.from({ length: 3 }, (_, i) => ["outer", ["Mahagrid", "Covernat", "Musinsa Standard"][i], ["레드", "옐로", "그린"][i], ["빅로고 바시티 자켓", "그래픽 바람막이", "패딩"][i], (["too_big", "too_small", "regular"] as FitLevel[])[i]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 22 }, (_, i) => ["top", ["Mahagrid", "Covernat", "LMC", "Musinsa Standard", "thisisneverthat"][i % 5], ["레드", "옐로", "그린", "퍼플", "핑크", "오렌지", "블루", "블랙"][i % 8], ["빅로고 반팔 티", "그래픽 후드티", "레터링 맨투맨", "캐릭터 프린트 티", "로고 스웨트셔츠", "무지 티셔츠"][i % 6], (["too_big", "regular", "too_small", "over"] as FitLevel[])[i % 4]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 4 }, (_, i) => ["bottom", ["Musinsa Standard", "Mahagrid", "Covernat", "LMC"][i], ["레드", "그린", "퍼플", "데님"][i], ["트레이닝 팬츠", "카고 팬츠", "조거 팬츠", "데님 팬츠"][i], (["too_small", "too_big", "regular", "too_big"] as FitLevel[])[i]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 3 }, (_, i) => ["shoes", ["Nike", "adidas", "Puma"][i], ["옐로", "레드", "그린"][i], "스니커즈", undefined] as [Row["cat"], string, string, string, FitLevel?]),
]);

const campusAvg = listOf([
  ...Array.from({ length: 5 }, (_, i) => ["outer", ["Covernat", "Musinsa Standard", "Nike", "thisisneverthat", "UNIQLO"][i], ["블랙", "네이비", "블루", "그레이", "블랙"][i], ["후드 집업", "블루종", "로고 바람막이", "그래픽 후드 집업", "패딩"][i], (["regular", "semi_over", "too_big", "over", "regular"] as FitLevel[])[i]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 16 }, (_, i) => ["top", ["Covernat", "Musinsa Standard", "thisisneverthat", "UNIQLO", "Nike", "LMC"][i % 6], ["블랙", "화이트", "그레이", "네이비", "그린", "블랙", "레드", "화이트"][i % 8], ["로고 반팔 티", "무지 티셔츠", "그래픽 맨투맨", "후드티", "스트라이프 티", "레터링 티"][i % 6], (["regular", "semi_over", "over", "regular", "too_big"] as FitLevel[])[i % 5]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 6 }, (_, i) => ["bottom", ["Musinsa Standard", "UNIQLO", "Covernat", "Nike"][i % 4], ["데님", "블랙", "그레이", "데님", "그레이", "블랙"][i], ["데님 팬츠", "와이드 슬랙스", "트레이닝 팬츠", "와이드 데님", "조거 팬츠", "카고 팬츠"][i], (["regular", "semi_over", "too_big", "regular", "regular", "over"] as FitLevel[])[i]] as [Row["cat"], string, string, string, FitLevel]),
  ...Array.from({ length: 4 }, (_, i) => ["shoes", ["Nike", "adidas", "Converse", "New Balance"][i], ["화이트", "블랙", "화이트", "그레이"][i], "스니커즈", undefined] as [Row["cat"], string, string, string, FitLevel?]),
]);

const personas: Record<string, Garment[]> = {
  campusAvg,
  campusGood,
  campusBad,
  campusNeat: wardrobe(["Musinsa Standard", "UNIQLO", "Nike", "Covernat", "thisisneverthat", "adidas", "Converse"], ["블랙", "그레이", "화이트", "네이비", "블랙"], ["regular", "semi_over"]),
  spaStylish: wardrobe(["UNIQLO", "ZARA", "COS", "SPAO"], ["블랙", "화이트", "그레이", "베이지"], ["regular", "semi_over", "regular"]),
  allblackDesigner: wardrobe(["Maison Margiela", "Acne Studios", "Lemaire", "Our Legacy", "Wooyoungmi", "Comme des Garçons"], ["블랙"], ["regular", "semi_over", "over"]),
  expensiveBad: wardrobe(["Maison Margiela", "Ader Error", "Comme des Garçons", "Arc'teryx", "Andersson Bell"], ["레드", "옐로우", "그린", "블랙", "퍼플", "핑크", "오렌지"], ["too_big", "too_small", "slim", "too_big"]),
  workwearDenim: wardrobe(["Levi's", "FULL COUNT", "Kapital", "visvim", "Engineered Garments", "Carhartt WIP"], ["데님", "카키", "브라운", "블랙"], ["regular", "semi_over", "over"]),
  oneBrand: wardrobe(["Stüssy", "Stüssy", "Stüssy", "Stüssy", "Nike", "Carhartt WIP", "UNIQLO"], ["블랙", "화이트", "그레이"], ["semi_over", "over"]),
  streetHype: wardrobe(["Stüssy", "Supreme", "MMLG", "Nike", "Carhartt WIP", "Ader Error"], ["블랙", "화이트", "그레이", "레드"], ["over", "semi_over"]),
  beginner: wardrobe(["UNIQLO", "SPAO", "Musinsa Standard"], ["블랙", "화이트"], ["regular"], { cats: [...Array(2).fill("outer"), ...Array(5).fill("top"), ...Array(4).fill("bottom"), ...Array(3).fill("shoes")] }),
};

const run = (gs: Garment[]) => evaluate(prepare(gs, null, 1350), null, "closet", now, DEFAULT_CONFIG);

describe("패션 수준 평가", () => {
  it("유형 정의가 52개이고 판정 함수·기본 설계가 모두 있다", () => {
    expect(TYPE_DEFS).toHaveLength(52);
    expect(new Set(TYPE_DEFS.map((t) => t.id)).size).toBe(52);
    for (const t of TYPE_DEFS) expect(DEFAULT_CONFIG.types[t.id]).toBeTruthy();
  });

  it("페르소나별 점수는 31~100이고, 유형은 최대 4개", () => {
    const rows: string[] = [];
    for (const [name, gs] of Object.entries(personas)) {
      const ev = run(gs);
      expect(ev.score).toBeGreaterThanOrEqual(31);
      expect(ev.score).toBeLessThanOrEqual(100);
      expect(ev.types.length).toBeLessThanOrEqual(4);
      const sumShare = ev.types.reduce((a, t) => a + t.share, 0);
      if (ev.types.length) expect(sumShare).toBeCloseTo(1);
      expect(Object.values(ev.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
      rows.push(`${name.padEnd(18)} ${String(ev.score).padStart(3)}점 raw ${ev.raw.toFixed(1)} sum ${ev.sum.toFixed(1)} bonus ${ev.bonus.grade}${ev.bonus.points} pen ${ev.penalties.map((p) => `${p.id}${p.points}`).join(",")} | ${ev.types.map((t) => `${t.id}:${t.fitness.toFixed(2)}`).join(", ")} | ${(["c", "t", "b", "f", "x"] as const).map((k) => `${k}=${ev.axes[k].value == null ? "-" : ev.axes[k].value!.toFixed(2)}`).join(" ")}`);
    }
    console.log("\n" + rows.join("\n"));
  });

  it("디자이너 올블랙 > 비싸지만 못 입는 옷장, 평범한 대학생·SPA는 60점대", () => {
    expect(run(personas.allblackDesigner).score).toBeGreaterThan(run(personas.expensiveBad).score + 10);
    expect(run(personas.allblackDesigner).score).toBeGreaterThanOrEqual(80);
    // 같은 중저가 대학생이라도 고르는 실력에 따라 크게 갈린다
    expect(run(personas.campusGood).score).toBeGreaterThanOrEqual(70);
    expect(run(personas.campusBad).score).toBeLessThan(50);
    expect(run(personas.campusAvg).score).toBeGreaterThanOrEqual(55);
    expect(run(personas.campusAvg).score).toBeLessThan(70);
    expect(run(personas.campusGood).score).toBeGreaterThanOrEqual(run(personas.campusAvg).score + 7);
    expect(run(personas.campusAvg).score).toBeGreaterThanOrEqual(run(personas.campusBad).score + 10);
    expect(run(personas.spaStylish).score).toBeGreaterThanOrEqual(60);
    expect(run(personas.expensiveBad).penalties.some((p) => p.id === "fit")).toBe(true);
  });

  it("대표 유형이 붙는다", () => {
    const ids = (k: string) => run(personas[k]).types.map((t) => t.id);
    expect(ids("spaStylish")).toContain("spa");
    expect(ids("allblackDesigner")).toContain("allblack");
    expect(ids("allblackDesigner")).toContain("designer_maniac");
    expect(ids("oneBrand")).toContain("one_brand");
    expect(ids("workwearDenim")).toContain("workwear");
    expect(ids("beginner")).toContain("beginner");
  });

  it("A 등급 유형은 보너스를 받는다(받치는 옷장일 때)", () => {
    expect(run(personas.allblackDesigner).bonus.points).toBeGreaterThan(5);
    expect(run(personas.campusNeat).bonus.points).toBe(0);
  });

  it("대화와 결과가 만들어지고 같은 seed면 같다", () => {
    const ev = run(personas.allblackDesigner);
    const a = buildPlan(ev, DEFAULT_CONFIG, 7, "세현", ["Maison Margiela"]);
    const b = buildPlan(ev, DEFAULT_CONFIG, 7, "세현", ["Maison Margiela"]);
    expect(JSON.stringify(a.script)).toBe(JSON.stringify(b.script));
    expect(a.script.steps.length).toBeGreaterThan(5);
    const built = buildReport(ev, DEFAULT_CONFIG, 7, a.asked, {}, { admin: true, partial: false });
    expect(built.report.total.score).toBe(ev.score);
    expect(built.report.axes?.length).toBe(5);
    expect(built.report.scoreDetail?.items.reduce((s, x) => s + x.delta, 0)).toBeCloseTo(ev.score, 5);
  });

  it("설계를 저장하고 불러오면 기본값 위에 덮인다", () => {
    const next = { ...DEFAULT_CONFIG.types.spa, name: "SPA 달인", grade: "B" as const };
    const r = sanitizeSection("type.spa", next);
    expect(r.ok).toBe(true);
    const rows = toRows("type.spa", next);
    const C = applyEdits(rows);
    expect(C.types.spa.name).toBe("SPA 달인");
    expect(C.types.spa.grade).toBe("B");
    expect(C.types.one_brand.name).toBe(DEFAULT_CONFIG.types.one_brand.name);
    // 쓸 수 없는 자리는 거부
    const bad = sanitizeSection("type.spa", { ...next, lines: { ...next.lines, say: ["{모르는자리}"] } });
    expect(bad.ok).toBe(false);
  });
});

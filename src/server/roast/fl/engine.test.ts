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

const personas: Record<string, Garment[]> = {
  campus: wardrobe(["Musinsa Standard", "UNIQLO", "Nike", "Covernat", "thisisneverthat", "adidas", "Converse"], ["블랙", "그레이", "화이트", "네이비", "블랙"], ["regular", "semi_over"]),
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
    for (const k of ["campus", "spaStylish"]) {
      expect(run(personas[k]).score).toBeGreaterThanOrEqual(60);
      expect(run(personas[k]).score).toBeLessThan(70);
    }
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
    expect(run(personas.campus).bonus.points).toBe(0);
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

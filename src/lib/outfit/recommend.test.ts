import { describe, expect, it } from "vitest";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";
import { fitsSeason, recommendOutfit, seasonOfDate } from "./recommend";

let n = 0;
function g(categoryId: CategoryId, subcategoryId: string, colorName: string | null, seasons: Season[] = ["all"], measurements: Garment["measurements"] = {}): Garment {
  n += 1;
  return {
    id: `g${n}`,
    categoryId,
    subcategoryId,
    brand: "B",
    productName: `${subcategoryId} ${colorName ?? ""}`,
    sizeLabel: null,
    colorName,
    seasons,
    purchasedOn: null,
    purchasePrice: null,
    productUrl: null,
    imageUrl: null,
    measurements,
    fitReview: null,
    shoeFit: null,
  };
}

const wardrobe: Garment[] = [
  g("top", "top.short_tee", "화이트"),
  g("top", "top.long_tee", "블랙"),
  g("top", "top.shirt", "라이트 블루"),
  g("top", "top.knit", "그레이", ["fall", "winter"]),
  g("top", "top.sweatshirt", "네이비"),
  g("bottom", "bottom.denim", "진청"),
  g("bottom", "bottom.slacks", "차콜"),
  g("bottom", "bottom.chino", "베이지"),
  g("outer", "outer.blouson", "카키", ["spring", "fall"]),
  g("outer", "outer.trucker", "데님", ["spring", "fall"]),
  g("outer", "outer.cardigan", "오트밀", ["spring", "fall"]),
  g("outer", "outer.long_padding", "블랙", ["winter"]),
  g("shoes", "shoes.sneakers", "화이트"),
  g("shoes", "shoes.dress", "블랙"),
  g("hat", "hat.cap", "네이비"),
];

const days = (from: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

describe("seasonOfDate", () => {
  it.each([
    ["2026-03-01", "spring"],
    ["2026-06-15", "summer"],
    ["2026-09-28", "fall"],
    ["2026-12-01", "winter"],
    ["2027-02-28", "winter"],
  ])("%s → %s", (d, s) => expect(seasonOfDate(d)).toBe(s));
});

describe("fitsSeason", () => {
  it("입력한 시즌을 따르고 사계절은 어디든 들어간다", () => {
    expect(fitsSeason(g("top", "top.knit", null, ["winter"]), "summer")).toBe(false);
    expect(fitsSeason(g("top", "top.knit", null, ["all"]), "summer")).toBe(true);
  });
  it("시즌이 비어 있으면 세부분류로 짐작한다", () => {
    expect(fitsSeason(g("outer", "outer.long_padding", null, []), "summer")).toBe(false);
    expect(fitsSeason(g("bottom", "bottom.shorts", null, []), "winter")).toBe(false);
    expect(fitsSeason(g("bottom", "bottom.denim", null, []), "winter")).toBe(true);
  });
});

describe("recommendOutfit", () => {
  it("같은 날이면 늘 같은 코디", () => {
    expect(recommendOutfit(wardrobe, "2026-09-28")).toEqual(recommendOutfit(wardrobe, "2026-09-28"));
  });

  it("상의·하의는 꼭 있고, 계절에 맞는 옷만 고르며, 분류당 하나씩 순서대로", () => {
    for (const day of days("2026-01-01", 365)) {
      const r = recommendOutfit(wardrobe, day);
      if (!r.ok) throw new Error(day);
      const cats = r.items.map((i) => i.slot);
      expect(cats).toContain("top");
      expect(cats).toContain("bottom");
      expect(new Set(cats).size).toBe(cats.length);
      expect(cats).toEqual([...cats].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)));
      for (const { garment: item } of r.items) expect(item.seasons.includes("all") || item.seasons.includes(r.season)).toBe(true);
    }
  });

  it("겨울엔 겨울 아우터를 입고, 여름엔 아우터가 거의 없다", () => {
    const winter = days("2026-12-01", 20).map((d) => recommendOutfit(wardrobe, d));
    expect(winter.every((r) => r.ok && r.items.map((p) => p.garment).some((i) => i.subcategoryId === "outer.long_padding"))).toBe(true);
    const summer = days("2026-06-01", 30).map((d) => recommendOutfit(wardrobe, d));
    expect(summer.every((r) => r.ok && !r.items.map((p) => p.garment).some((i) => i.categoryId === "outer"))).toBe(true);
  });

  it("매일 같지 않다: 이틀 연속 같은 상의·하의 짝이 나오지 않는다", () => {
    const list = days("2026-09-01", 60).map((d) => recommendOutfit(wardrobe, d));
    const key = (r: (typeof list)[number]) => (r.ok ? r.items.map((p) => p.garment).filter((i) => i.categoryId === "top" || i.categoryId === "bottom").map((i) => i.id).join() : "");
    for (let i = 1; i < list.length; i++) expect(key(list[i])).not.toBe(key(list[i - 1]));
    expect(new Set(list.map(key)).size).toBeGreaterThanOrEqual(8);
  });

  it("옷이 적어도(짝 2~6개) 어제와 같은 짝이 이어지지 않는다", () => {
    for (const bottomsCount of [1, 2, 3]) {
      const small = [g("top", "top.shirt", "화이트"), g("top", "top.knit", "그레이"), ...["진청", "차콜", "베이지"].slice(0, bottomsCount).map((c) => g("bottom", "bottom.chino", c))];
      const list = days("2026-09-01", 90).map((d) => recommendOutfit(small, d));
      const key = (r: (typeof list)[number]) => (r.ok ? r.items.map((p) => p.garment).map((i) => i.id).join() : "");
      for (let i = 1; i < list.length; i++) expect(key(list[i])).not.toBe(key(list[i - 1]));
    }
  });

  it("다른 조합 보기(variant)는 같은 날 다른 조합을 준다", () => {
    const a = recommendOutfit(wardrobe, "2026-09-28", 0);
    const b = recommendOutfit(wardrobe, "2026-09-28", 1);
    expect(a.ok && b.ok && a.items.map((p) => p.garment).map((i) => i.id).join()).not.toBe(b.ok && b.items.map((p) => p.garment).map((i) => i.id).join());
  });

  it("포인트 색이 부딪히는 조합은 잘 고르지 않는다", () => {
    const loud = [g("top", "top.short_tee", "레드"), g("top", "top.short_tee", "화이트"), g("bottom", "bottom.chino", "그린"), g("bottom", "bottom.chino", "베이지")];
    const list = days("2026-09-01", 30).map((d) => recommendOutfit(loud, d));
    const clashes = list.filter((r) => r.ok && r.items.map((p) => p.garment).some((i) => i.colorName === "레드") && r.items.map((p) => p.garment).some((i) => i.colorName === "그린"));
    expect(clashes.length).toBeLessThan(6);
  });

  it("아우터가 상의보다 작으면 겹쳐 입지 않는다", () => {
    const wide = g("top", "top.sweatshirt", "그레이", ["all"], { chest: 64, shoulder: 58 });
    const small = g("outer", "outer.blouson", "블랙", ["all"], { chest: 54, shoulder: 46 });
    const fits = g("outer", "outer.blouson", "네이비", ["all"], { chest: 68, shoulder: 60 });
    const list = days("2026-12-01", 30).map((d) => recommendOutfit([wide, small, fits, g("bottom", "bottom.denim", "진청")], d));
    const smallCount = list.filter((r) => r.ok && r.items.map((p) => p.garment).includes(small)).length;
    expect(smallCount).toBeLessThan(list.length / 3);
  });

  it("아우터로 분류한 셔츠는 상의 자리에 올 수 있다", () => {
    const shirt = g("outer", "outer.shirt", "화이트");
    const r = recommendOutfit([shirt, g("bottom", "bottom.slacks", "차콜")], "2026-09-28");
    expect(r.ok && r.items.find((i) => i.garment === shirt)?.slot).toBe("top");
    expect(r.ok && r.items.filter((i) => i.garment === shirt)).toHaveLength(1);
  });

  it("그 계절 상의나 하의가 없으면 모자란 것을 알려 준다", () => {
    const r = recommendOutfit([g("top", "top.knit", "그레이", ["winter"]), g("outer", "outer.blouson", "블랙")], "2026-07-01");
    expect(r).toEqual({ ok: false, season: "summer", missing: ["top", "bottom"] });
    expect(recommendOutfit([], "2026-09-28").ok).toBe(false);
  });
});

const ORDER: CategoryId[] = ["hat", "outer", "top", "bottom", "shoes"];

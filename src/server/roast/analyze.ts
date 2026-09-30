import "server-only";
import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { findColorFamily } from "@/lib/constants/colors";
import type { FitKind, FitLevel } from "@/lib/constants/body";
import { FOUR_SEASONS, SEASON_NAME, wearsInSeason } from "@/lib/constants/seasons";
import { computeBodyFit, type BodyProfile } from "@/lib/fit/body-fit";
import { priceInKrw } from "@/lib/format/price";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";
import { brandGroups, brandLabels, findBrand, GROUP_WORD, isTrendBrand, MUSINSA_POPULAR, type BrandGroup, type BrandInfo } from "./brands";
import { FAMILY_IDS, familyName, productFamilies, type FamilyId } from "./keywords";

/**
 * AI 옷장 분석의 계산(계획서 5장). 화면 문구는 넣지 않고 패턴(id·강도·흥미도·근거 값·관련 옷)만 만든다.
 * 문장은 lines.ts가 근거 값으로 채운다. 숫자·이름은 모두 여기서 계산한 값만 쓴다.
 */

export const ACHROMATIC = ["블랙", "그레이", "화이트"];
export const MIN_GARMENTS = 10;

/** 핏 이름(상의·하의 공통으로 부를 때) */
export const FIT_WORD: Record<FitLevel, string> = {
  too_small: "작은 핏",
  slim: "슬림",
  regular: "레귤러",
  semi_over: "세미오버",
  over: "오버",
  too_big: "큰 핏",
};

/** 분석용으로 정리한 옷 한 벌 */
export interface Item {
  g: Garment;
  id: string;
  cat: CategoryId;
  sub: string | null;
  subName: string | null;
  /** 옷에 적힌 브랜드(화면에 쓰는 이름) */
  brandLabel: string;
  brand: BrandInfo | null;
  groups: BrandGroup[];
  trend: boolean;
  families: FamilyId[];
  color: string | null;
  achromatic: boolean;
  fit: { level: FitLevel; kind: FitKind } | null;
  seasons: Season[];
  /** 원으로 바꾼 구매가 */
  price: number | null;
  date: string | null;
  hasPhoto: boolean;
  /** 모자·신발 */
  accessory: boolean;
  /** 구매 링크의 쇼핑몰(예: 무신사). 링크가 없으면 null */
  shop: string | null;
}

export type Stat = string | number;

export interface Pattern {
  id: string;
  /** 0~1: 쏠림이 얼마나 뚜렷한지 */
  strength: number;
  /** 0~1: 말할 거리로서 재미 */
  interest: number;
  stats: Record<string, Stat>;
  garmentIds: string[];
}

export interface Analysis {
  items: Item[];
  /** 모자·신발을 뺀 옷 */
  clothes: Item[];
  patterns: Pattern[];
  /** 튀는 옷(있으면) */
  /** reason: 고른 이유(드문 특성을 실제 값으로, 예: "레드 색, 셔츠라는 종류") */
  oddOne: { item: Item; traits: string[]; reason: string } | null;
  /** 구매금액 상위 브랜드(목록에 있는 브랜드만) */
  topSpendBrands: { label: string; amount: number; count: number; ids: string[] }[];
  /** 가진 브랜드(브랜드 자료 이름). 퀴즈는 이 중 문제가 있는 브랜드로 낸다. */
  brandNames: string[];
  now: Date;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** from에서 0.35, to에서 1 */
const ramp = (v: number, from: number, to: number) => clamp(0.35 + ((v - from) / Math.max(to - from, 1e-9)) * 0.65);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function countBy<T>(list: T[], key: (x: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (k == null) continue;
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}
const top = <T>(m: Map<string, T[]>) => [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
const ids = (list: Item[]) => list.map((i) => i.id);

export function prepare(garments: Garment[], body: BodyProfile | null, usdRate: number): Item[] {
  return garments
    .filter((g) => !g.held)
    .map((g) => {
      const brand = findBrand(g.brand);
      const color = findColorFamily(g.colorName);
      const accessory = g.categoryId === "hat" || g.categoryId === "shoes";
      let fit: Item["fit"] = null;
      if (!accessory) {
        if (g.userFit) fit = { level: g.userFit, kind: g.categoryId === "bottom" ? "bottom" : "top" };
        else if (body) {
          const r = computeBodyFit(g, body);
          if (r.status === "ok") fit = { level: r.level, kind: r.kind };
        }
      }
      return {
        g,
        id: g.id,
        cat: g.categoryId,
        sub: g.subcategoryId,
        subName: g.subcategoryId ? (SUBCATEGORY_NAME[g.subcategoryId] ?? null) : null,
        brandLabel: g.brand.trim(),
        brand,
        groups: brand ? brandGroups(brand) : [],
        trend: brand ? isTrendBrand(brand) : false,
        families: productFamilies(g.productName),
        color,
        achromatic: color != null && ACHROMATIC.includes(color),
        fit,
        seasons: g.seasons,
        price: priceInKrw(g.purchasePrice, g.currency, usdRate),
        date: g.purchasedOn,
        hasPhoto: Boolean(g.thumbUrl || g.imageUrl),
        accessory,
        shop: shopOf(g.productUrl),
      };
    });
}

/** 쇼핑몰 주소 → 이름. 목록에 없으면 주소의 이름 부분(예: example.com → example) */
const SHOPS: [RegExp, string][] = [
  [/(^|\.)musinsa\.com$/, "무신사"],
  [/(^|\.)29cm\.co\.kr$/, "29CM"],
  [/(^|\.)wconcept\.co\.kr$/, "W컨셉"],
  [/(^|\.)ssfshop\.com$/, "SSF샵"],
  [/(^|\.)kream\.co\.kr$/, "KREAM"],
  [/(^|\.)ably\.co\.kr$|(^|\.)a-bly\.com$/, "에이블리"],
  [/(^|\.)zigzag\.kr$/, "지그재그"],
  [/(^|\.)coupang\.com$/, "쿠팡"],
  [/(^|\.)hfashionmall\.com$/, "더한섬닷컴"],
  [/(^|\.)lotteon\.com$/, "롯데온"],
  [/(^|\.)ssg\.com$/, "SSG"],
  [/(^|\.)ssense\.com$/, "SSENSE"],
  [/(^|\.)mrporter\.com$/, "MR PORTER"],
  [/(^|\.)farfetch\.com$/, "파페치"],
  [/(^|\.)matchesfashion\.com$|(^|\.)matches\.com$/, "매치스"],
  [/(^|\.)endclothing\.com$/, "END."],
  [/(^|\.)uniqlo\.com$/, "유니클로"],
  [/(^|\.)zara\.com$/, "자라"],
  [/(^|\.)cos\.com$/, "COS"],
  [/(^|\.)nike\.com$/, "나이키"],
];

export function shopOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, "");
  } catch {
    return null;
  }
  const hit = SHOPS.find(([re]) => re.test(host));
  if (hit) return hit[1];
  const parts = host.split(".");
  // example.co.kr → example, shop.example.com → example
  const main = parts.length >= 3 && /^(co|or|ac|go)$/.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
  return main || null;
}

/** 같은 옷인지 볼 때 제품명(띄어쓰기·기호·대소문자 무시) */
const sameName = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

/** 한 브랜드(자료 기준)의 옷들에서 가장 많이 쓴 표기를 이름으로 쓴다. */
const labelOf = (list: Item[]) => top(countBy(list, (i) => i.brandLabel || i.brand?.name))?.[0] ?? list[0].brand!.name;

export const GROUP_THRESHOLD: Record<BrandGroup, number> = {
  luxury: 0.12,
  designer: 0.2,
  jp_denim: 0.12,
  contemporary: 0.3,
  premium_casual: 0.35,
  specialist: 0.3,
  heritage: 0.3,
  street: 0.3,
  sports: 0.25,
  outdoor: 0.25,
  mass: 0.35,
};

const dayKey = (d: Date) => {
  const k = new Date(d.getTime() + 9 * 3_600_000); // 한국 날짜
  return k.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

export function analyze(garments: Garment[], body: BodyProfile | null, usdRate: number, now = new Date()): Analysis {
  const items = prepare(garments, body, usdRate);
  const clothes = items.filter((i) => !i.accessory);
  const P: Pattern[] = [];
  const add = (id: string, strength: number, interest: number, stats: Record<string, Stat>, list: Item[]) =>
    P.push({ id, strength: clamp(strength), interest: clamp(interest), stats, garmentIds: ids(list) });

  const N = clothes.length;
  const all = items.length;

  // 옷장 크기와 구성 ---------------------------------------------------------
  if (N < 20) add("count_small", 0.5, 0.35, { n: N }, []);
  else if (N >= 100) add("count_huge", ramp(N, 100, 200), 0.7, { n: N }, []);
  else if (N >= 60) add("count_many", ramp(N, 60, 100), 0.55, { n: N }, []);

  const byCat = countBy(clothes, (i) => i.cat);
  const [cat, catList] = top(byCat) ?? [null, []];
  if (cat && catList.length / N >= 0.5)
    add("category_bias", ramp(catList.length / N, 0.5, 0.8), 0.5, { cat, n: catList.length, pct: pct(catList.length, N) }, catList);

  const bySub = countBy(clothes, (i) => i.sub);
  const [sub, subList] = top(bySub) ?? [null, []];
  if (sub && subList.length >= 4 && subList.length / N >= 0.2)
    add("subcategory_bias", ramp(subList.length / N, 0.2, 0.45), 0.7, { sub: subList[0].subName ?? "옷", n: subList.length, pct: pct(subList.length, N) }, subList);

  // 모자·신발 -------------------------------------------------------------------
  const shoes = items.filter((i) => i.cat === "shoes");
  const hats = items.filter((i) => i.cat === "hat");
  if (shoes.length >= 8) add("shoes_many", ramp(shoes.length, 8, 20), 0.7, { n: shoes.length }, shoes);
  if (hats.length >= 5) add("hats_many", ramp(hats.length, 5, 12), 0.7, { n: hats.length }, hats);
  const [, shoeSubList] = top(countBy(shoes, (i) => i.sub)) ?? [null, []];
  if (shoes.length >= 5 && shoeSubList.length >= 4 && shoeSubList.length / shoes.length >= 0.6)
    add("shoe_sub_bias", ramp(shoeSubList.length / shoes.length, 0.6, 1), 0.65, { sub: shoeSubList[0].subName ?? "신발", n: shoeSubList.length, total: shoes.length }, shoeSubList);
  const [, hatSubList] = top(countBy(hats, (i) => i.sub)) ?? [null, []];
  if (hats.length >= 4 && hatSubList.length >= 3 && hatSubList.length / hats.length >= 0.6)
    add("hat_sub_bias", ramp(hatSubList.length / hats.length, 0.6, 1), 0.6, { sub: hatSubList[0].subName ?? "모자", n: hatSubList.length, total: hats.length }, hatSubList);

  // 컬러 ---------------------------------------------------------------------
  const colored = items.filter((i) => i.color);
  const C = colored.length;
  if (C >= 5) {
    const black = colored.filter((i) => i.color === "블랙");
    const achro = colored.filter((i) => i.achromatic);
    if (black.length / C >= 0.35) add("black_bias", ramp(black.length / C, 0.35, 0.7), 0.8, { n: black.length, pct: pct(black.length, C) }, black);
    if (achro.length / C >= 0.6) add("achromatic_bias", ramp(achro.length / C, 0.6, 0.9), 0.75, { n: achro.length, pct: pct(achro.length, C), colorful: C - achro.length }, achro);
    const [chroma, chromaList] = top(countBy(colored.filter((i) => !i.achromatic), (i) => i.color)) ?? [null, []];
    if (chroma && chromaList.length / C >= 0.25)
      add("chroma_bias", ramp(chromaList.length / C, 0.25, 0.5), 0.75, { color: chroma, n: chromaList.length, pct: pct(chromaList.length, C) }, chromaList);
  }

  // 브랜드(목록에 없는 소규모 브랜드는 쓰지 않는다) ------------------------------
  const known = items.filter((i) => i.brand);
  const K = known.length;
  const byBrand = countBy(known, (i) => i.brand!.name);
  const [, brandList] = top(byBrand) ?? [null, []];
  if (brandList.length >= 4 && brandList.length / all >= 0.15)
    add("brand_focus", ramp(brandList.length / all, 0.15, 0.4), 0.85, { brand: labelOf(brandList), n: brandList.length, pct: pct(brandList.length, all) }, brandList);

  const groupHits = (Object.keys(GROUP_THRESHOLD) as BrandGroup[])
    .map((grp) => {
      const list = known.filter((i) => i.groups.includes(grp));
      return { grp, list, share: list.length / all };
    })
    .filter((x) => x.list.length >= 3 && x.share >= GROUP_THRESHOLD[x.grp])
    .sort((a, b) => b.share / GROUP_THRESHOLD[b.grp] - a.share / GROUP_THRESHOLD[a.grp]);
  for (const { grp, list, share } of groupHits.slice(0, 2)) {
    const t = GROUP_THRESHOLD[grp];
    const brandsIn = [...countBy(list, (i) => i.brand!.name).values()].sort((a, b) => b.length - a.length);
    add(`group_${grp}`, ramp(share, t, Math.min(t * 2.5, 0.9)), grp === "luxury" || grp === "designer" ? 0.85 : 0.7, {
      n: list.length,
      pct: pct(list.length, all),
      brands: brandsIn.length,
      brand: labelOf(brandsIn[0]),
    }, list);
  }

  const trendy = known.filter((i) => i.trend);
  if (trendy.length >= 3 && trendy.length / all >= 0.2) {
    const brandsIn = [...countBy(trendy, (i) => i.brand!.name).values()].sort((a, b) => b.length - a.length);
    add("trend_brands", ramp(trendy.length / all, 0.2, 0.5), 0.8, { n: trendy.length, pct: pct(trendy.length, all), brand: labelOf(brandsIn[0]), brands: brandsIn.length }, trendy);
  }

  if (K >= 5) {
    const [country, cList] = top(countBy(known, (i) => i.brand!.country)) ?? [null, []];
    if (country && cList.length / K >= 0.6) add("country_bias", ramp(cList.length / K, 0.6, 0.95), 0.55, { country, n: cList.length, pct: pct(cList.length, K) }, cList);

    const avg = (f: (b: BrandInfo) => number) => known.reduce((a, i) => a + f(i.brand!), 0) / K;
    const traits: [string, number, boolean, number, number][] = [
      // id, 평균, 조건, ramp 시작, ramp 끝
      ["trait_hype", avg((b) => b.hype), avg((b) => b.hype) >= 3.5, 3.5, 4.5],
      ["trait_trendy", avg((b) => b.trend), avg((b) => b.trend) >= 3.8, 3.8, 4.6],
      ["trait_timeless", avg((b) => b.trend), avg((b) => b.trend) <= 1.9, -1.9, -1.2],
      ["trait_functional", avg((b) => b.func), avg((b) => b.func) >= 3.5, 3.5, 4.6],
      ["trait_niche", avg((b) => b.pop), avg((b) => b.pop) <= 2.5, -2.5, -1.5],
      ["trait_mainstream", avg((b) => b.pop), avg((b) => b.pop) >= 4.5, 4.5, 5],
      ["trait_formal", avg((b) => b.formal), avg((b) => b.formal) >= 3.5, 3.5, 4.5],
      ["trait_casual", avg((b) => b.formal), avg((b) => b.formal) <= 1.6, -1.6, -1.1],
      ["trait_heritage", avg((b) => b.heritage), avg((b) => b.heritage) >= 3.8, 3.8, 4.8],
      ["trait_pricey", avg((b) => b.price), avg((b) => b.price) >= 4.8, 4.8, 5.8],
    ];
    for (const [id, value, ok, from, to] of traits) {
      if (!ok) continue;
      const v = from < 0 ? -value : value;
      add(id, ramp(v, from, to), 0.55, { avg: Math.round(value * 10) / 10, n: K }, known);
    }

    const [tag, tagList] = top(countBy(known.flatMap((i) => i.brand!.tags.map((t) => ({ t, i }))), (x) => x.t)) ?? [null, []];
    if (tag && tagList.length / K >= 0.4) {
      const list = tagList.map((x) => x.i);
      add("tag_bias", ramp(list.length / K, 0.4, 0.8), 0.7, { tag, n: list.length, pct: pct(list.length, K) }, list);
    }

    // 브랜드는 제각각인데 결국 비슷함
    const brandCount = byBrand.size;
    if (brandCount >= 8 && brandCount >= K / 2) {
      const achroShare = C ? colored.filter((i) => i.achromatic).length / C : 0;
      const fitTop = fitted0(clothes);
      const tagShare = tag ? tagList.length / K : 0;
      if (achroShare >= 0.65) add("same_color", ramp(achroShare, 0.65, 0.9), 0.85, { brands: brandCount, pct: pct(achroShare * 100, 100) }, colored.filter((i) => i.achromatic));
      else if (fitTop && fitTop.share >= 0.6) add("same_fit", ramp(fitTop.share, 0.6, 0.9), 0.8, { brands: brandCount, fit: FIT_WORD[fitTop.level], pct: Math.round(fitTop.share * 100) }, fitTop.list);
      else if (tag && tagShare >= 0.6) add("same_tag", ramp(tagShare, 0.6, 0.9), 0.8, { brands: brandCount, tag, pct: Math.round(tagShare * 100) }, tagList.map((x) => x.i));
    }

    const dated = known.filter((i) => i.brand!.founded != null);
    const old = dated.filter((i) => now.getFullYear() - i.brand!.founded! >= 50);
    if (dated.length >= 5 && old.length / dated.length >= 0.6) {
      const oldest = old.slice().sort((a, b) => a.brand!.founded! - b.brand!.founded!)[0];
      add("old_brands", ramp(old.length / dated.length, 0.6, 0.95), 0.6, { n: old.length, pct: pct(old.length, dated.length), oldest: labelOf([oldest]), year: oldest.brand!.founded! }, old);
    }
  }

  // 구매처 -------------------------------------------------------------------
  const linked = items.filter((i) => i.shop);
  if (linked.length >= 5) {
    const musinsa = linked.filter((i) => i.shop === "무신사");
    // 한국 대중 브랜드이거나 무신사 인기 태그가 붙은 브랜드
    const branded = items.filter((i) => i.brand || brandLabels(i.g.brand).length);
    const krPopular = branded.filter((i) => (i.brand?.country === "한국" && i.brand.pop >= 4) || brandLabels(i.g.brand).includes(MUSINSA_POPULAR));
    const musinsaKr = musinsa.length >= 4 && musinsa.length / linked.length >= 0.5 && krPopular.length >= 4 && krPopular.length / Math.max(branded.length, 1) >= 0.4;
    if (musinsaKr) {
      // 읊어 줄 브랜드: 무신사 인기 태그를 먼저, 오래된 브랜드보다 요즘 뜨는 브랜드를 먼저, 세 개까지
      const rank = (i: Item) => (brandLabels(i.g.brand).includes(MUSINSA_POPULAR) ? 0 : 10) + (i.brand ? i.brand.heritage - i.brand.trend : 0);
      const names = [...new Set(krPopular.slice().sort((x, y) => rank(x) - rank(y)).map((i) => i.brandLabel || i.brand?.name || ""))].filter(Boolean).slice(0, 3);
      add("musinsa_kr", ramp(musinsa.length / linked.length, 0.5, 0.9), 0.9, { n: musinsa.length, pct: pct(musinsa.length, linked.length), krN: krPopular.length, krPct: pct(krPopular.length, branded.length), names: names.join(", ") }, [...new Set([...musinsa, ...krPopular])]);
    }
    const [shop, shopList] = top(countBy(linked, (i) => i.shop)) ?? [null, []];
    if (shop && shopList.length >= 4 && shopList.length / linked.length >= 0.6 && !(musinsaKr && shop === "무신사"))
      add("shop_focus", ramp(shopList.length / linked.length, 0.6, 0.95), 0.7, { shop, n: shopList.length, pct: pct(shopList.length, linked.length) }, shopList);
  }

  // 반복 ---------------------------------------------------------------------
  // 이름·색까지 같은 옷(같은 옷을 여러 벌)
  const twins = countBy(items.filter((i) => i.color && sameName(i.g.productName).length >= 2), (i) => `${i.cat}|${sameName(i.g.productName)}|${i.color}`);
  const [twinKey, twinList] = top(twins) ?? [null, []];
  if (twinKey && twinList.length >= 3)
    add("identical_items", ramp(twinList.length, 3, 6), 0.95, { name: twinList[0].g.productName, color: twinList[0].color!, n: twinList.length }, twinList);

  const fitted = clothes.filter((i) => i.fit && i.fit.level !== "too_small" && i.fit.level !== "too_big");
  const combos = countBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}|${i.fit?.level ?? "-"}`);
  const [comboKey, comboList] = top(combos) ?? [null, []];
  if (comboKey && comboList.length >= 3) {
    const f = comboList[0].fit;
    add("combo_repeat", ramp(comboList.length, 3, 7), 0.9, {
      sub: comboList[0].subName ?? "옷",
      color: comboList[0].color!,
      fit: f ? FIT_WORD[f.level] : "",
      n: comboList.length,
    }, comboList);
  }

  const famCounts = FAMILY_IDS.map((id) => ({ id, list: clothes.filter((i) => i.families.includes(id)) })).sort((a, b) => b.list.length - a.list.length);
  const fam = famCounts[0];
  if (fam && fam.list.length >= 3) add("family_repeat", ramp(fam.list.length, 3, 8), 0.8, { family: fam.id, n: fam.list.length }, fam.list);

  let bestCluster: Item[] = [];
  for (const [, list] of bySub) {
    const m = list.filter((i) => i.g.measurements.length != null && i.g.measurements.chest != null);
    for (const a of m) {
      const near = m.filter(
        (b) => Math.abs(b.g.measurements.length! - a.g.measurements.length!) <= 2 && Math.abs(b.g.measurements.chest! - a.g.measurements.chest!) <= 2,
      );
      if (near.length > bestCluster.length) bestCluster = near;
    }
  }
  if (bestCluster.length >= 3)
    add("measure_repeat", ramp(bestCluster.length, 3, 6), 0.75, { sub: bestCluster[0].subName ?? "옷", n: bestCluster.length }, bestCluster);

  if (fitted.length >= 5) {
    const [lv, lvList] = top(countBy(fitted, (i) => i.fit!.level)) ?? [null, []];
    if (lv && lvList.length / fitted.length >= 0.5)
      add("fit_bias", ramp(lvList.length / fitted.length, 0.5, 0.9), 0.65, { fit: FIT_WORD[lv as FitLevel], level: lv, n: lvList.length, pct: pct(lvList.length, fitted.length) }, lvList);
  }

  // 시즌 ---------------------------------------------------------------------
  const seasoned = items.filter((i) => i.seasons.length);
  if (seasoned.length >= 5) {
    const counts = FOUR_SEASONS.map((s) => ({ id: s.id, name: s.name, n: seasoned.filter((i) => wearsInSeason(i.seasons, s.id)).length })).sort((a, b) => b.n - a.n);
    const most = counts[0];
    const least = counts[counts.length - 1];
    if (most.n >= 3 && most.n >= least.n * 1.8)
      add("season_bias", ramp(least.n ? most.n / least.n : 4, 1.8, 4), 0.6, { most: most.name, mostN: most.n, least: least.name, leastN: least.n }, seasoned.filter((i) => wearsInSeason(i.seasons, most.id as Season)));
  }

  // 구매 시기 ------------------------------------------------------------------
  const today = dayKey(now);
  const withDate = items.filter((i) => i.date && i.date <= today);
  if (withDate.length >= 5) {
    const r30 = withDate.filter((i) => daysBetween(i.date!, today) <= 30);
    const r90 = withDate.filter((i) => daysBetween(i.date!, today) <= 90);
    if (r30.length >= 3) add("recent_30", ramp(r30.length, 3, 8), 0.85, { n: r30.length }, r30);
    else if (r90.length >= 5) add("recent_90", ramp(r90.length, 5, 12), 0.7, { n: r90.length }, r90);

    // 연도와 상관없이 같은 달(예: 9월)에 몰아 산 옷. 기록한 기간이 1년이 안 되면 그 기간의 달 수로 평균을 낸다.
    const byMonth = countBy(withDate, (i) => String(Number(i.date!.slice(5, 7))));
    const months = [...new Set(withDate.map((i) => i.date!.slice(0, 7)))].sort();
    const span = Math.min(12, monthIndex(months[months.length - 1]) - monthIndex(months[0]) + 1);
    const avg = withDate.length / span;
    const [m, mList] = top(byMonth) ?? [null, []];
    if (m && mList.length >= 4 && mList.length >= avg * 2)
      add("month_binge", ramp(mList.length / avg, 2, 6), 0.85, { month: Number(m), n: mList.length }, mList);
  }

  // 금액 ---------------------------------------------------------------------
  const priced = items.filter((i) => i.price != null && i.price > 0);
  const topSpendBrands = [...countBy(priced.filter((i) => i.brand), (i) => i.brand!.name).values()]
    .map((list) => ({ label: labelOf(list), amount: list.reduce((a, i) => a + i.price!, 0), count: items.filter((i) => i.brand === list[0].brand).length, ids: ids(list) }))
    .sort((a, b) => b.amount - a.amount);
  if (priced.length >= 5) {
    const total = priced.reduce((a, i) => a + i.price!, 0);
    const avg = total / priced.length;
    if (avg >= 80_000) add("avg_price", ramp(avg, 80_000, 400_000), 0.8, { avg: Math.round(avg), n: priced.length }, []);
    const sorted = priced.map((i) => i.price!).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = priced.slice().sort((a, b) => b.price! - a.price!)[0];
    if (max.price! >= median * 3)
      add("top_item", ramp(max.price! / median, 3, 10), 0.75, { price: max.price!, ratio: Math.round((max.price! / median) * 10) / 10, brand: max.brandLabel, name: max.g.productName }, [max]);

    const catSpend = [...countBy(priced, (i) => i.cat)].map(([c, list]) => ({
      c,
      list,
      spend: list.reduce((a, i) => a + i.price!, 0) / total,
      count: list.length / priced.length,
    }));
    const over = catSpend.sort((a, b) => b.spend - b.count - (a.spend - a.count))[0];
    if (over && over.spend - over.count >= 0.15)
      add("category_spend", ramp(over.spend - over.count, 0.15, 0.4), 0.6, { cat: over.c, spendPct: Math.round(over.spend * 100), countPct: Math.round(over.count * 100) }, over.list);

    const subSpend = [...countBy(priced, (i) => i.sub)]
      .map(([, list]) => ({ list, amount: list.reduce((a, i) => a + i.price!, 0) }))
      .sort((a, b) => b.amount - a.amount)[0];
    if (subSpend && subSpend.list.length >= 3 && subSpend.amount >= 500_000 && subSpend.amount / total >= 0.25)
      add("subcategory_spend", ramp(subSpend.amount / total, 0.25, 0.6), 0.75, {
        sub: subSpend.list[0].subName ?? "옷",
        n: subSpend.list.length,
        amount: subSpend.amount,
        pct: pct(subSpend.amount, total),
      }, subSpend.list);

    const b1 = topSpendBrands[0];
    if (b1 && b1.amount / total >= 0.3) add("brand_spend", ramp(b1.amount / total, 0.3, 0.7), 0.75, { brand: b1.label, pct: pct(b1.amount, total), amount: b1.amount }, items.filter((i) => b1.ids.includes(i.id)));

    const sale = priced.filter((i) => i.brand && i.brand.price >= 6 && i.price! < 300_000);
    if (sale.length >= 2) add("sale_luxury", ramp(sale.length, 2, 5), 0.8, { n: sale.length, brand: labelOf(sale) }, sale);
    const splurge = priced.filter((i) => i.brand && i.brand.price <= 2 && i.price! >= 300_000).sort((a, b) => b.price! - a.price!);
    if (splurge.length) add("cheap_brand_splurge", 0.6, 0.8, { brand: splurge[0].brandLabel, price: splurge[0].price!, name: splurge[0].g.productName }, splurge.slice(0, 1));
  }

  // 유독 튀는 옷 ----------------------------------------------------------------
  const oddOne = findOddOne(clothes, colored.length ? colored.filter((i) => i.achromatic).length / colored.length : 0);
  if (oddOne) add("odd_one", ramp(oddOne.traits.length, 2, 4), 0.9, { brand: oddOne.item.brandLabel, name: oddOne.item.g.productName, traits: oddOne.traits.join(",") }, [oddOne.item]);

  const brandNames = [...new Set(known.map((i) => i.brand!.name))];

  return { items, clothes, patterns: P, oddOne, topSpendBrands, brandNames, now };
}

/** 핏을 아는 옷이 5벌 이상일 때 가장 많은 핏 */
function fitted0(clothes: Item[]) {
  const fitted = clothes.filter((i) => i.fit && i.fit.level !== "too_small" && i.fit.level !== "too_big");
  if (fitted.length < 5) return null;
  const [level, list] = top(countBy(fitted, (i) => i.fit!.level))!;
  return { level: level as FitLevel, list, share: list.length / fitted.length };
}

/** 옷장 안에서 같은 값인 옷이 12% 이하인 특성이 2개 이상이면 튀는 옷(계획서 5-4). */
/** 튀는 옷을 고른 이유: 드문 특성을 실제 값으로 적는다. */
function oddReason(i: Item, traits: string[], famCount: Map<FamilyId, number>, n: number): string {
  const c = (w: string) => w.charCodeAt(w.length - 1) - 0xac00;
  const rara = (w: string) => `${w}${c(w) >= 0 && c(w) < 11172 && c(w) % 28 ? "이라는" : "라는"}`;
  const part: Record<string, () => string | null> = {
    color: () => (i.color ? `${i.color} 색` : null),
    sub: () => (i.subName ? `${rara(i.subName)} 종류` : null),
    group: () => (i.groups[0] ? `${rara(GROUP_WORD[i.groups[0]])} 브랜드 결` : null),
    fit: () => (i.fit ? `${FIT_WORD[i.fit.level]} 핏` : null),
    season: () => (i.seasons.length ? `${i.seasons.map((x) => SEASON_NAME[x]).join("·")}에만 입는 계절` : null),
    family: () => {
      const f = i.families.find((x) => (famCount.get(x) ?? 0) / n <= 0.12);
      return f ? `${familyName(f)} 디자인` : null;
    },
  };
  return traits.map((t) => part[t]?.()).filter(Boolean).join(", ");
}

function findOddOne(clothes: Item[], achromaticShare: number): Analysis["oddOne"] {
  if (clothes.length < 8) return null;
  const n = clothes.length;
  const rare = (list: Item[], key: (i: Item) => string | null) => {
    const m = countBy(list, key);
    return (i: Item) => {
      const k = key(i);
      return k != null && (m.get(k)?.length ?? 0) / n <= 0.12;
    };
  };
  const checks: [string, (i: Item) => boolean][] = [
    ["color", rare(clothes, (i) => i.color)],
    ["group", rare(clothes, (i) => i.groups[0] ?? null)],
    ["sub", rare(clothes, (i) => i.sub)],
    ["fit", rare(clothes, (i) => i.fit?.level ?? null)],
    ["season", rare(clothes, (i) => (i.seasons.length ? [...i.seasons].sort().join(",") : null))],
  ];
  const famCount = new Map<FamilyId, number>();
  for (const i of clothes) for (const f of i.families) famCount.set(f, (famCount.get(f) ?? 0) + 1);

  let best: Analysis["oddOne"] = null;
  let bestScore = 0;
  for (const i of clothes) {
    const traits = checks.filter(([, f]) => f(i)).map(([k]) => k);
    if (i.families.some((f) => (famCount.get(f) ?? 0) / n <= 0.12)) traits.push("family");
    if (traits.length < 2) continue;
    const score = traits.length + (achromaticShare >= 0.6 && i.color && !i.achromatic ? 1 : 0) + (i.hasPhoto ? 0.1 : 0);
    if (score > bestScore) {
      best = { item: i, traits, reason: oddReason(i, traits, famCount, n) };
      bestScore = score;
    }
  }
  return best;
}

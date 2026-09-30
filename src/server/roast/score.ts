import "server-only";
import { FOUR_SEASONS, wearsInSeason } from "@/lib/constants/seasons";
import { colorCounted, type Analysis, type Item } from "./analyze";
import { brandLabels, MUSINSA_POPULAR } from "./brands";
import { AGE_BANDS, AGE_RULES, SCORE_RULES, type ScoreRules } from "./score-deltas";

/**
 * 총 옷장 점수의 옷장 부분("얼마나 힙한가", 계획서 /mnt/project-files/roast/score-plan.md).
 * 질문·퀴즈 답의 증감은 여기서 더하지 않는다(report.ts). 마지막 질문의 점수 구간도 이 값으로 정한다.
 */

const DAY = 86_400_000;
const MONTH_MS = 30.44 * DAY;

export interface ScorePart {
  id: string;
  delta: number;
}

export interface WardrobeScore {
  /** 옷장 점수(자르기 전) */
  score: number;
  parts: ScorePart[];
  /** 나이 기준에서 가장 크게 걸린 것(결과 한마디용) */
  age: { kind: "street" | "musinsa" | "mature" | "formal" | "lux" | "young_street"; pct: number; age: number } | null;
}

export interface ScoreOptions {
  /** 지금 나이(모르면 null: 나이 기준은 건너뜀) */
  age: number | null;
  /** 무신사 링크 질문에서 "링크만 무신사인 게 많음"을 골랐으면 무신사 관련 감점을 절반으로 */
  musinsaLinkOnly?: boolean;
  rules?: Partial<ScoreRules>;
  ageRules?: Record<string, Record<string, number>>;
}

const isMusinsa = (i: Item) => brandLabels(i.g.brand).includes(MUSINSA_POPULAR) && !i.groups.includes("mass");
const isDesigner = (i: Item) => i.groups.some((g) => g === "designer" || g === "luxury" || g === "contemporary");
const isStreet = (i: Item) => i.groups.includes("street") || (i.brand?.hype ?? 0) >= 4;
const isMature = (i: Item) => i.groups.includes("contemporary") || (i.brand?.heritage ?? 0) >= 4 || (i.brand?.formal ?? 0) >= 3.5;
const isFormalLux = (i: Item) => i.groups.includes("luxury") || (i.brand?.formal ?? 0) >= 3.5;
const isRepro = (i: Item) => i.groups.includes("jp_denim") || /levi'?s vintage|lvc/i.test(`${i.brand?.name ?? ""} ${i.brandLabel}`);
const isLogo = (i: Item) => /로고|logo/i.test(i.g.productName);
const monthIndex = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 12 + d.getMonth();
};

export function scoreWardrobe(a: Analysis, opts: ScoreOptions): WardrobeScore {
  const R = { ...SCORE_RULES, ...(opts.rules ?? {}) };
  const AR = opts.ageRules ?? AGE_RULES;
  const now = a.now.getTime();
  const items = a.items;
  const clothes = a.clothes;
  const parts: ScorePart[] = [];
  const add = (id: string, delta: number) => {
    const d = Math.round(delta * 10) / 10;
    if (d) parts.push({ id, delta: d });
  };
  const share = (list: Item[], f: (i: Item) => boolean) => (list.length ? list.filter(f).length / list.length : 0);
  const upTo = (s: number, fullPct: number, max: number) => Math.min(max, (s * 100 * max) / Math.max(fullPct, 1));
  const over = (s: number, fromPct: number, per10: number, max: number) => Math.min(max, (Math.max(0, s * 100 - fromPct) / 10) * per10);
  const musinsaFactor = opts.musinsaLinkOnly ? 0.5 : 1;

  const known = items.filter((i) => i.brand);
  const enough = known.length >= 5;
  const named = items.filter((i) => i.brandKind === "known" || i.brandKind === "unknown");
  const tags = new Map<string, number>();
  for (const i of known) for (const t of new Set(i.brand!.tags)) tags.set(t, (tags.get(t) ?? 0) + 1);
  const tagRank = [...tags.entries()].sort((x, y) => y[1] - x[1]);
  const styleTop = enough && tagRank.length ? tagRank[0][1] / known.length : 0;
  const byBrand = new Map<string, Item[]>();
  for (const i of named) {
    const k = i.brand?.name ?? i.brandLabel.toLowerCase();
    byBrand.set(k, [...(byBrand.get(k) ?? []), i]);
  }

  // 1. 더하는 점수 ------------------------------------------------------------
  add("designer", Math.min(R.designer_max, known.filter(isDesigner).length * R.designer_each));
  if (enough) {
    add("niche", upTo(share(known, (i) => i.brand!.pop <= 2), R.niche_full, R.niche_max));
    add("style", styleTop * 100 >= R.style_high_pct ? R.style_high : styleTop * 100 >= R.style_mid_pct ? R.style_mid : 0);
    const tasteList = [...known, ...items.filter((i) => i.brandKind === "vintage")];
    add(
      "taste",
      upTo(
        share(tasteList, (i) => i.brandKind === "vintage" || i.groups.includes("jp_denim") || (i.brand?.heritage ?? 0) >= 4 || (i.brand?.tags ?? []).some((t) => /워크웨어|빈티지|아메카지/.test(t))),
        R.taste_full,
        R.taste_max,
      ),
    );
  }
  if (items.filter((i) => i.shop === "후르츠패밀리").length >= R.fruits_n) add("fruits", R.fruits);

  // 색: 데님은 빼고 본다. 기본색 = 무채색
  const colored = items.filter(colorCounted);
  const basic = share(colored, (i) => i.achromatic);
  const accentN = colored.filter((i) => !i.achromatic).length;
  const luxN = known.filter((i) => isDesigner(i) || i.brand!.heritage >= 4).length;
  if (colored.length >= 5) {
    if (basic * 100 >= R.accent_basic_pct && accentN >= 1 && accentN <= R.accent_max_n) add("accent", R.accent);
    if (basic * 100 >= R.basic_pct && luxN >= R.basic_lux_n) add("basic_lux", R.basic_lux);
    if (basic * 100 >= R.basic_pct && luxN === 0 && enough && share(known, (i) => i.groups.includes("mass")) * 100 >= R.basic_mass_pct) add("basic_mass", -R.basic_mass);
  }

  // 구매 시기: 구매일을 적은 옷 8벌 이상일 때만
  const dated = items.filter((i) => i.date && Date.parse(i.date) <= now);
  if (dated.length >= 8) {
    const nowM = monthIndex(now);
    const months = new Set(dated.map((i) => monthIndex(Date.parse(i.date!))));
    // 구매 공백: 최근 24개월(첫 구매 이후) 중 한 벌도 안 산 달이 연속 gap_months 이상이면 그 개월 수만큼
    const first = Math.max(nowM - 23, Math.min(...months));
    let run = 0;
    let gap = 0;
    for (let m = first; m <= nowM; m++) {
      if (months.has(m)) {
        if (run >= R.gap_months) gap += run;
        run = 0;
      } else run++;
    }
    if (run >= R.gap_months) gap += run;
    add("gap", -Math.min(R.gap_max, gap));
    // 꾸준한 구매: 최근 12개월 동안 연속으로 안 산 달이 steady_gap 미만
    let longest = 0;
    run = 0;
    for (let m = nowM - 11; m <= nowM; m++) {
      run = months.has(m) ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    if (longest < R.steady_gap) add("steady", R.steady);
  }
  // 소비액: 구매일·가격을 모두 적은 옷 8벌 이상일 때, 최근 12개월 합계 / 4
  const datedPriced = dated.filter((i) => i.price != null && i.price > 0);
  if (datedPriced.length >= 8) {
    const quarter = datedPriced.filter((i) => now - Date.parse(i.date!) <= 365 * DAY).reduce((s, i) => s + i.price!, 0) / 4 / 10_000;
    add("spend", quarter >= R.spend_top_won ? R.spend_top : quarter >= R.spend_a_won ? -R.spend_a : quarter >= R.spend_b_won ? -R.spend_b : -R.spend_c);
  }

  const outers = clothes.filter((i) => i.cat === "outer");
  if (outers.some((i) => i.groups.includes("designer") || i.groups.includes("luxury") || (i.brand?.heritage ?? 0) >= 4)) add("good_outer", R.good_outer);
  const shoes = items.filter((i) => i.cat === "shoes");
  if (shoes.some((i) => i.sub === "shoes.dress" || i.sub === "shoes.boots")) add("leather_shoes", R.leather_shoes);
  const shoeSubs = new Set(shoes.map((i) => i.sub));
  if (["shoes.sneakers", "shoes.sports", "shoes.dress", "shoes.boots", "shoes.sandals"].every((s) => shoeSubs.has(s))) add("shoe_set", R.shoe_set);
  if (shoes.length >= 3 && shoes.every((i) => i.sub === "shoes.sneakers" || i.sub === "shoes.sports")) add("sneakers_only", -R.sneakers_only);

  const krNew = known.filter((i) => i.brand!.country === "한국" && (i.brand!.founded ?? 0) >= R.kr_new_year && isDesigner(i) && i.brand!.pop <= 2);
  if (krNew.length >= R.kr_new_n) add("kr_new", R.kr_new);
  if (known.filter((i) => i.brand!.country === "일본").length >= R.jp_n) add("jp", R.jp);
  const repro = items.filter(isRepro).length;
  if (repro) add("repro", repro >= R.repro_many_n ? R.repro_many : R.repro);
  if (enough && share(known, (i) => i.brand!.country !== "한국" && !i.groups.includes("mass")) * 100 >= R.foreign_pct) add("foreign", R.foreign);
  if (items.some((i) => (i.price ?? 0) >= R.bold_won * 10_000)) add("bold", R.bold);
  const regulars = [...byBrand.values()].filter((l) => l.length >= 2 && l.length <= 4 && !isMusinsa(l[0]) && !l[0].groups.includes("mass"));
  if (regulars.length >= R.regular_n) add("regular", R.regular);

  // 2. 빼는 점수 --------------------------------------------------------------
  if (enough) {
    add("mass", -over(share(known, (i) => i.groups.includes("mass")), R.mass_from, R.mass_per10, R.mass_max));
    if (share(known, (i) => i.brand!.hype >= 4 && i.brand!.pop >= 4) * 100 >= R.trendy_pct) add("trendy", -R.trendy);
    if (styleTop * 100 < R.scattered_pct && named.length >= 8 && byBrand.size / named.length >= 0.7) add("scattered", -R.scattered);
    // 스타일 모르고 산 명품: 디자이너·럭셔리가 1~2벌뿐인데 그 스타일이 나머지 옷의 주력 스타일(상위 2개)과 안 겹침
    const lux = known.filter((i) => i.groups.includes("designer") || i.groups.includes("luxury"));
    if (lux.length >= 1 && lux.length <= 2) {
      const rest = new Map<string, number>();
      for (const i of known.filter((x) => !lux.includes(x))) for (const t of new Set(i.brand!.tags)) rest.set(t, (rest.get(t) ?? 0) + 1);
      const main = [...rest.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t);
      if (main.length && lux.every((i) => !i.brand!.tags.some((t) => main.includes(t)))) add("lux_mismatch", -R.lux_mismatch);
    }
  }
  // 무신사 인기 브랜드 쏠림: 26세 이하에 산 옷은 1/musinsa_young_div만 센다
  if (named.length >= 8) {
    const w = (i: Item) => (opts.age != null && ageAt(opts.age, i, now) <= 26 ? 1 / Math.max(R.musinsa_young_div, 1) : 1);
    const m = named.filter(isMusinsa).reduce((s, i) => s + w(i), 0) / named.length;
    add("musinsa", -over(m, R.musinsa_from, R.musinsa_per10, R.musinsa_max) * musinsaFactor);
  }
  const copies =
    [...groupBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}`).values()].reduce((n, l) => n + Math.max(0, l.length - 2), 0) +
    [...groupBy(items, (i) => (i.g.productName ? `${i.brandLabel}|${i.g.productName}|${i.color ?? ""}`.toLowerCase() : null)).values()].reduce((n, l) => n + Math.max(0, l.length - 1), 0);
  add("dup", -Math.min(R.dup_max, copies * R.dup_each));
  const misfit = clothes.filter((i) => i.fit && (i.fit.level === "too_small" || i.fit.level === "too_big")).length;
  add("misfit", -Math.min(R.misfit_max, misfit * R.misfit_each));
  if (clothes.length && share(clothes, isLogo) * 100 >= R.logo_pct) add("logo", -R.logo);
  const seasoned = items.filter((i) => i.seasons.length);
  if (seasoned.length >= 8) {
    const counts = FOUR_SEASONS.map((s) => seasoned.filter((i) => wearsInSeason(i.seasons, s.id)).length);
    if (Math.min(...counts) * 100 < Math.max(...counts) * R.season_gap_pct) add("season_gap", -R.season_gap);
  }

  // 3. 나이에 맞는 옷: 옷마다 산 때 나이 구간으로 나눠 구간별로 규칙을 적용하고, 그 구간 옷 비중만큼 반영
  let age: WardrobeScore["age"] = null;
  if (opts.age != null && enough) {
    let worst = 0;
    const byBand = groupBy(known, (i) => bandOf(ageAt(opts.age!, i, now)));
    for (const [band, list] of byBand) {
      const rule = AR[band] ?? {};
      if (list.length < 3) continue;
      const weight = list.length / known.length;
      const hit = (kind: NonNullable<WardrobeScore["age"]>["kind"], pctKey: string, pointKey: string, sign: 1 | -1, f: (i: Item) => boolean, factor = 1) => {
        if (rule[pctKey] == null || !rule[pointKey]) return;
        const s = share(list, f);
        if (s * 100 < rule[pctKey]) return;
        const d = sign * rule[pointKey] * weight * factor;
        add(`age_${kind}`, d);
        if (sign < 0 && -d > worst) {
          worst = -d;
          age = { kind, pct: Math.round(s * 100), age: opts.age! };
        } else if (sign > 0 && !age) age = { kind, pct: Math.round(s * 100), age: opts.age! };
      };
      hit(band === "b0" || band === "b20" ? "young_street" : "street", "street_plus_pct", "street_plus", 1, isStreet);
      hit("street", "street_pct", "street_minus", -1, isStreet);
      hit("mature", "mature_pct", "mature_plus", 1, isMature);
      hit("musinsa", "musinsa_pct", "musinsa_minus", -1, isMusinsa, musinsaFactor);
      hit("formal", "formal_pct", "formal_minus", -1, isFormalLux);
      if (rule.lux_n != null && rule.lux_minus && list.filter((i) => i.groups.includes("luxury")).length >= rule.lux_n) {
        add("age_lux", -rule.lux_minus * weight);
        if (rule.lux_minus * weight > worst) age = { kind: "lux", pct: 0, age: opts.age };
      }
    }
  }

  const score = R.base + parts.reduce((s, p) => s + p.delta, 0);
  return { score, parts, age };
}

/** 그 옷을 산 때 나이(구매일이 없으면 지금 나이) */
export function ageAt(age: number, i: Item, now: number): number {
  if (!i.date) return age;
  const t = Date.parse(i.date);
  return t > now ? age : age - Math.floor((now - t) / (12 * MONTH_MS));
}

export function bandOf(age: number): string {
  let key = AGE_BANDS[0][0];
  for (const [k, from] of AGE_BANDS) if (age >= from) key = k;
  return key;
}

/** 점수 구간(마지막 질문의 반응·증감을 고를 때) */
export function tierOf(score: number, rules?: Partial<ScoreRules>): "high" | "mid" | "low" {
  const R = { ...SCORE_RULES, ...(rules ?? {}) };
  return score >= R.tier_high ? "high" : score >= R.tier_low ? "mid" : "low";
}

function groupBy<T>(list: T[], key: (x: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

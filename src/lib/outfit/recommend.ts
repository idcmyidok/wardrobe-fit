import { findColorFamily, findColorHex, luminance } from "@/lib/constants/colors";
import { wearsInSeason } from "@/lib/constants/seasons";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";

/**
 * 오늘의 코디 추천. AI를 부르지 않고 규칙으로만 고른다(비용 0).
 * - 계절: 날짜의 달로 정하고, 그 계절에 입는 옷만 쓴다.
 * - 점수: 색 조합(포인트 색은 하나까지), 분류 조합(정장·운동복 섞임), 사이즈(아우터가 상의보다 작지 않은지, 둘 다 넉넉한지).
 * - 다양성: 좋은 상의·하의 짝을 날짜 순서대로 돌려 쓰고, 아우터·신발·모자는 날짜로 정한 난수로 고른다.
 * 같은 날·같은 옷장이면 늘 같은 결과가 나온다.
 */

export type WearSeason = Exclude<Season, "all">;

/** 화면에 늘어놓는 순서(위에서 아래로) */
export const OUTFIT_ORDER: CategoryId[] = ["hat", "outer", "top", "bottom", "shoes"];

export type OutfitResult =
  | { ok: true; season: WearSeason; items: Garment[]; reasons: string[] }
  | { ok: false; season: WearSeason; missing: ("top" | "bottom")[] };

/** 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울 */
export function seasonOfDate(dateKey: string): WearSeason {
  const month = Number(dateKey.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/** 기기 시간대 기준 YYYY-MM-DD */
export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------- 계절 ---------- */

/** 시즌을 입력하지 않은 옷은 세부분류로 짐작한다. */
const NOT_IN: Partial<Record<WearSeason, Set<string>>> = {
  summer: new Set([
    "outer.light_padding", "outer.fleece", "outer.mustang", "outer.single_coat", "outer.double_coat",
    "outer.winter_coat", "outer.short_padding", "outer.long_padding", "outer.leather", "outer.stadium",
    "top.knit", "top.sweatshirt", "top.hoodie", "top.long_tee", "hat.beanie", "shoes.boots",
  ]),
  winter: new Set(["top.short_tee", "top.sleeveless", "top.polo", "bottom.shorts", "shoes.sandals", "outer.coach"]),
};

export function fitsSeason(g: Garment, season: WearSeason): boolean {
  if (g.seasons.length > 0) return wearsInSeason(g.seasons, season);
  return !(g.subcategoryId && NOT_IN[season]?.has(g.subcategoryId));
}

/* ---------- 분류 조합: 차려입은 정도 ---------- */

/** 1 = 격식, 0 = 캐주얼, -1 = 운동복. 적지 않은 세부분류는 0 */
const FORMALITY: Record<string, number> = {
  "outer.blazer": 1, "outer.single_coat": 1, "outer.double_coat": 1, "outer.winter_coat": 0.5,
  "outer.transition_coat": 0.5, "outer.cardigan": 0.5,
  "outer.training": -1, "outer.anorak": -0.5, "outer.coach": -0.5, "outer.hood_zip": -0.5,
  "outer.fleece": -0.5, "outer.stadium": -0.5,
  "top.shirt": 1, "top.knit": 0.5, "top.polo": 0.5, "top.hoodie": -0.5, "top.sleeveless": -1,
  "bottom.slacks": 1, "bottom.chino": 0.5, "bottom.sweatpants": -1, "bottom.leggings": -1, "bottom.shorts": -0.5,
  "shoes.dress": 1, "shoes.boots": 0.5, "shoes.sports": -1, "shoes.sandals": -0.5,
  "hat.cap": -0.5,
};
const formality = (g: Garment) => FORMALITY[g.subcategoryId ?? ""] ?? 0;

/* ---------- 색 ---------- */

/** 어디에나 어울리는 색 계열(findColorFamily 이름) */
const NEUTRALS = new Set(["블랙", "그레이", "화이트", "베이지", "네이비", "데님", "브라운", "카키"]);
/** 함께 입으면 부딪히는 포인트 색 */
const CLASHES = [
  ["레드", "그린"],
  ["퍼플", "옐로"],
  ["오렌지", "핑크"],
  ["레드", "핑크"],
  ["레드", "오렌지"],
];
const KNOWN_FAMILIES = new Set([...NEUTRALS, "그린", "블루", "레드", "핑크", "퍼플", "옐로", "오렌지"]);

function family(g: Garment): string | null {
  const f = findColorFamily(g.colorName);
  return f && KNOWN_FAMILIES.has(f) ? f : null;
}

/* ---------- 사이즈 ---------- */

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface SizeBase {
  topChest: number | null;
  bottomThigh: number | null;
}

/** 옷장 안에서 이 옷이 넉넉한 편(1 초과)인지 딱 붙는 편인지 */
function looseness(g: Garment, base: SizeBase): number | null {
  if (g.categoryId === "top") {
    const v = g.measurements.chest;
    return v && base.topChest ? v / base.topChest : null;
  }
  if (g.categoryId === "bottom") {
    const v = g.measurements.thigh;
    return v && base.bottomThigh ? v / base.bottomThigh : null;
  }
  return null;
}

/* ---------- 점수 ---------- */

interface Scored {
  score: number;
  reasons: string[];
}

function scoreOutfit(items: Garment[], base: SizeBase): Scored {
  let score = 0;
  const reasons: string[] = [];
  const by = (c: CategoryId) => items.find((g) => g.categoryId === c);
  const top = by("top");
  const bottom = by("bottom");
  const outer = by("outer");

  // 색: 포인트 색은 하나까지가 무난하다.
  const fams = items.map(family);
  const accents = [...new Set(fams.filter((f): f is string => !!f && !NEUTRALS.has(f)))];
  if (accents.length === 0) {
    score += 0.5;
    if (fams.filter(Boolean).length >= 2) reasons.push("무채색·기본색으로 차분하게 맞췄어요");
  } else if (accents.length === 1) {
    score += 1.5;
    reasons.push(`${accents[0]} 하나만 포인트로 두었어요`);
  } else if (accents.length === 2) score -= 1.5;
  else score -= 4;
  for (const [a, b] of CLASHES) if (accents.includes(a) && accents.includes(b)) score -= 2;

  if (top && bottom) {
    const ft = family(outer ?? top);
    const fb = family(bottom);
    // 청청은 가끔만
    if (fb === "데님" && (family(top) === "데님" || (outer && family(outer) === "데님"))) score -= 1.5;
    // 위아래가 같은 포인트 색이면 답답해 보이기 쉽다.
    if (ft && ft === fb && !NEUTRALS.has(ft)) score -= 1;
    // 위아래 밝기 차이가 조금은 있는 편이 낫다.
    const ht = findColorHex((outer ?? top).colorName);
    const hb = findColorHex(bottom.colorName);
    if (ht && hb) {
      const diff = Math.abs(luminance(ht) - luminance(hb));
      if (diff >= 0.15) {
        score += 0.5;
        if (reasons.length < 2) reasons.push("위아래 밝기 차이를 두었어요");
      } else if (diff < 0.03 && ft !== "블랙") score -= 0.3;
    }
  }
  // 모자·신발은 기본색이거나 다른 옷과 같은 계열이면 좋다.
  for (const g of items) {
    if (g.categoryId !== "hat" && g.categoryId !== "shoes") continue;
    const f = family(g);
    if (!f) continue;
    const others = items.filter((o) => o !== g).map(family);
    if (NEUTRALS.has(f) || others.includes(f)) score += 0.5;
    if (others.includes(f) && !NEUTRALS.has(f) && reasons.length < 2) reasons.push(`${g.categoryId === "hat" ? "모자" : "신발"} 색을 옷과 맞췄어요`);
  }

  // 분류 조합: 정장과 운동복이 섞이지 않게
  let worstGap = 0;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) worstGap = Math.max(worstGap, Math.abs(formality(items[i]) - formality(items[j])));
  if (worstGap >= 1.5) score -= 3;
  else if (worstGap >= 1) score -= 1;
  else if (items.length >= 3 && reasons.length < 2) {
    const avg = items.reduce((s, g) => s + formality(g), 0) / items.length;
    reasons.push(avg >= 0.5 ? "단정한 분위기로 맞췄어요" : avg <= -0.5 ? "편한 분위기로 맞췄어요" : "캐주얼한 분위기로 맞췄어요");
  }

  // 사이즈: 아우터가 상의보다 작으면 겹쳐 입기 어렵다.
  if (outer && top) {
    const oc = outer.measurements.chest, tc = top.measurements.chest;
    const os = outer.measurements.shoulder, ts = top.measurements.shoulder;
    if (oc && tc && oc < tc - 1) score -= 3;
    if (os && ts && os < ts - 2) score -= 2;
  }
  // 위아래 모두 넉넉하거나 모두 딱 붙으면 균형이 덜하다.
  if (top && bottom) {
    const lt = looseness(top, base), lb = looseness(bottom, base);
    if (lt && lb) {
      if (lt > 1.08 && lb > 1.08) score -= 1;
      else if (lt < 0.93 && lb < 0.93) score -= 0.5;
      else if ((lt > 1.05) !== (lb > 1.05) && reasons.length < 2) reasons.push("품이 넉넉한 옷과 슬림한 옷을 섞었어요");
    }
  }

  return { score, reasons };
}

/* ---------- 난수 ---------- */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 끝 글자만 다른 seed(날짜)끼리도 첫 난수가 비슷하지 않게 한 번 더 섞는다(murmur3 fmix).
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 같은 seed면 같은 수열(mulberry32) */
function rng(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 점수가 높을수록 자주 뽑히지만 1등만 나오지는 않게(softmax) */
function pickWeighted<T extends { score: number }>(list: T[], rand: () => number, temperature = 1): T {
  const max = Math.max(...list.map((c) => c.score));
  const weights = list.map((c) => Math.exp((c.score - max) / temperature));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

/* ---------- 고르기 ---------- */

const DAY_MS = 24 * 60 * 60 * 1000;
const dayIndex = (dateKey: string) => Math.round(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);

/** 좋은 상의·하의 짝 목록(1등보다 이만큼 낮은 것까지, 최대 개수) */
const PAIR_MARGIN = 3;
const MAX_PAIRS = 14;

/** seed로 섞은 순서. 이웃한 날에 같은 상의·하의가 이어지지 않게 한 번 더 고른다. */
function dailyOrder<T extends { items: Garment[] }>(pairs: T[], seed: string): T[] {
  const rand = rng(seed);
  const rest = [...pairs];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const order: T[] = [];
  while (rest.length) {
    const prev = order[order.length - 1];
    const k = prev ? rest.findIndex((p) => !p.items.some((g) => prev.items.includes(g))) : 0;
    order.push(...rest.splice(Math.max(k, 0), 1));
  }
  return order;
}

/**
 * dateKey(YYYY-MM-DD) 날의 코디. variant를 올리면 같은 날 다른 조합을 보여 준다.
 * 좋은 상의·하의 짝 N개를 한 바퀴(N일) 동안 섞인 순서로 하루에 하나씩 돌려 쓰므로
 * 같은 바퀴 안에서는 짝이 겹치지 않고, 어제와 오늘이 같은 짝이 되지 않는다.
 * 아우터·신발·모자는 그날의 난수로 짝에 어울리는 것을 붙인다.
 */
export function recommendOutfit(garments: Garment[], dateKey: string, variant = 0): OutfitResult {
  const season = seasonOfDate(dateKey);
  const pool = (c: CategoryId) => garments.filter((g) => g.categoryId === c && fitsSeason(g, season));
  const tops = pool("top");
  const bottoms = pool("bottom");
  if (tops.length === 0 || bottoms.length === 0) {
    const missing: ("top" | "bottom")[] = [];
    if (tops.length === 0) missing.push("top");
    if (bottoms.length === 0) missing.push("bottom");
    return { ok: false, season, missing };
  }
  const base: SizeBase = {
    topChest: median(garments.filter((g) => g.categoryId === "top").map((g) => g.measurements.chest ?? 0).filter((v) => v > 0)),
    bottomThigh: median(garments.filter((g) => g.categoryId === "bottom").map((g) => g.measurements.thigh ?? 0).filter((v) => v > 0)),
  };

  // 1) 상의·하의 짝을 모두 매기고 좋은 짝만 남긴다(id 순으로 정렬해 옷장 순서와 상관없게).
  const scored = tops
    .flatMap((t) => bottoms.map((b) => ({ items: [t, b], score: scoreOutfit([t, b], base).score })))
    .sort((a, b) => b.score - a.score || a.items.map((g) => g.id).join().localeCompare(b.items.map((g) => g.id).join()));
  const pairs = scored.filter((p) => p.score >= scored[0].score - PAIR_MARGIN).slice(0, MAX_PAIRS);

  // 2) 한 바퀴 = pairs.length일. 바퀴마다 다른 순서로 섞는다.
  const day = dayIndex(dateKey);
  const n = pairs.length;
  const pos = (((day + variant) % n) + n) % n;
  const cycle = Math.floor((day + variant) / n);
  const order = n <= 2 ? pairs : dailyOrder(pairs, `${season}#${cycle}`);
  // 바퀴가 바뀌는 날에도 어제 짝이 다시 나오지 않게 앞의 둘을 바꾼다(마지막 짝은 그대로라 다음 바퀴 계산과 어긋나지 않는다).
  if (n > 2 && order[0] === dailyOrder(pairs, `${season}#${cycle - 1}`)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  const pair = order[pos];

  // 3) 아우터·모자를 걸칠지는 계절과 그날 난수로 정한다(여름엔 아우터를 거의 안 입는다).
  const rand = rng(`${dateKey}#${variant}`);
  const outers = pool("outer");
  const outerChance = { winter: 1, spring: 0.75, fall: 0.8, summer: 0.2 }[season];
  const hats = pool("hat");
  const withOuter = outers.length > 0 && rand() < outerChance;
  const withHat = hats.length > 0 && rand() < 0.5;
  const extend = (items: Garment[], options: Garment[]) => {
    if (options.length === 0) return items;
    const list = options.map((o) => ({ o, score: scoreOutfit([...items, o], base).score }));
    return [...items, pickWeighted(list, rand, 0.7).o];
  };
  let items = pair.items;
  if (withOuter) items = extend(items, outers);
  items = extend(items, pool("shoes"));
  if (withHat) items = extend(items, hats);

  const { reasons } = scoreOutfit(items, base);
  return { ok: true, season, items: OUTFIT_ORDER.flatMap((c) => items.filter((g) => g.categoryId === c)), reasons: reasons.slice(0, 2) };
}

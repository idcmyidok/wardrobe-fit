import "server-only";
import type { Item } from "../analyze";
import type { Feat } from "./feat";
import { AXIS_KEYS, TYPICAL, type AxisKey, type RuleId } from "./types";

/**
 * 항목 5개의 점수(0~1). 유형이 켠 rules가 계산을 바꾼다. 값이 null이면 자료가 없어 그 항목을 뺀다.
 * 옷장과 주문내역은 같은 5칸이지만 보는 것이 다르다(types.ts의 AXIS_NAME).
 */

export interface AxisOut {
  value: number | null;
  /** 점수 풀이용 한 줄(관리자에게만 보임) */
  why: string;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

type Has = (r: RuleId) => boolean;

const LEVEL_VALUE: Record<number, number> = { 1: 0.35, 2: 0.45, 3: 0.6, 4: 0.75, 5: 0.88, 6: 0.95 };

const PRODUCT_CAT: [RegExp, Item["cat"]][] = [
  [/아우터|재킷|자켓|코트|점퍼|패딩|블루종|윈드|바시티|블레이저/, "outer"],
  [/팬츠|바지|데님|슬랙스|트라우저|쇼츠|스커트|카고|조거/, "bottom"],
  [/신발|스니커|부츠|로퍼|더비|샌들/, "shoes"],
  [/모자|캡|비니|햇/, "hat"],
];
const catOfProduct = (p: string): Item["cat"] | null => PRODUCT_CAT.find(([re]) => re.test(p))?.[1] ?? (/티|셔츠|니트|후드|스웨트|맨투맨|탑|가디건|블라우스/.test(p) ? "top" : null);

/** 한 브랜드 덕후: 다른 브랜드 옷이 주력과 어울리는지(어울림), 주력이 모자란 품목을 채우는지(빈틈), 주력 핵심+나머지 기본템(역할) */
export function complement(F: Feat): { value: number; why: string } | null {
  const main = F.topBrand;
  if (!main || F.n < 10) return null;
  const mainItems = F.items.filter((i) => i.brand && main.ids.includes(i.id));
  const others = F.items.filter((i) => !main.ids.includes(i.id));
  const mb = mainItems[0]?.brand;
  if (!mb || !others.length) return null;
  const compat = mean(
    others.map((i) => {
      const b = i.brand;
      if (!b) return 0.4;
      const tag = mb.tags.some((t) => b.tags.includes(t)) ? 1 : 0.3;
      const formal = Math.abs(b.formal - mb.formal) <= 1 ? 1 : 0.3;
      const price = Math.abs(b.price - mb.price) <= 1 ? 1 : 0.4;
      return 0.45 * tag + 0.3 * formal + 0.25 * price;
    }),
  );
  const mainCats = new Set(mb.products.map(catOfProduct).filter(Boolean));
  const missing = (["outer", "top", "bottom", "shoes"] as const).filter((c) => !mainCats.has(c));
  const fill = missing.length ? clamp(others.filter((i) => (missing as readonly string[]).includes(i.cat)).length / Math.max(others.length * 0.5, 1)) : 0.6;
  const mainOuter = mainItems.filter((i) => i.cat === "outer").length / mainItems.length;
  const othersBasic = others.filter((i) => i.cat === "top" || i.cat === "bottom").length / others.length;
  const role = mainOuter >= 0.35 && othersBasic >= 0.6 ? 1 : mainOuter >= 0.2 ? 0.7 : 0.5;
  const value = 0.5 * compat + 0.25 * fill + 0.25 * role;
  return { value, why: `어울림 ${Math.round(compat * 100)} · 빈틈 ${Math.round(fill * 100)} · 역할 ${Math.round(role * 100)}` };
}

const NEUTRAL = new Set(["블랙", "그레이", "화이트", "베이지", "브라운", "카키", "네이비", "데님"]);
const isNeutral = (i: Item) => i.denim || (i.color != null && NEUTRAL.has(i.color));
const LOGO = /로고|그래픽|프린트|레터링|아트웍|캐릭터|graphic|logo|print|lettering/i;

function consistency(F: Feat, has: Has): AxisOut {
  if (F.known.length < 6 && !has("palette_free")) return { value: 0.55, why: "브랜드 자료가 적어 기본값" };
  const tag = clamp((F.tagFocus - 0.4) / 0.5);
  const formals = F.known.map((i) => i.brand!.formal);
  const spread = sd(formals);
  const tight = 1 - clamp(spread / 1.6);
  // 색 일관성: 상위 3색 쏠림이나 기본색 위주면 높고, 튀는 색 가짓수가 많으면 깎는다
  const colored = F.clothes.filter((i) => i.color);
  const neutralShare = colored.length ? colored.filter(isNeutral).length / colored.length : 0.5;
  const loudHues = new Set(colored.filter((i) => !isNeutral(i)).map((i) => i.color)).size;
  const palette = has("palette_free") ? 1 : Math.max(clamp((F.topColors3 - 0.5) / 0.4), clamp((neutralShare - 0.5) / 0.4)) * (1 - 0.5 * clamp((loudHues - 3) / 4));
  let v = 0.45 * tag + 0.2 * tight + 0.35 * palette;
  let why = `태그 ${Math.round(tag * 100)} · 포멀도 ${Math.round(tight * 100)} · 색 ${Math.round(palette * 100)}`;
  if (has("variety_ok")) {
    const alt = 0.55 + 0.25 * clamp(spread / 1.2);
    if (alt > v) {
      v = alt;
      why += " (다양함 인정)";
    }
  }
  if (has("complement")) {
    const c = complement(F);
    if (c) {
      v = 0.45 * v + 0.55 * c.value;
      why += ` · 보완 평가 ${c.why}`;
    }
  }
  if (has("recent_only") && F.mode === "orders") {
    const dated = F.items.filter((i) => i.date).sort((a, b) => a.date!.localeCompare(b.date!));
    const tail = dated.slice(Math.floor(dated.length * 0.67));
    if (tail.length >= 5) {
      const tags = new Map<string, number>();
      for (const i of tail) for (const t of i.brand?.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
      const tot = [...tags.values()].reduce((a, b) => a + b, 0);
      const focus = tot ? [...tags.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / tot : 0;
      v = Math.max(v, clamp((focus - 0.4) / 0.5) * 0.8 + 0.15);
      why += " · 최근 구매 기준";
    }
  }
  if (F.mode === "orders" && F.dated >= 15) {
    // 방향이 이어지는지: 오래된 1/3과 최근 1/3의 태그가 겹치는 정도
    const dated = F.items.filter((i) => i.date && i.brand).sort((a, b) => a.date!.localeCompare(b.date!));
    const k = Math.floor(dated.length / 3);
    if (k >= 4) {
      const tagsOf = (list: Item[]) => {
        const m = new Map<string, number>();
        for (const i of list) for (const t of i.brand!.tags) m.set(t, (m.get(t) ?? 0) + 1);
        return new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t));
      };
      const a = tagsOf(dated.slice(0, k));
      const b = tagsOf(dated.slice(-k));
      const overlap = [...a].filter((t) => b.has(t)).length / Math.max(Math.min(a.size, b.size), 1);
      v = 0.7 * v + 0.3 * (0.4 + 0.6 * overlap);
      why += ` · 5년 방향 겹침 ${Math.round(overlap * 100)}`;
    }
  }
  return { value: clamp(v), why };
}

/**
 * 코디력(가격과 무관): 같은 가격대 옷장도 크게 갈리게 하는 신호.
 * 색 조화(튀는 색 가짓수) · 섞어 입기(하의·아우터가 기본색인지) · 로고 절제(상의 로고·그래픽 비율) · 기본템(기본색 아우터·데님·무지 상의·기본색 신발) · 품목 짝(상의 대비 하의 수)
 */
export function styling(F: Feat, has: Has): { value: number; why: string } | null {
  const clothes = F.clothes.filter((i) => i.color);
  if (clothes.length < 8) return null;
  const loud = clothes.filter((i) => !isNeutral(i));
  const hues = new Set(loud.map((i) => i.color)).size;
  const loudShare = loud.length / clothes.length;
  // 튀는 색은 2가지까지 자연스럽고, 5가지를 넘으면 0. 컬러 플레이 유형은 가짓수 대신 기본색 받침만 본다.
  let harmony = has("palette_free") ? 1 : 1 - clamp((hues - 2) / 4);
  if (loudShare > 0.45) harmony *= 1 - clamp((loudShare - 0.45) / 0.35) * 0.6;
  const bottoms = F.clothes.filter((i) => i.cat === "bottom");
  const outers = F.clothes.filter((i) => i.cat === "outer");
  const nb = bottoms.length ? bottoms.filter(isNeutral).length / bottoms.length : 0;
  const no = outers.length ? outers.filter(isNeutral).length / outers.length : 0.5;
  const mix = 0.65 * nb + 0.35 * no;
  const tops = F.clothes.filter((i) => i.cat === "top");
  const logoShare = tops.length ? tops.filter((i) => LOGO.test(i.g.productName)).length / tops.length : 0;
  const logo = has("logo_care") ? 1 - clamp((logoShare - 0.5) / 0.4) : 1 - clamp((logoShare - 0.2) / 0.45);
  const shoes = F.items.filter((i) => i.cat === "shoes");
  const basics =
    [
      outers.some(isNeutral),
      bottoms.some((i) => i.denim),
      tops.some((i) => isNeutral(i) && !LOGO.test(i.g.productName)),
      shoes.length === 0 || shoes.some(isNeutral),
    ].filter(Boolean).length / 4;
  // 상의 3벌에 하의 1벌 이상이면 충분, 하의가 너무 적으면 돌려 입을 수 없다
  const pair = tops.length ? clamp((bottoms.length / tops.length) / 0.4) : 0.5;
  const value = 0.3 * harmony + 0.25 * mix + 0.2 * logo + 0.15 * basics + 0.1 * pair;
  const p = (v: number) => Math.round(v * 100);
  return { value, why: `코디력 ${p(value)}(색 ${p(harmony)}·섞기 ${p(mix)}·로고 ${p(logo)}·기본템 ${p(basics)}·하의 짝 ${p(pair)})` };
}

function taste(F: Feat, has: Has): AxisOut {
  if (F.known.length < 5) return { value: null, why: "브랜드 자료가 있는 옷이 5벌 미만" };
  const outerShoes = new Set(F.items.filter((i) => i.cat === "outer" || i.cat === "shoes").map((i) => i.id));
  const values = F.known.map((i) => {
    const b = i.brand!;
    // SPA는 브랜드로 깎지 않고 중립
    let v = i.groups.includes("spa") ? 0.5 : (LEVEL_VALUE[b.price] ?? 0.5);
    if (has("price_free") && b.price <= 2) v = Math.max(v, 0.5);
    if (b.pop <= 2) v += 0.08;
    if (i.groups.includes("heritage") && b.heritage >= 4) v += 0.05;
    if (i.groups.includes("specialist")) v += 0.05;
    if (has("core_upgrade") && outerShoes.has(i.id) && b.price >= 3 && !i.groups.includes("spa")) v += 0.12;
    return clamp(v);
  });
  let v = mean(values);
  let why = `브랜드 ${F.known.length}벌 평균 ${Math.round(v * 100)}`;
  if (has("cult_plus")) {
    const bonus = clamp(F.cult * 0.25 + F.level(6, 6) * 0.15, 0, 0.15);
    v += bonus;
    why += ` · 컬트/최고가 가점 ${Math.round(bonus * 100)}`;
  }
  if (F.mode === "orders") {
    const paid = F.items.filter((i) => i.price && i.brand);
    if (paid.length >= 5) {
      const near = paid.filter((i) => {
        const r = i.price! / TYPICAL[i.brand!.price];
        return r >= 0.55 && r <= 1.7;
      }).length / paid.length;
      v = 0.7 * v + 0.3 * (0.3 + 0.7 * near);
      why += ` · 결제가 적정 ${Math.round(near * 100)}`;
    }
  }
  // 가격이 아니라 고르는 실력이 더 크게: 브랜드 40% + 코디력 60%
  const st = styling(F, has);
  if (st) {
    v = 0.4 * v + 0.6 * st.value;
    why += ` · ${st.why}`;
  }
  return { value: clamp(v), why };
}

const IDEAL: Record<string, number> = { outer: 0.2, top: 0.35, bottom: 0.25, shoes: 0.15, hat: 0.05 };

function balance(F: Feat, has: Has): AxisOut {
  const ideal = { ...IDEAL };
  if (has("outer_core")) Object.assign(ideal, { outer: 0.35, top: 0.25, bottom: 0.2, shoes: 0.15, hat: 0.05 });
  if (has("shoe_deep")) Object.assign(ideal, { outer: 0.15, top: 0.2, bottom: 0.15, shoes: 0.45, hat: 0.05 });
  if (F.n < 8) return { value: null, why: "옷이 8벌 미만" };
  const dist = (Object.keys(ideal) as (keyof typeof IDEAL)[]).reduce((a, k) => a + Math.abs((F.cat as Record<string, number>)[k] - ideal[k]), 0) / 2;
  const cat = 1 - clamp(dist / 0.6);
  let second: number;
  let why2: string;
  if (F.mode === "orders") {
    const years = F.items.map((i) => i.date?.slice(0, 4)).filter((y): y is string => Boolean(y));
    if (years.length >= 10) {
      const counts = new Map<string, number>();
      for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
      const first = Number(Math.min(...[...counts.keys()].map(Number)));
      const last = Number(Math.max(...[...counts.keys()].map(Number)));
      const span = last - first + 1;
      const active = counts.size / span;
      const maxShare = Math.max(...counts.values()) / years.length;
      second = clamp(0.6 * active + 0.4 * (1 - clamp((maxShare - 0.35) / 0.5)));
      why2 = `해마다 ${Math.round(active * 100)} · 몰아사기 ${Math.round(maxShare * 100)}`;
    } else {
      second = 0.6;
      why2 = "구매일이 적어 기본값";
    }
  } else if (has("season_scoped")) {
    second = 1;
    why2 = "계절 편중은 조언만";
  } else {
    second = mean((["spring", "summer", "fall", "winter"] as const).map((s) => clamp(F.season[s] / 0.35)));
    why2 = `계절 ${Math.round(second * 100)}`;
  }
  return { value: clamp(0.55 * cat + 0.45 * second), why: `품목 ${Math.round(cat * 100)} · ${why2}` };
}

function fit(F: Feat, has: Has): AxisOut {
  const scored: number[] = [];
  for (const i of F.clothes) {
    const l = i.fit?.level;
    if (!l) continue;
    let s = l === "regular" || l === "semi_over" ? 1 : l === "slim" ? 0.9 : l === "over" ? 0.85 : 0.35;
    if (has("fit_over_ok")) s = l === "over" || l === "semi_over" ? 1 : l === "too_big" ? 0.6 : s;
    if (has("fit_slim_ok")) s = l === "slim" ? 1 : l === "too_small" ? 0.6 : s;
    scored.push(s);
  }
  for (const i of F.items) {
    if (i.cat !== "shoes" || !i.g.shoeFit) continue;
    const vals = Object.values(i.g.shoeFit).filter(Boolean);
    if (vals.length) scored.push(vals.every((v) => v === "good") ? 1 : vals.some((v) => v === "tight") ? 0.5 : 0.75);
  }
  if (scored.length < 5) return { value: null, why: "핏 자료(표기·내 치수)가 5벌 미만" };
  let v = mean(scored);
  let why = `맞음 ${scored.length}벌 평균 ${Math.round(v * 100)}`;
  if (has("fit_weight")) {
    v = v ** 1.4;
    why += " (엄격)";
  }
  if (has("volume_pair")) {
    const up = F.items.filter((i) => i.cat === "top" || i.cat === "outer");
    const bot = F.items.filter((i) => i.cat === "bottom");
    if (up.length >= 3 && bot.length >= 3) {
      const big = (i: Item) => i.fit && (i.fit.level === "semi_over" || i.fit.level === "over" || i.fit.level === "too_big");
      const diff = Math.abs(up.filter(big).length / up.length - bot.filter(big).length / bot.length);
      if (diff >= 0.5) {
        v += 0.08;
        why += " · 볼륨 짝 가점";
      }
    }
  }
  return { value: clamp(v), why };
}

/** 개성·깊이(옷장) / 구매 규율(주문내역) */
function depthOrDiscipline(F: Feat, has: Has): AxisOut {
  if (F.mode === "orders") {
    const o = F.orders;
    const orders = Math.max(o?.orders ?? 1, 1);
    const bad = ((o?.events.length ?? 0) + (o?.exchanged ?? 0)) / orders;
    const mult = has("return_strict") ? 1.6 : 1;
    let v = 1 - clamp(bad * 2.2 * mult, 0, 0.4);
    const cheap = F.share((i) => i.price != null && i.price > 0 && i.price < 10_000, F.items);
    const dup = F.repeat;
    v -= cheap > 0.4 ? 0.1 : 0;
    v -= has("repeat_penalty") || dup > 0.3 ? clamp(dup * 0.5, 0, 0.2) : 0;
    if (has("steady_plus") && (o?.events.length ?? 0) === 0 && orders >= 3) v += 0.1;
    return { value: clamp(v), why: `반품·교환 ${(o?.events.length ?? 0) + (o?.exchanged ?? 0)}건/주문 ${orders}건 · 반복 ${Math.round(dup * 100)}` };
  }
  let v = 0.3 + F.cult * 0.5 + F.heritage * 0.25;
  let why = `컬트 ${Math.round(F.cult * 100)} · 헤리티지 ${Math.round(F.heritage * 100)}`;
  const groups = ["designer", "contemporary", "specialist", "street", "outdoor", "heritage", "jp_denim", "sports"] as const;
  const deepest = Math.max(...groups.map((g) => F.group(g)));
  if (has("brand_deep") && deepest >= 0.3) {
    v += 0.15;
    why += " · 계열 깊이";
  }
  if (F.avg.hype >= 4 && F.kshare((i) => i.brand!.hype >= 4) >= 0.7) {
    v -= 0.15;
    why += " · 하이프 쏠림";
  }
  if (has("repeat_penalty") || F.repeat > 0.3) v -= clamp(F.repeat * 0.6, 0, 0.2);
  if (has("hype_pair")) {
    const hype = F.kshare((i) => i.brand!.hype >= 4);
    const basicBottoms = F.share((i) => i.cat === "bottom" && (i.achromatic || i.denim), F.items.filter((i) => i.cat === "bottom"));
    if (hype >= 0.15 && hype <= 0.6 && basicBottoms >= 0.4) {
      v += 0.1;
      why += " · 하이프를 기본으로 받침";
    }
  }
  if (has("variety_ok")) {
    const spread = sd(F.known.map((i) => i.brand!.formal));
    v += 0.1 * clamp(spread / 1.2);
  }
  if (has("palette_free")) {
    // 올블랙: 질감·실루엣 대비(포멀도 분산 + 품목 다양성)로 개성을 본다
    v += 0.1 * clamp(sd(F.known.map((i) => i.brand!.formal)) / 1.2) + 0.1 * clamp(new Set(F.items.map((i) => i.sub ?? i.cat)).size / 12);
    why += " · 질감·실루엣 대비";
  }
  return { value: clamp(v), why };
}

/** 옷이 적으면 점수를 가운데(0.5) 쪽으로 당긴다(몇 벌로 만점·빵점이 나오지 않게). 30벌이면 그대로 */
const shrink = (o: AxisOut, n: number): AxisOut => {
  if (o.value == null || n >= 30) return o;
  const k = Math.max(0.3, n / 30);
  return { value: 0.5 + (o.value - 0.5) * k, why: `${o.why} · 표본 ${n}벌 보정` };
};

export function computeAxes(F: Feat, has: Has): Record<AxisKey, AxisOut> {
  const n = F.n;
  return { c: shrink(consistency(F, has), n), t: shrink(taste(F, has), n), b: shrink(balance(F, has), n), f: shrink(fit(F, has), n), x: shrink(depthOrDiscipline(F, has), n) };
}

export { AXIS_KEYS };

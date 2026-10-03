import "server-only";
import { colorCounted, type Analysis, type Item } from "../analyze";
import { brandLabels, MUSINSA_POPULAR, musinsaLikesCut } from "../brands";
import { ageAt, youngNote, youngWeight, bandName, bandOf, isFormalLux, isGood, isHeritage, isMidTier, isNice, isRepro, isTopDesigner, monthIndex, type ScorePart } from "../score";
import { SCORE_RULES } from "../score-deltas";
import { won } from "../text";
import { avgPrice, busiestMonth, isRanking, isStandard, orderRules, returnStats, thirds, topTag } from "./metrics";
import { ORDER_AGE_RULES, type OrderRules } from "./rules";

/**
 * 주문내역 훈수 점수(점수 계산표 /mnt/project-files/roast/order-score-table.md). 옷장 훈수 점수 기준 v4(score.ts)를 바탕으로
 * 주문내역에만 있는 것(상품 하트·후기, 반품·취소, 주문일)을 더했다.
 * 질문·퀴즈 답의 증감은 여기서 더하지 않는다(report.ts).
 */

const DAY = 86_400_000;

export type OrderAgeKind = "rank" | "standard" | "street" | "mature" | "young_street" | "lux" | "formal";
export interface OrderScore {
  score: number;
  parts: ScorePart[];
  /** 나이 기준에서 가장 크게 걸린 것(결과 한마디용) */
  age: { kind: OrderAgeKind; pct: number; age: number } | null;
}

/** 기본 상의: 반팔·긴팔 티, 맨투맨, 후드 */
const BASIC_TOPS = new Set(["top.short_tee", "top.long_tee", "top.sweatshirt", "top.hoodie"]);
const isStreet = (i: Item) => i.groups.includes("street") || (i.brand?.hype ?? 0) >= 4;
const isMature = (i: Item) => i.groups.includes("contemporary") || (i.brand?.heritage ?? 0) >= 4 || (i.brand?.formal ?? 0) >= 3.5;
const isLogo = (i: Item) => /로고|logo/i.test(i.g.productName);
const itemLabel = (i: Item) => `${i.brandLabel} ${i.g.productName}`.trim() || i.subName || "이름 없는 옷";

function groupBy<T>(list: T[], key: (x: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

export function scoreOrders(a: Analysis, opts: { age: number | null; rules?: Partial<OrderRules>; ageRules?: Record<string, Record<string, number>> }): OrderScore {
  const R = orderRules(opts.rules);
  const AR = opts.ageRules ?? ORDER_AGE_RULES;
  const now = a.now.getTime();
  const items = a.items;
  const clothes = a.clothes;
  const parts: ScorePart[] = [];
  const add = (id: string, delta: number, why: string, list?: Item[]) => {
    const d = Math.round(delta * 10) / 10;
    if (d) parts.push({ id, delta: d, why, ...(list?.length ? { items: list.map(itemLabel) } : {}) });
  };
  const P = (v: number) => `${Math.round(v * 100)}%`;
  const share = (list: Item[], f: (i: Item) => boolean) => (list.length ? list.filter(f).length / list.length : 0);
  const upTo = (s: number, fullPct: number, max: number) => Math.min(max, (s * 100 * max) / Math.max(fullPct, 1));
  const over = (s: number, fromPct: number, per10: number, max: number) => Math.min(max, (Math.max(0, s * 100 - fromPct) / 10) * per10);
  const ranking = (i: Item) => isRanking(a, i, R);
  const likesCut = musinsaLikesCut(SCORE_RULES.musinsa_likes_top);
  const isMusinsa = (i: Item) =>
    !(i.groups.includes("mass") || i.groups.includes("spa")) && !isStandard(i) && (brandLabels(i.g.brand).includes(MUSINSA_POPULAR) || (likesCut != null && (i.brand?.likes ?? 0) >= likesCut));

  const known = items.filter((i) => i.brand);
  const enough = known.length >= 5;
  const named = items.filter((i) => i.brandKind === "known" || i.brandKind === "unknown");
  const style = topTag(known);
  const styleTop = enough && style ? style.share : 0;
  const byBrand = groupBy(named, (i) => i.brand?.name ?? i.brandLabel.toLowerCase());

  // 1. 더하는 점수 ------------------------------------------------------------
  const designers = known.filter(isTopDesigner);
  add("designer", Math.min(R.designer_max, designers.length * R.designer_each), `명품·디자이너(가격 고가 이상, 대중적 제외) ${designers.length}벌 × ${R.designer_each}점, 최대 ${R.designer_max}점`, designers);
  const midTiers = known.filter(isMidTier);
  add("mid", Math.min(R.mid_max, midTiers.length * R.mid_each), `컨템포러리·디자이너·스트릿 중고가 이상(대중적 제외) ${midTiers.length}벌 × ${R.mid_each}점, 최대 ${R.mid_max}점`, midTiers);
  if (enough && style) {
    add(
      "style",
      styleTop * 100 >= R.style_high_pct ? R.style_high : styleTop * 100 >= R.style_mid_pct ? R.style_mid : 0,
      `가장 많은 스타일 '${style.tag}' ${P(styleTop)} (${R.style_high_pct}% 이상 +${R.style_high}, ${R.style_mid_pct}% 이상 +${R.style_mid})`,
      known.filter((i) => i.brand!.tags.includes(style.tag)),
    );
    // 옷장 훈수와 같은 기준: 진짜 헤리티지(1990년 이전 설립, 너무 유명한 브랜드 제외)·워크웨어·일본 데님. 빈티지·아메카지는 뺀다.
    const isTaste = (i: Item) => i.groups.includes("jp_denim") || isHeritage(i) || (i.brand?.tags ?? []).some((t) => /워크웨어/.test(t));
    const taste = share(known, isTaste);
    add("taste", upTo(taste, R.taste_full, R.taste_max), `진짜 헤리티지(1990년 이전 설립, 너무 유명한 브랜드 제외)·워크웨어·일본 데님 ${P(taste)}, ${R.taste_full}%면 만점 ${R.taste_max}점`, known.filter(isTaste));
  }

  // 시기별 변화: 오래된 1/3과 최근 1/3 비교
  const t = thirds(a, R.shift_min_n);
  if (t) {
    const oldRank = share(t.old, ranking);
    const newRank = share(t.recent, ranking);
    const diff = (newRank - oldRank) * 100;
    if (-diff >= R.hipper_pp) add("hipper", R.hipper, `랭킹템 비율 ${t.from} ${P(oldRank)} → ${t.to} ${P(newRank)} (${R.hipper_pp}%p 이상 줄어듦)`, t.recent.filter((i) => !ranking(i)));
    else if (diff >= R.mainstream_pp) add("mainstream", -R.mainstream, `랭킹템 비율 ${t.from} ${P(oldRank)} → ${t.to} ${P(newRank)} (${R.mainstream_pp}%p 이상 늘어남)`, t.recent.filter(ranking));
    const oldAvg = avgPrice(t.old);
    const newAvg = avgPrice(t.recent);
    if (oldAvg > 0 && newAvg >= oldAvg * (1 + R.pricier_pct / 100))
      add("pricier", R.pricier, `한 벌 평균가 ${t.from} ${won(oldAvg)} → ${t.to} ${won(newAvg)} (${R.pricier_pct}% 이상 오름)`);
  }

  const rs = returnStats(a);
  if (rs.orders >= R.return_min_orders && rs.returnPct <= R.return_low_pct) add("return_low", R.return_low, `주문 ${rs.orders}건 중 반품·교환 ${rs.returned + rs.exchanged}건(${rs.returnPct}%, ${R.return_low_pct}% 이하)`);
  const shoes = items.filter((i) => i.cat === "shoes");
  const leather = shoes.filter((i) => i.sub === "shoes.dress" || i.sub === "shoes.boots");
  if (leather.length) add("leather_shoes", R.leather_shoes, `구두·부츠 ${leather.length}켤레`, leather);
  // 옷장 훈수와 같은 가점 -------------------------------------------------------
  const goodOuters = clothes.filter((i) => i.cat === "outer" && (isTopDesigner(i) || isHeritage(i)));
  if (goodOuters.length) add("good_outer", R.good_outer, `디자이너·명품·진짜 헤리티지 브랜드 아우터 ${goodOuters.length}벌`, goodOuters);
  const shoeSubs = new Set(shoes.map((i) => i.sub));
  if (["shoes.sneakers", "shoes.sports", "shoes.dress", "shoes.boots", "shoes.sandals"].every((s) => shoeSubs.has(s))) add("shoe_set", R.shoe_set, "스니커즈·스포츠화·구두·부츠·샌들이 다 있음", shoes);
  const krNew = known.filter((i) => i.brand!.country === "한국" && (i.brand!.founded ?? 0) >= a.now.getFullYear() - R.kr_new_age && (isTopDesigner(i) || isMidTier(i)) && i.brand!.pop <= 2);
  if (krNew.length >= R.kr_new_n) add("kr_new", R.kr_new, `설립 ${R.kr_new_age}년 이내 국내 디자이너 브랜드(대중성 낮음) ${krNew.length}벌 (${R.kr_new_n}벌 이상)`, krNew);
  const jpList = known.filter((i) => i.brand!.country === "일본" && i.brand!.price >= R.foreign_price);
  if (jpList.length >= R.jp_n) add("jp", R.jp, `일본 중고가 이상 브랜드 ${jpList.length}벌 (${R.jp_n}벌 이상)`, jpList);
  const reproList = items.filter(isRepro);
  if (reproList.length) add("repro", reproList.length >= R.repro_many_n ? R.repro_many : R.repro, `일본 데님·리바이스 빈티지 ${reproList.length}벌 (${R.repro_many_n}벌 이상이면 +${R.repro_many})`, reproList);
  // 국가를 모르는 브랜드는 해외로 치지 않는다.
  const isForeign = (i: Item) => Boolean(i.brand!.country) && i.brand!.country !== "한국" && !(i.groups.includes("mass") || i.groups.includes("spa")) && i.brand!.price >= R.foreign_price;
  const foreign = share(known, isForeign);
  if (enough && foreign * 100 >= R.foreign_pct) add("foreign", R.foreign, `해외 브랜드(SPA·대중 제외, 가격 레벨 ${R.foreign_price} 이상) ${P(foreign)} (${R.foreign_pct}% 이상)`, known.filter(isForeign));
  const boldList = items.filter((i) => (i.price ?? 0) >= R.bold_won * 10_000);
  if (boldList.length) add("bold", R.bold, `${R.bold_won}만 원 이상 옷 ${boldList.length}벌`, boldList);
  const regulars = [...byBrand.values()].filter((l) => l.length >= 2 && l.length <= 4 && !isMusinsa(l[0]) && !isStandard(l[0]) && !(l[0].groups.includes("mass") || l[0].groups.includes("spa")));
  if (regulars.length >= R.regular_n) add("regular", R.regular, `2~4벌씩 산 단골 브랜드(무신사 인기·스탠다드·대중 제외) ${regulars.length}곳 (${R.regular_n}곳 이상)`, regulars.flat());
  // 색: 데님은 빼고 본다. 기본색 = 무채색
  const colored = items.filter(colorCounted);
  const basic = share(colored, (i) => i.achromatic);
  const accentN = colored.filter((i) => !i.achromatic).length;
  const goodN = known.filter(isGood).length;
  if (colored.length >= 5) {
    if (basic * 100 >= R.accent_basic_pct && accentN >= 1 && accentN <= R.accent_max_n)
      add("accent", R.accent, `무채색 ${P(basic)} (${R.accent_basic_pct}% 이상) + 유채색 ${accentN}벌 (1~${R.accent_max_n}벌)`, colored.filter((i) => !i.achromatic));
    if (basic * 100 >= R.basic_pct && goodN >= R.basic_lux_n)
      add("basic_lux", R.basic_lux, `무채색 ${P(basic)} (${R.basic_pct}% 이상) + 좋은 브랜드(디자이너·컨템포러리 중고가·진짜 헤리티지) ${goodN}벌 (${R.basic_lux_n}벌 이상)`, known.filter(isGood));
  }
  // 구매 공백·꾸준한 구매: 구매일 있는 옷 8벌 이상일 때
  const dated = items.filter((i) => i.date && Date.parse(i.date) <= now);
  if (dated.length >= 8) {
    const nowM = monthIndex(now);
    const months = new Set(dated.map((i) => monthIndex(Date.parse(i.date!))));
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
    add("gap", -Math.min(R.gap_max, gap), `최근 24개월 중 ${R.gap_months}개월 이상 연속으로 안 산 기간 합계 ${gap}개월 × 1점, 최대 ${R.gap_max}점`);
    let longest = 0;
    run = 0;
    for (let m = nowM - 11; m <= nowM; m++) {
      run = months.has(m) ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    if (longest < R.steady_gap) add("steady", R.steady, `최근 12개월 중 가장 오래 안 산 기간 ${longest}개월 (${R.steady_gap}개월 미만)`);
  }

  // 소비액: 구매일·가격이 있는 옷 8벌 이상일 때, 최근 12개월 합계 / 4
  const datedPriced = items.filter((i) => i.date && Date.parse(i.date) <= now && i.price != null && i.price > 0);
  if (datedPriced.length >= 8) {
    const year = datedPriced.filter((i) => now - Date.parse(i.date!) <= 365 * DAY);
    const quarter = year.reduce((s, i) => s + i.price!, 0) / 4 / 10_000;
    add(
      "spend",
      quarter >= R.spend_top_won ? R.spend_top : quarter >= R.spend_a_won ? -R.spend_a : quarter >= R.spend_b_won ? -R.spend_b : -R.spend_c,
      `최근 12개월 석 달 평균 구매액 ${Math.round(quarter)}만 원 (${R.spend_top_won}만 원 이상 +${R.spend_top}, ${R.spend_a_won}만 원 이상 −${R.spend_a}, ${R.spend_b_won}만 원 이상 −${R.spend_b}, 그 아래 −${R.spend_c})`,
      year,
    );
  }

  // 새 브랜드 탐색: 최근 explore_months개월 안에 처음 산 브랜드가 전체 브랜드의 explore_pct% 이상
  if (byBrand.size >= R.explore_min_brands) {
    const since = now - R.explore_months * 30.44 * 86_400_000;
    const firstOf = (l: Item[]) => Math.min(...l.map((i) => (i.date ? Date.parse(i.date) : now)));
    const fresh = [...byBrand.values()].filter((l) => firstOf(l) >= since);
    if ((fresh.length / byBrand.size) * 100 >= R.explore_pct)
      add("explore", R.explore, `최근 ${R.explore_months}개월 안에 처음 산 브랜드 ${fresh.length}곳 / 전체 ${byBrand.size}곳 (${R.explore_pct}% 이상)`, fresh.flat());
  }

  // 2. 빼는 점수 --------------------------------------------------------------
  // 인기 쏠림: 랭킹템(하트·후기 많은 상품), 인기 대중 브랜드(좋아요 많음·중고가 미만·대중적, 또는 가격 레벨 3 이하 SPA), 무신사 인기 브랜드를 한 항목으로 센다(스탠다드는 따로 감점).
  const isPopularBrand = (i: Item) =>
    Boolean(i.brand) &&
    !isStandard(i) &&
    (((i.brand!.likes ?? 0) >= R.popular_likes_10k * 10_000 && i.brand!.price < R.popular_price && i.brand!.pop >= 4) || (i.brand!.positions.includes("SPA") && i.brand!.price <= 3) || isMusinsa(i));
  const isPopular = (i: Item) => !isStandard(i) && (ranking(i) || isPopularBrand(i));
  const popularList = items.filter(isPopular);
  const popularShare = items.length ? popularList.reduce((s, i) => s + (i.brand?.positions.includes("SPA") ? 1 : youngWeight(opts.age, i, now, R)), 0) / items.length : 0;
  add(
    "popular",
    -over(popularShare, R.popular_from, R.popular_per10, R.popular_max),
    `인기 쏠림(랭킹템·인기 대중 브랜드·무신사 인기 브랜드) ${P(popularShare)} (${R.popular_from}% 넘는 10%마다 −${R.popular_per10}, 최대 −${R.popular_max}${opts.age != null ? `, ${youngNote(R)}` : ""}). 랭킹템 = 하트 ${(R.rank_likes_k * 1000).toLocaleString()}개·후기 ${(R.rank_reviews_h * 100).toLocaleString()}개 이상`,
    popularList,
  );
  if (enough) {
    const isTrendy = (i: Item) => i.brand!.hype >= 4 && i.brand!.pop >= 4;
    const trendy = share(known, isTrendy);
    if (trendy * 100 >= R.trendy_pct) add("trendy", -R.trendy, `하이프·대중성 모두 높은 브랜드 ${P(trendy)} (${R.trendy_pct}% 이상)`, known.filter(isTrendy));
    // 스타일 모르고 산 명품: 명품 하우스가 1~2벌뿐인데 그 스타일이 나머지 주문의 주력 스타일(상위 2개)과 안 겹침
    const lux = known.filter((i) => i.groups.includes("luxury"));
    if (lux.length >= 1 && lux.length <= 2) {
      const rest = new Map<string, number>();
      for (const i of known.filter((x) => !lux.includes(x))) for (const t of new Set(i.brand!.tags)) rest.set(t, (rest.get(t) ?? 0) + 1);
      const main = [...rest.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t);
      if (main.length && lux.every((i) => !i.brand!.tags.some((t) => main.includes(t))))
        add("lux_mismatch", -R.lux_mismatch, `명품 하우스 ${lux.length}벌의 스타일이 주력 스타일(${main.join("·")})과 안 겹침`, lux);
    }
  }
  const standard = clothes.filter(isStandard);
  const standardShare = clothes.length ? standard.length / clothes.length : 0;
  if (standardShare * 100 >= R.standard_a_pct)
    add("standard", -(standardShare * 100 >= R.standard_b_pct ? R.standard_b : R.standard_a), `무신사 스탠다드 ${standard.length}벌, ${P(standardShare)} (${R.standard_a_pct}% 이상 −${R.standard_a}, ${R.standard_b_pct}% 이상 −${R.standard_b})`, standard);
  const [, brandTop] = [...byBrand.entries()].sort((x, y) => y[1].length - x[1].length)[0] ?? [null, []];
  if (named.length >= R.one_brand_n && brandTop.length / named.length >= R.one_brand_pct / 100)
    add("one_brand", -R.one_brand, `${brandTop[0].brandLabel} ${brandTop.length}벌, ${P(brandTop.length / named.length)} (${R.one_brand_pct}% 이상)`, brandTop);
  // 쏠림 계열(인기 쏠림·스탠다드·한 브랜드 몰빵·유행 브랜드) 감점 합계 상한
  const pileSum = parts.filter((p) => ["popular", "standard", "one_brand", "trendy"].includes(p.id)).reduce((t, p) => t + p.delta, 0);
  if (pileSum < -R.pile_max) add("pile_cap", -R.pile_max - pileSum, `쏠림 감점 합계 ${Math.round(pileSum)}점이 상한(−${R.pile_max}점)을 넘어 ${Math.round(-R.pile_max - pileSum)}점 돌려줌`);
  const month = busiestMonth(a);
  if (month && month.pct >= R.sale_month_pct) add("sale_month", -R.sale_month, `해마다 ${month.month}월에 산 옷 ${month.pct}% (${R.sale_month_pct}% 이상)`, month.list);
  const avg = avgPrice(clothes);
  if (avg > 0 && avg < R.cheap_won * 10_000) add("cheap", -R.cheap, `옷 한 벌 평균 ${won(avg)} (${R.cheap_won}만 원 미만)`);
  // 극단적 저가: 한 벌 tiny_won만 원 미만인 옷 비율(가격 있는 옷 기준)
  const priced = clothes.filter((i) => i.price != null && i.price > 0);
  const tinyList = priced.filter((i) => i.price! < R.tiny_won * 10_000);
  if (priced.length >= 5 && (tinyList.length / priced.length) * 100 >= R.tiny_pct)
    add("tiny", -R.tiny, `${R.tiny_won}만 원 미만 옷 ${tinyList.length}벌, ${P(tinyList.length / priced.length)} (${R.tiny_pct}% 이상)`, tinyList);
  // 사이즈 갈팡질팡: 같은 브랜드에서 구매 간격이 size_gap_months개월 미만으로 이어진 옷들의 사이즈가 size_kinds_n종 이상(1.5년 이상 떨어진 구매는 사이즈가 달라도 따로 본다)
  const sizeOf = (i: Item) => (i.g.sizeLabel ?? "").toUpperCase().replace(/\s+/g, "");
  const messy: Item[] = [];
  for (const list of byBrand.values()) {
    const dated = list.filter((i) => i.date && sizeOf(i) && i.cat !== "shoes" && i.cat !== "hat").sort((x, y) => Date.parse(x.date!) - Date.parse(y.date!));
    let run: Item[] = [];
    const flush = () => {
      if (new Set(run.map(sizeOf)).size >= R.size_kinds_n) messy.push(...run);
      run = [];
    };
    for (const i of dated) {
      if (run.length && Date.parse(i.date!) - Date.parse(run[run.length - 1].date!) >= R.size_gap_months * 30.44 * DAY) flush();
      run.push(i);
    }
    flush();
  }
  if (messy.length) add("size_mess", -R.size_mess, `같은 브랜드에서 ${R.size_gap_months}개월 안에 이어 산 옷의 사이즈가 ${R.size_kinds_n}종 이상 (${[...new Set(messy.map((i) => i.brandLabel))].join("·")})`, messy);
  // 내 치수에 크게 안 맞는 옷: 내 치수를 입력했고 실측을 읽은 옷만(a.items의 fit은 내 치수로 계산한 것)
  const fitted = clothes.filter((i) => i.fit != null);
  const offList = fitted.filter((i) => i.fit!.level === "too_small" || i.fit!.level === "too_big");
  if (fitted.length >= R.body_off_min_n && (offList.length / fitted.length) * 100 >= R.body_off_pct)
    add("body_off", -Math.min(R.body_off_max, R.body_off + ((offList.length / fitted.length) * 100 - R.body_off_pct) / 10), `내 치수에 너무 작거나 너무 큰 옷 ${offList.length}벌 / 실측을 읽은 ${fitted.length}벌, ${P(offList.length / fitted.length)} (${R.body_off_pct}% 이상 −${R.body_off}, 10%p 늘 때마다 −1, 최대 −${R.body_off_max})`, offList);
  // 같은 옷 반복: 같은 상품(색만 다른 것 포함)을 같은 실측(실측을 못 찾으면 같은 사이즈)으로 다른 주문에서 또 산 것.
  // 한 주문의 팩(2PACK 등)은 한 번으로 본다.
  const fitKey = (i: Item) => a.orders?.measure[i.id] ?? (i.g.sizeLabel ? `size:${i.g.sizeLabel.toUpperCase().replace(/\s+/g, "")}` : null);
  const sameProduct = [...groupBy(items, (i) => (i.g.productName && fitKey(i) ? `${i.brandLabel}|${i.g.productName}|${fitKey(i)}`.toLowerCase() : null)).values()]
    .map((l) => [...groupBy(l, (i) => String(a.orders?.orderOf[i.id] ?? i.id)).values()].map((g) => g[0]))
    .filter((l) => l.length > 1);
  const copies = sameProduct.reduce((n, l) => n + l.length - 1, 0);
  add("dup", -Math.min(R.dup_max, copies * R.dup_each), `같은 상품을 같은 실측(없으면 사이즈)으로 다른 주문에서 또 산 것 ${copies}벌 × ${R.dup_each}점, 최대 ${R.dup_max}점`, sameProduct.flat());
  if (rs.orders >= 8 && rs.returnPct >= R.return_high_pct) add("return_high", -R.return_high, `주문 ${rs.orders}건 중 반품 ${rs.returned}건·교환 ${rs.exchanged}건(${rs.returnPct}%, ${R.return_high_pct}% 이상)`);
  if (rs.orders >= 8 && rs.cancelPct >= R.cancel_pct) add("cancel", -R.cancel, `주문 ${rs.orders}건 중 취소 ${rs.cancelled}건(${rs.cancelPct}%, ${R.cancel_pct}% 이상)`);
  if (enough && styleTop * 100 < R.scattered_pct && named.length >= 8 && byBrand.size / named.length >= 0.7)
    add("scattered", -R.scattered, `가장 많은 스타일 ${P(styleTop)} (${R.scattered_pct}% 미만) + 옷 ${named.length}벌에 브랜드 ${byBrand.size}곳`, named);
  const logo = share(clothes, isLogo);
  if (clothes.length && logo * 100 >= R.logo_pct) add("logo", -R.logo, `상품명에 '로고'가 든 옷 ${P(logo)} (${R.logo_pct}% 이상)`, clothes.filter(isLogo));
  if (shoes.length >= 3 && shoes.every((i) => i.sub === "shoes.sneakers" || i.sub === "shoes.sports")) add("sneakers_only", -R.sneakers_only, `신발 ${shoes.length}켤레가 모두 스니커즈·스포츠화`, shoes);
  // 무채색뿐인데 고급 브랜드가 없음(데님은 색에서 뺀다)
  if (colored.length >= 5 && basic * 100 >= R.basic_pct && enough && !known.some(isNice))
    add("basic_mass", -(basic * 100 >= R.basic_full_pct ? R.basic_mass : R.basic_mass_mid), `무채색 ${P(basic)} (${R.basic_pct}% 이상 -${R.basic_mass_mid}, ${R.basic_full_pct}% 이상 -${R.basic_mass}) + 고급 브랜드(컨템포러리 이상이거나 중고가 이상) 0벌`, known);
  // 새 감점(주문내역에만 있는 정보)
  // 몰아 사기 날: 하루에 서로 다른 주문으로 옷 binge_n벌 이상(팩은 한 벌로)
  const byDay = groupBy(items, (i) => i.date);
  const bingeDays = [...byDay.values()].filter((l) => new Set(l.map((i) => a.orders?.orderOf[i.id] ?? i.id)).size >= R.binge_n);
  if (bingeDays.length)
    add("binge", -Math.min(R.binge_max, bingeDays.length * R.binge_each), `하루에 다른 주문으로 옷 ${R.binge_n}벌 이상 산 날 ${bingeDays.length}일 × ${R.binge_each}점, 최대 ${R.binge_max}점`, bingeDays.flat());
  // 반품하고 또 사는 브랜드: 반품 2건 이상인 브랜드의 옷을 return_brand_n벌 이상 가지고 있음
  if (rs.topBrand) {
    const kept = items.filter((i) => i.brandLabel.toLowerCase() === rs.topBrand!.toLowerCase());
    if (kept.length >= R.return_brand_n) add("return_brand", -R.return_brand, `${rs.topBrand} 반품 ${rs.topBrandN}건인데 가진 옷 ${kept.length}벌 (${R.return_brand_n}벌 이상)`, kept);
  }
  // 기본 상의만: 반팔·긴팔 티, 맨투맨, 후드 비율
  const basicTops = clothes.filter((i) => i.sub != null && BASIC_TOPS.has(i.sub));
  if (clothes.length >= 10 && basicTops.length / clothes.length >= R.basic_tops_pct / 100)
    add("basic_tops", -R.basic_tops, `티셔츠·맨투맨·후드 ${basicTops.length}벌, ${P(basicTops.length / clothes.length)} (${R.basic_tops_pct}% 이상)`, basicTops);

  // 3. 나이에 맞는 주문: 산 때 나이 구간별로 그 구간 옷끼리 비율을 내고, 그 구간 비중만큼 반영
  let age: OrderScore["age"] = null;
  if (opts.age != null && items.length >= 5) {
    let worst = 0;
    for (const [band, list] of groupBy(items, (i) => bandOf(ageAt(opts.age!, i, now)))) {
      const rule = AR[band] ?? {};
      if (list.length < 3) continue;
      const weight = list.length / items.length;
      const hit = (kind: OrderAgeKind, pctKey: string, pointKey: string, sign: 1 | -1, f: (i: Item) => boolean) => {
        if (rule[pctKey] == null || !rule[pointKey]) return;
        const s = share(list, f);
        if (s * 100 < rule[pctKey]) return;
        const d = sign * rule[pointKey] * weight;
        add(`age_${kind}`, d, `${bandName(band)}에 산 옷 ${list.length}벌 중 ${P(s)} (${rule[pctKey]}% 이상) × ${sign > 0 ? "+" : "−"}${rule[pointKey]}점 × 비중 ${P(weight)}`, list.filter(f));
        if (sign < 0 && -d > worst) {
          worst = -d;
          age = { kind, pct: Math.round(s * 100), age: opts.age! };
        } else if (sign > 0 && !age) age = { kind, pct: Math.round(s * 100), age: opts.age! };
      };
      hit(band === "b0" || band === "b20" ? "young_street" : "street", "street_plus_pct", "street_plus", 1, isStreet);
      hit("street", "street_pct", "street_minus", -1, isStreet);
      hit("mature", "mature_pct", "mature_plus", 1, isMature);
      hit("rank", "rank_pct", "rank_minus", -1, ranking);
      hit("standard", "standard_pct", "standard_minus", -1, isStandard);
      hit("formal", "formal_pct", "formal_minus", -1, isFormalLux);
      const lux = list.filter((i) => i.groups.includes("luxury"));
      if (rule.lux_n != null && rule.lux_minus && lux.length >= rule.lux_n) {
        add("age_lux", -rule.lux_minus * weight, `${bandName(band)}에 산 명품 ${lux.length}벌 (${rule.lux_n}벌 이상) × −${rule.lux_minus}점 × 비중 ${P(weight)}`, lux);
        if (rule.lux_minus * weight > worst) age = { kind: "lux", pct: 0, age: opts.age };
      }
    }
  }

  return { score: R.base + parts.reduce((s, p) => s + p.delta, 0), parts, age };
}

export function orderTier(score: number, rules?: Partial<OrderRules>): "high" | "mid" | "low" {
  const R = orderRules(rules);
  return score >= R.tier_high ? "high" : score >= R.tier_low ? "mid" : "low";
}

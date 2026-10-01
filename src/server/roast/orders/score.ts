import "server-only";
import { colorCounted, type Analysis, type Item } from "../analyze";
import { brandLabels, MUSINSA_POPULAR, musinsaLikesCut } from "../brands";
import { ageAt, bandName, bandOf, isMidTier, isNice, isTopDesigner, type ScorePart } from "../score";
import { SCORE_RULES } from "../score-deltas";
import { won } from "../text";
import { avgPrice, busiestMonth, isHidden, isRanking, isStandard, orderRules, returnStats, thirds, topTag } from "./metrics";
import { ORDER_AGE_RULES, type OrderRules } from "./rules";

/**
 * 주문내역 훈수 점수(점수 계산표 /mnt/project-files/roast/order-score-table.md). 옷장 훈수 점수 기준 v4(score.ts)를 바탕으로
 * 주문내역에만 있는 것(상품 하트·후기, 반품·취소, 주문일)을 더했다.
 * 질문·퀴즈 답의 증감은 여기서 더하지 않는다(report.ts).
 */

const DAY = 86_400_000;

export type OrderAgeKind = "rank" | "standard" | "street" | "mature" | "young_street" | "lux";
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
  const hidden = (i: Item) => isHidden(a, i, R);
  const likesCut = musinsaLikesCut(SCORE_RULES.musinsa_likes_top);
  const isMusinsa = (i: Item) =>
    !i.groups.includes("mass") && !isStandard(i) && (brandLabels(i.g.brand).includes(MUSINSA_POPULAR) || (likesCut != null && (i.brand?.likes ?? 0) >= likesCut));

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
  const noLikes = known.filter((i) => !i.brand!.likes && i.brand!.price >= 4);
  add("nolikes", Math.min(R.nolikes_max, noLikes.length * R.nolikes_each), `무신사 좋아요 없는 중고가 이상 브랜드 ${noLikes.length}벌 × ${R.nolikes_each}점, 최대 ${R.nolikes_max}점`, noLikes);
  const hiddenList = items.filter(hidden);
  const hiddenShare = items.length ? hiddenList.length / items.length : 0;
  add("hidden", upTo(hiddenShare, R.hidden_full, R.hidden_max), `숨은 상품(하트 ${R.hidden_likes_h * 100}개 미만) ${P(hiddenShare)}, ${R.hidden_full}%면 만점 ${R.hidden_max}점`, hiddenList);
  if (enough && style) {
    add(
      "style",
      styleTop * 100 >= R.style_high_pct ? R.style_high : styleTop * 100 >= R.style_mid_pct ? R.style_mid : 0,
      `가장 많은 스타일 '${style.tag}' ${P(styleTop)} (${R.style_high_pct}% 이상 +${R.style_high}, ${R.style_mid_pct}% 이상 +${R.style_mid})`,
      known.filter((i) => i.brand!.tags.includes(style.tag)),
    );
    const isTaste = (i: Item) => i.groups.includes("jp_denim") || (i.brand?.heritage ?? 0) >= 4 || (i.brand?.tags ?? []).some((t) => /워크웨어|빈티지|아메카지/.test(t));
    const taste = share(known, isTaste);
    add("taste", upTo(taste, R.taste_full, R.taste_max), `헤리티지·워크웨어·아메카지 ${P(taste)}, ${R.taste_full}%면 만점 ${R.taste_max}점`, known.filter(isTaste));
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

  // 2. 빼는 점수 --------------------------------------------------------------
  const rankList = items.filter(ranking);
  const rankShare = items.length ? rankList.length / items.length : 0;
  add("rank", -over(rankShare, R.rank_from, R.rank_per10, R.rank_max), `랭킹템(하트 ${(R.rank_likes_k * 1000).toLocaleString()}개·후기 ${(R.rank_reviews_h * 100).toLocaleString()}개 이상) ${P(rankShare)} (${R.rank_from}% 넘는 10%마다 −${R.rank_per10}, 최대 −${R.rank_max})`, rankList);
  if (enough) {
    // 무신사 좋아요가 많고 고가 미만이면서 대중적인 브랜드 쏠림(무신사 스탠다드는 따로 감점하므로 뺀다)
    const isPopular = (i: Item) => !isStandard(i) && (i.brand!.likes ?? 0) >= R.popular_likes_10k * 10_000 && i.brand!.price < 5 && i.brand!.pop >= 4;
    const popular = share(known, isPopular);
    add("popular", -over(popular, R.popular_from, R.popular_per10, R.popular_max), `좋아요 ${(R.popular_likes_10k * 10_000).toLocaleString()} 이상·고가 미만·대중적 브랜드(스탠다드 제외) ${P(popular)} (${R.popular_from}% 넘는 10%마다 −${R.popular_per10}, 최대 −${R.popular_max})`, known.filter(isPopular));
    const isTrendy = (i: Item) => i.brand!.hype >= 4 && i.brand!.pop >= 4;
    const trendy = share(known, isTrendy);
    if (trendy * 100 >= R.trendy_pct) add("trendy", -R.trendy, `하이프·대중성 모두 높은 브랜드 ${P(trendy)} (${R.trendy_pct}% 이상)`, known.filter(isTrendy));
    // 스타일 모르고 산 명품: 디자이너·럭셔리가 1~2벌뿐인데 그 스타일이 나머지 주문의 주력 스타일(상위 2개)과 안 겹침
    const lux = known.filter((i) => i.groups.includes("designer") || i.groups.includes("luxury"));
    if (lux.length >= 1 && lux.length <= 2) {
      const rest = new Map<string, number>();
      for (const i of known.filter((x) => !lux.includes(x))) for (const t of new Set(i.brand!.tags)) rest.set(t, (rest.get(t) ?? 0) + 1);
      const main = [...rest.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t);
      if (main.length && lux.every((i) => !i.brand!.tags.some((t) => main.includes(t))))
        add("lux_mismatch", -R.lux_mismatch, `디자이너·명품 ${lux.length}벌의 스타일이 주력 스타일(${main.join("·")})과 안 겹침`, lux);
    }
  }
  if (named.length >= 8) {
    const w = (i: Item) => (opts.age != null && ageAt(opts.age, i, now) <= R.musinsa_young_age ? 1 / Math.max(R.musinsa_young_div, 1) : 1);
    const list = named.filter(isMusinsa);
    const m = list.reduce((s, i) => s + w(i), 0) / named.length;
    add("musinsa", -over(m, R.musinsa_from, R.musinsa_per10, R.musinsa_max), `무신사 인기 브랜드(스탠다드·SPA 제외) ${P(m)} (${R.musinsa_from}% 넘는 10%마다 −${R.musinsa_per10}, 최대 −${R.musinsa_max}${opts.age != null ? `, ${R.musinsa_young_age}세 이하에 산 옷은 1/${R.musinsa_young_div}로 셈` : ""})`, list);
  }
  const standard = clothes.filter(isStandard);
  const standardShare = clothes.length ? standard.length / clothes.length : 0;
  if (standardShare * 100 >= R.standard_a_pct)
    add("standard", -(standardShare * 100 >= R.standard_b_pct ? R.standard_b : R.standard_a), `무신사 스탠다드 ${standard.length}벌, ${P(standardShare)} (${R.standard_a_pct}% 이상 −${R.standard_a}, ${R.standard_b_pct}% 이상 −${R.standard_b})`, standard);
  const [, brandTop] = [...byBrand.entries()].sort((x, y) => y[1].length - x[1].length)[0] ?? [null, []];
  if (named.length >= R.one_brand_n && brandTop.length / named.length >= R.one_brand_pct / 100)
    add("one_brand", -R.one_brand, `${brandTop[0].brandLabel} ${brandTop.length}벌, ${P(brandTop.length / named.length)} (${R.one_brand_pct}% 이상)`, brandTop);
  const month = busiestMonth(a);
  if (month && month.pct >= R.sale_month_pct) add("sale_month", -R.sale_month, `해마다 ${month.month}월에 산 옷 ${month.pct}% (${R.sale_month_pct}% 이상)`, month.list);
  const avg = avgPrice(clothes);
  if (avg > 0 && avg < R.cheap_won * 10_000) add("cheap", -R.cheap, `옷 한 벌 평균 ${won(avg)} (${R.cheap_won}만 원 미만)`);
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
  const colored = items.filter(colorCounted);
  const basic = share(colored, (i) => i.achromatic);
  if (colored.length >= 5 && basic * 100 >= R.basic_pct && enough && !known.some(isNice))
    add("basic_mass", -R.basic_mass, `무채색 ${P(basic)} (${R.basic_pct}% 이상) + 고급 브랜드(컨템포러리 이상이거나 중고가 이상) 0벌`, known);
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

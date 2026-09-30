import "server-only";
import type { RoastReport } from "@/lib/roast/types";
import type { Analysis, Item } from "../analyze";
import { splitLead, tryFill, type ReportOverride } from "../report";
import { rng, won } from "../text";
import type { RoastTexts } from "../texts";
import { avgPrice, busiestMonth, isHidden, isRanking, isStandard, likesOf, orderRules, returnStats, thirds, topTag } from "./metrics";
import type { OrderRules } from "./rules";
import type { OrderScore } from "./score";
import { ORDER_PART_NAME } from "./texts";

/**
 * 주문내역 훈수 결과: 옷장 훈수 결과(buildReport)에 얹는 주문내역 문단·점수·첫 줄.
 * 문단 순서: 하트로 본 대중성 → 무신사 스탠다드 → 한 벌 평균가 → 시기별 변화 → 세일 달 → 반품·교환 → 취소 → 나이 한마디
 */

/** 주문내역 질문 → 답을 붙일 문단 */
const ANSWER_TO: Record<string, string[]> = {
  o_ranking: ["o_popularity"],
  o_review: ["o_popularity"],
  o_standard: ["o_standard"],
  o_cheapest: ["o_price"],
  o_shift: ["o_shift"],
  o_sale_month: ["o_sale_month"],
  o_returns: ["o_returns"],
  o_cancel: ["o_cancel"],
};

export function orderOverride(a: Analysis, seed: number, T: RoastTexts, score: OrderScore): ReportOverride {
  const r = rng(seed ^ 0x51ed27a3);
  const R: OrderRules = orderRules(T.score.orules as Partial<OrderRules>);
  const O = T.orders.report;
  const points: RoastReport["points"] = [];
  const photos = (list: Item[], n = 12) => list.filter((i) => i.hasPhoto).map((i) => i.id).slice(0, n);
  const put = (id: string, list: readonly string[], vars: Record<string, string | number>, shown: Item[] = []) => {
    const t = tryFill(r, list, vars);
    if (t) points.push({ id, ...splitLead(t), ...(shown.length ? { photos: photos(shown) } : {}) });
  };
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const items = a.items;

  // 하트로 본 대중성
  const rank = items.filter((i) => isRanking(a, i, R));
  const hidden = items.filter((i) => isHidden(a, i, R));
  if (items.length >= 5 && rank.length / items.length >= 0.3) {
    const top = [...rank].sort((x, y) => (likesOf(a, y) ?? 0) - (likesOf(a, x) ?? 0))[0];
    const topLikes = likesOf(a, top);
    put("o_popularity", O.popularity.high, { pct: pct(rank.length, items.length), likes: (R.rank_likes_k * 1000).toLocaleString("ko-KR"), ...(topLikes != null ? { top: `${top.brandLabel} ${top.g.productName}`.trim(), topLikes: topLikes.toLocaleString("ko-KR") } : {}) }, rank);
  } else if (items.length >= 5 && hidden.length / items.length >= 0.25)
    put("o_popularity", O.popularity.low, { pct: pct(hidden.length, items.length), hidden: (R.hidden_likes_h * 100).toLocaleString("ko-KR") }, hidden);

  // 무신사 스탠다드
  const standard = a.clothes.filter(isStandard);
  if (standard.length >= 3 && standard.length / Math.max(a.clothes.length, 1) >= R.standard_a_pct / 100)
    put("o_standard", O.standard, { n: standard.length, pct: pct(standard.length, a.clothes.length) }, standard);

  // 한 벌 평균가
  const avg = avgPrice(a.clothes);
  if (avg > 0) put("o_price", avg < R.cheap_won * 10_000 ? O.price.cheap : avg >= 100_000 ? O.price.pricey : O.price.mid, { avgWon: won(avg) });

  // 시기별 변화(스타일 → 랭킹템 비율 → 가격대 중 뚜렷한 하나)
  const t = thirds(a, R.shift_min_n);
  if (t) {
    const o = topTag(t.old);
    const n = topTag(t.recent);
    const share = (list: Item[]) => pct(list.filter((i) => isRanking(a, i, R)).length, list.length);
    const oldPct = share(t.old);
    const newPct = share(t.recent);
    const oldAvg = avgPrice(t.old);
    const newAvg = avgPrice(t.recent);
    const base = { from: t.from, to: t.to };
    if (o && n && o.tag !== n.tag) put("o_shift", O.shift.style, { ...base, old: o.tag, new: n.tag }, t.recent);
    else if (oldPct - newPct >= R.hipper_pp) put("o_shift", O.shift.hipper, { ...base, oldPct, newPct }, t.recent);
    else if (newPct - oldPct >= R.mainstream_pp) put("o_shift", O.shift.mainstream, { ...base, oldPct, newPct }, t.recent);
    else if (oldAvg > 0 && newAvg >= oldAvg * (1 + R.pricier_pct / 100)) put("o_shift", O.shift.pricier, { ...base, oldWon: won(oldAvg), newWon: won(newAvg) });
    else if (oldAvg > 0 && newAvg > 0 && newAvg <= oldAvg * (1 - R.pricier_pct / 100)) put("o_shift", O.shift.cheaper, { ...base, oldWon: won(oldAvg), newWon: won(newAvg) });
  }

  // 세일 달
  const month = busiestMonth(a);
  if (month && month.pct >= R.sale_month_pct) put("o_sale_month", O.sale_month, { month: month.month, pct: month.pct }, month.list);

  // 반품·교환·취소
  const rs = returnStats(a);
  if (rs.returned + rs.exchanged >= 3) {
    if (rs.topBrand) put("o_returns", O.returns, { returned: rs.returned, exchanged: rs.exchanged, brand: rs.topBrand, brandN: rs.topBrandN });
    else put("o_returns", O.returns_plain, { returned: rs.returned, exchanged: rs.exchanged, pct: rs.returnPct });
  }
  if (rs.cancelled >= 3) put("o_cancel", O.cancel, { n: rs.cancelled });

  // 나이 한마디
  if (score.age) put("o_age", (O.age as Record<string, readonly string[]>)[score.age.kind] ?? [], { age: score.age.age, pct: score.age.pct });

  return {
    score,
    base: R.base,
    partName: ORDER_PART_NAME,
    points,
    answerTo: ANSWER_TO,
    headline: O.HEADLINE,
    totalLead: O.TOTAL_LEAD,
    skipDiags: ["shop"],
  };
}

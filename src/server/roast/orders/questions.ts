import "server-only";
import type { Analysis, Item } from "../analyze";
import { QUESTIONS, type QuestionDef } from "../questions";
import { won } from "../text";
import { busiestMonth, isRanking, isStandard, likesOf, orderRules, recentItems, returnStats, thirds, topTag } from "./metrics";

/**
 * 주문내역 훈수 질문. 조건은 여기, 문구는 orders/texts.ts(ORDER_Q_TEXT, 관리자 "주문내역 훈수" 탭)에 있다.
 * 패션 퀴즈·밥과 옷·패셔너블 질문은 옷장 훈수 것을 그대로 쓴다.
 */

const photoIds = (list: Item[]) => list.filter((i) => i.hasPhoto).map((i) => i.id);
/** 질문 조건의 기준값은 기본 점수 기준을 쓴다(관리자가 고친 값과 약간 어긋나도 질문 후보에만 영향) */
const R = orderRules();

const rankList = (a: Analysis) => a.items.filter((i) => isRanking(a, i, R));
const brandVip = (a: Analysis) => {
  const by = new Map<string, Item[]>();
  for (const i of a.items) if (i.brandLabel && !isStandard(i)) by.set(i.brand?.name ?? i.brandLabel.toLowerCase(), [...(by.get(i.brand?.name ?? i.brandLabel.toLowerCase()) ?? []), i]);
  const top = [...by.values()].sort((x, y) => y.length - x.length)[0];
  return top && top.length >= 5 ? top : null;
};
const cheapest = (a: Analysis) =>
  a.clothes.filter((i) => i.price != null && i.price >= 5_000 && i.price <= 20_000 && i.subName).sort((x, y) => x.price! - y.price!)[0] ?? null;
const styleShift = (a: Analysis) => {
  const t = thirds(a, R.shift_min_n);
  if (!t) return null;
  const o = topTag(t.old);
  const n = topTag(t.recent);
  return o && n && o.tag !== n.tag ? { old: o.tag, new: n.tag, list: t.recent } : null;
};

export const ORDER_QUESTIONS: QuestionDef[] = [
  { id: "o_only_musinsa", bucket: "o_shop", base: 0.6, options: ["all", "also_other", "offline"], when: () => ({}) },
  { id: "o_ranking", bucket: "o_rank", base: 0.95, options: ["ranking", "popular_after", "didnt_know"],
    when: (a) => {
      const list = rankList(a);
      return list.length >= 5 ? { n: list.length, likes: (R.rank_likes_k * 1000).toLocaleString("ko-KR") } : null;
    },
    photos: (a) => photoIds(rankList(a).sort((x, y) => (likesOf(a, y) ?? 0) - (likesOf(a, x) ?? 0))).slice(0, 8) },
  // 후기 읽기와 후기 쓰기는 다른 일이라 따로 묻는다(사용자 요청).
  { id: "o_review_read", bucket: "o_review_read", base: 0.35, options: ["read", "photo", "skip"], when: () => ({}) },
  { id: "o_review_write", bucket: "o_review_write", base: 0.35, options: ["points", "good_only", "never"], when: () => ({}) },
  { id: "o_returns", bucket: "o_return", base: 0.9, options: ["size", "mind", "try_on"],
    when: (a) => {
      const rs = returnStats(a);
      return rs.returned + rs.exchanged >= 3 ? { n: rs.returned + rs.exchanged } : null;
    } },
  { id: "o_cancel", bucket: "o_return", base: 0.7, options: ["impulse", "price_drop", "mistake"],
    when: (a) => {
      const n = returnStats(a).cancelled;
      return n >= 3 ? { n } : null;
    } },
  { id: "o_sale_month", bucket: "o_timing", base: 0.8, options: ["cart", "same_day", "coincidence"],
    when: (a) => {
      const m = busiestMonth(a);
      return m && m.pct >= R.sale_month_pct ? { month: m.month, pct: m.pct } : null;
    } },
  { id: "o_brand_vip", bucket: "o_brand", base: 0.85, options: ["love", "sale", "didnt_know"],
    when: (a) => {
      const list = brandVip(a);
      return list ? { brand: list[0].brandLabel, n: list.length } : null;
    },
    photos: (a) => photoIds(brandVip(a) ?? []).slice(0, 8) },
  { id: "o_standard", bucket: "o_standard", base: 0.85, options: ["value", "lazy", "quit"],
    when: (a) => {
      const n = a.items.filter(isStandard).length;
      return n >= 5 ? { n } : null;
    },
    photos: (a) => photoIds(a.items.filter(isStandard)).slice(0, 8) },
  { id: "o_courier", bucket: "o_timing", base: 0.75, options: ["friends", "bundle", "just_now"],
    when: (a) => {
      const n = recentItems(a, 91).length;
      return n >= 8 ? { n } : null;
    } },
  { id: "o_shift", bucket: "o_shift", base: 0.8, options: ["taste", "trend", "both"],
    when: (a) => {
      const s = styleShift(a);
      return s ? { old: s.old, new: s.new } : null;
    },
    photos: (a) => photoIds(styleShift(a)?.list ?? []).slice(0, 6) },
  { id: "o_cheapest", bucket: "o_money", base: 0.6, options: ["wear", "once", "lost"],
    when: (a) => {
      const i = cheapest(a);
      return i ? { sub: i.subName!, priceWon: won(i.price!) } : null;
    },
    photos: (a) => photoIds([cheapest(a)].filter((i): i is Item => Boolean(i))) },
  { id: "o_grade", bucket: "o_shop", base: 0.55, options: ["top", "mid", "dont_care"],
    when: (a) => ((a.orders?.orders ?? 0) >= 30 ? { orders: a.orders!.orders } : null) },
  // 옷장 훈수와 같은 질문
  ...QUESTIONS.filter((q) => q.id === "quiz" || q.id === "food_vs_clothes" || q.id === "fashionable_q"),
];

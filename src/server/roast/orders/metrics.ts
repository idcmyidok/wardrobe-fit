import "server-only";
import type { Analysis, Item } from "../analyze";
import { ORDER_RULES, type OrderRules } from "./rules";

/** 점수·질문·결과 문단이 같이 쓰는 주문내역 수치 */

const DAY = 86_400_000;
export const orderRules = (rules?: Partial<OrderRules>): OrderRules => ({ ...ORDER_RULES, ...(rules ?? {}) });

export const isStandard = (i: Item) => /무신사\s*스탠다드|musinsa\s*standard|무탠다드/i.test(`${i.brandLabel} ${i.brand?.name ?? ""}`);

/** 상품 하트(없으면 null) */
export const likesOf = (a: Analysis, i: Item) => a.orders?.pop[i.id]?.likes ?? null;
export const reviewsOf = (a: Analysis, i: Item) => a.orders?.pop[i.id]?.reviews ?? null;

/** 랭킹템: 상품 하트·후기가 많거나, 하트를 못 읽었으면 브랜드 무신사 좋아요가 많은 상품 */
export function isRanking(a: Analysis, i: Item, R: OrderRules): boolean {
  const likes = likesOf(a, i);
  const reviews = reviewsOf(a, i);
  if (likes != null && likes >= R.rank_likes_k * 1000) return true;
  if (reviews != null && reviews >= R.rank_reviews_h * 100) return true;
  if (likes == null && reviews == null) return (i.brand?.likes ?? 0) >= R.rank_brand_10k * 10_000;
  return false;
}

/** 숨은 상품: 상품 하트가 적거나, 하트를 못 읽었으면 브랜드 좋아요가 적은(좋아요 자료가 있는) 상품 */
export function isHidden(a: Analysis, i: Item, R: OrderRules): boolean {
  const likes = likesOf(a, i);
  if (likes != null) return likes < R.hidden_likes_h * 100;
  const b = i.brand?.likes;
  return b != null && b > 0 && b < R.hidden_brand_k * 1000;
}

/** 구매일 순으로 세 몫으로 나눈 앞(오래된)·뒤(최근) 몫. 각 몫이 min벌 미만이면 null */
export function thirds(a: Analysis, min: number): { old: Item[]; recent: Item[]; from: string; to: string } | null {
  const dated = a.clothes.filter((i) => i.date).sort((x, y) => x.date!.localeCompare(y.date!));
  const n = Math.floor(dated.length / 3);
  if (n < Math.max(min, 1)) return null;
  const old = dated.slice(0, n);
  const recent = dated.slice(-n);
  const label = (list: Item[]) => {
    const f = list[0].date!.slice(0, 4);
    const t = list[list.length - 1].date!.slice(0, 4);
    return f === t ? `${f}년` : `${f}~${t}년`;
  };
  return { old, recent, from: label(old), to: label(recent) };
}

/** 해마다 같은 달을 합쳐 가장 많이 산 달과 그 비율(구매일 있는 옷 8벌 이상) */
export function busiestMonth(a: Analysis): { month: number; pct: number; list: Item[] } | null {
  const dated = a.items.filter((i) => i.date);
  if (dated.length < 8) return null;
  const by = new Map<number, Item[]>();
  for (const i of dated) {
    const m = Number(i.date!.slice(5, 7));
    by.set(m, [...(by.get(m) ?? []), i]);
  }
  // 대화의 "N월에 몰아 샀다" 문장(month_binge)과 같은 달을 말하도록, 그 패턴이 있으면 그 달을 쓴다.
  const binge = Number(a.patterns.find((p) => p.id === "month_binge")?.stats.month);
  const [month, list] = by.has(binge) ? [binge, by.get(binge)!] : [...by.entries()].sort((x, y) => y[1].length - x[1].length || x[0] - y[0])[0];
  return { month, pct: Math.round((list.length / dated.length) * 100), list };
}

/** 반품·교환·취소 수와 비율(비율의 분모는 주문 건수) */
export function returnStats(a: Analysis) {
  const o = a.orders;
  const returned = o?.events.filter((e) => e.status === "returned") ?? [];
  const cancelled = o?.events.filter((e) => e.status === "cancelled") ?? [];
  const exchanged = o?.exchanged ?? 0;
  const orders = Math.max(o?.orders ?? 0, 1);
  // 가장 많이 반품한 브랜드(2건 이상)
  const byBrand = new Map<string, number>();
  for (const e of returned) if (e.brand) byBrand.set(e.brand, (byBrand.get(e.brand) ?? 0) + 1);
  const [topBrand, topBrandN] = [...byBrand.entries()].sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
  return {
    returned: returned.length,
    cancelled: cancelled.length,
    exchanged,
    orders: o?.orders ?? 0,
    returnPct: Math.round(((returned.length + exchanged) / orders) * 100),
    cancelPct: Math.round((cancelled.length / orders) * 100),
    topBrand: topBrandN >= 2 ? topBrand : null,
    topBrandN,
  };
}

/** 최근 days일 동안 산 옷(주문 건 기준이 아니라 옷 벌 수) */
export const recentItems = (a: Analysis, days: number) =>
  a.items.filter((i) => i.date && a.now.getTime() - Date.parse(i.date) <= days * DAY && Date.parse(i.date) <= a.now.getTime());

/** 한 벌 평균가(가격 있는 옷, 원) */
export const avgPrice = (list: Item[]) => {
  const priced = list.filter((i) => i.price != null && i.price > 0);
  return priced.length ? priced.reduce((s, i) => s + i.price!, 0) / priced.length : 0;
};

/** 브랜드 자료가 있는 옷의 가장 많은 스타일 태그 */
export function topTag(list: Item[]): { tag: string; share: number } | null {
  const known = list.filter((i) => i.brand);
  if (!known.length) return null;
  const tags = new Map<string, number>();
  for (const i of known) for (const t of new Set(i.brand!.tags)) tags.set(t, (tags.get(t) ?? 0) + 1);
  const [tag, n] = [...tags.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0] ?? [null, 0];
  return tag ? { tag, share: n / known.length } : null;
}

/** 오래된 1/3과 최근 1/3의 주 스타일이 다를 때 그 둘. 동률이면 이름순으로 하나만 정해, 질문과 결과 글이 같은 스타일을 말한다. */
export function styleShiftOf(a: Analysis, min: number): { old: string; new: string; from: string; to: string; list: Item[]; older: Item[] } | null {
  const t = thirds(a, min);
  if (!t) return null;
  const o = topTag(t.old);
  const n = topTag(t.recent);
  return o && n && o.tag !== n.tag ? { old: o.tag, new: n.tag, from: t.from, to: t.to, list: t.recent, older: t.old } : null;
}

import type { Item } from "./analyze";

export interface ShiftRules {
  shift_min_n: number;
  shift_style_pp: number;
  shift_price: number;
}

export interface TasteShift {
  /** style: 주 스타일이 바뀜, price: 스타일은 같고 가격대만 바뀜 */
  kind: "style" | "price";
  fromLabel: string;
  toLabel: string;
  /** 바뀌기 전 스타일, 바뀐 뒤 스타일 */
  fromStyle: string;
  toStyle: string;
  /** 새 스타일이 최근 구간에서 차지하는 %와 예전 구간에서 차지하던 % */
  toPct: number;
  fromPct: number;
  /** 평균 가격 레벨(1~6) */
  fromPrice: number;
  toPrice: number;
  up: boolean;
  list: Item[];
}

const half = (date: string) => `${date.slice(0, 4)}년 ${Number(date.slice(5, 7)) <= 6 ? "상반기" : "하반기"}`;
/** "2024년 하반기" → 시간순으로 정렬되는 키 */
const key = (label: string) => label.replace("상반기", "1").replace("하반기", "2");
const styles = (i: Item) => [...new Set([...i.brand!.tags, ...i.brand!.positions])];
const topStyle = (list: Item[]) => {
  const m = new Map<string, number>();
  for (const i of list) for (const s of styles(i)) m.set(s, (m.get(s) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
};
const share = (list: Item[], s: string) => (list.length ? (list.filter((i) => styles(i).includes(s)).length / list.length) * 100 : 0);
const avgPrice = (list: Item[]) => list.reduce((a, i) => a + i.brand!.price, 0) / list.length;

/** 구매일 있는 옷을 반기로 묶어 가장 오래된 구간과 가장 최근 구간의 주 스타일·가격대를 비교한다. 변화가 없으면 null. */
export function detectTasteShift(items: Item[], now: number, R: ShiftRules): TasteShift | null {
  const buckets = new Map<string, Item[]>();
  for (const i of items) {
    if (!i.brand || !i.date || !(Date.parse(i.date) <= now)) continue;
    const k = half(i.date);
    buckets.set(k, [...(buckets.get(k) ?? []), i]);
  }
  const ok = [...buckets.entries()].filter(([, l]) => l.length >= R.shift_min_n);
  ok.sort((a, b) => key(a[0]).localeCompare(key(b[0])));
  if (ok.length < 2) return null;
  const [fromLabel, older] = ok[0];
  const [toLabel, newer] = ok[ok.length - 1];
  const a = topStyle(older);
  const b = topStyle(newer);
  if (!a || !b) return null;
  const fromPrice = avgPrice(older);
  const toPrice = avgPrice(newer);
  const base = { fromLabel, toLabel, fromStyle: a, toStyle: b, fromPrice, toPrice, up: toPrice > fromPrice, list: [...older, ...newer] };
  if (a !== b && share(newer, b) - share(older, b) >= R.shift_style_pp)
    return { ...base, kind: "style", toPct: Math.round(share(newer, b)), fromPct: Math.round(share(older, b)) };
  if (a === b && Math.abs(toPrice - fromPrice) >= R.shift_price)
    return { ...base, kind: "price", toPct: Math.round(share(newer, b)), fromPct: Math.round(share(older, a)) };
  return null;
}

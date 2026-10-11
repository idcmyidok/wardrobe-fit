import "server-only";
import type { FitLevel } from "@/lib/constants/body";
import { computeBodyFit, type BodyProfile } from "@/lib/fit/body-fit";
import type { Item } from "../analyze";
import { isTrueHeritage, MUSINSA_POPULAR, type BrandGroup } from "../brands";
import type { OrderContext } from "../orders/context";

/**
 * 패션 수준 평가가 읽는 신호 모음. 옷(Item) 목록에서 한 번만 계산해 두고, 유형 판정·항목 점수가 같이 쓴다.
 * 비율은 모두 0~1. 분모가 없으면 0.
 */

export type Mode = "closet" | "orders";

const OVER_LEVELS: FitLevel[] = ["over", "too_big"];
const BIG_LEVELS: FitLevel[] = ["semi_over", "over", "too_big"];

export interface Feat {
  mode: Mode;
  items: Item[];
  /** 모자·신발을 뺀 옷 */
  clothes: Item[];
  n: number;
  /** 브랜드 자료에 있는 옷 */
  known: Item[];
  /** 주문내역일 때만 */
  orders?: OrderContext;
  /** 조건에 맞는 옷의 비율(기본 분모: 전체 옷) */
  share(pred: (i: Item) => boolean, base?: Item[]): number;
  /** 브랜드 자료 기준 비율(분모: 자료에 있는 옷) */
  kshare(pred: (i: Item) => boolean): number;
  group(g: BrandGroup): number;
  level(min: number, max: number): number;
  tag(...tags: string[]): number;
  position(...p: string[]): number;
  /** 가장 많은 브랜드 */
  topBrand: { name: string; share: number; count: number; ids: string[] } | null;
  brandCount: number;
  achro: number;
  chroma: number;
  denim: number;
  colorCount: number;
  topColors3: number;
  cat: Record<"outer" | "top" | "bottom" | "hat" | "shoes", number>;
  /** 내가 표기한 핏과 앱이 내 치수로 계산한 예상 핏 */
  fits: { marked: number; expected: number; over: number; big: number; slim: number; regular: number; bothOver: number; mismatch: number; wide: number; bad: number };
  season: Record<"spring" | "summer" | "fall" | "winter", number>;
  avg: { formal: number; trend: number; heritage: number; hype: number; pop: number; price: number };
  /** 옷 값 평균(원) */
  avgPrice: number;
  shop: (name: string) => number;
  /** 제품명에 단어가 있는 옷의 비율 */
  word(re: RegExp): number;
  /** 같은 제품 반복(같은 브랜드·같은 분류·같은 색) 비율 */
  repeat: number;
  /** 스타일 태그 한 방향 집중도(상위 3개 태그의 몫) */
  tagFocus: number;
  /** 가장 많은 태그 */
  topTags: string[];
  /** 컬트 브랜드(대중성 1~2) 비율 */
  cult: number;
  /** 진짜 헤리티지 비율 */
  heritage: number;
  /** 중고·빈티지 플랫폼 구매 비율 */
  usedShop: number;
  /** 무신사 인기 라벨 비율(자료에 있는 옷 기준) */
  popular: number;
  /** 최근 6개월 구매 비율(주문내역·구매일 있는 옷) */
  recent: number;
  /** 구매일이 있는 옷 수 */
  dated: number;
}

const USED_SHOPS = new Set(["후르츠패밀리", "번개장터", "KREAM"]);
const used = (i: Item) => i.shop === "후르츠패밀리" || i.shop === "번개장터" || i.brandKind === "vintage";

const ratio = (n: number, d: number) => (d ? n / d : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** 예상 핏: 내 치수로 계산한 핏(치수·실측이 없으면 null) */
function expectedFit(i: Item, body: BodyProfile | null): FitLevel | null {
  if (!body || i.accessory) return null;
  const r = computeBodyFit(i.g, body);
  return r.status === "ok" ? r.level : null;
}

export function features(items: Item[], body: BodyProfile | null, mode: Mode, now: Date, orders?: OrderContext): Feat {
  const clothes = items.filter((i) => !i.accessory);
  const n = items.length;
  const known = items.filter((i) => i.brand);
  const kn = known.length;

  const share = (pred: (i: Item) => boolean, base: Item[] = items) => ratio(base.filter(pred).length, base.length);
  const kshare = (pred: (i: Item) => boolean) => ratio(known.filter(pred).length, kn);

  const byBrand = new Map<string, Item[]>();
  for (const i of known) byBrand.set(i.brand!.name, [...(byBrand.get(i.brand!.name) ?? []), i]);
  const topEntry = [...byBrand.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const topBrand = topEntry
    ? { name: topEntry[1][0].brandLabel || topEntry[0], share: topEntry[1].length / n, count: topEntry[1].length, ids: topEntry[1].map((i) => i.id) }
    : null;

  const colored = items.filter((i) => i.color && !i.denim);
  const colorCounts = new Map<string, number>();
  for (const i of colored) colorCounts.set(i.color!, (colorCounts.get(i.color!) ?? 0) + 1);
  const top3 = [...colorCounts.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);

  // 핏: 표기(userFit)와 예상 핏을 따로 센다.
  const marked = clothes.filter((i) => i.g.userFit);
  const expected = clothes.map((i) => ({ i, e: expectedFit(i, body) })).filter((x) => x.e);
  const markedOver = marked.filter((i) => OVER_LEVELS.includes(i.g.userFit!) || i.g.userFit === "semi_over").length;
  const expectedOver = expected.filter((x) => BIG_LEVELS.includes(x.e!)).length;
  const overShare = (() => {
    const parts: number[] = [];
    if (marked.length) parts.push(markedOver / marked.length);
    if (expected.length) parts.push(expectedOver / expected.length);
    return mean(parts);
  })();
  const bothBase = clothes.filter((i) => i.g.userFit && expectedFit(i, body));
  const effective = (i: Item): FitLevel | null => i.g.userFit ?? expectedFit(i, body);
  const eff = clothes.map(effective).filter((l): l is FitLevel => Boolean(l));
  const fitShare = (levels: FitLevel[]) => ratio(eff.filter((l) => levels.includes(l)).length, eff.length);
  const bothOver = ratio(
    bothBase.filter((i) => BIG_LEVELS.includes(i.g.userFit!) && BIG_LEVELS.includes(expectedFit(i, body)!)).length,
    bothBase.length,
  );
  const mismatch = ratio(
    bothBase.filter((i) => BIG_LEVELS.includes(i.g.userFit!) !== BIG_LEVELS.includes(expectedFit(i, body)!)).length,
    bothBase.length,
  );

  const seasonShare = (s: "spring" | "summer" | "fall" | "winter") => share((i) => i.seasons.includes(s) || i.seasons.includes("all"));

  const dated = items.filter((i) => i.date);
  const sixMonthsAgo = now.getTime() - 183 * 86_400_000;
  const recent = ratio(dated.filter((i) => Date.parse(i.date!) >= sixMonthsAgo).length, dated.length);

  // 같은 제품 반복
  const keyOf = (i: Item) => `${i.brand?.name ?? i.brandLabel}|${i.sub ?? i.cat}|${i.color ?? ""}`;
  const keyCounts = new Map<string, number>();
  for (const i of items) keyCounts.set(keyOf(i), (keyCounts.get(keyOf(i)) ?? 0) + 1);
  const repeat = ratio([...keyCounts.values()].filter((c) => c >= 2).reduce((a, b) => a + b, 0), n);

  const tagCounts = new Map<string, number>();
  for (const i of known) for (const t of i.brand!.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tagSorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const tagFocus = ratio(tagSorted.slice(0, 3).reduce((a, [, c]) => a + c, 0), [...tagCounts.values()].reduce((a, b) => a + b, 0));

  const prices = items.map((i) => i.price).filter((p): p is number => p != null && p > 0);

  return {
    mode,
    items,
    clothes,
    n,
    known,
    orders,
    share,
    kshare,
    group: (g) => kshare((i) => i.groups.includes(g)),
    level: (min, max) => kshare((i) => i.brand!.price >= min && i.brand!.price <= max),
    tag: (...tags) => kshare((i) => tags.some((t) => i.brand!.tags.includes(t))),
    position: (...p) => kshare((i) => p.some((x) => i.brand!.positions.includes(x))),
    topBrand,
    brandCount: byBrand.size,
    achro: ratio(colored.filter((i) => i.achromatic).length, colored.length),
    chroma: ratio(colored.filter((i) => !i.achromatic).length, colored.length),
    denim: share((i) => i.denim, clothes),
    colorCount: colorCounts.size,
    topColors3: ratio(top3, colored.length),
    cat: {
      outer: share((i) => i.cat === "outer"),
      top: share((i) => i.cat === "top"),
      bottom: share((i) => i.cat === "bottom"),
      hat: share((i) => i.cat === "hat"),
      shoes: share((i) => i.cat === "shoes"),
    },
    fits: {
      marked: ratio(marked.length, clothes.length),
      expected: ratio(expected.length, clothes.length),
      over: overShare,
      big: fitShare(BIG_LEVELS),
      slim: fitShare(["slim", "too_small"]),
      regular: fitShare(["regular"]),
      bothOver,
      mismatch,
      bad: fitShare(["too_big", "too_small"]),
      wide: share((i) => i.cat === "bottom" && (i.families.includes("wide") || i.families.includes("balloon") || i.families.includes("parachute") || (i.fit ? BIG_LEVELS.includes(i.fit.level) : false)), clothes.filter((i) => i.cat === "bottom")),
    },
    season: { spring: seasonShare("spring"), summer: seasonShare("summer"), fall: seasonShare("fall"), winter: seasonShare("winter") },
    avg: {
      formal: mean(known.map((i) => i.brand!.formal)),
      trend: mean(known.map((i) => i.brand!.trend)),
      heritage: mean(known.map((i) => i.brand!.heritage)),
      hype: mean(known.map((i) => i.brand!.hype)),
      pop: mean(known.map((i) => i.brand!.pop)),
      price: mean(known.map((i) => i.brand!.price)),
    },
    avgPrice: mean(prices),
    shop: (name) => share((i) => i.shop === name),
    word: (re) => share((i) => re.test(i.g.productName)),
    repeat,
    tagFocus,
    topTags: tagSorted.slice(0, 3).map(([t]) => t),
    cult: kshare((i) => i.brand!.pop <= 2),
    heritage: kshare((i) => isTrueHeritage(i.brand!)),
    usedShop: share((i) => used(i) || USED_SHOPS.has(i.shop ?? "") && i.shop !== "KREAM"),
    popular: kshare((i) => i.brand!.labels.includes(MUSINSA_POPULAR)),
    recent,
    dated: dated.length,
  };
}

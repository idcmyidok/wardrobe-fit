import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { RoastReport } from "@/lib/roast/types";
import { colorCounted, FIT_WORD, fitSummary, type Analysis, type Item } from "./analyze";
import { MUSINSA_POPULAR } from "./brands";
import { quotesAnswer } from "./compose";
import type { AskedQuestion } from "./questions";
import { fill, MissingVar, rng, won, type Rng, type Vars } from "./text";
import type { ReportTexts } from "./report-text";
import { SCORE_RULES, type ScoreRules } from "./score-deltas";
import { fitContrast, SCORE_PART_NAME, scoreWardrobe, type ScorePart, type WardrobeScore } from "./score";
import { findColorFamily } from "@/lib/constants/colors";

/**
 * 결과 페이지(옷장 진단 리포트, 기획 문서 "AI 옷장 평가 기능"). 수치는 모두 여기서 계산하고 문장은 REPORT_TEXT에서 고른다.
 * 취향에 가까운 항목(색·국가·하이프·포멀)은 점수로 깎지 않고 성향(DNA·진단 카드)으로만 쓴다.
 * 데이터가 모자란 항목(구매일·가격·핏·브랜드 정보가 적은 경우)은 뺀다.
 */

const DAY = 86_400_000;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const avg = (list: number[]) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : 0);
const median = (list: number[]) => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
function countBy<T>(list: T[], key: (x: T) => string | null | undefined): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

type Side = "high" | "low";
interface Diag {
  id: string;
  /** 문장 묶음(REPORT_TEXT.diag의 key) */
  key: string;
  side: Side;
  /** 0~1: 뚜렷한 정도(카드 순서) */
  strength: number;
  value: string;
  vars: Vars;
  photos: string[];
}

/** 대화 질문 → 답을 붙일 진단 카드 */
const ANSWER_TO: Record<string, string[]> = {
  brand_spend_q: ["brand"],
  brand_employee: ["brand"],
  brand_alert: ["brand"],
  color_taste: ["color"],
  black_why: ["color"],
  chroma_love: ["color"],
  justify_combo: ["duplicate", "similar"],
  rationalize: ["similar", "duplicate"],
  extreme_one: ["duplicate"],
  jjanggu_q: ["identical", "duplicate"],
  fruits_q: ["fruits"],
  bunjang_q: ["bunjang"],
  recent_reason: ["burst", "binge"],
  binge_month: ["binge", "burst"],
  musinsa_q: ["musinsa"],
  trend_source: ["hype", "musinsa"],
  hype_alarm: ["hype"],
  category_why: ["subcat", "category"],
  fit_choice: ["fit"],
  shop_q: ["shop"],
  country_q: ["country", "country_kr"],
  top_item_q: ["polar"],
  sale_q: ["polar"],
  splurge_q: ["polar"],
  subcat_spend_q: ["polar"],
  timeless_q: ["hype"],
  mountain: ["func"],
  sports_q: ["func"],
  formal_job: ["formal"],
  old_trust: ["heritage"],
};
/** 결과에 넣는 질문 답은 세 개까지 */

/**
 * 주문내역 훈수(orders/report.ts)가 결과를 바꿀 때: 점수는 주문내역 기준으로, 주문내역 문단은 진단 문단 앞에,
 * 첫 줄·총점 문장은 주문내역 문장으로 쓴다. 나머지(요약·목록·진단 문단)는 옷장 훈수와 같다.
 */
export interface ReportOverride {
  score: { score: number; parts: ScorePart[] };
  base: number;
  partName: Record<string, string>;
  points: RoastReport["points"];
  /** 질문 id → 답을 붙일 문단 id */
  answerTo: Record<string, string[]>;
  headline: Record<string, readonly string[]>;
  totalLead: readonly string[];
  /** 빼는 진단 문단(주문내역에서는 당연한 것, 예: 구매 링크가 전부 무신사) */
  skipDiags: string[];
}

export function buildReport(
  a: Analysis,
  name: string | null,
  seed: number,
  R: ReportTexts,
  asked: AskedQuestion[] = [],
  answers: Record<string, string> = {},
  score: Record<string, unknown> = {},
  age: number | null = null,
  override?: ReportOverride,
): RoastReport {
  const deltas = score as Record<string, Record<string, number>>;
  const r = rng(seed ^ 0x2f6a91c3);
  const items = a.items;
  const clothes = a.clothes;
  const now = a.now.getTime();
  const L = R.layout;
  const photosOf = (list: Item[]) => list.filter((i) => i.hasPhoto).map((i) => i.id).slice(0, L.count.photos);
  const diags: Diag[] = [];
  const add = (d: Omit<Diag, "key" | "photos"> & { key?: string; photos?: string[] }) => diags.push({ key: d.id, photos: [], ...d });

  // 카테고리 균형(4.1): 상의·하의·아우터 중 한 종류 몫
  const byCat = countBy(clothes, (i) => i.cat);
  const [cat, catList] = byCat[0] ?? [null, []];
  const catShare = catList.length / Math.max(clothes.length, 1);
  if (cat && catShare >= 0.45) add({ id: "category", side: "high", strength: clamp((catShare - 0.45) / 0.35) * 0.9 + 0.1, value: `${CATEGORY_NAME[cat as Item["cat"]]} ${pct(catList.length, clothes.length)}%`, vars: { catName: CATEGORY_NAME[cat as Item["cat"]], pct: pct(catList.length, clothes.length), n: catList.length }, photos: photosOf(catList) });
  else if (byCat.length >= 3 && catShare <= 0.4) add({ id: "category", side: "low", strength: 0.15, value: "종류별로 고른 편", vars: {} });

  // 중복 구매(4.2): 세부분류 + 색(+ 아는 핏)
  const groups = countBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}|${i.fit?.level ?? "-"}`);
  const dup = groups[0]?.[1] ?? [];
  const what = dup.length ? `${dup[0].color} ${dup[0].subName ?? "옷"}` : "";
  if (dup.length >= 3) add({ id: "duplicate", side: "high", strength: clamp((dup.length - 2) / 5), value: `${what} ${dup.length}벌`, vars: { what, n: dup.length }, photos: photosOf(dup) });
  else if (clothes.length >= 20 && dup.length <= 2) add({ id: "duplicate", side: "low", strength: 0.15, value: "중복 거의 없음", vars: {} });
  const overlap = (list: string[], other: Item[]) => list.filter((id) => other.some((i) => i.id === id)).length / Math.max(list.length, 1);

  // 같은 옷(제품명까지 같음), 실측이 비슷한 옷: 중복 구매 문단과 거의 겹치면 뺀다.
  const twin = a.patterns.find((p) => p.id === "identical_items");
  if (twin && overlap(twin.garmentIds, dup) < 0.5)
    add({ id: "identical", side: "high", strength: twin.strength * 0.9, value: "", vars: twin.stats, photos: twin.garmentIds });
  const near = a.patterns.find((p) => p.id === "measure_repeat");
  if (near && overlap(near.garmentIds, dup) < 0.5) {
    const list = clothes.filter((i) => near.garmentIds.includes(i.id));
    const sameColor = Math.max(0, ...countBy(list, (i) => i.color).map(([, l]) => l.length)) / Math.max(list.length, 1);
    add({ id: "similar", side: sameColor >= 0.6 ? "high" : "low", strength: near.strength * (sameColor >= 0.6 ? 0.9 : 0.5), value: "", vars: near.stats, photos: near.garmentIds });
  }
  // 같은 품목 반복: 세부분류 하나가 옷의 30% 이상(중복 구매 문단과 거의 겹치면 뺀다)
  const [, subList] = countBy(clothes, (i) => i.sub)[0] ?? [null, []];
  if (subList.length >= 5 && subList.length / Math.max(clothes.length, 1) >= 0.3 && overlap(subList.map((i) => i.id), dup) < 0.6)
    add({ id: "subcat", side: "high", strength: clamp((subList.length / clothes.length - 0.25) / 0.35) * 0.8, value: "", vars: { sub: subList[0].subName ?? "옷", n: subList.length, pct: pct(subList.length, clothes.length) }, photos: photosOf(subList) });

  // 컬러 편중(4.3)
  // 데님은 색 계산에서 뺀다(청바지를 무채색·유채색으로 세지 않게).
  const colored = items.filter(colorCounted);
  const achro = colored.filter((i) => i.achromatic);
  const achroShare = achro.length / Math.max(colored.length, 1);

  // 브랜드 편중(4.4): 적힌 브랜드 이름 기준
  const branded = items.filter((i) => i.brandKind === "known" || i.brandKind === "unknown");
  const byBrand = countBy(branded, (i) => i.brand?.name ?? i.brandLabel.toLowerCase());
  const [, brandList] = byBrand[0] ?? [null, []];
  const brandShare = brandList.length / Math.max(branded.length, 1);
  const brandName = brandList[0]?.brandLabel ?? "";
  if (branded.length >= 8) {
    if (brandShare >= 0.25) add({ id: "brand", side: "high", strength: clamp((brandShare - 0.2) / 0.4), value: `${brandName} ${pct(brandList.length, branded.length)}%`, vars: { brand: brandName, pct: pct(brandList.length, branded.length) }, photos: photosOf(brandList) });
    else if (byBrand.length / branded.length >= 0.7) add({ id: "brand", side: "low", strength: clamp((byBrand.length / branded.length - 0.6) / 0.4) * 0.8, value: `브랜드 ${byBrand.length}개`, vars: { brands: byBrand.length } });
  }

  // 브랜드 성향(4.5~4.9, 4.17~4.20): 브랜드 자료가 있는 옷만
  const known = items.filter((i) => i.brand);
  const K = known.length;
  const enough = K >= 5;
  const tags = countBy(known.flatMap((i) => i.brand!.tags.map((t) => ({ t, i }))), (x) => x.t).map(([t, l]) => ({ t, n: new Set(l.map((x) => x.i.id)).size }));
  if (enough && tags.length >= 3) {
    const [t1, t2, t3] = tags;
    const share = t1.n / K;
    if (share >= 0.6) add({ id: "style", side: "high", strength: clamp((share - 0.5) / 0.4) * 0.7, value: `${t1.t} ${pct(t1.n, K)}%`, vars: { tag1: t1.t, pct: pct(t1.n, K) } });
    else if (t3.n / t1.n >= 0.75 && share < 0.45) add({ id: "style", side: "low", strength: 0.4, value: `${t1.t} · ${t2.t} · ${t3.t}`, vars: { tag1: t1.t, tag2: t2.t, tag3: t3.t } });
  }

  // 무신사 동기화도(4.6): 브랜드를 적은 옷 중 무신사 인기 브랜드 표시가 있는 옷
  const labeled = branded.filter((i) => (i.brand?.labels ?? []).includes(MUSINSA_POPULAR));
  const musinsaShare = labeled.length / Math.max(branded.length, 1);
  if (branded.length >= 8) {
    if (musinsaShare >= 0.5) add({ id: "musinsa", side: "high", strength: clamp((musinsaShare - 0.4) / 0.5), value: `무신사 인기 브랜드 ${pct(labeled.length, branded.length)}%`, vars: { pct: pct(labeled.length, branded.length) }, photos: photosOf(labeled) });
    else if (musinsaShare <= 0.1) add({ id: "musinsa", side: "low", strength: 0.35, value: `무신사 인기 브랜드 ${pct(labeled.length, branded.length)}%`, vars: { pct: pct(labeled.length, branded.length) } });
  }

  const avgOf = (f: (i: Item) => number) => avg(known.map((i) => f(i)));
  const hype = avgOf((i) => i.brand!.hype);
  const pop = avgOf((i) => (i.brand!.pop + i.brand!.access) / 2);
  const heritage = avgOf((i) => i.brand!.heritage);
  const func = avgOf((i) => i.brand!.func);
  const formal = avgOf((i) => i.brand!.formal);
  if (enough) {
    if (hype >= 3.6) add({ id: "hype", side: "high", strength: clamp((hype - 3.3) / 1.2), value: "하이프 높음", vars: {} });
    else if (hype <= 2.2) add({ id: "hype", side: "low", strength: clamp((2.5 - hype) / 1.2), value: "하이프 낮음", vars: {} });
    if (pop >= 4.2) add({ id: "popularity", side: "high", strength: clamp((pop - 4) / 1) * 0.6, value: "메이저 중심", vars: { pct: pct(known.filter((i) => i.brand!.pop >= 5).length, K) } });
    else if (pop <= 2.4) add({ id: "popularity", side: "low", strength: clamp((2.7 - pop) / 1.2) * 0.8, value: "마이너 탐색", vars: {} });
    const founded = known.map((i) => i.brand!.founded).filter((y): y is number => y != null);
    const midYear = median(founded);
    if (heritage >= 3.8) add({ id: "heritage", side: "high", strength: clamp((heritage - 3.5) / 1.2) * 0.8, value: "헤리티지 브랜드 중심", vars: {} });
    else if (founded.length >= 5 && midYear >= a.now.getFullYear() - 5) add({ id: "heritage", side: "low", strength: 0.45, value: `절반이 ${midYear}년 이후 브랜드`, vars: { year: midYear } });
    if (func >= 3.5) add({ id: "func", side: "high", strength: clamp((func - 3.2) / 1.3) * 0.8, value: "기능성 높음", vars: {} });
    if (formal >= 3.5) add({ id: "formal", side: "high", strength: clamp((formal - 3.2) / 1.3) * 0.7, value: "포멀도 높음", vars: {} });
    else if (formal <= 1.7) add({ id: "formal", side: "low", strength: clamp((2 - formal) / 1) * 0.5, value: "매우 캐주얼", vars: {} });
  }

  // 브랜드 국가(4.17)
  const byCountry = countBy(known, (i) => i.brand!.country);
  const [country, countryList] = byCountry[0] ?? [null, []];
  const countryShare = countryList.length / Math.max(K, 1);
  if (enough && country && countryShare >= 0.45) {
    const kr = country === "한국";
    add({ id: kr ? "country_kr" : "country", side: "high", strength: clamp((countryShare - 0.4) / 0.5) * (kr ? 0.6 : 0.85), value: `${country} ${pct(countryList.length, K)}%`, vars: { country, pct: pct(countryList.length, K) }, photos: photosOf(countryList) });
  }

  // 가격(4.10~4.12)
  const priced = items.filter((i) => i.price != null && i.price > 0);
  const prices = priced.map((i) => i.price!);
  const med = median(prices);
  const maxP = Math.max(0, ...prices);
  const minP = prices.length ? Math.min(...prices) : 0;
  if (priced.length >= 5) {
    const ratio = maxP / Math.max(med, 1);
    if (ratio >= 8) add({ id: "polar", side: "high", strength: clamp((ratio - 6) / 20), value: `${won(minP)} ~ ${won(maxP)}`, vars: { minWon: won(minP), maxWon: won(maxP) }, photos: priced.filter((i) => i.price === maxP || i.price === minP).filter((i) => i.hasPhoto).map((i) => i.id).slice(0, 2) });
    else if (ratio <= 2.2) add({ id: "polar", side: "low", strength: 0.3, value: `${won(minP)} ~ ${won(maxP)}`, vars: {} });
  }

  // 구매 시기(4.13~4.14): 구매일을 적은 옷만
  const dated = items.filter((i) => i.date && Date.parse(i.date) <= now);
  const recent = dated.filter((i) => now - Date.parse(i.date!) <= 183 * DAY);
  const recentShare = recent.length / Math.max(dated.length, 1);
  const byMonth = countBy(dated, (i) => i.date!.slice(0, 7));
  const [binMonth, binList] = byMonth[0] ?? [null, []];
  if (dated.length >= 8) {
    if (recentShare >= 0.4) add({ id: "burst", side: "high", strength: clamp((recentShare - 0.3) / 0.5), value: `최근 6개월 구매 ${pct(recent.length, dated.length)}%`, vars: { pct: pct(recent.length, dated.length) }, photos: photosOf(recent) });
    else if (recentShare <= 0.08) add({ id: "burst", side: "low", strength: 0.3, value: `최근 6개월 구매 ${pct(recent.length, dated.length)}%`, vars: { pct: pct(recent.length, dated.length) } });
    if (binMonth && binList.length >= 5 && binList.length / dated.length >= 0.25)
      add({ id: "binge", side: "high", strength: clamp((binList.length / dated.length - 0.2) / 0.4), value: `${Number(binMonth.slice(5))}월 ${binList.length}벌`, vars: { month: Number(binMonth.slice(5)), n: binList.length }, photos: photosOf(binList) });
    const ages = dated.map((i) => (now - Date.parse(i.date!)) / DAY);
    const old = ages.filter((d) => d >= 3 * 365).length;
    const months = Math.round(avg(ages) / 30);
    if (old / dated.length >= 0.4) add({ id: "age", side: "high", strength: clamp((old / dated.length - 0.3) / 0.5) * 0.7, value: `3년 넘은 옷 ${pct(old, dated.length)}%`, vars: { pct: pct(old, dated.length) } });
    else if (months <= 10) add({ id: "age", side: "low", strength: clamp((12 - months) / 10) * 0.6, value: `평균 ${months}개월`, vars: { months } });
  }

  // 핏(4.15~4.16): 핏을 아는 옷(내 치수로 계산했거나 직접 "내 핏"을 적은 옷)
  const fitted = clothes.filter((i) => i.fit && i.fit.level !== "too_small" && i.fit.level !== "too_big");
  const big = fitted.filter((i) => i.fit!.level === "semi_over" || i.fit!.level === "over");

  // 구매처(4.21)
  const linked = items.filter((i) => i.shop);
  const [shop, shopList] = countBy(linked, (i) => i.shop)[0] ?? [null, []];
  if (shop && linked.length >= 5 && shopList.length / linked.length >= 0.5)
    add({ id: "shop", side: "high", strength: clamp((shopList.length / linked.length - 0.4) / 0.5) * 0.8, value: `${shop} ${pct(shopList.length, linked.length)}%`, vars: { shop, pct: pct(shopList.length, linked.length) } });
  // 중고 거래 앱(후르츠패밀리·번개장터): 3개 이상이면 문단 하나
  for (const [id, name] of [["fruits", "후르츠패밀리"], ["bunjang", "번개장터"]] as const) {
    const list = linked.filter((i) => i.shop === name);
    if (list.length >= 3) add({ id, side: "high", strength: 0.55 + clamp((list.length - 3) / 7) * 0.4, value: `${name} ${list.length}벌`, vars: { n: list.length }, photos: photosOf(list) });
  }

  // 이미 많은 옷·브랜드를 최근에도 또 샀으면 그 문단을 꼭 넣고 뒤에 한 줄 붙인다(같은 얘기를 두 문단에 나눠 하지 않는다).
  const isRecent = (i: Item) => Boolean(i.date && now - Date.parse(i.date) <= 183 * DAY && Date.parse(i.date) <= now);
  const dupRecent = dup.filter(isRecent);
  const recentBrand = recent.filter((i) => brandList.includes(i)).length / Math.max(recent.length, 1);
  const tails = new Map<string, string>();
  if (dup.length >= 3 && dupRecent.length) {
    const t = tryFill(r, R.DUP_RECENT, { recent: dupRecent.length });
    if (t) tails.set("duplicate", t);
  }
  if (branded.length >= 8 && brandShare >= 0.25 && recent.length >= 3 && recentBrand >= 0.5) {
    const t = tryFill(r, R.BRAND_RECENT, { brand: brandName, recentPct: Math.round(recentBrand * 100) });
    if (t) tails.set("brand", t);
  }

  // 진단 문단: 문장이 있는 것만, 뚜렷한 순서로 3~5개(뚜렷하지 않은 "반대쪽"은 모자랄 때만)
  const texts = R.diag as Record<string, { title: string; fact: string; factLow?: string; high: string[]; low?: string[] }>;
  const withText = diags.filter((d) => (texts[d.key]?.[d.side] ?? []).length && !override?.skipDiags.includes(d.id));
  const rank = (d: Diag) => d.strength + (tails.has(d.id) ? 1 : 0);
  const strong = withText.filter((d) => d.strength >= 0.3).sort((x, y) => rank(y) - rank(x));
  const weak = withText.filter((d) => d.strength < 0.3).sort((x, y) => rank(y) - rank(x));
  const picked = [...strong, ...weak].slice(0, Math.min(L.count.diag_max, Math.max(L.count.diag_min, strong.length)));

  // 컬러 한마디: 무채색 비율로 한 문장, 눈에 띄는 경우가 있으면 한 문장 더
  let colorPoint: RoastReport["points"][number] | null = null;
  if (colored.length >= 5) {
    const Cc = R.color;
    const ap = pct(achro.length, colored.length);
    // 무채색이 60% 이상일 때만 "무채색이 많다"고 말한다(57%는 특징이 아니다, 사용자 요청).
    const achroMain = ap >= 60;
    const main = ap >= 85 ? Cc.achro_85 : ap >= 70 ? Cc.achro_70 : achroMain ? Cc.achro_50 : ap >= 40 ? Cc.balanced : Cc.colorful;
    const fam = colored.map((i) => findColorFamily(i.color));
    const count = (...names: string[]) => fam.filter((f) => f && names.includes(f)).length;
    const chroma = colored.filter((i) => !i.achromatic);
    const [chromaFam, chromaList] = countBy(chroma, (i) => findColorFamily(i.color))[0] ?? [null, []];
    const kinds = new Set(fam.filter(Boolean)).size;
    const recentColored = recent.filter((i) => i.color);
    const recentAchro = recentColored.filter((i) => i.achromatic).length / Math.max(recentColored.length, 1);
    const pastel = colored.filter((i) => /라이트|베이비|파우더|라벤더|라일락|민트|피치|버터|스카이|파스텔/.test(i.color ?? "")).length;
    const n = colored.length;
    // 덧붙임은 첫 문장과 같은 방향만 쓴다. "무채색이 많다" 뒤에 "색 종류가 많다"처럼 반대 얘기를 잇지 않는다.
    const extras: [boolean, readonly string[], Vars][] = [
      [ap >= 60 && recentColored.length >= 3 && recentAchro >= 0.6, Cc.recent, { recentPct: Math.round(recentAchro * 100) }],
      [count("블랙") / n >= 0.4, Cc.black, { n: count("블랙") }],
      [count("화이트") / n >= 0.25, Cc.white, { n: count("화이트") }],
      [!achroMain && count("베이지", "브라운", "카키") / n >= 0.35, Cc.earth, { n: count("베이지", "브라운", "카키") }],
      [!achroMain && count("네이비", "데님") / n >= 0.3, Cc.blue, { n: count("네이비", "데님") }],
      [chroma.length >= 3 && chromaList.length / chroma.length >= 0.5 && chromaList.length >= 3, Cc.one_chroma, { family: chromaFam ?? "", n: chromaList.length }],
      [!achroMain && count("레드", "옐로", "오렌지", "그린", "핑크", "퍼플", "블루") / n >= 0.25, Cc.vivid, { n: count("레드", "옐로", "오렌지", "그린", "핑크", "퍼플", "블루") }],
      [!achroMain && pastel >= 3, Cc.pastel, { n: pastel }],
      [!achroMain && kinds >= 9, Cc.many, { k: kinds }],
      [n >= 8 && kinds <= 3, Cc.few, { k: kinds }],
    ];
    const first = tryFill(r, main, { pct: ap, colorPct: 100 - ap });
    const extra = extras.filter(([ok]) => ok).map(([, list, v]) => tryFill(r, list, v)).find(Boolean);
    if (first) colorPoint = { id: "color", ...splitLead([first, extra].filter(Boolean).join(" ")), photos: photosOf(achroMain ? achro : chroma) };
  }

  // 핏 한마디: 주력 핏으로 한 문장, 눈에 띄는 경우가 있으면 한 문장 더
  let fitPoint: RoastReport["points"][number] | null = null;
  const fs = fitSummary(clothes);
  if (fs.fitted.length >= 5) {
    const F = R.fit;
    const trimMain = fs.all.trimShare >= 0.6;
    const bigMain = !trimMain && fs.all.bigShare >= 0.6;
    const main = trimMain ? F.trim : bigMain ? F.big : F.even;
    const first = tryFill(r, main, { pct: pct((trimMain ? fs.all.trim : fs.all.big).length, fs.fitted.length) });
    const extra =
      (fitContrast(fs) ? tryFill(r, F.contrast, {}) : null) ??
      (fs.top.n >= 3 && fs.bottom.n >= 3 && fs.top.bigShare >= 0.6 && fs.bottom.bigShare >= 0.6 ? tryFill(r, F.all_big, {}) : null) ??
      (fs.misfit.length >= 3 ? tryFill(r, F.misfit, { n: fs.misfit.length }) : null);
    if (first) fitPoint = { id: "fit", ...splitLead([first, extra].filter(Boolean).join(" ")), photos: photosOf(trimMain ? fs.all.trim : bigMain ? fs.all.big : fs.fitted) };
  }

  // 비싸게 산 옷과 싸게 산 옷의 브랜드 비교(가격과 브랜드 정보가 있는 옷 8벌 이상, 위아래 4분의 1씩)
  let walletPoint: RoastReport["points"][number] | null = null;
  const pricedKnown = items.filter((i) => i.brand && i.price != null && i.price > 0).sort((x, y) => y.price! - x.price!);
  if (pricedKnown.length >= 8) {
    const q = Math.max(2, Math.floor(pricedKnown.length / 4));
    const pricy = pricedKnown.slice(0, q);
    const cheap = pricedKnown.slice(-q);
    const topOf = (list: Item[], f: (i: Item) => string[]) => countBy(list.flatMap((i) => f(i).map((t) => ({ t }))), (x) => x.t)[0]?.[0] ?? null;
    const lux = (list: Item[]) => list.filter((i) => i.groups.includes("luxury") || i.groups.includes("designer")).length / list.length;
    const heri = (list: Item[]) => avg(list.map((i) => i.brand!.heritage));
    const W = R.wallet;
    const cheapTag = topOf(cheap, (i) => i.brand!.tags);
    const pricyTag = topOf(pricy, (i) => i.brand!.tags);
    const pricyPos = topOf(pricy, (i) => i.brand!.positions);
    // 사진은 문장이 말하는 옷만 보여 준다(헤리티지 문장이면 비싸게 산 헤리티지 브랜드 옷만).
    const isLux = (i: Item) => i.groups.includes("luxury") || i.groups.includes("designer");
    const hasTag = (tag: string | null) => (i: Item) => Boolean(tag && i.brand!.tags.includes(tag));
    let t: string | null = null;
    let shown: Item[] = [];
    if (heri(pricy) - heri(cheap) >= 1.2 && (t = tryFill(r, W.heritage, {}))) shown = pricy.filter((i) => i.brand!.heritage >= 4);
    else if (lux(pricy) >= 0.5 && lux(cheap) <= 0.2 && cheapTag && pricyPos && (t = tryFill(r, W.luxury, { cheapTag, pricyPos }))) shown = pricy.filter(isLux);
    else if (cheapTag && pricyTag && cheapTag !== pricyTag && (t = tryFill(r, W.style, { cheapTag, pricyTag }))) shown = [...pricy.filter(hasTag(pricyTag)), ...cheap.filter(hasTag(cheapTag))];
    if (t) walletPoint = { id: "wallet", ...splitLead(t), photos: photosOf(shown) };
  }

  // 질문 답: 관련 문단에 한 줄로 붙이고, 남는 한 개는 따로 한 문단이 된다.
  const answerLine = (q: AskedQuestion, quoted: { v: boolean }) => {
    const list = q.roast[answers[q.id]] ?? [];
    if (!list.length) return null;
    const plain = list.filter((t) => !quotesAnswer(t));
    const text = r.pick(quoted.v && plain.length ? plain : list);
    if (quotesAnswer(text)) quoted.v = true;
    return text;
  };
  const targets = new Set([...picked.map((d) => d.id), ...(colorPoint ? ["color"] : []), ...(fitPoint ? ["fit"] : []), ...(override?.points.map((p) => p.id) ?? [])]);
  const answerTo: Record<string, string[]> = { ...ANSWER_TO, ...(override?.answerTo ?? {}) };
  const quoted = { v: false };
  const pointAnswers = new Map<string, string>();
  let extra: string | null = null;
  let used = 0;
  for (const q of asked) {
    if (used >= L.count.answers || !answers[q.id]) continue;
    const target = (answerTo[q.id] ?? []).find((id) => targets.has(id) && !pointAnswers.has(id));
    if (target) {
      const line = answerLine(q, quoted);
      if (line) {
        pointAnswers.set(target, line);
        used++;
      }
    } else if (!extra && !answerTo[q.id]) {
      extra = answerLine(q, quoted);
      if (extra) used++;
    }
  }
  const withAnswer = (p: RoastReport["points"][number]) => {
    const answer = pointAnswers.get(p.id);
    return answer ? { ...p, answer } : p;
  };

  // 문단은 자리(slot)별로 모았다가 "결과 구성"의 순서대로 잇는다.
  type Point = RoastReport["points"][number];
  const slot: Record<string, Point[]> = {};
  const put = (id: string, p: Point | null) => {
    if (p) (slot[id] ??= []).push(p);
  };
  const diagPoints: Point[] = picked.flatMap((d) => {
    const text = tryFill(r, texts[d.key][d.side] ?? [], d.vars);
    if (!text) return [];
    const full = [text, tails.get(d.id)].filter(Boolean).join(" ");
    return [withAnswer({ id: d.id, ...splitLead(full), ...(d.photos.length ? { photos: d.photos.slice(0, L.count.photos) } : {}) })];
  });
  put("diag_lead", diagPoints[0] ?? null);
  for (const p of diagPoints.slice(1)) put("diag", p);
  put("color", colorPoint && withAnswer(colorPoint));
  put("fit", fitPoint && withAnswer(fitPoint));
  put("wallet", walletPoint);
  // 빈티지·구제, 나이 한마디(점수와 별개로 한 문단씩)
  const vintage = items.filter((i) => i.brandKind === "vintage");
  if (vintage.length >= 3) {
    const t = tryFill(r, R.VINTAGE, { n: vintage.length });
    if (t) put("vintage", { id: "vintage", ...splitLead(t), photos: photosOf(vintage) });
  }
  const facts = picked.flatMap((d) => {
    const t = d.side === "high" ? texts[d.key].fact : texts[d.key].factLow;
    const f = t ? tryFill(r, [t], d.vars) : null;
    return f ? [f] : [];
  });

  // 총 옷장 점수: 옷장 점수(score.ts) + 질문·퀴즈 답별 증감
  const wardrobe: Pick<WardrobeScore, "score" | "parts" | "age"> = override
    ? { ...override.score, age: null }
    : scoreWardrobe(a, {
        age,
        rules: deltas.rules as Partial<ScoreRules> | undefined,
        ageRules: (score.age as Record<string, Record<string, number>> | undefined) ?? undefined,
      });
  const answerDeltas = asked.flatMap((q) => {
    const ans = answers[q.id];
    const d = ans ? (deltas[q.id]?.[q.scoreKey?.[ans] ?? ans] ?? 0) : 0;
    return d ? [{ label: "질문 답", why: `"${q.text}" → ${q.options.find((o) => o.id === ans)?.label ?? ans}`, delta: d }] : [];
  });
  const bonus = answerDeltas.reduce((sum, x) => sum + x.delta, 0);
  const totalScore = Math.max(0, Math.min(100, Math.round(wardrobe.score + bonus)));
  // 관리자 점수 풀이: 같은 항목(나이 구간별 등)은 합치고 판단 기준은 이어 붙인다.
  const merged = new Map<string, { delta: number; why: string[]; items: string[] }>();
  for (const p of wardrobe.parts) {
    const m = merged.get(p.id) ?? { delta: 0, why: [], items: [] };
    merged.set(p.id, { delta: m.delta + p.delta, why: [...m.why, p.why], items: [...new Set([...m.items, ...(p.items ?? [])])] });
  }
  const scoreDetail = {
    base: override?.base ?? Number((deltas.rules as Partial<ScoreRules> | undefined)?.base ?? SCORE_RULES.base),
    items: [
      ...[...merged.entries()].map(([id, m]) => ({ label: (override?.partName ?? SCORE_PART_NAME)[id] ?? id, why: m.why.join(" / "), delta: Math.round(m.delta * 10) / 10, ...(m.items.length ? { garments: m.items } : {}) })),
      ...answerDeltas,
    ].filter((x) => x.delta),
    total: totalScore,
  };
  if (wardrobe.age) {
    const t = tryFill(r, (R.age as Record<string, string[]>)[wardrobe.age.kind] ?? [], { age: wardrobe.age.age, pct: wardrobe.age.pct });
    if (t) put("age", { id: "age", ...splitLead(t) });
  }
  const band = (totalScore >= 90 ? "b90" : `b${Math.floor(totalScore / 10) * 10}`) as keyof ReportTexts["HEADLINE"];

  // 제목 아래 요약 한 문장: 가장 뚜렷한 특징 세 개(모자라면 두 개)를 서로 다른 종류에서 골라 잇는다(사용자 요청).
  const Sm = R.summary as Record<string, readonly string[]>;
  const fsum = fitSummary(clothes);
  const designerShareAll = known.filter((i) => i.groups.includes("designer") || i.groups.includes("luxury") || i.groups.includes("contemporary")).length / Math.max(K, 1);
  const massShare = known.filter((i) => i.groups.includes("mass")).length / Math.max(K, 1);
  const oldShareAll = dated.length ? dated.filter((i) => now - Date.parse(i.date!) >= 3 * 365 * DAY).length / dated.length : 0;
  const colorAp = colored.length ? achro.length / colored.length : 0;
  const blackShare = colored.length ? colored.filter((i) => findColorFamily(i.color) === "블랙").length / colored.length : 0;
  const traits: { kind: string; key: string; s: number; vars?: Vars }[] = [
    { kind: "color", key: "black", s: colored.length >= 5 && blackShare >= 0.4 ? clamp((blackShare - 0.3) / 0.4) + 0.05 : 0 },
    { kind: "color", key: "achro", s: colored.length >= 5 && colorAp >= 0.6 ? clamp((colorAp - 0.5) / 0.4) : 0 },
    { kind: "color", key: "colorful", s: colored.length >= 5 && colorAp < 0.4 ? clamp((0.4 - colorAp) / 0.3) : 0 },
    { kind: "brand", key: "brand_one", s: branded.length >= 8 && brandShare >= 0.25 ? clamp((brandShare - 0.2) / 0.4) : 0, vars: { brand: brandName } },
    { kind: "brand", key: "musinsa", s: branded.length >= 8 && musinsaShare >= 0.5 ? clamp((musinsaShare - 0.4) / 0.5) : 0 },
    { kind: "brand", key: "designer", s: enough && designerShareAll >= 0.35 ? clamp((designerShareAll - 0.25) / 0.5) : 0 },
    { kind: "brand", key: "mass", s: enough && massShare >= 0.4 ? clamp((massShare - 0.3) / 0.5) : 0 },
    { kind: "brand", key: "hype", s: enough && hype >= 3.6 ? clamp((hype - 3.3) / 1.2) : 0 },
    { kind: "brand", key: "heritage", s: enough && heritage >= 3.8 ? clamp((heritage - 3.5) / 1.2) : 0 },
    { kind: "brand", key: "country", s: enough && country && countryShare >= 0.45 ? clamp((countryShare - 0.4) / 0.5) * 0.8 : 0, vars: { country: country ?? "" } },
    { kind: "brand", key: "brand_many", s: branded.length >= 10 && byBrand.length / branded.length >= 0.75 ? 0.3 : 0 },
    { kind: "style", key: "style", s: enough && tags.length && tags[0].n / K >= 0.5 ? clamp((tags[0].n / K - 0.4) / 0.5) : 0, vars: { tag: tags[0]?.t ?? "" } },
    { kind: "style", key: "casual", s: enough && formal <= 1.9 ? clamp((2.2 - formal) / 1) * 0.7 : 0 },
    { kind: "style", key: "formal", s: enough && formal >= 3.5 ? clamp((formal - 3.2) / 1.3) : 0 },
    { kind: "style", key: "func", s: enough && func >= 3.5 ? clamp((func - 3.2) / 1.3) : 0 },
    { kind: "fit", key: "big", s: fsum.fitted.length >= 5 && fsum.all.bigShare >= 0.6 ? clamp((fsum.all.bigShare - 0.5) / 0.4) : 0 },
    { kind: "fit", key: "trim", s: fsum.fitted.length >= 5 && fsum.all.trimShare >= 0.6 ? clamp((fsum.all.trimShare - 0.5) / 0.4) : 0 },
    { kind: "category", key: "category", s: cat && catShare >= 0.45 ? clamp((catShare - 0.4) / 0.4) : 0, vars: { catName: cat ? CATEGORY_NAME[cat as Item["cat"]] : "" } },
    { kind: "repeat", key: "dup", s: dup.length >= 3 ? clamp((dup.length - 2) / 5) : 0 },
    { kind: "timing", key: "new_items", s: dated.length >= 8 && recentShare >= 0.4 ? clamp((recentShare - 0.3) / 0.5) : 0 },
    { kind: "timing", key: "old_items", s: dated.length >= 8 && oldShareAll >= 0.4 ? clamp((oldShareAll - 0.3) / 0.5) : 0 },
  ];
  const kindsUsed = new Set<string>();
  const words: string[] = [];
  for (const t of traits.filter((x) => x.s > 0 && Sm[x.key]?.length).sort((x, y) => y.s - x.s)) {
    if (words.length >= 3 || kindsUsed.has(t.kind)) continue;
    const w = tryFill(r, Sm[t.key], t.vars ?? {});
    if (!w) continue;
    kindsUsed.add(t.kind);
    words.push(w);
  }
  const summary =
    words.length >= 3 ? tryFill(r, R.SUMMARY_3, { a: words[0], b: words[1], c: words[2] }) : words.length === 2 ? tryFill(r, R.SUMMARY_2, { a: words[0], b: words[1] }) : null;

  // 캐릭터(6): 조건이 맞는 것 중 뚜렷한 순서로 세 개. "> " 문장에 들어간다.
  const C = R.character as Record<string, { name: string; who: string }>;
  const outerShare = clothes.filter((i) => i.cat === "outer").length / Math.max(clothes.length, 1);
  const designerShare = known.filter((i) => i.groups.includes("designer") || i.groups.includes("luxury")).length / Math.max(K, 1);
  const saleN = a.patterns.find((p) => p.id === "sale_luxury")?.garmentIds.length ?? 0;
  const oldShare = dated.length ? dated.filter((i) => now - Date.parse(i.date!) >= 3 * 365 * DAY).length / dated.length : 0;
  const cand: [string, number][] = [
    ["musinsa", branded.length >= 8 && musinsaShare >= 0.5 ? musinsaShare : 0],
    ["duplicate", dup.length >= 4 ? clamp(dup.length / 7) : 0],
    ["outer", outerShare >= 0.4 ? outerShare : 0],
    ["over", fitted.length >= 5 && big.length / fitted.length >= 0.6 ? big.length / fitted.length : 0],
    ["mono_brand", branded.length >= 8 && brandShare >= 0.3 ? brandShare + 0.2 : 0],
    ["octopus", branded.length >= 10 && byBrand.length / branded.length >= 0.75 ? byBrand.length / branded.length - 0.1 : 0],
    ["achromatic", colored.length >= 5 && achroShare >= 0.7 ? achroShare - 0.05 : 0],
    ["hype", enough && hype >= 3.8 ? hype / 5 : 0],
    ["no_trend", enough && hype <= 2.2 ? (5 - hype) / 5 - 0.1 : 0],
    ["heritage", enough && heritage >= 3.8 ? heritage / 5 - 0.1 : 0],
    ["func", enough && func >= 3.6 ? func / 5 - 0.1 : 0],
    ["sale", saleN >= 2 ? clamp(saleN / 5) : 0],
    ["new_addict", dated.length >= 8 && recentShare >= 0.5 ? recentShare : 0],
    ["long_tenure", dated.length >= 8 && oldShare >= 0.4 ? oldShare : 0],
    ["binge", dated.length >= 8 && binList.length >= 5 && binList.length / dated.length >= 0.3 ? binList.length / dated.length + 0.2 : 0],
    ["jp", enough && country === "일본" && countryShare >= 0.35 ? countryShare + 0.1 : 0],
    ["designer", enough && designerShare >= 0.35 ? designerShare : 0],
  ];
  const chars = cand
    .filter(([id, s]) => s > 0 && C[id])
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .flatMap(([id]) => {
      const v = { what };
      const nm = tryFill(r, [C[id].name], v);
      const who = tryFill(r, [C[id].who], v);
      return nm && who ? [{ name: nm, who }] : [];
    });

  // 마지막 문단: 따로 붙일 곳이 없는 질문 답, 없으면 가장 비싼 항목
  const top = a.patterns.find((p) => p.id === "top_item");
  if (extra) put("last", { id: "answer", ...splitLead(extra) });
  else if (top) {
    const t = tryFill(r, R.suspicious.top_item, { ...top.stats, priceWon: won(Number(top.stats.price)) });
    if (t) put("last", { id: "top_item", ...splitLead(t), photos: top.garmentIds.filter((id) => items.find((i) => i.id === id)?.hasPhoto) });
  }

  const pointOrder = Object.entries(L.point_order).sort((x, y) => x[1] - y[1]).map(([k]) => k);
  const pointShown = (k: string) => (L.point_show as Record<string, number>)[k] !== 0;
  const points = limitPhotos([...(override?.points.map(withAnswer) ?? []), ...pointOrder.filter(pointShown).flatMap((k) => slot[k] ?? [])], L.count.photo_blocks);

  // 첫 줄(총점 평가)과 "> " 문장들
  const owner = name ? `${name}님의` : "당신의";
  const headline = tryFill(r, override?.headline[band] ?? R.HEADLINE[band], { owner, score: totalScore }) ?? `${owner} ${override ? "주문내역" : "옷장"}은 별로입니다.`;
  const intro = [
    facts.length >= 2 ? tryFill(r, R.INTRO_THANKS, { fact1: facts[0], fact2: facts[1] }) : facts.length ? tryFill(r, R.INTRO_THANKS_ONE, { fact1: facts[0] }) : null,
    chars.length >= 2 ? tryFill(r, R.INTRO_CHAR_TWO, { first: chars[0].name, who2: chars[1].who }) : chars.length ? tryFill(r, R.INTRO_CHAR_ONE, { who1: chars[0].who }) : null,
    ...(chars.length >= 3 ? [r.pick(R.INTRO_ALSO), tryFill(r, R.INTRO_SECOND, { who3: chars[2].who })] : []),
    points.length ? r.pick(R.INTRO_MORE) : null,
  ].filter((t): t is string => Boolean(t));

  // 목록: 많이 가진 옷, 많이 산 브랜드(사용자 요청).
  // - 많이 가진 옷: 세부분류 + 색 + 핏이 같은 옷이 dup_min벌(3벌) 이상인 것만. 2벌은 중복으로 보지 않고, 없으면 목록을 뺀다.
  // - 브랜드: 옷장(브랜드를 적은 옷) 대비 %로 몇 개만. 1위가 brand_top_pct% 미만이면 뺀다.
  const lists: RoastReport["lists"] = [];
  const dupRows = countBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}|${i.fit?.level ?? "-"}`)
    .filter(([, l]) => l.length >= L.count.dup_min)
    .slice(0, L.count.list_rows);
  if (dupRows.length) {
    const labelOf = (i: Item) => (i.color === "데님" && i.subName?.includes("데님") ? i.subName : `${i.color} ${i.subName ?? "옷"}`);
    const labels = dupRows.map(([, l]) => labelOf(l[0]));
    lists.push({
      title: r.pick(R.LIST_DUP),
      // 같은 옷 이름이 두 줄이면 핏으로 구분한다.
      items: dupRows.map(([, l], k) => `${labels[k]}${labels.filter((x) => x === labels[k]).length > 1 && l[0].fit ? ` (${FIT_WORD[l[0].fit.level]})` : ""} ${l.length}벌`),
    });
  }
  const brandRows = byBrand.filter(([, l]) => l.length >= 2 && (l.length / Math.max(branded.length, 1)) * 100 >= L.count.brand_row_pct).slice(0, L.count.brand_rows);
  if (branded.length >= 8 && brandRows.length && (brandRows[0][1].length / branded.length) * 100 >= L.count.brand_top_pct)
    lists.push({ title: r.pick(R.LIST_BRAND), items: brandRows.map(([, l]) => `${l[0].brandLabel} ${pct(l.length, branded.length)}%`) });

  const total = {
    score: totalScore,
    lead: tryFill(r, override?.totalLead ?? R.TOTAL_LEAD, { owner, score: totalScore }) ?? `${totalScore}점`,
    text: r.pick(R.TOTAL[band]),
  };

  const notes: string[] = [];
  if (K && K < items.length) {
    const note = tryFill(r, R.BASIS_BRAND, { n: K });
    if (note) notes.push(note);
  }

  const show = (k: string) => (L.show as Record<string, number>)[k] !== 0;
  const order = Object.entries(L.order).sort((x, y) => x[1] - y[1]).map(([k]) => k);
  return {
    headline,
    intro: show("intro") ? intro : [],
    lists: show("lists") ? lists : [],
    total,
    points,
    ...(summary && show("summary") ? { summary } : {}),
    scoreDetail,
    notes: show("notes") ? notes : [],
    order,
  };
}

/**
 * 결과에서는 사진을 문단마다 넣지 않고, 가장 특이한 문단 max개에만 넣는다(그 문단 안에서는 여러 장도 된다, 사용자 요청).
 * 특이한 순서: 같은 옷·가장 비싼 옷·비슷한 옷처럼 옷 자체가 증거인 문단부터.
 */
const PHOTO_PRIORITY = ["identical", "top_item", "similar", "duplicate", "vintage", "fruits", "bunjang", "binge", "wallet", "polar", "subcat", "country", "country_kr", "brand", "musinsa", "burst", "category", "color", "fit"];
export function limitPhotos<P extends { id: string; photos?: string[] }>(points: P[], max: number): P[] {
  const rank = (id: string) => {
    const k = PHOTO_PRIORITY.indexOf(id);
    return k < 0 ? PHOTO_PRIORITY.length : k;
  };
  const keep = new Set(
    points
      .filter((p) => p.photos?.length)
      .sort((x, y) => rank(x.id) - rank(y.id))
      .slice(0, Math.max(0, max))
      .map((p) => p.id),
  );
  return points.map((p) => {
    if (keep.has(p.id) || !p.photos) return p;
    const rest = { ...p };
    delete rest.photos;
    return rest;
  });
}

/** 첫 문장(굵게)과 나머지로 나눈다. */
export function splitLead(text: string): { lead: string; text: string } {
  const m = /^([^]+?[.!?])\s+([^]+)$/.exec(text);
  return m ? { lead: m[1], text: m[2] } : { lead: text, text: "" };
}

export function tryFill(r: Rng, list: readonly string[], vars: Vars): string | null {
  for (const t of r.shuffle(list)) {
    try {
      return fill(t, vars);
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  }
  return null;
}

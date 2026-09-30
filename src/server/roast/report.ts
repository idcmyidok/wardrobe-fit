import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { RoastReport } from "@/lib/roast/types";
import type { Analysis, Item } from "./analyze";
import { MUSINSA_POPULAR } from "./brands";
import { quotesAnswer } from "./compose";
import type { AskedQuestion } from "./questions";
import { fill, MissingVar, rng, won, type Rng, type Vars } from "./text";
import type { ReportTexts } from "./report-text";
import { SCORE_RULES, type ScoreRules } from "./score-deltas";
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
/** 1~5 평균 → 낮음·중간·높음 */
const level = (v: number) => (v < 2.4 ? "낮음" : v < 3.6 ? "중간" : "높음");

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
const MAX_ANSWERS = 3;

export function buildReport(
  a: Analysis,
  name: string | null,
  seed: number,
  R: ReportTexts,
  asked: AskedQuestion[] = [],
  answers: Record<string, string> = {},
  deltas: Record<string, Record<string, number>> = {},
): RoastReport {
  const r = rng(seed ^ 0x2f6a91c3);
  const items = a.items;
  const clothes = a.clothes;
  const now = a.now.getTime();
  const photosOf = (list: Item[]) => list.filter((i) => i.hasPhoto).map((i) => i.id).slice(0, 20);
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
  const colored = items.filter((i) => i.color);
  const achro = colored.filter((i) => i.achromatic);
  const achroShare = achro.length / Math.max(colored.length, 1);

  // 브랜드 편중(4.4): 적힌 브랜드 이름 기준
  const branded = items.filter((i) => i.brandLabel);
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
    if (pop >= 4.2) add({ id: "popularity", side: "high", strength: clamp((pop - 4) / 1) * 0.6, value: "메이저 중심", vars: {} });
    else if (pop <= 2.4) add({ id: "popularity", side: "low", strength: clamp((2.7 - pop) / 1.2) * 0.8, value: "마이너 탐색", vars: {} });
    const founded = known.map((i) => i.brand!.founded).filter((y): y is number => y != null);
    const midYear = median(founded);
    if (heritage >= 3.8) add({ id: "heritage", side: "high", strength: clamp((heritage - 3.5) / 1.2) * 0.8, value: "헤리티지 브랜드 중심", vars: {} });
    else if (founded.length >= 5 && midYear >= 2012) add({ id: "heritage", side: "low", strength: 0.45, value: `절반이 ${midYear}년 이후 브랜드`, vars: { year: midYear } });
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
  const trim = fitted.filter((i) => i.fit!.level === "slim" || i.fit!.level === "regular");
  if (fitted.length >= 5) {
    if (big.length / fitted.length >= 0.6) add({ id: "fit", side: "high", strength: clamp((big.length / fitted.length - 0.5) / 0.5) * 0.8, value: `세미오버 이상 ${pct(big.length, fitted.length)}%`, vars: { pct: pct(big.length, fitted.length) }, photos: photosOf(big) });
    else if (trim.length / fitted.length >= 0.75) add({ id: "fit", side: "low", strength: 0.35, value: `슬림·레귤러 ${pct(trim.length, fitted.length)}%`, vars: { pct: pct(trim.length, fitted.length) } });
    const tops = fitted.filter((i) => i.fit!.kind === "top");
    const bottoms = fitted.filter((i) => i.fit!.kind === "bottom");
    const topOver = tops.filter((i) => i.fit!.level === "over" || i.fit!.level === "semi_over").length / Math.max(tops.length, 1);
    const bottomTrim = bottoms.filter((i) => i.fit!.level === "slim" || i.fit!.level === "regular").length / Math.max(bottoms.length, 1);
    if (tops.length >= 3 && bottoms.length >= 3 && topOver >= 0.6 && bottomTrim >= 0.7)
      add({ id: "silhouette", side: "high", strength: 0.7, value: `상의 오버 ${Math.round(topOver * 100)}% · 하의 슬림 ${Math.round(bottomTrim * 100)}%`, vars: { topPct: Math.round(topOver * 100), bottomPct: Math.round(bottomTrim * 100) } });
  }

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
  const withText = diags.filter((d) => (texts[d.key]?.[d.side] ?? []).length);
  const rank = (d: Diag) => d.strength + (tails.has(d.id) ? 1 : 0);
  const strong = withText.filter((d) => d.strength >= 0.3).sort((x, y) => rank(y) - rank(x));
  const weak = withText.filter((d) => d.strength < 0.3).sort((x, y) => rank(y) - rank(x));
  const picked = [...strong, ...weak].slice(0, Math.max(3, Math.min(5, strong.length)));

  // 컬러 한마디: 무채색 비율로 한 문장, 눈에 띄는 경우가 있으면 한 문장 더
  let colorPoint: RoastReport["points"][number] | null = null;
  if (colored.length >= 5) {
    const Cc = R.color;
    const ap = pct(achro.length, colored.length);
    const main = ap >= 85 ? Cc.achro_85 : ap >= 70 ? Cc.achro_70 : ap >= 50 ? Cc.achro_50 : ap >= 30 ? Cc.balanced : Cc.colorful;
    const fam = colored.map((i) => findColorFamily(i.color));
    const count = (...names: string[]) => fam.filter((f) => f && names.includes(f)).length;
    const chroma = colored.filter((i) => !i.achromatic);
    const [chromaFam, chromaList] = countBy(chroma, (i) => findColorFamily(i.color))[0] ?? [null, []];
    const kinds = new Set(fam.filter(Boolean)).size;
    const recentColored = recent.filter((i) => i.color);
    const recentAchro = recentColored.filter((i) => i.achromatic).length / Math.max(recentColored.length, 1);
    const pastel = colored.filter((i) => /라이트|베이비|파우더|라벤더|라일락|민트|피치|버터|스카이|파스텔/.test(i.color ?? "")).length;
    const n = colored.length;
    const extras: [boolean, readonly string[], Vars][] = [
      [ap >= 60 && recentColored.length >= 3 && recentAchro >= 0.6, Cc.recent, { recentPct: Math.round(recentAchro * 100) }],
      [count("블랙") / n >= 0.4, Cc.black, { n: count("블랙") }],
      [count("화이트") / n >= 0.25, Cc.white, { n: count("화이트") }],
      [count("베이지", "브라운", "카키") / n >= 0.35, Cc.earth, { n: count("베이지", "브라운", "카키") }],
      [count("네이비", "데님") / n >= 0.3, Cc.blue, { n: count("네이비", "데님") }],
      [chroma.length >= 3 && chromaList.length / chroma.length >= 0.5 && chromaList.length >= 3, Cc.one_chroma, { family: chromaFam ?? "", n: chromaList.length }],
      [count("레드", "옐로", "오렌지", "그린", "핑크", "퍼플", "블루") / n >= 0.25, Cc.vivid, { n: count("레드", "옐로", "오렌지", "그린", "핑크", "퍼플", "블루") }],
      [pastel >= 3, Cc.pastel, { n: pastel }],
      [kinds >= 9, Cc.many, { k: kinds }],
      [n >= 8 && kinds <= 3, Cc.few, { k: kinds }],
    ];
    const first = tryFill(r, main, { pct: ap, colorPct: 100 - ap });
    const extra = extras.filter(([ok]) => ok).map(([, list, v]) => tryFill(r, list, v)).find(Boolean);
    if (first) colorPoint = { id: "color", ...splitLead([first, extra].filter(Boolean).join(" ")), photos: photosOf(ap >= 50 ? achro : chroma) };
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
    const t =
      (heri(pricy) - heri(cheap) >= 1.2 ? tryFill(r, W.heritage, {}) : null) ??
      (lux(pricy) >= 0.5 && lux(cheap) <= 0.2 && cheapTag && pricyPos ? tryFill(r, W.luxury, { cheapTag, pricyPos }) : null) ??
      (cheapTag && pricyTag && cheapTag !== pricyTag ? tryFill(r, W.style, { cheapTag, pricyTag }) : null);
    if (t) walletPoint = { id: "wallet", ...splitLead(t), photos: photosOf([...pricy, ...cheap]) };
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
  const targets = new Set([...picked.map((d) => d.id), ...(colorPoint ? ["color"] : [])]);
  const quoted = { v: false };
  const pointAnswers = new Map<string, string>();
  let extra: string | null = null;
  let used = 0;
  for (const q of asked) {
    if (used >= MAX_ANSWERS || !answers[q.id]) continue;
    const target = (ANSWER_TO[q.id] ?? []).find((id) => targets.has(id) && !pointAnswers.has(id));
    if (target) {
      const line = answerLine(q, quoted);
      if (line) {
        pointAnswers.set(target, line);
        used++;
      }
    } else if (!extra && !ANSWER_TO[q.id]) {
      extra = answerLine(q, quoted);
      if (extra) used++;
    }
  }
  const withAnswer = (p: RoastReport["points"][number]) => {
    const answer = pointAnswers.get(p.id);
    return answer ? { ...p, answer } : p;
  };

  const points: RoastReport["points"] = picked.flatMap((d) => {
    const text = tryFill(r, texts[d.key][d.side] ?? [], d.vars);
    if (!text) return [];
    const full = [text, tails.get(d.id)].filter(Boolean).join(" ");
    return [withAnswer({ id: d.id, ...splitLead(full), ...(d.photos.length ? { photos: d.photos.slice(0, 20) } : {}) })];
  });
  if (colorPoint) points.splice(Math.min(1, points.length), 0, withAnswer(colorPoint));
  if (walletPoint) points.push(walletPoint);
  const facts = picked.flatMap((d) => {
    const t = d.side === "high" ? texts[d.key].fact : texts[d.key].factLow;
    const f = t ? tryFill(r, [t], d.vars) : null;
    return f ? [f] : [];
  });

  // 총 옷장 점수: "얼마나 힙한가"(SCORE_RULES) + 질문·퀴즈 답별 증감. 가격은 넣지 않는다.
  const RU = { ...SCORE_RULES, ...((deltas.rules ?? {}) as Partial<ScoreRules>) };
  const upTo = (share: number, full: number, max: number) => Math.min(max, (share * 100 * max) / Math.max(full, 1));
  const over = (share: number, from: number, per10: number, max: number) => Math.min(max, (Math.max(0, share * 100 - from) / 10) * per10);
  const shareOf = (f: (i: Item) => boolean) => (K ? known.filter(f).length / K : 0);
  let score = RU.base;
  const styleTop = tags[0] ? tags[0].n / K : 0;
  if (enough) {
    score += upTo(shareOf((i) => i.groups.some((g) => g === "designer" || g === "luxury" || g === "contemporary")), RU.designer_full, RU.designer_max);
    score += upTo(shareOf((i) => i.brand!.pop <= 2), RU.niche_full, RU.niche_max);
    score += styleTop * 100 >= RU.style_high_pct ? RU.style_high : styleTop * 100 >= RU.style_mid_pct ? RU.style_mid : 0;
    score += upTo(shareOf((i) => i.groups.includes("jp_denim") || i.brand!.heritage >= 4 || i.brand!.tags.some((t) => /워크웨어|빈티지|아메카지/.test(t))), RU.taste_full, RU.taste_max);
    score -= over(shareOf((i) => i.groups.includes("mass")), RU.mass_from, RU.mass_per10, RU.mass_max);
    if (shareOf((i) => i.brand!.hype >= 4 && i.brand!.pop >= 4) * 100 >= RU.trendy_pct) score -= RU.trendy;
    if (styleTop * 100 < RU.scattered_pct && branded.length >= 8 && byBrand.length / branded.length >= 0.7) score -= RU.scattered;
  }
  if (branded.length >= 8) score -= over(musinsaShare, RU.musinsa_from, RU.musinsa_per10, RU.musinsa_max);
  if (linked.filter((i) => i.shop === "후르츠패밀리" || i.shop === "번개장터").length >= 3) score += RU.digging;
  const chromaN = colored.filter((i) => !i.achromatic).length;
  if (colored.length >= 5 && achroShare >= 0.6 && chromaN >= 1 && chromaN <= 3) score += RU.accent;
  const copies =
    countBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}`).reduce((n, [, l]) => n + Math.max(0, l.length - 2), 0) +
    countBy(items, (i) => (i.g.productName ? `${i.brandLabel}|${i.g.productName}|${i.color ?? ""}`.toLowerCase() : null)).reduce((n, [, l]) => n + Math.max(0, l.length - 1), 0);
  score -= Math.min(RU.dup_max, copies * RU.dup_each);
  const misfit = clothes.filter((i) => i.fit && (i.fit.level === "too_small" || i.fit.level === "too_big")).length;
  score -= Math.min(RU.misfit_max, misfit * RU.misfit_each);
  const bonus = asked.reduce((sum, q) => {
    const ans = answers[q.id];
    if (!ans) return sum;
    return sum + (deltas[q.id]?.[q.scoreKey?.[ans] ?? ans] ?? 0);
  }, 0);
  const totalScore = Math.max(0, Math.min(100, Math.round(score + bonus)));
  const band = (totalScore >= 90 ? "b90" : `b${Math.floor(totalScore / 10) * 10}`) as keyof ReportTexts["HEADLINE"];

  // 옷장 DNA: 해당하는 것 중 다섯 문장까지. 진단 문단에 이미 나온 주제는 뺀다.
  const D = R.dna;
  const inPoints = new Set(picked.map((d) => d.id));
  const dnaCand: [boolean, readonly string[], Vars][] = [];
  if (enough && tags.length >= 2 && !inPoints.has("style")) dnaCand.push([true, tags[1].n / K >= 0.25 ? D.styles : D.style, { tag1: tags[0].t, tag2: tags[1].t }]);
  const positions = countBy(known.flatMap((i) => i.brand!.positions.map((p) => ({ p, i }))), (x) => x.p);
  if (enough && positions.length) dnaCand.push([true, D.position, { position: positions[0][0] }]);
  if (enough) {
    const lv: [string, number][] = [
      ["hype", hype],
      ["formal", formal],
      ["func", func],
      ["heritage", heritage],
    ];
    lv.filter(([id]) => !inPoints.has(id))
      .map(([id, v]) => ({ id, v, side: level(v) === "높음" ? "high" : level(v) === "낮음" ? "low" : null }))
      .filter((x) => x.side && (D as Record<string, readonly string[]>)[`${x.id}_${x.side}`])
      .sort((x, y) => Math.abs(y.v - 3) - Math.abs(x.v - 3))
      .slice(0, 2)
      .forEach((x) => dnaCand.push([true, (D as Record<string, readonly string[]>)[`${x.id}_${x.side}`], {}]));
  }
  if (branded.length >= 8 && !inPoints.has("musinsa")) {
    if (musinsaShare >= 0.3) dnaCand.push([true, D.musinsa, { pct: pct(labeled.length, branded.length) }]);
    else if (musinsaShare <= 0.1) dnaCand.push([true, D.musinsa_low, { pct: pct(labeled.length, branded.length) }]);
  }
  if (enough && country && countryShare >= 0.4 && !inPoints.has("country") && !inPoints.has("country_kr"))
    dnaCand.push([true, country === "한국" ? D.country_kr : D.country, { country, pct: pct(countryList.length, K) }]);
  if (shop && linked.length >= 5 && shopList.length / linked.length >= 0.4 && !inPoints.has("shop")) dnaCand.push([true, D.shop, { shop, pct: pct(shopList.length, linked.length) }]);
  const dna = dnaCand.flatMap(([, list, v]) => tryFill(r, list, v) ?? []).slice(0, 5);

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

  // 첫 줄(총점 평가)과 "> " 문장들
  const owner = name ? `${name}님의` : "당신의";
  const headline = tryFill(r, R.HEADLINE[band], { owner, score: totalScore }) ?? `${owner} 옷장은 ${totalScore}점입니다.`;
  const intro = [
    facts.length >= 2 ? tryFill(r, R.INTRO_THANKS, { fact1: facts[0], fact2: facts[1] }) : facts.length ? tryFill(r, R.INTRO_THANKS_ONE, { fact1: facts[0] }) : null,
    chars.length >= 2 ? tryFill(r, R.INTRO_CHAR_TWO, { first: chars[0].name, who2: chars[1].who }) : chars.length ? tryFill(r, R.INTRO_CHAR_ONE, { who1: chars[0].who }) : null,
    ...(chars.length >= 3 ? [r.pick(R.INTRO_ALSO), tryFill(r, R.INTRO_SECOND, { who3: chars[2].who })] : []),
    points.length ? r.pick(R.INTRO_MORE) : null,
  ].filter((t): t is string => Boolean(t));

  // 목록: 많이 가진 옷(세부분류 + 색), 많이 산 브랜드. 각 다섯 개까지, 두 벌 이상인 것만.
  // 한 줄뿐이면 세 벌 이상일 때만 보여 준다.
  const lists: RoastReport["lists"] = [];
  const listOf = (title: string, rows: [string, Item[]][]) => {
    const top = rows.filter(([, l]) => l.length >= 2).slice(0, 5);
    if (top.length >= 2 || top[0]?.[1].length >= 3) lists.push({ title, items: top.map(([k, l]) => `${k} ${l.length}벌`) });
  };
  listOf(r.pick(R.LIST_DUP), countBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.color} ${i.subName ?? "옷"}`));
  listOf(r.pick(R.LIST_BRAND), byBrand.map(([, l]) => [l[0].brandLabel, l]));

  const total = {
    score: totalScore,
    lead: fill(r.pick(R.TOTAL_LEAD), { owner, score: totalScore }),
    text: r.pick(R.TOTAL[band]),
  };

  // 마지막 문단: 따로 붙일 곳이 없는 질문 답, 없으면 가장 비싼 항목
  const top = a.patterns.find((p) => p.id === "top_item");
  if (extra) points.push({ id: "answer", ...splitLead(extra) });
  else if (top) {
    const t = tryFill(r, R.suspicious.top_item, { ...top.stats, priceWon: won(Number(top.stats.price)) });
    if (t) points.push({ id: "top_item", ...splitLead(t), photos: top.garmentIds.filter((id) => items.find((i) => i.id === id)?.hasPhoto) });
  }

  const notes: string[] = [];
  if (K && K < items.length) {
    const note = tryFill(r, R.BASIS_BRAND, { n: K });
    if (note) notes.push(note);
  }

  return { headline, intro, lists, total, points, dnaLead: r.pick(R.DNA_LEAD), dna, notes };
}

/** 첫 문장(굵게)과 나머지로 나눈다. */
function splitLead(text: string): { lead: string; text: string } {
  const m = /^([^]+?[.!?])\s+([^]+)$/.exec(text);
  return m ? { lead: m[1], text: m[2] } : { lead: text, text: "" };
}

function tryFill(r: Rng, list: readonly string[], vars: Vars): string | null {
  for (const t of r.shuffle(list)) {
    try {
      return fill(t, vars);
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  }
  return null;
}

import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { RoastReport } from "@/lib/roast/types";
import type { Analysis, Item } from "./analyze";
import { MUSINSA_POPULAR } from "./brands";
import { quotesAnswer } from "./compose";
import type { AskedQuestion } from "./questions";
import { fill, MissingVar, rng, won, type Rng, type Vars } from "./text";
import type { ReportTexts } from "./report-text";

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
/** 정규화 엔트로피(0: 한쪽에 몰림, 1: 고르게) */
function evenness(counts: number[]): number {
  const total = counts.reduce((s, x) => s + x, 0);
  const k = counts.length;
  if (!total || k < 2) return 0;
  const h = -counts.filter((c) => c > 0).reduce((s, c) => s + (c / total) * Math.log(c / total), 0);
  return h / Math.log(k);
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
  justify_combo: ["duplicate"],
  rationalize: ["duplicate"],
  extreme_one: ["duplicate"],
  jjanggu_q: ["duplicate"],
  recent_reason: ["burst", "binge"],
  binge_month: ["binge", "burst"],
  musinsa_q: ["musinsa"],
  trend_source: ["hype", "musinsa"],
  hype_alarm: ["hype"],
  category_why: ["category"],
  subcat_known: ["category"],
  fit_choice: ["fit"],
  shop_q: ["shop"],
  country_q: ["country", "country_kr"],
  top_item_q: ["polar"],
  sale_q: ["polar"],
  splurge_q: ["polar"],
  subcat_spend_q: ["spend", "polar"],
  timeless_q: ["hype"],
  mountain: ["func"],
  sports_q: ["func"],
  formal_job: ["formal"],
  old_trust: ["heritage"],
};
/** 점수에 한 줄을 붙이는 기준 */
export const SCORE_HIGH = 95;
export const SCORE_LOW = 30;
/** 결과에 넣는 질문 답은 세 개까지 */
const MAX_ANSWERS = 3;

export function buildReport(
  a: Analysis,
  name: string | null,
  seed: number,
  R: ReportTexts,
  asked: AskedQuestion[] = [],
  answers: Record<string, string> = {},
): RoastReport {
  const r = rng(seed ^ 0x2f6a91c3);
  const items = a.items;
  const clothes = a.clothes;
  const now = a.now.getTime();
  const photosOf = (list: Item[]) => list.filter((i) => i.hasPhoto).map((i) => i.id).slice(0, 12);
  const diags: Diag[] = [];
  const add = (d: Omit<Diag, "key" | "photos"> & { key?: string; photos?: string[] }) => diags.push({ key: d.id, photos: [], ...d });

  // 카테고리 균형(4.1): 상의·하의·아우터 중 한 종류 몫
  const byCat = countBy(clothes, (i) => i.cat);
  const [cat, catList] = byCat[0] ?? [null, []];
  const catShare = catList.length / Math.max(clothes.length, 1);
  if (cat && catShare >= 0.45) add({ id: "category", side: "high", strength: clamp((catShare - 0.45) / 0.35) * 0.9 + 0.1, value: `${CATEGORY_NAME[cat as Item["cat"]]} ${pct(catList.length, clothes.length)}%`, vars: { catName: CATEGORY_NAME[cat as Item["cat"]], pct: pct(catList.length, clothes.length), n: catList.length } });
  else if (byCat.length >= 3 && catShare <= 0.4) add({ id: "category", side: "low", strength: 0.15, value: "종류별로 고른 편", vars: {} });

  // 중복 구매(4.2): 세부분류 + 색(+ 아는 핏)
  const groups = countBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}|${i.fit?.level ?? "-"}`);
  const dup = groups[0]?.[1] ?? [];
  const what = dup.length ? `${dup[0].color} ${dup[0].subName ?? "옷"}` : "";
  if (dup.length >= 3) add({ id: "duplicate", side: "high", strength: clamp((dup.length - 2) / 5), value: `${what} ${dup.length}벌`, vars: { what, n: dup.length }, photos: photosOf(dup) });
  else if (clothes.length >= 20 && dup.length <= 2) add({ id: "duplicate", side: "low", strength: 0.15, value: "중복 거의 없음", vars: {} });
  const dupItems = groups.filter(([, l]) => l.length >= 3).reduce((s, [, l]) => s + l.length, 0);

  // 컬러 편중(4.3)
  const colored = items.filter((i) => i.color);
  const achro = colored.filter((i) => i.achromatic);
  const achroShare = achro.length / Math.max(colored.length, 1);
  if (colored.length >= 5) {
    if (achroShare >= 0.65) add({ id: "color", side: "high", strength: clamp((achroShare - 0.6) / 0.35), value: `무채색 ${pct(achro.length, colored.length)}%`, vars: { pct: pct(achro.length, colored.length) }, photos: photosOf(achro) });
    else if (achroShare <= 0.35) add({ id: "color", side: "low", strength: clamp((0.4 - achroShare) / 0.3) * 0.8, value: `유채색 ${pct(colored.length - achro.length, colored.length)}%`, vars: { colorPct: pct(colored.length - achro.length, colored.length) }, photos: photosOf(colored.filter((i) => !i.achromatic)) });
  }

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
    const catAvg = countBy(priced, (i) => i.cat)
      .filter(([, l]) => l.length >= 2)
      .map(([c, l]) => ({ c, v: avg(l.map((i) => i.price!)) }))
      .sort((x, y) => x.v - y.v);
    if (catAvg.length >= 2) {
      const cheap = catAvg[0];
      const pricy = catAvg[catAvg.length - 1];
      if (pricy.v / cheap.v >= 3.5)
        add({ id: "spend", side: "high", strength: clamp((pricy.v / cheap.v - 3) / 8) * 0.8, value: `${CATEGORY_NAME[pricy.c as Item["cat"]]} 평균 ${won(pricy.v)}`, vars: { cheapCat: CATEGORY_NAME[cheap.c as Item["cat"]], cheapWon: won(cheap.v), pricyCat: CATEGORY_NAME[pricy.c as Item["cat"]], pricyWon: won(pricy.v) } });
    }
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

  // 진단 카드: 문장이 있는 것만, 뚜렷한 순서로 3~5개(뚜렷하지 않은 "반대쪽" 카드는 모자랄 때만)
  const texts = R.diag as Record<string, { title: string; high: string[]; low?: string[] }>;
  const withText = diags.filter((d) => (texts[d.key]?.[d.side] ?? []).length);
  const strong = withText.filter((d) => d.strength >= 0.3).sort((x, y) => y.strength - x.strength);
  const weak = withText.filter((d) => d.strength < 0.3).sort((x, y) => y.strength - x.strength);
  const picked = [...strong, ...weak].slice(0, Math.max(3, Math.min(5, strong.length)));

  // 질문 답: 관련 카드에 붙이고, 남는 한 개는 "가장 수상한 부분"에 붙인다.
  const answerLine = (q: AskedQuestion, quoted: { v: boolean }) => {
    const list = q.roast[answers[q.id]] ?? [];
    if (!list.length) return null;
    const plain = list.filter((t) => !quotesAnswer(t));
    const text = r.pick(quoted.v && plain.length ? plain : list);
    if (quotesAnswer(text)) quoted.v = true;
    return text;
  };
  const quoted = { v: false };
  const cardAnswers = new Map<string, string>();
  let extra: string | null = null;
  let used = 0;
  for (const q of asked) {
    if (used >= MAX_ANSWERS || !answers[q.id]) continue;
    const target = (ANSWER_TO[q.id] ?? []).find((id) => picked.some((d) => d.id === id) && !cardAnswers.has(id));
    if (target) {
      const line = answerLine(q, quoted);
      if (line) {
        cardAnswers.set(target, line);
        used++;
      }
    } else if (!extra && !ANSWER_TO[q.id]) {
      extra = answerLine(q, quoted);
      if (extra) used++;
    }
  }

  const diagnoses = picked.flatMap((d) => {
    const text = tryFill(r, texts[d.key][d.side] ?? [], d.vars);
    if (!text) return [];
    const answer = cardAnswers.get(d.id);
    return [{ id: d.id, title: texts[d.key].title, value: d.value, text, ...(answer ? { answer } : {}), photos: d.photos.slice(0, 8) }];
  });

  // 점수(5.1): 객관적으로 볼 수 있는 것만. 문장은 유난히 높거나 낮을 때만(사용자 요청).
  const scores: RoastReport["scores"] = [];
  const S = R.score as Record<string, { label: string; high: string[]; low: string[] }>;
  const score = (id: string, v: number) => scores.push({ id, label: S[id].label, score: Math.round(clamp(v) * 100) });
  const main = ["top", "bottom", "outer"].map((c) => clothes.filter((i) => i.cat === c).length);
  score("category", evenness(main) * 1.05);
  score("duplicate", 1 - dupItems / Math.max(clothes.length, 1) / 0.5);
  if (dated.length >= 8) score("timing", 1 - (binList.length / dated.length - 0.1) / 0.45);
  if (priced.length >= 5) score("price", 1 - (Math.log(maxP / Math.max(med, 1)) - Math.log(2)) / (Math.log(25) - Math.log(2)));
  if (fitted.length >= 5) score("fit", evenness(["slim", "regular", "semi_over", "over"].map((l) => fitted.filter((i) => i.fit!.level === l).length)) * 1.1);
  if (branded.length >= 8) score("brand", 1 - (brandShare - 0.1) / 0.5);
  // 유난히 높거나 낮은 점수에만, 가장 튀는 두 개까지 한 줄을 붙인다.
  scores
    .filter((s) => s.score >= SCORE_HIGH || s.score <= SCORE_LOW)
    .sort((x, y) => Math.abs(y.score - 50) - Math.abs(x.score - 50))
    .slice(0, 2)
    .forEach((s) => {
      const text = r.pick(S[s.id][s.score >= SCORE_HIGH ? "high" : "low"]);
      if (text) s.text = text;
    });

  // 옷장 DNA(5.2)
  const D = R.dna;
  const dna: string[] = [];
  const chip = (t: string, v: Vars) => {
    try {
      dna.push(fill(t, v));
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  };
  if (colored.length >= 5) chip(achroShare >= 0.5 ? D.achromatic : D.colorful, { pct: achroShare >= 0.5 ? pct(achro.length, colored.length) : pct(colored.length - achro.length, colored.length) });
  if (enough && tags.length >= 2) chip(tags[1].n / K >= 0.25 ? D.styles : D.style, { tag1: tags[0].t, tag2: tags[1].t });
  const positions = countBy(known.flatMap((i) => i.brand!.positions.map((p) => ({ p, i }))), (x) => x.p);
  if (enough && positions.length) chip(D.position, { position: positions[0][0] });
  if (enough) {
    chip(D.hype, { level: level(hype) });
    chip(D.formal, { level: level(formal) });
    chip(D.func, { level: level(func) });
    chip(D.heritage, { level: level(heritage) });
  }
  if (branded.length >= 8) chip(D.musinsa, { pct: pct(labeled.length, branded.length) });
  if (enough && country && countryShare >= 0.3) chip(D.country, { country, pct: pct(countryList.length, K) });
  if (shop && linked.length >= 5 && shopList.length / linked.length >= 0.3) chip(D.shop, { shop, pct: pct(shopList.length, linked.length) });

  // 대표 캐릭터(6): 조건이 맞는 것 중 뚜렷한 순서로 세 개
  const C = R.character as Record<string, { name: string; who: string; text: string }>;
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
      return nm && who ? [{ name: nm, who, text: C[id].text }] : [];
    });

  // 한 줄 정의와 종합 진단
  const owner = name ? `${name}님의` : "당신의";
  const headline =
    (chars.length >= 2 ? tryFill(r, R.HEADLINE_TWO, { owner, first: chars[0].name, who2: chars[1].who }) : null) ??
    (chars.length ? tryFill(r, R.HEADLINE_ONE, { owner, who1: chars[0].who }) : null) ??
    fill(r.pick(R.HEADLINE_PLAIN), { owner });
  // 종합 진단: 가장 뚜렷한 두 진단의 수치를 한 문장으로 묶고 마무리 한 줄(카드 문장을 되풀이하지 않는다)
  const facts = diagnoses.slice(0, 2).map((d) => d.value);
  const summary = [facts.length ? `${facts.join(", ")}.` : "", r.pick(R.SUMMARY_TAIL)].filter(Boolean).join(" ");

  // 가장 수상한 부분: 이미 많은 걸 최근에도 또 산 경우를 먼저 찾는다.
  const U = R.suspicious;
  const isRecent = (i: Item) => Boolean(i.date && now - Date.parse(i.date) <= 183 * DAY && Date.parse(i.date) <= now);
  let suspicious: RoastReport["suspicious"] = null;
  const dupRecent = dup.filter(isRecent);
  const recentColored = recent.filter((i) => i.color);
  const recentAchro = recentColored.filter((i) => i.achromatic).length / Math.max(recentColored.length, 1);
  const recentBrand = recent.filter((i) => brandList.includes(i)).length / Math.max(recent.length, 1);
  const top = a.patterns.find((p) => p.id === "top_item");
  if (dup.length >= 3 && dupRecent.length >= 1) {
    const text = tryFill(r, U.dup_recent, { what, n: dup.length, recent: dupRecent.length });
    if (text) suspicious = { text, photos: photosOf(dup).slice(0, 8) };
  }
  if (!suspicious && achroShare >= 0.6 && recentColored.length >= 3 && recentAchro >= 0.6) {
    const text = tryFill(r, U.color_recent, { pct: pct(achro.length, colored.length), recentPct: Math.round(recentAchro * 100) });
    if (text) suspicious = { text, photos: photosOf(recent.filter((i) => i.achromatic)).slice(0, 8) };
  }
  if (!suspicious && brandShare >= 0.25 && recent.length >= 3 && recentBrand >= 0.5) {
    const text = tryFill(r, U.brand_recent, { brand: brandName, pct: pct(brandList.length, branded.length), recentPct: Math.round(recentBrand * 100) });
    if (text) suspicious = { text, photos: photosOf(brandList.filter(isRecent)).slice(0, 8) };
  }
  if (!suspicious && top) {
    const text = tryFill(r, U.top_item, { ...top.stats, priceWon: won(Number(top.stats.price)) });
    if (text) suspicious = { text, photos: top.garmentIds.filter((id) => items.find((i) => i.id === id)?.hasPhoto) };
  }
  if (suspicious && extra) suspicious.answer = extra;
  else if (!suspicious && extra) suspicious = { text: extra, photos: [] };

  const notes: string[] = [];
  if (K && K < items.length) {
    const note = tryFill(r, R.BASIS_BRAND, { n: K });
    if (note) notes.push(note);
  }

  return { headline, summary, diagnoses, scores, dna, characters: chars.map(({ name: n, text }) => ({ name: n, text })), suspicious, notes };
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

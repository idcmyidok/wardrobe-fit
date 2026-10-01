import "server-only";
import { FOUR_SEASONS, wearsInSeason } from "@/lib/constants/seasons";
import { colorCounted, fitSummary, type Analysis, type Item } from "./analyze";
import { brandLabels, isTrueHeritage, MUSINSA_POPULAR, musinsaLikesCut } from "./brands";
import { detectTasteShift } from "./shift";
import { AGE_BANDS, AGE_RULES, SCORE_RULES, type ScoreRules } from "./score-deltas";

/**
 * 총 옷장 점수의 옷장 부분("얼마나 힙한가", 계획서 /mnt/project-files/roast/score-plan.md).
 * 질문·퀴즈 답의 증감은 여기서 더하지 않는다(report.ts). 마지막 질문의 점수 구간도 이 값으로 정한다.
 */

const DAY = 86_400_000;
const MONTH_MS = 30.44 * DAY;

export interface ScorePart {
  id: string;
  delta: number;
  /** 관리자 점수 풀이용: 이번 옷장에 실제로 적용된 판단 기준(숫자 포함) */
  why: string;
  /** 관리자 점수 풀이용: 이 항목에 반영된 옷("브랜드 제품명"). 옷 하나하나가 아니라 전체 기준(구매 시기 등)이면 없다. */
  items?: string[];
}

export interface WardrobeScore {
  /** 옷장 점수(자르기 전) */
  score: number;
  parts: ScorePart[];
  /** 나이 기준에서 가장 크게 걸린 것(결과 한마디용) */
  age: { kind: "street" | "musinsa" | "mature" | "formal" | "lux" | "young_street"; pct: number; age: number } | null;
}

export interface ScoreOptions {
  /** 지금 나이(모르면 null: 나이 기준은 건너뜀) */
  age: number | null;
  rules?: Partial<ScoreRules>;
  ageRules?: Record<string, Record<string, number>>;
}

const priceOf = (i: Item) => i.brand?.price ?? 0;
/** 대중성 1(컬트)~3(패션 관심층)만. 대중적(4)·매우 대중적(5)은 디자이너·컨템포러리·스트릿 가점에서 뺀다. */
const notPopular = (i: Item) => (i.brand?.pop ?? 5) <= 3;
/** 디자이너 가점(1벌당 +2): 명품, 또는 디자이너 포지션이면서 가격 고가(5) 이상 */
const isTopDesigner = (i: Item) => i.groups.includes("luxury") || (i.groups.includes("designer") && priceOf(i) >= 5 && notPopular(i));
/** 중고가 가점(1벌당 +1): 디자이너 중고가, 컨템포러리·스트릿 중고가(4) 이상. 위 디자이너 가점과 겹치지 않는다. */
const isMidTier = (i: Item) =>
  !isTopDesigner(i) && notPopular(i) && ((i.groups.includes("designer") && priceOf(i) === 4) || ((i.groups.includes("contemporary") || i.groups.includes("street")) && priceOf(i) >= 4));
const isHeritage = (i: Item) => Boolean(i.brand && isTrueHeritage(i.brand));
/** 좋은 브랜드(디자이너 가점·중고가 가점·진짜 헤리티지) */
const isGood = (i: Item) => isTopDesigner(i) || isMidTier(i) || isHeritage(i);
/** 고급 브랜드: 컨템포러리 이상 포지션이거나 중고가 이상(기본색뿐인 옷장 감점용) */
const isNice = (i: Item) => i.groups.some((g) => g === "designer" || g === "luxury" || g === "contemporary") || priceOf(i) >= 4;
const isStreet = (i: Item) => i.groups.includes("street") || (i.brand?.hype ?? 0) >= 4;
const isMature = (i: Item) => i.groups.includes("contemporary") || (i.brand?.heritage ?? 0) >= 4 || (i.brand?.formal ?? 0) >= 3.5;
const isFormalLux = (i: Item) => i.groups.includes("luxury") || (i.brand?.formal ?? 0) >= 3.5;
const isRepro = (i: Item) => i.groups.includes("jp_denim") || /levi'?s vintage|lvc/i.test(`${i.brand?.name ?? ""} ${i.brandLabel}`);
const isLogo = (i: Item) => /로고|logo/i.test(i.g.productName);
const itemLabel = (i: Item) => `${i.brandLabel} ${i.g.productName}`.trim() || i.subName || "이름 없는 옷";
const monthIndex = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 12 + d.getMonth();
};

export function scoreWardrobe(a: Analysis, opts: ScoreOptions): WardrobeScore {
  const R = { ...SCORE_RULES, ...(opts.rules ?? {}) };
  const AR = opts.ageRules ?? AGE_RULES;
  const now = a.now.getTime();
  const items = a.items;
  const clothes = a.clothes;
  const parts: ScorePart[] = [];
  const add = (id: string, delta: number, why: string, list?: Item[]) => {
    const d = Math.round(delta * 10) / 10;
    if (d) parts.push({ id, delta: d, why, ...(list?.length ? { items: list.map(itemLabel) } : {}) });
  };
  /** 0~1 → "37%" */
  const P = (v: number) => `${Math.round(v * 100)}%`;
  const share = (list: Item[], f: (i: Item) => boolean) => (list.length ? list.filter(f).length / list.length : 0);
  const upTo = (s: number, fullPct: number, max: number) => Math.min(max, (s * 100 * max) / Math.max(fullPct, 1));
  const over = (s: number, fromPct: number, per10: number, max: number) => Math.min(max, (Math.max(0, s * 100 - fromPct) / 10) * per10);
  // 무신사풍: 무신사 인기 태그, 또는 무신사 좋아요 상위 musinsa_likes_top%(좋아요 없는 브랜드는 미입점이라 뺀다). SPA·대중 브랜드는 제외.
  const likesCut = musinsaLikesCut(R.musinsa_likes_top);
  const isMusinsa = (i: Item) =>
    !i.groups.includes("mass") && (brandLabels(i.g.brand).includes(MUSINSA_POPULAR) || (likesCut != null && (i.brand?.likes ?? 0) >= likesCut));

  const known = items.filter((i) => i.brand);
  const enough = known.length >= 5;
  const named = items.filter((i) => i.brandKind === "known" || i.brandKind === "unknown");
  const tags = new Map<string, number>();
  for (const i of known) for (const t of new Set(i.brand!.tags)) tags.set(t, (tags.get(t) ?? 0) + 1);
  const tagRank = [...tags.entries()].sort((x, y) => y[1] - x[1]);
  const styleTop = enough && tagRank.length ? tagRank[0][1] / known.length : 0;
  const byBrand = new Map<string, Item[]>();
  for (const i of named) {
    const k = i.brand?.name ?? i.brandLabel.toLowerCase();
    byBrand.set(k, [...(byBrand.get(k) ?? []), i]);
  }

  // 1. 더하는 점수 ------------------------------------------------------------
  const topDesigners = known.filter(isTopDesigner);
  add("designer", Math.min(R.designer_max, topDesigners.length * R.designer_each), `명품·디자이너(가격 고가 이상, 대중적 제외) ${topDesigners.length}벌 × ${R.designer_each}점, 최대 ${R.designer_max}점`, topDesigners);
  const midTiers = known.filter(isMidTier);
  add("mid", Math.min(R.mid_max, midTiers.length * R.mid_each), `컨템포러리·디자이너·스트릿 중고가 이상(대중적 제외) ${midTiers.length}벌 × ${R.mid_each}점, 최대 ${R.mid_max}점`, midTiers);
  if (enough) {
    add(
      "style",
      styleTop * 100 >= R.style_high_pct ? R.style_high : styleTop * 100 >= R.style_mid_pct ? R.style_mid : 0,
      `가장 많은 스타일 '${tagRank[0]?.[0] ?? ""}' ${P(styleTop)} (${R.style_high_pct}% 이상 +${R.style_high}, ${R.style_mid_pct}% 이상 +${R.style_mid})`,
      tagRank.length ? known.filter((i) => i.brand!.tags.includes(tagRank[0][0])) : [],
    );
    const isTaste = (i: Item) => i.groups.includes("jp_denim") || isHeritage(i) || (i.brand?.tags ?? []).some((t) => /워크웨어/.test(t));
    const taste = share(known, isTaste);
    add("taste", upTo(taste, R.taste_full, R.taste_max), `진짜 헤리티지(1990년 이전 설립, 너무 유명한 브랜드 제외)·워크웨어·일본 데님 ${P(taste)}, ${R.taste_full}%면 만점 ${R.taste_max}점`, known.filter(isTaste));
  }
  const fruitsN = items.filter((i) => i.shop === "후르츠패밀리").length;
  if (fruitsN >= R.fruits_n) add("fruits", R.fruits, `후르츠패밀리 링크 ${fruitsN}벌 (${R.fruits_n}벌 이상)`, items.filter((i) => i.shop === "후르츠패밀리"));

  // 색: 데님은 빼고 본다. 기본색 = 무채색
  const colored = items.filter(colorCounted);
  const basic = share(colored, (i) => i.achromatic);
  const accentN = colored.filter((i) => !i.achromatic).length;
  const luxN = known.filter(isGood).length;
  if (colored.length >= 5) {
    if (basic * 100 >= R.accent_basic_pct && accentN >= 1 && accentN <= R.accent_max_n)
      add("accent", R.accent, `무채색 ${P(basic)} (${R.accent_basic_pct}% 이상) + 유채색 ${accentN}벌 (1~${R.accent_max_n}벌)`, colored.filter((i) => !i.achromatic));
    if (basic * 100 >= R.basic_pct && luxN >= R.basic_lux_n) add("basic_lux", R.basic_lux, `무채색 ${P(basic)} (${R.basic_pct}% 이상) + 좋은 브랜드(디자이너·컨템포러리 중고가·진짜 헤리티지) ${luxN}벌 (${R.basic_lux_n}벌 이상)`, known.filter(isGood));
    if (basic * 100 >= R.basic_pct && enough && !known.some(isNice))
      add("basic_mass", -R.basic_mass, `무채색 ${P(basic)} (${R.basic_pct}% 이상) + 고급 브랜드(컨템포러리 이상이거나 중고가 이상) 0벌`, known);
  }

  // 구매 시기: 구매일을 적은 옷 8벌 이상일 때만
  const dated = items.filter((i) => i.date && Date.parse(i.date) <= now);
  if (dated.length >= 8) {
    const nowM = monthIndex(now);
    const months = new Set(dated.map((i) => monthIndex(Date.parse(i.date!))));
    // 구매 공백: 최근 24개월(첫 구매 이후) 중 한 벌도 안 산 달이 연속 gap_months 이상이면 그 개월 수만큼
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
    // 꾸준한 구매: 최근 12개월 동안 연속으로 안 산 달이 steady_gap 미만
    let longest = 0;
    run = 0;
    for (let m = nowM - 11; m <= nowM; m++) {
      run = months.has(m) ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    if (longest < R.steady_gap) add("steady", R.steady, `최근 12개월 중 가장 오래 안 산 기간 ${longest}개월 (${R.steady_gap}개월 미만)`);
  }
  // 소비액: 구매일·가격을 모두 적은 옷 8벌 이상일 때, 최근 12개월 합계 / 4
  const datedPriced = dated.filter((i) => i.price != null && i.price > 0);
  if (datedPriced.length >= 8) {
    const quarter = datedPriced.filter((i) => now - Date.parse(i.date!) <= 365 * DAY).reduce((s, i) => s + i.price!, 0) / 4 / 10_000;
    add(
      "spend",
      quarter >= R.spend_top_won ? R.spend_top : quarter >= R.spend_a_won ? -R.spend_a : quarter >= R.spend_b_won ? -R.spend_b : -R.spend_c,
      `최근 12개월 석 달 평균 구매액 ${Math.round(quarter)}만 원 (${R.spend_top_won}만 원 이상 +${R.spend_top}, ${R.spend_a_won}만 원 이상 −${R.spend_a}, ${R.spend_b_won}만 원 이상 −${R.spend_b}, 그 아래 −${R.spend_c})`,
      datedPriced.filter((i) => now - Date.parse(i.date!) <= 365 * DAY),
    );
  }

  const outers = clothes.filter((i) => i.cat === "outer");
  const goodOuters = outers.filter((i) => isTopDesigner(i) || isHeritage(i));
  if (goodOuters.length) add("good_outer", R.good_outer, `디자이너·명품·진짜 헤리티지 브랜드 아우터 ${goodOuters.length}벌`, goodOuters);
  const shoes = items.filter((i) => i.cat === "shoes");
  const leather = shoes.filter((i) => i.sub === "shoes.dress" || i.sub === "shoes.boots");
  if (leather.length) add("leather_shoes", R.leather_shoes, `구두·부츠 ${leather.length}켤레`, leather);
  const shoeSubs = new Set(shoes.map((i) => i.sub));
  if (["shoes.sneakers", "shoes.sports", "shoes.dress", "shoes.boots", "shoes.sandals"].every((s) => shoeSubs.has(s))) add("shoe_set", R.shoe_set, "스니커즈·스포츠화·구두·부츠·샌들이 다 있음", shoes);
  if (shoes.length >= 3 && shoes.every((i) => i.sub === "shoes.sneakers" || i.sub === "shoes.sports")) add("sneakers_only", -R.sneakers_only, `신발 ${shoes.length}켤레가 모두 스니커즈·스포츠화`, shoes);

  const krNew = known.filter((i) => i.brand!.country === "한국" && (i.brand!.founded ?? 0) >= R.kr_new_year && (isTopDesigner(i) || isMidTier(i)) && i.brand!.pop <= 2);
  if (krNew.length >= R.kr_new_n) add("kr_new", R.kr_new, `${R.kr_new_year}년 이후 생긴 국내 디자이너 브랜드(대중성 낮음) ${krNew.length}벌 (${R.kr_new_n}벌 이상)`, krNew);
  const jpList = known.filter((i) => i.brand!.country === "일본");
  const jpN = jpList.length;
  if (jpN >= R.jp_n) add("jp", R.jp, `일본 브랜드 ${jpN}벌 (${R.jp_n}벌 이상)`, jpList);
  const reproList = items.filter(isRepro);
  const repro = reproList.length;
  if (repro) add("repro", repro >= R.repro_many_n ? R.repro_many : R.repro, `일본 데님·리바이스 빈티지 ${repro}벌 (${R.repro_many_n}벌 이상이면 +${R.repro_many})`, reproList);
  // 국가를 모르는 브랜드(편집숍 입점 소규모 브랜드 등)는 해외로 치지 않는다.
  const isForeign = (i: Item) => Boolean(i.brand!.country) && i.brand!.country !== "한국" && !i.groups.includes("mass") && i.brand!.price >= R.foreign_price;
  const foreign = share(known, isForeign);
  if (enough && foreign * 100 >= R.foreign_pct) add("foreign", R.foreign, `해외 브랜드(SPA·대중 제외, 가격 레벨 ${R.foreign_price} 이상) ${P(foreign)} (${R.foreign_pct}% 이상)`, known.filter(isForeign));
  const boldList = items.filter((i) => (i.price ?? 0) >= R.bold_won * 10_000);
  const boldN = boldList.length;
  if (boldN) add("bold", R.bold, `${R.bold_won}만 원 이상 옷 ${boldN}벌`, boldList);
  // 무신사 좋아요 수는 없는데 중고가 이상인 브랜드(소규모 감각 브랜드일 가능성)
  const noLikes = known.filter((i) => !i.brand!.likes && i.brand!.price >= 4);
  add("nolikes", Math.min(R.nolikes_max, noLikes.length * R.nolikes_each), `무신사 좋아요 없는 중고가 이상 브랜드 ${noLikes.length}벌 × ${R.nolikes_each}점, 최대 ${R.nolikes_max}점`, noLikes);
  const regulars = [...byBrand.values()].filter((l) => l.length >= 2 && l.length <= 4 && !isMusinsa(l[0]) && !l[0].groups.includes("mass"));
  if (regulars.length >= R.regular_n) add("regular", R.regular, `2~4벌씩 산 단골 브랜드(무신사 인기·대중 제외) ${regulars.length}곳 (${R.regular_n}곳 이상)`, regulars.flat());

  // 2. 빼는 점수 --------------------------------------------------------------
  if (enough) {
    // 무신사 좋아요가 많고 고가 미만이면서 대중적인 브랜드(SPA·매스마켓 포함) 쏠림
    const isPopular = (i: Item) => (i.brand!.likes ?? 0) >= R.popular_likes && i.brand!.price < 5 && i.brand!.pop >= 4;
    const popular = share(known, isPopular);
    add("popular", -over(popular, R.popular_from, R.popular_per10, R.popular_max), `좋아요 ${R.popular_likes.toLocaleString()} 이상·고가 미만·대중적 브랜드 ${P(popular)} (${R.popular_from}% 넘는 10%마다 −${R.popular_per10}, 최대 −${R.popular_max})`, known.filter(isPopular));
    const isTrendy = (i: Item) => i.brand!.hype >= 4 && i.brand!.pop >= 4;
    const trendy = share(known, isTrendy);
    if (trendy * 100 >= R.trendy_pct) add("trendy", -R.trendy, `하이프·대중성 모두 높은 브랜드 ${P(trendy)} (${R.trendy_pct}% 이상)`, known.filter(isTrendy));
    if (styleTop * 100 < R.scattered_pct && named.length >= 8 && byBrand.size / named.length >= 0.7)
      add("scattered", -R.scattered, `가장 많은 스타일 ${P(styleTop)} (${R.scattered_pct}% 미만) + 옷 ${named.length}벌에 브랜드 ${byBrand.size}곳`, named);
    // 스타일 모르고 산 명품: 디자이너·럭셔리가 1~2벌뿐인데 그 스타일이 나머지 옷의 주력 스타일(상위 2개)과 안 겹침
    const lux = known.filter((i) => i.groups.includes("designer") || i.groups.includes("luxury"));
    if (lux.length >= 1 && lux.length <= 2) {
      const rest = new Map<string, number>();
      for (const i of known.filter((x) => !lux.includes(x))) for (const t of new Set(i.brand!.tags)) rest.set(t, (rest.get(t) ?? 0) + 1);
      const main = [...rest.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t);
      if (main.length && lux.every((i) => !i.brand!.tags.some((t) => main.includes(t))))
        add("lux_mismatch", -R.lux_mismatch, `디자이너·명품 ${lux.length}벌의 스타일이 옷장 주력 스타일(${main.join("·")})과 안 겹침`, lux);
    }
  }
  // 무신사 인기 브랜드 쏠림: 26세 이하에 산 옷은 1/musinsa_young_div만 센다
  if (named.length >= 8) {
    const w = (i: Item) => (opts.age != null && ageAt(opts.age, i, now) <= R.musinsa_young_age ? 1 / Math.max(R.musinsa_young_div, 1) : 1);
    const musinsaList = named.filter(isMusinsa);
    const m = musinsaList.reduce((s, i) => s + w(i), 0) / named.length;
    add(
      "musinsa",
      -over(m, R.musinsa_from, R.musinsa_per10, R.musinsa_max),
      `무신사풍 브랜드(인기 태그${likesCut != null ? `·좋아요 상위 ${R.musinsa_likes_top}%(${likesCut.toLocaleString()} 이상)` : ""}) ${P(m)} (${R.musinsa_from}% 넘는 10%마다 −${R.musinsa_per10}, 최대 −${R.musinsa_max}${opts.age != null ? `, ${R.musinsa_young_age}세 이하에 산 옷은 1/${R.musinsa_young_div}로 셈` : ""})`,
      musinsaList,
    );
  }
  // 구매 시기별 변화: 기본 0점(문장만), 관리자가 shift_score를 올리면 변화가 있을 때 더한다
  const shift = detectTasteShift(clothes, now, R);
  if (shift && R.shift_score)
    add("shift", R.shift_score, `${shift.fromLabel}(${shift.fromStyle}, 가격 레벨 ${shift.fromPrice.toFixed(1)}) → ${shift.toLabel}(${shift.toStyle}, ${shift.toPrice.toFixed(1)})로 ${shift.kind === "style" ? "주 스타일이 바뀜" : "가격대가 바뀜"}`, shift.list);
  const sameKind = [...groupBy(clothes.filter((i) => i.sub && i.color), (i) => `${i.sub}|${i.color}`).values()].filter((l) => l.length > 2);
  const sameProduct = [...groupBy(items, (i) => (i.g.productName ? `${i.brandLabel}|${i.g.productName}|${i.color ?? ""}`.toLowerCase() : null)).values()].filter((l) => l.length > 1);
  const copies = sameKind.reduce((n, l) => n + l.length - 2, 0) + sameProduct.reduce((n, l) => n + l.length - 1, 0);
  add("dup", -Math.min(R.dup_max, copies * R.dup_each), `같은 종류·색 3벌째부터, 같은 제품 2벌째부터 ${copies}벌 × ${R.dup_each}점, 최대 ${R.dup_max}점`, [...new Set([...sameKind.flat(), ...sameProduct.flat()])]);
  const fit = fitSummary(clothes);
  add("misfit", -Math.min(R.misfit_max, fit.misfit.length * R.misfit_each), `치수에 안 맞는 옷 ${fit.misfit.length}벌 × ${R.misfit_each}점, 최대 ${R.misfit_max}점`, fit.misfit);
  if (fit.fitted.length >= R.fit_min) {
    // 상의·하의 중 3벌 이상인 쪽만 본다(둘 다 적으면 전체로)
    const sides = [fit.top, fit.bottom].filter((p) => p.n >= 3);
    const look = sides.length ? sides : [fit.all];
    const trimMax = Math.max(...look.map((p) => p.trimShare));
    const bigMax = Math.max(...look.map((p) => p.bigShare));
    const side = sides.length ? "상의·하의 중 한쪽" : "전체";
    const trimSide = look.find((p) => p.trimShare === trimMax)!;
    const bigSide = look.find((p) => p.bigShare === bigMax)!;
    if (trimMax * 100 >= R.fit_trim_pct) add("fit_trim", R.fit_trim, `${side} 슬림·레귤러핏 ${P(trimMax)} (${R.fit_trim_pct}% 이상)`, trimSide.trim);
    else if (bigMax * 100 >= R.fit_big_pct) add("fit_big", -R.fit_big, `${side} 세미오버핏 이상 ${P(bigMax)} (${R.fit_big_pct}% 이상)`, bigSide.big);
    if (fitContrast(fit)) add("fit_contrast", R.fit_contrast, "상의·하의 각 3벌 이상에서 한쪽은 슬림·레귤러, 한쪽은 큰 핏이 절반 이상", [...fit.top.trim, ...fit.top.big, ...fit.bottom.trim, ...fit.bottom.big]);
  }
  const logo = share(clothes, isLogo);
  if (clothes.length && logo * 100 >= R.logo_pct) add("logo", -R.logo, `제품명에 '로고'가 든 옷 ${P(logo)} (${R.logo_pct}% 이상)`, clothes.filter(isLogo));
  const seasoned = items.filter((i) => i.seasons.length);
  if (seasoned.length >= 8) {
    const counts = FOUR_SEASONS.map((s) => seasoned.filter((i) => wearsInSeason(i.seasons, s.id)).length);
    if (Math.min(...counts) * 100 < Math.max(...counts) * R.season_gap_pct)
      add("season_gap", -R.season_gap, `가장 적은 계절 ${Math.min(...counts)}벌이 가장 많은 계절 ${Math.max(...counts)}벌의 ${R.season_gap_pct}% 미만`);
  }

  // 3. 나이에 맞는 옷: 옷마다 산 때 나이 구간으로 나눠 구간별로 규칙을 적용하고, 그 구간 옷 비중만큼 반영
  let age: WardrobeScore["age"] = null;
  if (opts.age != null && enough) {
    let worst = 0;
    const byBand = groupBy(known, (i) => bandOf(ageAt(opts.age!, i, now)));
    for (const [band, list] of byBand) {
      const rule = AR[band] ?? {};
      if (list.length < 3) continue;
      const weight = list.length / known.length;
      const hit = (kind: NonNullable<WardrobeScore["age"]>["kind"], pctKey: string, pointKey: string, sign: 1 | -1, f: (i: Item) => boolean) => {
        if (rule[pctKey] == null || !rule[pointKey]) return;
        const s = share(list, f);
        if (s * 100 < rule[pctKey]) return;
        const d = sign * rule[pointKey] * weight;
        add(`age_${kind}`, d, `${bandName(band)}에 산 옷 ${list.length}벌 중 ${P(s)} (${rule[pctKey]}% 이상) × ${sign > 0 ? "+" : "−"}${rule[pointKey]}점 × 옷장 비중 ${P(weight)}`, list.filter(f));
        if (sign < 0 && -d > worst) {
          worst = -d;
          age = { kind, pct: Math.round(s * 100), age: opts.age! };
        } else if (sign > 0 && !age) age = { kind, pct: Math.round(s * 100), age: opts.age! };
      };
      hit(band === "b0" || band === "b20" ? "young_street" : "street", "street_plus_pct", "street_plus", 1, isStreet);
      hit("street", "street_pct", "street_minus", -1, isStreet);
      hit("mature", "mature_pct", "mature_plus", 1, isMature);
      hit("musinsa", "musinsa_pct", "musinsa_minus", -1, isMusinsa);
      hit("formal", "formal_pct", "formal_minus", -1, isFormalLux);
      if (rule.lux_n != null && rule.lux_minus && list.filter((i) => i.groups.includes("luxury")).length >= rule.lux_n) {
        add("age_lux", -rule.lux_minus * weight, `${bandName(band)}에 산 명품 ${list.filter((i) => i.groups.includes("luxury")).length}벌 (${rule.lux_n}벌 이상) × −${rule.lux_minus}점 × 옷장 비중 ${P(weight)}`, list.filter((i) => i.groups.includes("luxury")));
        if (rule.lux_minus * weight > worst) age = { kind: "lux", pct: 0, age: opts.age };
      }
    }
  }

  const score = R.base + parts.reduce((s, p) => s + p.delta, 0);
  return { score, parts, age };
}

/** 그 옷을 산 때 나이(구매일이 없으면 지금 나이) */
/** 위아래 실루엣 대비: 한쪽은 슬림·레귤러, 다른 쪽은 오버·와이드가 절반 이상(각각 3벌 이상) */
export function fitContrast(f: ReturnType<typeof fitSummary>): boolean {
  if (f.top.n < 3 || f.bottom.n < 3) return false;
  return (f.top.trimShare >= 0.5 && f.bottom.bigShare >= 0.5) || (f.top.bigShare >= 0.5 && f.bottom.trimShare >= 0.5);
}

export function ageAt(age: number, i: Item, now: number): number {
  if (!i.date) return age;
  const t = Date.parse(i.date);
  return t > now ? age : age - Math.floor((now - t) / (12 * MONTH_MS));
}

/** 나이 구간 이름: "b24" → "24~26세", 마지막 구간은 "51세 이상" */
export function bandName(key: string): string {
  const i = AGE_BANDS.findIndex(([k]) => k === key);
  if (i < 0) return key;
  const from = AGE_BANDS[i][1];
  const next = AGE_BANDS[i + 1]?.[1];
  return next == null ? `${from}세 이상` : from === 0 ? `${next - 1}세 이하` : `${from}~${next - 1}세`;
}

export function bandOf(age: number): string {
  let key = AGE_BANDS[0][0];
  for (const [k, from] of AGE_BANDS) if (age >= from) key = k;
  return key;
}

/** 점수 구간(마지막 질문의 반응·증감을 고를 때) */
export function tierOf(score: number, rules?: Partial<ScoreRules>): "high" | "mid" | "low" {
  const R = { ...SCORE_RULES, ...(rules ?? {}) };
  return score >= R.tier_high ? "high" : score >= R.tier_low ? "mid" : "low";
}

function groupBy<T>(list: T[], key: (x: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

/** 관리자 점수 풀이에 쓰는 짧은 항목 이름(scoreWardrobe의 parts id). 판단 기준은 parts의 why에 있다. */
export const SCORE_PART_NAME: Record<string, string> = {
  designer: "디자이너 브랜드",
  mid: "중고가 브랜드",
  nolikes: "좋아요 없는 중고가",
  style: "뚜렷한 스타일",
  taste: "헤리티지 취향",
  fruits: "후르츠패밀리",
  accent: "포인트 색",
  basic_lux: "무채색 + 좋은 브랜드",
  basic_mass: "무채색 + 고급 브랜드 없음",
  gap: "구매 공백",
  steady: "꾸준한 구매",
  spend: "구매액",
  good_outer: "좋은 아우터",
  leather_shoes: "구두·부츠",
  shoe_set: "신발 구색",
  sneakers_only: "운동화뿐",
  kr_new: "신생 국내 브랜드",
  jp: "일본 브랜드",
  repro: "복각 데님",
  foreign: "해외 브랜드",
  bold: "큰 지출",
  regular: "단골 브랜드",
  popular: "인기 대중 브랜드 쏠림",
  trendy: "유행 브랜드 쏠림",
  scattered: "흩어진 브랜드",
  lux_mismatch: "따로 노는 명품",
  musinsa: "무신사 쏠림",
  dup: "같은 옷 반복",
  misfit: "안 맞는 옷",
  fit_trim: "슬림·레귤러핏",
  fit_big: "큰 핏 쏠림",
  fit_contrast: "위아래 핏 대비",
  logo: "로고 옷",
  season_gap: "계절 불균형",
  age_street: "나이: 스트릿",
  age_young_street: "나이: 스트릿",
  age_mature: "나이: 성숙한 브랜드",
  age_musinsa: "나이: 무신사",
  age_formal: "나이: 포멀·명품",
  age_lux: "나이: 명품",
};

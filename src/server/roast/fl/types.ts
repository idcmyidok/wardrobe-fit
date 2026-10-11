import "server-only";
import type { Feat, Mode } from "./feat";

/**
 * 패션 유형 52개. 유형은 "이 사람이 어떤 옷 입는 사람인가"를 신호로 판정해(적합도 0~1)
 * ① 항목 비중을 바꾸고 ② 항목의 평가 기준(rules)을 바꾼다.
 * 여기 값은 기본값이고, 관리자 화면(훈수 설계)에서 이름·설명·문장·비중·등급·기준 켜기를 고칠 수 있다.
 * 판정 함수(fitness)와 rules의 실제 계산은 코드(types.ts·axes.ts)에만 있다.
 */

export type AxisKey = "c" | "t" | "b" | "f" | "x";
/** 항목 이름: 옷장 / 주문내역 */
export const AXIS_NAME: Record<AxisKey, { closet: string; orders: string }> = {
  c: { closet: "취향 일관성", orders: "취향 방향" },
  t: { closet: "안목", orders: "브랜드 안목" },
  b: { closet: "구성 균형", orders: "구성 균형" },
  f: { closet: "핏·사이즈", orders: "핏 적합" },
  x: { closet: "개성·깊이", orders: "구매 규율" },
};
export const AXIS_KEYS: AxisKey[] = ["c", "t", "b", "f", "x"];
export const BASE_WEIGHTS: Record<Mode, Record<AxisKey, number>> = {
  closet: { c: 25, t: 25, b: 20, f: 20, x: 10 },
  orders: { c: 25, t: 25, b: 15, f: 10, x: 25 },
};

/** 평가 기준 스위치. 유형이 켜면 axes.ts의 계산이 달라진다. */
export const RULES = {
  palette_free: "색 일관성을 만점으로 고정하고 질감·실루엣 대비로 개성을 봅니다",
  variety_ok: "다양하게 입는 것을 감점하지 않고, 포멀도·가격 분산이 있으면 개성 가점",
  price_free: "저가 브랜드여도 안목을 깎지 않습니다(색 조합·핏·짝으로 평가)",
  core_upgrade: "핵심 아우터·신발이 한 단계 위 브랜드면 안목 가점",
  fit_over_ok: "오버 핏을 의도된 핏으로 인정하고, 지나치게 큰 것(큰 핏)만 감점",
  fit_slim_ok: "슬림 핏을 인정하고, 몸에 당겨 입은 것(작은 핏)만 감점",
  fit_weight: "핏 맞음 기준을 더 엄격하게 봅니다(실측 정확도)",
  volume_pair: "상의 오버와 하의 와이드처럼 볼륨을 짝지으면 가점",
  season_scoped: "있는 계절 안에서만 평가하고 빈 계절은 조언만 합니다",
  formal_free: "포멀 아이템이 없어도 감점하지 않습니다",
  cult_plus: "컬트·마니아 브랜드와 최고가 비중 가점",
  brand_deep: "한 계열 안의 브랜드 깊이 가점",
  complement: "주력 브랜드와 다른 브랜드의 어울림·빈틈 채우기·역할 분담 평가",
  hype_pair: "하이프 아이템을 기본 이너·하의로 받치면 가점",
  repeat_penalty: "같은 옷 색만 다르게 반복하면 감점",
  logo_care: "로고·그래픽이 겹치는 것만 감점, 무지 하의로 받치면 가점",
  heritage_real: "진짜 헤리티지 브랜드 비율과 소재 품질을 봅니다",
  shoe_deep: "신발 브랜드 깊이를 따로 평가하고 나머지 옷이 신발을 받치는지 봅니다",
  outer_core: "아우터가 중심일 때 이너·하의는 기본템이어도 인정",
  basics_gap: "부족한 기본템을 조언하고 방향이 잡히면 가점",
  recent_only: "최근 구매끼리의 일관성만 따로 평가",
  return_strict: "반품·교환을 더 엄격하게 보고 사이즈 조언 문장을 붙입니다",
  sale_ok: "세일로 샀어도 브랜드·품목이 좋으면 가점, 안 어울리는 싼 옷 반복은 감점",
  steady_plus: "구매가 적고 반품이 없으면 규율 가점",
} as const;
export type RuleId = keyof typeof RULES;

export type TypeGroup = "price" | "style" | "fit" | "habit";
export const GROUP_NAME: Record<TypeGroup, string> = { price: "가격·브랜드", style: "스타일·무드", fit: "핏·실루엣", habit: "구성·습관" };
/** 패션 몰입 보너스 등급: A 크게, B 중간, - 없음 */
export type Grade = "A" | "B" | "-";

export interface TypeLines {
  /** 근거를 짚는 말(숫자·브랜드 인용). 대화에서 먼저 나온다 */
  say: string[];
  /** 슬쩍 칭찬 */
  praise: string[];
  /** 이것만 바꾸면 */
  tip: string[];
}

export interface TypeDef {
  id: string;
  name: string;
  group: TypeGroup;
  grade: Grade;
  mode: Mode | "both";
  /** 이런 사람 */
  who: string;
  /** 이렇게 평가 */
  how: string;
  /** 같은 적합도일 때 먼저 붙는 순서(구체적일수록 큼) */
  priority: number;
  /** 항목 비중 변화(기본 비중에 더하고 100으로 다시 맞춤) */
  w: Partial<Record<AxisKey, number>>;
  rules: RuleId[];
  lines: TypeLines;
}

/** 판정 함수: 적합도 0~1. 0.6 이상이면 "뚜렷한 유형" */
type Fitness = (F: Feat) => number;

/** v가 min이면 0.6, full이면 1, min의 절반이면 0 */
export const ramp = (v: number, min: number, full: number): number => {
  if (v >= full) return 1;
  if (v >= min) return 0.6 + (0.4 * (v - min)) / Math.max(full - min, 1e-9);
  const lo = min * 0.5;
  return v > lo ? (0.6 * (v - lo)) / (min - lo) : 0;
};

const re = {
  basicsTee: /무지|베이직|basic/i,
  logo: /로고|그래픽|프린트|graphic|logo|print/i,
  running: /러닝|러너|트랙|조거|running|runner|track/i,
  crop: /크롭|롱|crop|long|맥시|maxi/i,
};

const bigLevel = (l: string | undefined) => l === "semi_over" || l === "over" || l === "too_big";
const isMusinsaStd = (name: string) => /^musinsa standard/i.test(name);

const need = (F: Feat, n: number) => F.n >= n;

/** 판정 함수. id → 적합도. 모드가 맞지 않으면 evaluate에서 걸러진다. */
export const FITNESS: Record<string, Fitness> = {
  // ── 가격·브랜드 14 ──
  spa: (F) => ramp(F.group("spa"), 0.5, 0.75),
  mass_trend: (F) => Math.max(ramp(F.group("mass"), 0.4, 0.7), 0.9 * ramp(F.kshare((i) => i.brand!.trend >= 4), 0.5, 0.8)),
  cheap_basic: (F) => ramp(F.level(1, 2), 0.65, 0.85),
  standard: (F) => ramp(F.kshare((i) => isMusinsaStd(i.brand!.name)), 0.3, 0.6),
  popular_picks: (F) => Math.max(ramp(F.popular, 0.5, 0.8), ramp(F.avg.pop, 4.2, 4.8) * (F.known.length >= 8 ? 1 : 0)),
  sports_daily: (F) => ramp(F.group("sports"), 0.35, 0.65),
  domestic_mid: (F) => ramp(F.kshare((i) => i.brand!.country === "한국" && i.brand!.price >= 2 && i.brand!.price <= 3), 0.5, 0.75),
  mid_select: (F) => (F.brandCount >= 6 && (F.topBrand?.share ?? 0) < 0.2 ? ramp(F.level(3, 4), 0.5, 0.75) : 0),
  premium_seeker: (F) => ramp(F.level(4, 6), 0.5, 0.8),
  designer_maniac: (F) => ramp(Math.max(F.group("designer") + F.group("contemporary") * 0.6, F.group("luxury") + F.group("designer")), 0.4, 0.65),
  indie_finder: (F) => (F.known.length >= 8 ? ramp(F.cult, 0.3, 0.5) : 0),
  one_brand: (F) => (need(F, 10) ? ramp(F.topBrand?.share ?? 0, 0.4, 0.65) : 0),
  heritage_vintage: (F) => ramp(F.heritage, 0.35, 0.6),
  vintage_collector: (F) => (F.mode === "closet" ? ramp(F.usedShop, 0.25, 0.5) : 0),

  // ── 스타일·무드 18 ──
  allblack: (F) => ramp(F.achro, 0.7, 0.9),
  minimal: (F) => ramp(F.tag("미니멀", "베이직", "모던", "조용한 럭셔리"), 0.5, 0.75),
  campus: (F) => ramp((F.share((i) => i.families.includes("hood") || /맨투맨|스웨트|후드/.test(i.g.productName) || i.denim, F.clothes) + F.level(1, 3)) / 2, 0.5, 0.7),
  daily_plain: (F) => ramp(F.tag("베이직", "클래식", "캐주얼", "데일리", "데일리 캐주얼"), 0.55, 0.8) * (F.avg.formal >= 2 && F.avg.formal <= 3.6 ? 1 : 0.7),
  dandy: (F) => ramp(F.share((i) => i.families.some((f) => ["shirt", "knit", "cardigan", "loafer", "derby"].includes(f)), F.items), 0.35, 0.6),
  cityboy: (F) => Math.max(ramp(F.tag("시티보이", "이지웨어", "원마일웨어", "내추럴"), 0.15, 0.3), ramp(F.kshare((i) => i.brand!.country === "일본" && (i.brand!.tags.includes("미니멀") || i.brand!.tags.includes("베이직") || i.brand!.tags.includes("캐주얼"))), 0.3, 0.5)),
  street_hype: (F) => ramp(F.group("street"), 0.4, 0.65),
  skate_hiphop: (F) => ramp(F.tag("스케이트", "힙합"), 0.15, 0.3) * 0.6 + 0.4 * ramp(F.fits.wide, 0.5, 0.75) * (F.group("street") >= 0.25 ? 1 : 0),
  graphic_logo: (F) => Math.max(ramp(F.word(re.logo), 0.35, 0.6), ramp(F.tag("로고플레이", "그래픽"), 0.45, 0.7)),
  workwear: (F) => Math.max(ramp(F.tag("워크웨어", "아메카지", "밀리터리", "유틸리티"), 0.35, 0.6), ramp(F.group("jp_denim"), 0.3, 0.5)),
  denim_maniac: (F) => ramp(F.denim, 0.35, 0.55) * (F.group("jp_denim") + F.group("specialist") >= 0.15 || F.tag("데님") >= 0.2 ? 1 : 0),
  outdoor_gorp: (F) => Math.max(ramp(F.group("outdoor"), 0.35, 0.6), ramp(F.tag("고프코어", "아웃도어", "테크웨어", "기능성"), 0.4, 0.65)),
  sporty_runner: (F) => Math.max(ramp(F.tag("러닝", "애슬레저", "스포티"), 0.2, 0.4), 0.9 * ramp(F.share((i) => re.running.test(i.g.productName) || i.families.includes("runner") || i.families.includes("track")), 0.3, 0.5)),
  formal_suit: (F) => (F.avg.formal >= 3.8 ? ramp(F.tag("테일러링", "클래식"), 0.4, 0.65) : 0),
  preppy: (F) => ramp(F.tag("프레피", "아이비"), 0.3, 0.5),
  y2k_retro: (F) => ramp(F.tag("Y2K", "레트로", "빈티지"), 0.3, 0.5),
  colorful: (F) => (F.colorCount >= 5 ? ramp(F.chroma, 0.5, 0.7) : 0),
  feminine: (F) => ramp(F.tag("페미닌", "로맨틱", "러블리", "우아함"), 0.4, 0.65),

  // ── 핏·실루엣 8 ──
  over_all: (F) => (F.fits.marked + F.fits.expected > 0 ? ramp(F.fits.over, 0.7, 0.9) : 0),
  slim_all: (F) => (F.fits.marked + F.fits.expected > 0 ? ramp(F.fits.slim, 0.7, 0.9) : 0),
  regular_pref: (F) => (F.fits.marked + F.fits.expected > 0 ? ramp(F.fits.regular, 0.6, 0.8) : 0),
  wide_bottom: (F) => (F.items.filter((i) => i.cat === "bottom").length >= 3 ? ramp(F.fits.wide, 0.6, 0.8) : 0),
  volume_contrast: (F) => {
    const up = F.items.filter((i) => i.cat === "top" || i.cat === "outer");
    const bot = F.items.filter((i) => i.cat === "bottom");
    if (up.length < 3 || bot.length < 3) return 0;
    const a = up.filter((i) => bigLevel(i.fit?.level)).length / up.length;
    const b = bot.filter((i) => bigLevel(i.fit?.level)).length / bot.length;
    return ramp(Math.abs(a - b), 0.5, 0.8);
  },
  size_precise: (F) => {
    const lv = F.clothes.map((i) => i.fit?.level).filter(Boolean);
    return lv.length >= 8 ? ramp(lv.filter((l) => l !== "too_small" && l !== "too_big").length / lv.length, 0.85, 0.95) : 0;
  },
  fit_experiment: (F) => (F.fits.marked + F.fits.expected > 0 ? ramp(Math.min(F.fits.slim, F.fits.regular, F.fits.big), 0.15, 0.28) : 0),
  length_play: (F) => ramp(F.word(re.crop), 0.2, 0.35),

  // ── 구성·습관 12 ──
  allrounder: (F) => {
    if (!need(F, 20)) return 0;
    const c = F.cat;
    const ok = [c.outer >= 0.1, c.top >= 0.2, c.bottom >= 0.15, c.shoes >= 0.07, F.season.spring + F.season.summer + F.season.fall + F.season.winter >= 2.4, F.tagFocus <= 0.6, F.avg.formal >= 1.8];
    const k = ok.filter(Boolean).length;
    return k >= 7 ? 1 : k === 6 ? 0.7 : 0;
  },
  shoe_collector: (F) => (need(F, 10) ? ramp(F.cat.shoes, 0.3, 0.5) : 0),
  outer_focus: (F) => (need(F, 10) ? ramp(F.cat.outer, 0.3, 0.45) : 0),
  hat_acc: (F) => (need(F, 10) ? ramp(F.cat.hat, 0.12, 0.2) : 0),
  layered: (F) => Math.max(ramp(F.share((i) => i.families.includes("layered") || /레이어드/.test(i.g.productName)), 0.15, 0.3), 0),
  beginner: (F) => (F.n <= 20 ? ramp(32 - F.n, 12, 18) : 0),
  wanderer: (F) => (F.known.length >= 10 ? ramp(1 - F.tagFocus, 0.5, 0.65) * (F.colorCount >= 7 ? 1 : 0.6) : 0),
  season_skew: (F) => {
    if (!need(F, 12)) return 0;
    const only = (s: string) => F.share((i) => i.seasons.length === 1 && i.seasons[0] === s);
    return ramp(Math.max(only("spring"), only("summer"), only("fall"), only("winter")), 0.6, 0.8);
  },
  new_arrivals: (F) => (F.mode === "orders" && F.dated >= 15 ? ramp(F.recent, 0.4, 0.65) : 0),
  size_wander: (F) => {
    const o = F.orders;
    if (F.mode !== "orders" || !o || o.orders < 8) return 0;
    return ramp((o.events.length + o.exchanged) / o.orders, 0.2, 0.4);
  },
  sale_buyer: (F) => (F.mode === "orders" && F.n >= 15 ? ramp(F.share((i) => i.price != null && i.brand != null && i.price < TYPICAL[i.brand.price] * 0.55, F.items.filter((i) => i.price != null)), 0.4, 0.6) : 0),
  careful_buyer: (F) => {
    const o = F.orders;
    if (F.mode !== "orders" || !o || F.n < 8 || F.n > 40) return 0;
    const bad = (o.events.length + o.exchanged) / Math.max(o.orders, 1);
    return bad <= 0.05 ? ramp(40 - F.n, 8, 24) : 0;
  },
};

/** 가격 레벨별 보통 가격(원). 세일 구매 판단·가격 대비 안목에 쓴다. */
export const TYPICAL: Record<number, number> = { 1: 25_000, 2: 45_000, 3: 80_000, 4: 150_000, 5: 300_000, 6: 600_000 };

const L = (say: string[], praise: string[], tip: string[]): TypeLines => ({ say, praise, tip });

/** 유형 정의(문구·비중·기준). 순서는 관리자 화면 표시 순서. */
export const TYPE_DEFS: TypeDef[] = [
  // ── 가격·브랜드 ──
  { id: "spa", name: "SPA 실속형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "유니클로·자라·탑텐 같은 SPA가 절반 이상", how: "브랜드로 깎지 않고 색 조합·핏·품목의 짝으로 봅니다. 핵심 아우터·신발을 한 단계 위로 올리면 가점",
    w: { t: -10, f: 5, b: 5 }, rules: ["price_free", "core_upgrade"],
    lines: L(["SPA가 {spaPct}%. 기본 체력은 탄탄한데 개성은 어디 두고 오셨죠.", "자라, 유니클로, 탑텐 사이를 오가는 옷장이네요. SPA 비중이 {spaPct}%입니다."],
      ["SPA로도 잘 입으면 반칙이 아니라 실력이죠. 색 조합이 깔끔합니다."], ["아우터나 신발 하나만 한 단계 위로 올려 보세요. 나머지가 갑자기 비싸 보입니다."]) },
  { id: "mass_trend", name: "매스·유행 추종형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "매스 브랜드가 많거나 유행 성향 4~5 브랜드가 많음", how: "유행템을 기본템과 섞으면 감소를 줄이고, 전신 유행템이면 감소, 사이즈가 맞으면 가점",
    w: { c: -5, f: 5, t: -5, x: 5 }, rules: ["hype_pair", "price_free"],
    lines: L(["유행하는 브랜드 위주네요. 지금 길거리에서 본 옷이 전부 여기 있습니다.", "대중 브랜드와 유행 브랜드가 {massPct}%. 트렌드는 빠른데 취향은 따라가는 중이네요."],
      ["유행을 빨리 잡는 눈은 인정합니다. 사이즈도 꽤 맞고요."], ["유행템 하나에 기본 하의 하나. 이 공식만 지켜도 한 계절은 안 낡습니다."]) },
  { id: "cheap_basic", name: "초가성비 기본템형", group: "price", grade: "-", mode: "both", priority: 2,
    who: "가격 레벨 1~2 브랜드가 대부분이고 무지·기본 위주", how: "가격이 낮아도 안목을 깎지 않고, 색 조합·핏·기본템 짝으로 평가",
    w: { t: -10, b: 5, f: 5 }, rules: ["price_free", "basics_gap"],
    lines: L(["싼 옷이 {lowPct}%입니다. 지갑은 건강한데 옷장은 단출하네요.", "가성비로 채운 옷장이네요. 기본템은 충분하지만 포인트가 없습니다."],
      ["가격 대비 핏이 잘 맞는 건 인정합니다. 싼 옷은 핏이 반이니까요."], ["포인트템 하나만 제대로 된 걸로 사 보세요. 같은 기본템도 달라 보입니다."]) },
  { id: "standard", name: "무신사 스탠다드형", group: "price", grade: "-", mode: "both", priority: 4,
    who: "무신사 스탠다드 같은 자체 브랜드가 30% 이상", how: "기본템 짝과 핏 적합 비중을 키우고, 색만 다른 반복은 감점, 포인트 한두 벌이 섞이면 가점",
    w: { f: 5, x: -5 }, rules: ["price_free", "repeat_penalty"],
    lines: L(["무신사 스탠다드가 {brandPct}%. 무난함에 보험을 든 옷장이네요.", "스탠다드 옷이 가득하군요. 실패는 없는데 놀라움도 없습니다."],
      ["스탠다드는 핏이 안정적이라 핏 점수는 믿음직합니다."], ["스탠다드는 바닥으로 깔고, 위에 얹을 한 벌만 다른 브랜드로 가 보세요."]) },
  { id: "popular_picks", name: "국민 인기템형", group: "price", grade: "-", mode: "both", priority: 2,
    who: "무신사 인기 브랜드·랭킹템 비중이 큼", how: "인기템을 나만의 조합으로 입으면 가점, 인기템끼리만 맞춘 듯하면 무난으로 인정",
    w: { x: 5, t: -5 }, rules: ["price_free", "hype_pair"],
    lines: L(["무신사 인기 브랜드가 {popularPct}%. 랭킹 1페이지를 정독하는 타입이시네요.", "다들 입는 브랜드가 많습니다. 실패 확률은 낮지만 길에서 마주칠 확률은 높죠."],
      ["인기템을 고르는 눈이 꾸준합니다. 흐름을 놓치지 않네요."], ["인기템 사이에 한 벌만 아무도 안 입는 걸로 섞어 보세요. 그게 취향이 됩니다."]) },
  { id: "sports_daily", name: "스포츠 브랜드 일상형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "나이키·아디다스·뉴발란스 등 스포츠 브랜드가 35% 이상", how: "신발·트랙 구성의 짝을 보고, 일상복과 섞으면 가점. 포멀이 없어도 감점 없음",
    w: { b: -3, x: 3 }, rules: ["formal_free", "price_free"],
    lines: L(["스포츠 브랜드가 {sportsPct}%. 체육복 입고 출근해도 되는 옷장이네요.", "운동하러 가는 건가요, 아니면 운동복이 일상인가요. 스포츠 브랜드 비중이 높습니다."],
      ["신발이 옷장을 끌어줍니다. 스포츠 브랜드는 신발이 반이죠."], ["운동복 사이에 셔츠나 슬랙스 한 벌만 섞으면 일상복으로 확 바뀝니다."]) },
  { id: "domestic_mid", name: "국내 중저가 브랜드형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "가격 레벨 2~3 국내 브랜드가 절반 이상", how: "브랜드 안목은 중간부터 시작. 한 계열이 모이거나 가격 대비 소재가 좋으면 가점",
    w: { c: 5, x: -3 }, rules: ["price_free", "brand_deep"],
    lines: L(["국내 중저가 브랜드가 {domesticPct}%. 무신사 단골이 확실합니다.", "국내 브랜드로 야무지게 채웠네요. 가격 대비 알차게 사는 눈은 있습니다."],
      ["가격 대비 계열이 모이는 게 보입니다. 쇼핑에 기준이 있으시네요."], ["브랜드를 하나쯤 더 깊게 파 보세요. 같은 브랜드 아우터 한 벌이 옷장의 중심이 됩니다."]) },
  { id: "mid_select", name: "중가 편집·셀렉트형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "가격 레벨 3~4 브랜드를 여러 곳에서 골고루", how: "브랜드를 섞어도 일관성이 나오면 안목 가점, 흩어지면 일관성 감소",
    w: { t: 5, c: 3 }, rules: ["brand_deep"],
    lines: L(["중가 브랜드 {midPct}%에 브랜드는 {brandCount}곳. 편집숍 쇼핑이 몸에 배었네요.", "여러 브랜드를 골라 담는 타입입니다. 한 곳에 몰빵하지 않는 점은 좋습니다."],
      ["브랜드를 섞어도 분위기가 안 깨집니다. 편집 감각이 있네요."], ["가장 아끼는 브랜드를 하나 정해 보세요. 중심이 생기면 편집이 더 선명해집니다."]) },
  { id: "premium_seeker", name: "고가 추구형", group: "price", grade: "A", mode: "both", priority: 5,
    who: "가격 레벨 4~6 브랜드가 절반 이상", how: "일관성과 핏이 받쳐 주면 점수가 크게 오르고(몰입 보너스 A), 못 받쳐 주면 안목 가점이 줄고 핏·중복이 감소. 유행 안 타는 옷에 가점",
    w: { t: 5, f: 5, c: 5, x: -5 }, rules: ["cult_plus", "fit_weight"],
    lines: L(["비싼 브랜드가 {highPct}%. 지갑이 옷장보다 먼저 취향을 정했네요.", "고가 브랜드 비중 {highPct}%. 이 정도면 쇼핑이 아니라 투자입니다."],
      ["비싼 옷을 잘 입고 있습니다. 가격이 아니라 안목으로 산 티가 납니다."], ["비싼 옷끼리 맞추려 하지 말고, 평범한 이너로 받쳐 보세요. 비싼 옷이 더 살아납니다."]) },
  { id: "designer_maniac", name: "디자이너·컨템포러리 마니아", group: "price", grade: "A", mode: "both", priority: 8,
    who: "디자이너·컨템포러리·럭셔리 브랜드가 40% 이상", how: "계열의 깊이와 폭 모두 가점, 컬트 브랜드와 최고가 비중 가점, 평이한 이너·하의로 디자이너 피스를 받치면 가점, 균형 기준 완화",
    w: { x: 10, t: 5, b: -8 }, rules: ["cult_plus", "brand_deep", "hype_pair"],
    lines: L(["디자이너·컨템포러리가 {designerPct}%. 무신사에서 이 정도면 취향이 확고하네요.", "디자이너 브랜드로 옷장을 채웠군요. 이쯤 되면 쇼핑이 아니라 수집입니다."],
      ["패션을 진짜 좋아하는 옷장입니다. 한 벌 한 벌에 이유가 있네요."], ["디자이너 피스 사이에 무난한 이너를 더하면 그 피스들이 더 돋보입니다."]) },
  { id: "indie_finder", name: "소규모·신진 브랜드 발굴형", group: "price", grade: "B", mode: "both", priority: 6,
    who: "대중성 낮은 컬트·신진 브랜드가 30% 이상", how: "발굴한 브랜드끼리 계열이 맞으면 가점, 기본템을 받쳐 주면 가점",
    w: { x: 8, t: 5, b: -5 }, rules: ["cult_plus", "brand_deep"],
    lines: L(["아는 사람만 아는 브랜드가 {cultPct}%. 인기 순위는 안 보시나 봐요.", "마니아 브랜드를 꽤 발굴하셨네요. 남들이 모르는 걸 입는 게 즐거운 타입입니다."],
      ["발굴한 브랜드끼리 분위기가 이어집니다. 우연이 아니라 취향입니다."], ["발굴한 옷 아래에 받침이 될 기본템 한두 벌만 더하면 완성도가 올라갑니다."]) },
  { id: "one_brand", name: "한 브랜드 덕후", group: "price", grade: "B", mode: "both", priority: 7,
    who: "한 브랜드가 40% 이상", how: "다른 브랜드 옷이 주력과 어울릴수록, 주력이 약한 품목을 채울수록, 주력이 아우터 같은 핵심을 맡고 다른 곳이 기본템을 채울수록 가점. 같은 옷 반복은 감소",
    w: { c: 5, x: 5, b: -5 }, rules: ["complement", "repeat_penalty", "brand_deep"],
    lines: L(["{brand}가 {brandPct}%. 옷장이 {brand|을} 위한 공연장입니다.", "{brand}만 {brandN}벌. 애사심이 거의 직원 수준이네요."],
      ["한 브랜드를 깊게 아는 건 취향이 확실하다는 뜻이죠. 다른 브랜드도 잘 어울립니다."], ["{brand}에 없는 품목은 다른 브랜드가 채우는 중이네요. 그 구성을 더 의도적으로 가 보세요."]) },
  { id: "heritage_vintage", name: "빈티지·헤리티지형", group: "price", grade: "B", mode: "both", priority: 7,
    who: "진짜 헤리티지 브랜드(오래되고 유명하지 않은)가 많음", how: "한 시대·계열 일관, 실측 입력(빈티지는 사이즈 표기를 못 믿으므로), 현대 기본템과 믹스 가점",
    w: { c: 5, x: 5, f: 3 }, rules: ["heritage_real", "brand_deep"],
    lines: L(["역사 있는 브랜드가 {heritagePct}%. 오래된 걸 좋아하는 게 취향이 아니라 신념이네요.", "헤리티지 브랜드 위주입니다. 유행은 돌아오지만 이 옷들은 계속 여기 있죠."],
      ["시간이 지나도 낡지 않는 옷 위주입니다. 안목이 오래 쓰겠네요."], ["현대적인 기본템을 하나 섞으면 빈티지가 더 새롭게 보입니다."]) },
  { id: "vintage_collector", name: "빈티지 컬렉터", group: "price", grade: "A", mode: "closet", priority: 9,
    who: "후루츠패밀리 같은 중고·빈티지 플랫폼 구매가 많고 구매가가 높음", how: "구매가 대비 브랜드·희소성, 계열 일관, 실측 입력, 현대 기본템과 믹스",
    w: { x: 10, t: 5, b: -5 }, rules: ["heritage_real", "cult_plus", "brand_deep"],
    lines: L(["중고·빈티지 플랫폼에서 산 옷이 {usedPct}%. 신상은 시시하다는 거죠.", "빈티지를 직접 구하는 타입입니다. 이 정도면 발품을 파는 취미입니다."],
      ["빈티지를 직접 찾아 사는 건 취향이 확실하다는 증거입니다."], ["산 옷의 실측을 입력해 두면 빈티지의 핏이 훨씬 정확하게 평가됩니다."]) },

  // ── 스타일·무드 ──
  { id: "allblack", name: "올블랙·무채색형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "무채색이 70% 이상", how: "색 일관성은 만점으로 두고, 질감·실루엣 대비·기장·포멀도 분산으로 개성을 봅니다. 같은 품목·핏 반복은 감소",
    w: { x: 8, c: -8 }, rules: ["palette_free", "repeat_penalty"],
    lines: L(["무채색이 {achroPct}%. 검정에 검정을 얹는 데 일가견이 있으시네요.", "옷장이 장례식장 분위기입니다. 정갈하긴 한데요."],
      ["색을 고르는 고민을 줄여서 핏과 질감에 쓰고 계시네요."], ["질감만 달라도 올블랙은 살아납니다. 니트, 가죽, 나일론을 섞어 보세요."]) },
  { id: "minimal", name: "미니멀·기본템형", group: "style", grade: "-", mode: "both", priority: 3,
    who: "미니멀·베이직 브랜드 위주, 로고·패턴 적음", how: "기본템 품질과 핏을 보고, 포인트 1~3벌이 있으면 가점",
    w: { f: 5, x: -3 }, rules: ["basics_gap", "formal_free"],
    lines: L(["미니멀·기본 브랜드가 {minimalPct}%. 꾸민 듯 안 꾸민 듯한 정갈함이네요.", "무난한 옷만 모았군요. 군더더기는 없는데 재미도 없습니다."],
      ["기본템 핏이 좋습니다. 꾸밈 없는 게 가장 어렵거든요."], ["포인트 한 벌만 있으면 미니멀이 심심함에서 세련됨으로 넘어갑니다."]) },
  { id: "campus", name: "캠퍼스 캐주얼형", group: "style", grade: "-", mode: "both", priority: 2,
    who: "후드·맨투맨·청바지·운동화 중심의 가성비 캐주얼", how: "색 조합과 핏 적합 중심. 후드·맨투맨 색이 겹쳐도 감점 없음, 아우터 한 벌이 단정하면 가점",
    w: { f: 5, t: -8, b: 3 }, rules: ["price_free", "basics_gap"],
    lines: L(["후드, 맨투맨, 청바지. 강의실 어디서든 바로 입고 갈 수 있는 옷장이네요.", "캠퍼스 룩의 정석입니다. 편한 건 확실한데 어디서 본 듯한 느낌이 있어요."],
      ["편한 옷이 깔끔하게 맞습니다. 대학생 옷장으로 합격입니다."], ["아우터 한 벌만 코트나 자켓으로 바꿔도 다른 사람처럼 보입니다."]) },
  { id: "daily_plain", name: "데일리 무난형", group: "style", grade: "-", mode: "both", priority: 1,
    who: "셔츠·니트·슬랙스 같은 포멀도 2~3의 무난한 구성", how: "일관성과 핏 비중을 키우고, 포인트템 한두 벌이 있으면 가점",
    w: { c: 5, f: 5 }, rules: ["basics_gap"],
    lines: L(["베이직·캐주얼 위주의 무난한 옷장입니다. 어디 가도 튀지 않죠.", "누구와 만나도 어색하지 않은 옷장이네요. 무난함이 취향입니다."],
      ["무난한데 정돈돼 있습니다. 이게 의외로 어려워요."], ["무난한 옷 사이에 색이나 소재가 다른 포인트를 한 벌 넣어 보세요."]) },
  { id: "dandy", name: "댄디·깔끔 캐주얼형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "셔츠·가디건·니트·로퍼 중심의 단정한 캐주얼", how: "색 톤 통일, 어깨·기장 실측 정확도 가점, 포멀과 캐주얼의 균형",
    w: { f: 5, c: 3 }, rules: ["fit_weight"],
    lines: L(["셔츠, 니트, 가디건이 많습니다. 소개팅 나가기 좋은 옷장이네요.", "단정한 옷 위주입니다. 어딘가 정리된 인상이 있어요."],
      ["단정함이 일관됩니다. 첫인상이 좋은 옷장입니다."], ["신발도 로퍼나 더비로 맞추면 단정함이 마지막까지 이어집니다."]) },
  { id: "cityboy", name: "시티보이·일본 캐주얼형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "여유 있는 핏과 차분한 색, 일본 계열 브랜드", how: "볼륨이 짝지어졌는지, 색 톤 통일, 소재를 봅니다",
    w: { c: 5, f: 3 }, rules: ["volume_pair", "fit_over_ok"],
    lines: L(["여유 있는 실루엣에 차분한 색. 시티보이 옷장이 이런 거죠.", "일본 계열 캐주얼이 눈에 띕니다. 힘 뺀 듯 신경 쓴 옷장이네요."],
      ["힘 뺀 듯한데 색 톤이 일정합니다. 그게 시티보이의 비결이죠."], ["소재 한 가지(리넨이나 코튼)를 늘리면 시티보이가 더 선명해집니다."]) },
  { id: "street_hype", name: "스트릿·하이프형", group: "style", grade: "B", mode: "both", priority: 6,
    who: "스트릿웨어와 로고 브랜드, 신발 비중이 큼", how: "한정판·콜라보 가점, 마니아 브랜드면 추가 가점, 하이프 템을 기본 이너·하의로 받치면 가점, 사이즈·반품은 엄격",
    w: { x: 5, f: 3, t: -3 }, rules: ["hype_pair", "cult_plus", "fit_weight"],
    lines: L(["스트릿 브랜드가 {streetPct}%. 신발장이 따로 있어야 할 것 같네요.", "하이프 브랜드에 진심입니다. 신상 알림은 꺼본 적이 없겠네요."],
      ["하이프 템을 사이즈까지 맞춰 입고 있습니다. 대부분은 사이즈에서 실패하죠."], ["하이프 한 벌에는 무지 하의. 두 벌이 겹치면 서로 싸웁니다."]) },
  { id: "skate_hiphop", name: "스케이트·힙합형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "배기·와이드 하의, 그래픽, 스케이트 브랜드", how: "상하의 볼륨 짝을 보고, 모자·신발 구색 가점, 오버사이즈는 정상 핏으로 인정",
    w: { f: -3, x: 5 }, rules: ["fit_over_ok", "volume_pair", "logo_care"],
    lines: L(["헐렁한 바지와 그래픽. 스케이트장에서 바로 알아볼 옷장입니다.", "배기 팬츠에 모자, 스케이트 신발까지. 한 줄로 설명되는 옷장이네요."],
      ["상하의 볼륨이 맞습니다. 헐렁한 건 맞춰 입을 때 멋있죠."], ["그래픽이 하나일 때가 가장 멋있습니다. 나머지는 무지로 눌러 보세요."]) },
  { id: "graphic_logo", name: "그래픽·로고 플레이형", group: "style", grade: "-", mode: "both", priority: 3,
    who: "그래픽·로고 상품이 35% 이상", how: "로고 충돌이 없으면 가점, 무지 하의로 받치면 가점, 한 벌에 로고가 겹치면 감소",
    w: { x: 3 }, rules: ["logo_care"],
    lines: L(["로고와 그래픽 옷이 {logoPct}%. 옷이 먼저 말을 거는 타입입니다.", "프린트가 가득한 옷장입니다. 입는 사람보다 옷이 주인공이네요."],
      ["로고끼리 부딪히지 않게 입고 있습니다. 의외로 쉽지 않은 일입니다."], ["로고 옷 하나에 무지 옷 둘. 이 비율이 로고를 더 돋보이게 합니다."]) },
  { id: "workwear", name: "워크웨어·아메카지형", group: "style", grade: "B", mode: "both", priority: 7,
    who: "워크웨어·데님·캔버스·밀리터리", how: "진짜 헤리티지 브랜드 비율, 소재 품질, 오버사이즈는 정상 핏으로 인정, 부츠·모자 구색 가점",
    w: { x: 5, t: 3, b: -3 }, rules: ["heritage_real", "fit_over_ok", "brand_deep"],
    lines: L(["워크웨어·아메카지 브랜드가 {workPct}%. 옷이 닳아야 멋이라고 믿는 분이네요.", "데님, 캔버스, 밀리터리. 공구함 열고 나온 듯한 옷장입니다."],
      ["진짜 브랜드를 쓰고 있습니다. 소재가 좋은 옷은 늙을수록 멋있죠."], ["부츠나 모자 같은 소품 한 가지를 더하면 워크웨어가 완성됩니다."]) },
  { id: "denim_maniac", name: "데님 매니아형", group: "style", grade: "B", mode: "both", priority: 7,
    who: "데님 하의·아우터 비중이 35% 이상이고 데님 전문 브랜드가 있음", how: "워싱·핏 다양성, 전문 브랜드 비중, 상의로 받치는 구성을 봅니다",
    w: { x: 5, t: 3 }, rules: ["heritage_real", "brand_deep"],
    lines: L(["데님이 {denimPct}%. 청바지 이름을 워싱별로 외우는 타입이시죠.", "데님 비중이 압도적입니다. 이쯤 되면 취미죠."],
      ["전문 브랜드의 데님을 갖고 계시네요. 청바지는 브랜드에서 갈립니다."], ["워싱이 비슷한 데님이 많다면 하나쯤은 전혀 다른 색(생지, 흑청)으로 바꿔 보세요."]) },
  { id: "outdoor_gorp", name: "아웃도어·고프코어형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "기능성 높은 아웃도어 브랜드", how: "쉘·미드·베이스 레이어 구성, 아웃도어 계열 일관, 도시 기본템과 믹스 가점",
    w: { b: 3, x: 3 }, rules: ["formal_free", "basics_gap"],
    lines: L(["아웃도어 브랜드가 {outdoorPct}%. 등산하러 가는 길에 카페 들를 준비가 돼 있네요.", "기능성 옷이 많습니다. 비가 와도 눈이 와도 끄떡없겠어요."],
      ["기능성 옷을 도시에서 어울리게 입고 있네요. 요즘 흐름을 잘 압니다."], ["도시용 기본템 한두 벌을 섞으면 아웃도어가 한층 세련돼 보입니다."]) },
  { id: "sporty_runner", name: "스포티·러닝형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "러닝·트랙·애슬레저 계열", how: "기능성 소재와 신발·트랙 구성, 일상복과 믹스 가점. 포멀 부재는 감점 없음",
    w: { b: -3 }, rules: ["formal_free", "price_free"],
    lines: L(["러닝·트랙 계열이 많습니다. 달리지 않아도 달릴 것 같은 옷장이네요.", "스포티한 옷이 눈에 띕니다. 신발부터 시작된 옷장 같아요."],
      ["기능성 소재가 일관됩니다. 입은 사람이 편해 보이는 이유가 있네요."], ["일상복 하의 하나를 섞으면 운동복이 스타일이 됩니다."]) },
  { id: "formal_suit", name: "포멀·클래식·수트형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "포멀도 4~5가 우세, 테일러링·클래식 브랜드", how: "자켓·슬랙스·셔츠·구두 구성의 완성도, 어깨·기장 실측 정확도 비중 확대, 캐주얼 부재는 감점 없음",
    w: { f: 8, c: 3, b: -3 }, rules: ["fit_weight", "formal_free"],
    lines: L(["포멀한 브랜드 위주입니다. 매일이 면접인 옷장이네요.", "자켓, 슬랙스, 구두. 정장 모드에서 못 벗어나는 타입입니다."],
      ["포멀은 핏이 전부인데 핏이 정확합니다. 어깨가 맞는 정장은 드물죠."], ["니트나 가디건 하나를 섞으면 포멀이 덜 딱딱해 보입니다."]) },
  { id: "preppy", name: "프레피·아이비형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "프레피·아이비 브랜드, 셔츠·니트·치노·로퍼", how: "짝 구성과 네이비·화이트·카키 팔레트를 봅니다",
    w: { c: 5 }, rules: ["basics_gap"],
    lines: L(["프레피 브랜드가 {preppyPct}%. 캠퍼스 잔디밭 화보 같은 옷장이네요.", "셔츠에 니트에 로퍼. 아이비 스타일을 제대로 이해하고 계십니다."],
      ["팔레트가 일관됩니다. 프레피는 색에서 결정되죠."], ["가끔은 스웨트나 데님으로 힘을 빼면 프레피가 더 편해 보입니다."]) },
  { id: "y2k_retro", name: "Y2K·레트로형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "Y2K·레트로·빈티지 태그 브랜드가 많음", how: "한 시대 태그 일관, 로고 허용, 소품 구색",
    w: { c: 3, x: 3 }, rules: ["logo_care"],
    lines: L(["레트로 감성 브랜드가 {y2kPct}%. 타임머신이 옷장에 있나 봅니다.", "Y2K와 레트로가 많군요. 그 시대를 좋아하는 건 확실합니다."],
      ["한 시대로 모여서 의도가 보입니다. 레트로는 일관이 생명이죠."], ["소품(모자, 가방, 선글라스)을 더하면 시대 분위기가 완성됩니다."]) },
  { id: "colorful", name: "컬러풀·포인트형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "비무채색 50% 이상, 색이 5가지 이상", how: "팔레트 3색 이내 반복으로 일관성 대체, 무채색 베이스와 포인트 색 비율이 적정하면 가점, 보색 충돌 과다는 감소",
    w: { c: -3, x: 5 }, rules: ["variety_ok"],
    lines: L(["유채색이 {chromaPct}%. 옷장이 무지개 같네요. 길에서도 눈에 띄겠습니다.", "색을 두려워하지 않는 분이네요. 옷장이 다채롭습니다."],
      ["색을 쓰는 용기가 있습니다. 무채색 베이스를 잘 깔아 줬네요."], ["자주 쓰는 색 세 가지를 정해 보세요. 다채로움이 취향으로 바뀝니다."]) },
  { id: "feminine", name: "페미닌·로맨틱형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "페미닌·로맨틱·러블리 브랜드가 40% 이상", how: "하의 기준에 원피스·스커트를 포함하고, 소재·길이·실루엣 다양성, 구두·가방 구색",
    w: { b: -3 }, rules: ["variety_ok"],
    lines: L(["페미닌 브랜드가 {femPct}%. 사랑스러운 옷장이네요.", "로맨틱한 분위기가 확실합니다. 소재도 부드러운 걸 고르시네요."],
      ["분위기가 일관됩니다. 취향이 분명한 옷장입니다."], ["신발이나 가방 하나만 단단한 느낌으로 바꾸면 균형이 잡힙니다."]) },

  // ── 핏·실루엣 ──
  { id: "over_all", name: "오버사이즈 일색형", group: "fit", grade: "-", mode: "both", priority: 5,
    who: "내가 표기한 핏과 앱이 내 치수로 계산한 예상 핏이 모두 오버인 옷이 70% 이상", how: "두 값을 함께 봅니다. 표기와 예상이 모두 오버면 의도된 오버로 인정, 표기는 적당인데 예상이 오버면 표기 오류 가능성 안내. 볼륨 짝이 맞으면 가점, 지나치게 큰 것만 감소",
    w: { f: -5, c: 3, x: 3 }, rules: ["fit_over_ok", "volume_pair"],
    lines: L(["오버핏이 {overPct}%. 옷이 몸을 입는지 몸이 옷을 입는지 모르겠습니다.", "큼직한 실루엣 일색이네요. 내 치수 대비로도 크게 입는 편입니다."],
      ["큰 옷을 의도적으로 입고 있습니다. 표기와 실제 치수가 일치하네요."], ["상의가 크면 하의는 정리해 보세요. 전부 크면 실루엣이 사라집니다."]) },
  { id: "slim_all", name: "슬림·타이트 일색형", group: "fit", grade: "-", mode: "both", priority: 5,
    who: "표기 또는 예상 핏이 슬림 이하인 옷이 70% 이상", how: "체형 대비 당겨 입은 정도만 감소, 상하의 핏 통일 가점",
    w: { f: 3 }, rules: ["fit_slim_ok"],
    lines: L(["슬림 핏이 {slimPct}%. 몸에 붙는 옷을 선호하시네요.", "슬림한 옷 일색입니다. 몸선을 드러내는 쪽이 취향이군요."],
      ["상하의 핏이 통일돼 있습니다. 슬림은 일관성이 핵심이죠."], ["한두 벌만 반 사이즈 크게 입어도 숨 쉴 구멍이 생깁니다."]) },
  { id: "regular_pref", name: "정핏·레귤러 선호형", group: "fit", grade: "-", mode: "both", priority: 4,
    who: "표기와 예상 핏이 모두 적당(레귤러)인 옷이 60% 이상", how: "핏 적합 비중을 키우고 어깨·기장·소매 실측 정확도로 평가. 무난해도 감점 없고 소재·색 조합이 좋으면 가점",
    w: { f: 8, x: -3 }, rules: ["fit_weight", "basics_gap"],
    lines: L(["정핏이 {regularPct}%. 몸에 딱 맞게 입는 걸 아는 분이네요.", "과하지도 모자라지도 않은 핏이 대부분입니다. 입는 방식이 안정적이에요."],
      ["핏이 정확합니다. 옷은 맞아야 비싸 보이죠."], ["정핏 위주니까 한 벌만 오버나 와이드를 섞어 보세요. 실루엣에 리듬이 생깁니다."]) },
  { id: "wide_bottom", name: "와이드·루즈 하의 선호형", group: "fit", grade: "-", mode: "both", priority: 4,
    who: "하의 중 와이드·배기·벌룬이 60% 이상", how: "상의 길이·볼륨과의 균형, 신발 볼륨 짝 평가, 기장이 바닥에 끌리지 않는지 확인",
    w: { f: -3 }, rules: ["fit_over_ok", "volume_pair"],
    lines: L(["하의가 전부 넉넉합니다. 바지통이 취향의 중심이네요.", "와이드 하의 비중이 {widePct}%. 두 다리를 해방시키는 타입입니다."],
      ["넉넉한 바지에 상의 길이를 맞추고 있습니다. 비율 감각이 있네요."], ["신발 볼륨이 바지통에 눌리지 않게, 조금 투박한 신발을 맞춰 보세요."]) },
  { id: "volume_contrast", name: "상하 볼륨 대비형", group: "fit", grade: "-", mode: "both", priority: 4,
    who: "상의와 하의의 핏 방향이 다름(오버 상의와 슬림 하의 등)", how: "의도된 대비로 보고 가점, 어정쩡하게 섞인 것만 감소",
    w: { x: 3 }, rules: ["volume_pair"],
    lines: L(["위는 크게, 아래는 좁게(혹은 반대로). 실루엣 대비를 즐기시네요.", "상하의 핏이 일부러 다릅니다. 비율에 신경 쓰는 타입이에요."],
      ["대비가 의도적입니다. 비율을 아는 사람의 옷장이네요."], ["대비가 한 방향으로 일정할 때 훨씬 세련돼 보입니다."]) },
  { id: "size_precise", name: "사이즈 정확형", group: "fit", grade: "-", mode: "both", priority: 3,
    who: "핏이 적당 범위(너무 작거나 큰 것 제외)인 옷이 85% 이상", how: "핏 점수가 높아도 비중을 올리지 않고 인정, 한 사이즈 업·다운 선택이 의도적이면 가점",
    w: { f: -2, x: 2 }, rules: [],
    lines: L(["사이즈 실패가 거의 없습니다. 사이즈표를 읽는 사람이네요.", "맞지 않는 옷이 드뭅니다. 이 정도면 구매 습관이 좋은 겁니다."],
      ["사이즈 감각이 정확합니다. 옷 사는 능력의 절반이 여기 있죠."], ["핏이 안정적이니 한 단계 모험(오버나 슬림)을 해 봐도 좋습니다."]) },
  { id: "fit_experiment", name: "핏 실험형", group: "fit", grade: "-", mode: "both", priority: 2,
    who: "슬림·정핏·오버가 골고루 섞임", how: "감점하지 않고 실험 중으로 보며, 가장 잘 맞는 핏을 짚어 줍니다",
    w: { f: -3 }, rules: ["variety_ok"],
    lines: L(["슬림도 정핏도 오버도 있습니다. 핏을 이것저것 시험 중이시네요.", "핏이 한 가지로 정해지지 않았습니다. 아직 탐색하는 중이군요."],
      ["다양한 핏을 시도한다는 건 몸에 맞는 걸 찾고 있다는 뜻이죠."], ["가장 마음에 든 핏 하나를 기준으로 삼으면 다음 쇼핑이 쉬워집니다."]) },
  { id: "length_play", name: "기장 실험형", group: "fit", grade: "-", mode: "both", priority: 3,
    who: "크롭·롱 기장 상품이 20% 이상", how: "기장 대비 상하의 균형, 허리 높이·신발 짝을 평가",
    w: { x: 3 }, rules: ["volume_pair"],
    lines: L(["크롭이나 롱 기장이 많습니다. 기장으로 승부를 보는 타입이네요.", "짧거나 길거나, 어정쩡한 길이는 안 입으시는군요."],
      ["기장에 이유가 있습니다. 비율을 아는 사람의 선택이죠."], ["길이가 극단일 때는 반대쪽을 단정하게 맞추면 한결 안정됩니다."]) },

  // ── 구성·습관 ──
  { id: "allrounder", name: "올라운더 균형형", group: "habit", grade: "-", mode: "closet", priority: 2,
    who: "품목·계절·포멀도가 고르게 분포", how: "일관성 기준을 완화하고, 포멀도·가격 분산이 있어야 개성 가점",
    w: { b: 5, c: -5 }, rules: ["variety_ok"],
    lines: L(["품목도 계절도 빠짐없이 갖췄습니다. 어떤 일정이 와도 입을 게 있네요.", "균형이 좋은 옷장입니다. 약점이 별로 안 보여요."],
      ["빈틈이 거의 없는 구성입니다. 옷장 관리를 잘 하셨네요."], ["이제 한 벌쯤은 모험을 해도 됩니다. 기본은 이미 다 있으니까요."]) },
  { id: "shoe_collector", name: "신발 컬렉터형", group: "habit", grade: "B", mode: "closet", priority: 6,
    who: "신발이 옷장의 35% 이상", how: "신발 브랜드 깊이·가격 안목을 따로 평가, 나머지 옷이 신발을 받치는지 평가, 같은 모델 색만 다르면 감소. 마니아 모델이면 몰입 보너스",
    w: { b: -8, x: 5 }, rules: ["shoe_deep", "repeat_penalty", "cult_plus"],
    lines: L(["신발이 {shoesPct}%. 신발이 옷을 입고 있는 건지, 옷이 신발을 입고 있는 건지.", "신발장이 옷장보다 큰 옷장입니다. 보는 눈이 신발에 쏠려 있네요."],
      ["신발 취향이 분명합니다. 신발에서 기본은 하고 가시네요."], ["옷이 신발을 받치는지 보세요. 신발이 주인공이면 옷은 조연으로 정리하는 게 좋습니다."]) },
  { id: "outer_focus", name: "아우터 중시형", group: "habit", grade: "-", mode: "closet", priority: 4,
    who: "아우터 비중이 30% 이상", how: "아우터가 중심일 때 이너·하의는 기본템이어도 인정, 아우터 계열 일관 가점",
    w: { b: -5, t: 3 }, rules: ["outer_core"],
    lines: L(["아우터가 {outerPct}%. 겉옷에 돈을 쓰는 타입이네요.", "겉옷이 중심인 옷장입니다. 계절 바뀔 때 가장 신나겠어요."],
      ["아우터 중심 구성은 한 벌로 분위기를 정하는 똑똑한 방식입니다."], ["아우터가 좋으니 이너는 무지로 정리하세요. 아우터가 더 빛납니다."]) },
  { id: "hat_acc", name: "모자·소품 활용형", group: "habit", grade: "-", mode: "closet", priority: 3,
    who: "모자 등 소품 비중이 12% 이상", how: "소품이 룩의 포인트로 짝이 맞으면 가점, 같은 소품 중복은 감소",
    w: { x: 3 }, rules: ["hype_pair"],
    lines: L(["모자가 {hatPct}%. 머리 위가 패션의 마지막 퍼즐이라고 믿으시는군요.", "소품 비중이 높은 편입니다. 마무리를 챙기는 타입이네요."],
      ["소품을 활용하는 건 센스입니다. 룩이 한층 입체적으로 보입니다."], ["모자는 옷색과 한 가지만 맞춰도 충분합니다. 과하면 정신없어요."]) },
  { id: "layered", name: "레이어드 활용형", group: "habit", grade: "-", mode: "both", priority: 3,
    who: "레이어드 상품이나 겹쳐 입는 구성이 많음", how: "두께·기장 차이가 나게 짜면 가점, 계절별 겹쳐 입는 구성 평가",
    w: { b: 3, x: 3 }, rules: ["volume_pair"],
    lines: L(["레이어드 아이템이 눈에 띕니다. 겹쳐 입는 재미를 아시네요.", "겹쳐 입는 걸 즐기는 옷장입니다. 한 장으로 끝내는 법이 없네요."],
      ["겹쳐 입는 구성이 꽤 계산돼 있습니다. 두께 차이가 좋아요."], ["겹칠 때 색은 두 가지까지만. 세 가지 넘으면 정리가 어렵습니다."]) },
  { id: "beginner", name: "패션 입문형", group: "habit", grade: "-", mode: "both", priority: 9,
    who: "옷이 10~20벌 정도이고 기본템이 부족", how: "낮게 깎지 않고 '기본기 쌓는 중'으로 보고 부족한 기본템을 조언, 방향이 잡히면 가점",
    w: { b: -5, c: 5, t: -3 }, rules: ["basics_gap", "price_free"],
    lines: L(["옷이 아직 많지 않네요. 이제 막 옷장을 키우기 시작하는 단계입니다.", "시작 단계의 옷장입니다. 지금부터 채우는 게 제일 재미있는 시기죠."],
      ["처음치고 방향이 잡혀 있습니다. 기본기부터 쌓는 순서가 맞아요."], ["기본 상의 두 벌과 하의 두 벌만 제대로 사도 조합이 폭발적으로 늘어납니다."]) },
  { id: "wanderer", name: "취향 방랑형", group: "habit", grade: "-", mode: "both", priority: 2,
    who: "스타일 태그가 흩어지고 색도 많음", how: "감점 대신 '실험 중'으로 보고 조언, 최근으로 갈수록 한 방향으로 모이면 가점",
    w: { c: -5, x: 3 }, rules: ["variety_ok"],
    lines: L(["스타일이 한 곳에 안 모입니다. 취향 방랑 중이시네요.", "옷장이 이것저것 섞인 편집숍 같습니다. 취향을 찾는 중인가 봐요."],
      ["다양하게 시도해 봤다는 건 자기 취향을 찾으려는 노력입니다."], ["지금 가장 마음에 드는 옷 세 벌의 공통점을 찾아보세요. 그게 다음 쇼핑의 기준입니다."]) },
  { id: "season_skew", name: "시즌 편중형", group: "habit", grade: "-", mode: "closet", priority: 2,
    who: "한 계절 옷이 60% 이상", how: "있는 계절 안에서 평가하고 비어 있는 계절을 조언",
    w: { b: -5 }, rules: ["season_scoped"],
    lines: L(["{seasonName} 옷이 {seasonPct}%. 다른 계절은 어떻게 나시려고요.", "한 계절 옷에 몰려 있습니다. 계절이 바뀌면 입을 게 없겠네요."],
      ["있는 계절 옷은 잘 갖췄습니다. 그 계절엔 걱정이 없겠네요."], ["다음 계절 아우터나 신발부터 하나씩 채워 보세요."]) },
  { id: "new_arrivals", name: "신상 몰림형", group: "habit", grade: "-", mode: "orders", priority: 3,
    who: "최근 6개월 구매가 40% 이상", how: "최근 구매끼리의 일관성만 따로 평가",
    w: { c: 3 }, rules: ["recent_only"],
    lines: L(["최근 6개월에 산 옷이 {recentPct}%. 요즘 쇼핑에 불이 붙으셨네요.", "최근 구매가 몰려 있습니다. 올해 옷에 진심이시군요."],
      ["최근 구매끼리는 방향이 이어집니다. 지금 취향이 확실하네요."], ["새로 산 옷에 맞는 하의가 있는지 확인하고 사세요. 따로 놀면 입을 일이 줄어듭니다."]) },
  { id: "size_wander", name: "사이즈 유랑형", group: "habit", grade: "-", mode: "orders", priority: 4,
    who: "반품·교환 비율이 높음", how: "반품 감점 한도 -10을 유지하고 사이즈 조언 문장을 붙입니다",
    w: { x: -3 }, rules: ["return_strict"],
    lines: L(["주문 {orders}건에 반품·교환 {events}번. 사이즈표 앞에서 머뭇거리는 타입이네요.", "반품과 교환이 잦습니다. 입어 보고 사는 쇼핑이 필요한 분이에요."],
      ["그래도 환불 받는 습관은 좋습니다. 손해는 안 보시네요."], ["산 사이즈의 실측을 적어 두세요. 다음 구매에서 같은 실패를 줄여 줍니다."]) },
  { id: "sale_buyer", name: "세일 구매형", group: "habit", grade: "-", mode: "orders", priority: 3,
    who: "보통 가격보다 크게 싸게 산 결제가 비중이 높음", how: "세일로 샀어도 브랜드·품목이 좋으면 가점, 안 어울리는 싼 옷 반복은 감소",
    w: { t: -3 }, rules: ["sale_ok", "price_free"],
    lines: L(["보통 가격보다 크게 싸게 산 옷이 {salePct}%. 세일 알림은 꺼본 적이 없죠.", "할인 때 산 옷이 많습니다. 싸게 사는 눈은 확실하네요."],
      ["싸게 사서 좋은 옷을 건졌다면 그게 실력이죠."], ["세일가가 싸다고 사는 옷과 원래 갖고 싶던 옷을 구분해 보세요."]) },
  { id: "careful_buyer", name: "소량 신중 구매형", group: "habit", grade: "-", mode: "orders", priority: 3,
    who: "구매가 적고 반품이 거의 없음", how: "구매 규율 가점, 자료가 적으면 '자료가 적어요'를 함께 표시",
    w: { x: 3 }, rules: ["steady_plus"],
    lines: L(["주문 {orders}건에 반품 거의 없음. 사야 할 때만 사는 타입이네요.", "필요한 것만 사고 후회가 적은 쇼핑입니다."],
      ["살 때 신중한 습관이 보입니다. 반품이 없는 게 증거죠."], ["자료가 적어서 평가가 덜 정확합니다. 옷장 쪽도 함께 해보세요."]) },
];

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
  closet: { c: 25, t: 35, b: 20, f: 10, x: 10 },
  orders: { c: 25, t: 30, b: 15, f: 5, x: 25 },
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
    lines: L(["SPA가 {spaPct}%. 기본 체력은 탄탄한데 개성은 매장 계산대에 두고 오셨나 봐요.", "자라, 유니클로, 탑텐을 순회하시는 옷장이네요. SPA {spaPct}%면 거의 정기 구독 수준입니다."],
      ["SPA로 이 정도 색 조합이면 인정은 해 드릴게요. 비싼 척은 못 해도 깔끔하긴 하네요."], ["아우터나 신발 하나만 한 단계 위로 올려 보세요. 나머지 옷들이 갑자기 몸값을 속이기 시작합니다."]) },
  { id: "mass_trend", name: "매스·유행 추종형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "매스 브랜드가 많거나 유행 성향 4~5 브랜드가 많음", how: "유행템을 기본템과 섞으면 감소를 줄이고, 전신 유행템이면 감소, 사이즈가 맞으면 가점",
    w: { c: -5, f: 5, t: -5, x: 5 }, rules: ["hype_pair", "price_free"],
    lines: L(["유행 브랜드 위주시네요. 이번 시즌 길거리 스냅을 그대로 옮겨 오셨습니다.", "대중·유행 브랜드가 {massPct}%. 트렌드는 빠르신데 취향은 아직 그 뒤를 쫓는 중이시죠."],
      ["유행 잡는 속도 하나는 알고리즘보다 빠르시네요. 사이즈까지 맞춘 건 좀 놀랍습니다."], ["유행템 하나에 기본 하의 하나. 이 공식만 지키셔도 옷이 한 계절 만에 촌스러워지진 않습니다."]) },
  { id: "cheap_basic", name: "초가성비 기본템형", group: "price", grade: "-", mode: "both", priority: 2,
    who: "가격 레벨 1~2 브랜드가 대부분이고 무지·기본 위주", how: "가격이 낮아도 안목을 깎지 않고, 색 조합·핏·기본템 짝으로 평가",
    w: { t: -10, b: 5, f: 5 }, rules: ["price_free", "basics_gap"],
    lines: L(["싼 옷이 {lowPct}%입니다. 통장은 지키셨는데 옷장은 좀 허전하네요.", "가성비로 꽉 채운 옷장이네요. 기본템은 차고 넘치는데 기억에 남는 옷이 없습니다."],
      ["싼 옷인데 핏은 또 잘 맞추셨네요. 아끼는 와중에 볼 건 다 보셨습니다."], ["포인트템 하나만 제대로 된 걸로 사 보세요. 그 한 벌 덕에 나머지 기본템까지 덩달아 출세합니다."]) },
  { id: "standard", name: "무신사 스탠다드형", group: "price", grade: "-", mode: "both", priority: 4,
    who: "무신사 스탠다드 같은 자체 브랜드가 30% 이상", how: "기본템 짝과 핏 적합 비중을 키우고, 색만 다른 반복은 감점, 포인트 한두 벌이 섞이면 가점",
    w: { f: 5, x: -5 }, rules: ["price_free", "repeat_penalty"],
    lines: L(["무신사 스탠다드가 {brandPct}%. 무난함에 종신보험을 드셨네요.", "스탠다드가 줄지어 걸려 있군요. 실패는 없는데 설렘도 없습니다."],
      ["스탠다드라 핏은 믿음직하네요. 위험한 선택을 안 하시니 틀릴 일도 없으시죠."], ["스탠다드는 바닥으로 깔고, 그 위에 얹을 딱 한 벌만 다른 브랜드로 가 보세요. 용기 내셔도 됩니다."]) },
  { id: "popular_picks", name: "국민 인기템형", group: "price", grade: "-", mode: "both", priority: 2,
    who: "무신사 인기 브랜드·랭킹템 비중이 큼", how: "인기템을 나만의 조합으로 입으면 가점, 인기템끼리만 맞춘 듯하면 무난으로 인정",
    w: { x: 5, t: -5 }, rules: ["price_free", "hype_pair"],
    lines: L(["무신사 인기 브랜드가 {popularPct}%. 랭킹 1페이지를 교과서처럼 정독하시는군요.", "다들 입는 브랜드가 가득합니다. 실패 확률은 낮지만 길에서 똑같은 옷과 마주칠 확률은 높죠."],
      ["인기템 고르는 감은 꾸준하시네요. 남들이 검증한 걸 사는 것도 나름의 재능입니다."], ["인기템 사이에 아무도 안 입는 한 벌을 섞어 보세요. 그게 랭킹이 아니라 취향이 됩니다."]) },
  { id: "sports_daily", name: "스포츠 브랜드 일상형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "나이키·아디다스·뉴발란스 등 스포츠 브랜드가 35% 이상", how: "신발·트랙 구성의 짝을 보고, 일상복과 섞으면 가점. 포멀이 없어도 감점 없음",
    w: { b: -3, x: 3 }, rules: ["formal_free", "price_free"],
    lines: L(["스포츠 브랜드가 {sportsPct}%. 체육복으로 출근해도 아무도 모를 옷장이네요.", "운동하러 가시는 건지, 운동복이 그냥 일상이신 건지. 스포츠 브랜드 비중이 꽤 높습니다."],
      ["신발이 옷장을 혼자 다 끌고 가네요. 스포츠 브랜드는 원래 신발이 반이니 반은 성공하셨습니다."], ["운동복 사이에 셔츠나 슬랙스 한 벌만 섞어 보세요. 그제야 헬스장 밖에서도 말이 됩니다."]) },
  { id: "domestic_mid", name: "국내 중저가 브랜드형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "가격 레벨 2~3 국내 브랜드가 절반 이상", how: "브랜드 안목은 중간부터 시작. 한 계열이 모이거나 가격 대비 소재가 좋으면 가점",
    w: { c: 5, x: -3 }, rules: ["price_free", "brand_deep"],
    lines: L(["국내 중저가 브랜드가 {domesticPct}%. 무신사 장바구니가 거의 생활 공간이시네요.", "국내 브랜드로 야무지게 채우셨네요. 가격 계산은 빠르신데 기억에 남는 한 벌은 아직 없습니다."],
      ["가격 대비 계열이 모이는 게 보입니다. 쇼핑에 나름 기준이 있긴 하셨네요."], ["브랜드 하나쯤은 깊게 파 보세요. 같은 브랜드 아우터 한 벌이 생기면 옷장에 드디어 중심이 잡힙니다."]) },
  { id: "mid_select", name: "중가 편집·셀렉트형", group: "price", grade: "-", mode: "both", priority: 3,
    who: "가격 레벨 3~4 브랜드를 여러 곳에서 골고루", how: "브랜드를 섞어도 일관성이 나오면 안목 가점, 흩어지면 일관성 감소",
    w: { t: 5, c: 3 }, rules: ["brand_deep"],
    lines: L(["중가 브랜드 {midPct}%에 브랜드만 {brandCount}곳. 편집숍 장바구니가 체질이시네요.", "여러 브랜드를 골고루 담으셨네요. 한 곳에 몰빵 안 하신 건 좋은데 정은 어디에도 안 주셨습니다."],
      ["브랜드를 이렇게 섞었는데 분위기가 안 깨지네요. 편집 감각은 은근히 있으십니다."], ["제일 아끼는 브랜드를 하나 정해 보세요. 중심이 생겨야 편집도 편집처럼 보입니다."]) },
  { id: "premium_seeker", name: "고가 추구형", group: "price", grade: "A", mode: "both", priority: 5,
    who: "가격 레벨 4~6 브랜드가 절반 이상", how: "일관성과 핏이 받쳐 주면 점수가 크게 오르고(몰입 보너스 A), 못 받쳐 주면 안목 가점이 줄고 핏·중복이 감소. 유행 안 타는 옷에 가점",
    w: { t: 5, f: 5, c: 5, x: -5 }, rules: ["cult_plus", "fit_weight"],
    lines: L(["비싼 브랜드가 {highPct}%. 취향보다 결제 버튼이 먼저 움직인 옷장이네요.", "고가 브랜드 비중이 {highPct}%. 이쯤 되면 쇼핑이 아니라 자산 운용이시죠."],
      ["비싼 옷을 비싸 보이게 입고 계시네요. 돈만 쓴 게 아니라 눈도 쓰신 건 인정합니다."], ["비싼 옷끼리 맞추려고 애쓰지 마세요. 평범한 이너로 받쳐야 그 가격이 비로소 티가 납니다."]) },
  { id: "designer_maniac", name: "디자이너·컨템포러리 마니아", group: "price", grade: "A", mode: "both", priority: 8,
    who: "디자이너·컨템포러리·럭셔리 브랜드가 40% 이상", how: "계열의 깊이와 폭 모두 가점, 컬트 브랜드와 최고가 비중 가점, 평이한 이너·하의로 디자이너 피스를 받치면 가점, 균형 기준 완화",
    w: { x: 10, t: 5, b: -8 }, rules: ["cult_plus", "brand_deep", "hype_pair"],
    lines: L(["디자이너·컨템포러리가 {designerPct}%. 무신사에서 이 정도면 취향이 고집 수준이네요.", "디자이너 브랜드로 옷장을 채우셨군요. 이쯤 되면 옷장이 아니라 전시실입니다."],
      ["패션을 진심으로 좋아하시는 게 옷장에서 다 티 납니다. 한 벌마다 사연이 길겠네요."], ["디자이너 피스끼리 서로 주인공 하려고 싸우는 중입니다. 무난한 이너 몇 벌로 교통정리 좀 해 주세요."]) },
  { id: "indie_finder", name: "소규모·신진 브랜드 발굴형", group: "price", grade: "B", mode: "both", priority: 6,
    who: "대중성 낮은 컬트·신진 브랜드가 30% 이상", how: "발굴한 브랜드끼리 계열이 맞으면 가점, 기본템을 받쳐 주면 가점",
    w: { x: 8, t: 5, b: -5 }, rules: ["cult_plus", "brand_deep"],
    lines: L(["아는 사람만 아는 브랜드가 {cultPct}%. 인기 순위는 일부러 안 보시는 거죠.", "마니아 브랜드를 꽤 캐내셨네요. 남들이 브랜드명 물어보는 순간을 즐기시는 타입입니다."],
      ["발굴한 브랜드끼리 분위기가 이어지네요. 우연이라고 하기엔 좀 얄밉게 잘 고르셨습니다."], ["발굴템 아래에 받쳐 줄 기본템 한두 벌만 더하세요. 보물도 진열대가 있어야 빛납니다."]) },
  { id: "one_brand", name: "한 브랜드 덕후", group: "price", grade: "B", mode: "both", priority: 7,
    who: "한 브랜드가 40% 이상", how: "다른 브랜드 옷이 주력과 어울릴수록, 주력이 약한 품목을 채울수록, 주력이 아우터 같은 핵심을 맡고 다른 곳이 기본템을 채울수록 가점. 같은 옷 반복은 감소",
    w: { c: 5, x: 5, b: -5 }, rules: ["complement", "repeat_penalty", "brand_deep"],
    lines: L(["{brand|가} {brandPct}%. 옷장이 {brand|을} 위한 단독 공연장이네요.", "{brand}만 {brandN}벌. 애사심이 거의 사원증 받을 수준입니다."],
      ["한 브랜드를 이렇게 깊게 아시다니 취향은 확실하시네요. 의외로 다른 브랜드랑도 잘 어울리고요."], ["{brand}에 없는 품목은 다른 브랜드가 메우는 중이네요. 우연에 맡기지 말고 의도적으로 짜 보세요."]) },
  { id: "heritage_vintage", name: "빈티지·헤리티지형", group: "price", grade: "B", mode: "both", priority: 7,
    who: "진짜 헤리티지 브랜드(오래되고 유명하지 않은)가 많음", how: "한 시대·계열 일관, 실측 입력(빈티지는 사이즈 표기를 못 믿으므로), 현대 기본템과 믹스 가점",
    w: { c: 5, x: 5, f: 3 }, rules: ["heritage_real", "brand_deep"],
    lines: L(["역사 있는 브랜드가 {heritagePct}%. 오래된 걸 좋아하는 게 취향이 아니라 거의 종교시네요.", "헤리티지 브랜드 위주입니다. 유행은 돌고 도는데 이 옷장은 꿈쩍도 안 하죠."],
      ["시간이 지나도 안 낡는 옷만 고르셨네요. 유행 따라 옷 버리는 사람들이 좀 민망해지겠습니다."], ["현대적인 기본템을 하나 섞어 보세요. 빈티지가 박물관 소장품이 아니라 옷으로 보이기 시작합니다."]) },
  { id: "vintage_collector", name: "빈티지 컬렉터", group: "price", grade: "A", mode: "closet", priority: 9,
    who: "후루츠패밀리 같은 중고·빈티지 플랫폼 구매가 많고 구매가가 높음", how: "구매가 대비 브랜드·희소성, 계열 일관, 실측 입력, 현대 기본템과 믹스",
    w: { x: 10, t: 5, b: -5 }, rules: ["heritage_real", "cult_plus", "brand_deep"],
    lines: L(["중고·빈티지 플랫폼에서 산 옷이 {usedPct}%. 신상은 시시하다는 말씀이시죠.", "빈티지를 직접 발굴하시는 타입이네요. 이 정도면 쇼핑이 아니라 고고학입니다."],
      ["빈티지를 손수 찾아 사시는 걸 보니 취향 하나는 확실하시네요. 발품이 옷장에 다 보입니다."], ["산 옷의 실측을 입력해 두세요. 빈티지 사이즈는 감으로 맞히는 게 아니라 숫자로 맞히는 겁니다."]) },

  // ── 스타일·무드 ──
  { id: "allblack", name: "올블랙·무채색형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "무채색이 70% 이상", how: "색 일관성은 만점으로 두고, 질감·실루엣 대비·기장·포멀도 분산으로 개성을 봅니다. 같은 품목·핏 반복은 감소",
    w: { x: 8, c: -8 }, rules: ["palette_free", "repeat_penalty"],
    lines: L(["무채색이 {achroPct}%. 검정 위에 검정을 얹는 장인이시네요.", "옷장 문을 열면 조문 복장이 줄지어 있습니다. 정갈하긴 하네요, 정갈하긴."],
      ["색 고민을 아껴서 핏과 질감에 쓰셨네요. 게으른 게 아니라 전략이었다고 쳐 드리겠습니다."], ["올블랙은 질감이 다르면 살아납니다. 니트, 가죽, 나일론을 섞으세요. 전부 같은 면 티면 그냥 그림자입니다."]) },
  { id: "minimal", name: "미니멀·기본템형", group: "style", grade: "-", mode: "both", priority: 3,
    who: "미니멀·베이직 브랜드 위주, 로고·패턴 적음", how: "기본템 품질과 핏을 보고, 포인트 1~3벌이 있으면 가점",
    w: { f: 5, x: -3 }, rules: ["basics_gap", "formal_free"],
    lines: L(["미니멀·기본 브랜드가 {minimalPct}%. 꾸민 듯 안 꾸민 듯, 아니 사실 안 꾸민 쪽에 가깝네요.", "무난한 옷만 골라 모으셨군요. 군더더기는 없는데 재미도 같이 빠졌습니다."],
      ["기본템 핏은 좋네요. 꾸밈 없는 게 제일 어렵다는 걸 아시는 건지 운이 좋으신 건지."], ["포인트 한 벌만 들이세요. 그래야 미니멀이 심심함에서 세련됨으로 겨우 넘어갑니다."]) },
  { id: "campus", name: "캠퍼스 캐주얼형", group: "style", grade: "-", mode: "both", priority: 2,
    who: "후드·맨투맨·청바지·운동화 중심의 가성비 캐주얼", how: "색 조합과 핏 적합 중심. 후드·맨투맨 색이 겹쳐도 감점 없음, 아우터 한 벌이 단정하면 가점",
    w: { f: 5, t: -8, b: 3 }, rules: ["price_free", "basics_gap"],
    lines: L(["후드, 맨투맨, 청바지. 강의실이든 편의점이든 5분 안에 출발 가능한 옷장이네요.", "캠퍼스 룩의 정석입니다. 편한 건 확실한데 학교 정문에서 백 번은 본 조합이죠."],
      ["편한 옷을 그래도 깔끔하게 맞춰 입으셨네요. 대충 입은 것처럼 안 보이는 게 다행입니다."], ["아우터 한 벌만 코트나 자켓으로 바꿔 보세요. 같은 후드도 갑자기 사회생활을 시작합니다."]) },
  { id: "daily_plain", name: "데일리 무난형", group: "style", grade: "-", mode: "both", priority: 1,
    who: "셔츠·니트·슬랙스 같은 포멀도 2~3의 무난한 구성", how: "일관성과 핏 비중을 키우고, 포인트템 한두 벌이 있으면 가점",
    w: { c: 5, f: 5 }, rules: ["basics_gap"],
    lines: L(["베이직·캐주얼 위주의 무난한 옷장입니다. 어디 가도 튀지 않고, 어디서도 기억 안 나죠.", "누구를 만나도 어색하지 않은 옷장이네요. 무난함을 취향이라고 우기시는 중입니다."],
      ["무난한데 정돈은 잘 돼 있네요. 이게 의외로 어렵다는 건 아마 모르고 하셨겠지만요."], ["무난한 옷 사이에 색이나 소재가 다른 포인트를 한 벌 넣으세요. 그래야 사진 속에서 본인을 찾을 수 있습니다."]) },
  { id: "dandy", name: "댄디·깔끔 캐주얼형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "셔츠·가디건·니트·로퍼 중심의 단정한 캐주얼", how: "색 톤 통일, 어깨·기장 실측 정확도 가점, 포멀과 캐주얼의 균형",
    w: { f: 5, c: 3 }, rules: ["fit_weight"],
    lines: L(["셔츠, 니트, 가디건이 가득하네요. 소개팅 일정이 상시 대기 중인 옷장입니다.", "단정한 옷 위주시군요. 단정함을 넘어 조금 모범생 냄새가 납니다."],
      ["단정함이 흔들림 없이 일관되네요. 첫인상 점수는 옷이 다 벌어 오고 있습니다."], ["신발까지 로퍼나 더비로 맞추세요. 위는 소개팅인데 발은 체육 시간이면 곤란하니까요."]) },
  { id: "cityboy", name: "시티보이·일본 캐주얼형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "여유 있는 핏과 차분한 색, 일본 계열 브랜드", how: "볼륨이 짝지어졌는지, 색 톤 통일, 소재를 봅니다",
    w: { c: 5, f: 3 }, rules: ["volume_pair", "fit_over_ok"],
    lines: L(["여유 있는 실루엣에 차분한 색. 일본 잡지 한 권을 통째로 외우셨네요.", "일본 계열 캐주얼이 눈에 띕니다. 힘 뺀 척하느라 힘을 꽤 쓰신 옷장이네요."],
      ["대충 걸친 듯한데 색 톤이 묘하게 일정하네요. 그 무심함이 다 계산이었다는 거 알고 있습니다."], ["리넨이나 코튼처럼 소재 한 가지를 늘려 보세요. 따라 한 시티보이가 아니라 진짜처럼 보입니다."]) },
  { id: "street_hype", name: "스트릿·하이프형", group: "style", grade: "B", mode: "both", priority: 6,
    who: "스트릿웨어와 로고 브랜드, 신발 비중이 큼", how: "한정판·콜라보 가점, 마니아 브랜드면 추가 가점, 하이프 템을 기본 이너·하의로 받치면 가점, 사이즈·반품은 엄격",
    w: { x: 5, f: 3, t: -3 }, rules: ["hype_pair", "cult_plus", "fit_weight"],
    lines: L(["스트릿 브랜드가 {streetPct}%. 신발장 하나로는 감당이 안 되실 것 같네요.", "하이프 브랜드에 진심이시네요. 드롭 알림은 태어나서 한 번도 안 끄셨죠."],
      ["하이프템을 사이즈까지 맞춰 입으셨네요. 대부분 리셀가에 눈이 멀어 사이즈를 놓치는데 말이죠."], ["하이프 한 벌엔 무지 하의 하나. 두 벌이 만나면 서로 자기가 비싸다고 싸웁니다."]) },
  { id: "skate_hiphop", name: "스케이트·힙합형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "배기·와이드 하의, 그래픽, 스케이트 브랜드", how: "상하의 볼륨 짝을 보고, 모자·신발 구색 가점, 오버사이즈는 정상 핏으로 인정",
    w: { f: -3, x: 5 }, rules: ["fit_over_ok", "volume_pair", "logo_care"],
    lines: L(["헐렁한 바지와 그래픽. 스케이트장 입구에서 바로 통과될 옷장입니다.", "배기 팬츠, 모자, 스케이트화까지. 해시태그 하나로 요약되는 옷장이네요."],
      ["상하의 볼륨은 또 잘 맞추셨네요. 헐렁한 걸 헐렁하게만 입진 않으셨습니다."], ["그래픽은 한 번에 하나만. 나머지는 무지로 눌러 주세요. 다 외치면 아무 말도 안 들립니다."]) },
  { id: "graphic_logo", name: "그래픽·로고 플레이형", group: "style", grade: "-", mode: "both", priority: 3,
    who: "그래픽·로고 상품이 35% 이상", how: "로고 충돌이 없으면 가점, 무지 하의로 받치면 가점, 한 벌에 로고가 겹치면 감소",
    w: { x: 3 }, rules: ["logo_care"],
    lines: L(["로고와 그래픽 옷이 {logoPct}%. 입기도 전에 옷이 먼저 자기소개를 하네요.", "프린트가 빼곡한 옷장입니다. 걸어 다니는 광고판 계약이라도 하셨나요."],
      ["로고끼리 부딪히지 않게는 입으시네요. 이 정도 물량에 그게 되는 게 신기합니다."], ["로고 옷 하나에 무지 옷 둘. 이 비율을 지키면 로고가 소음이 아니라 포인트가 됩니다."]) },
  { id: "workwear", name: "워크웨어·아메카지형", group: "style", grade: "B", mode: "both", priority: 7,
    who: "워크웨어·데님·캔버스·밀리터리", how: "진짜 헤리티지 브랜드 비율, 소재 품질, 오버사이즈는 정상 핏으로 인정, 부츠·모자 구색 가점",
    w: { x: 5, t: 3, b: -3 }, rules: ["heritage_real", "fit_over_ok", "brand_deep"],
    lines: L(["워크웨어·아메카지 브랜드가 {workPct}%. 옷은 닳아야 멋이라는 신념이 확고하시네요.", "데님, 캔버스, 밀리터리. 공구함은 없는데 작업복은 완벽하게 갖추셨습니다."],
      ["진짜 브랜드만 고르셨네요. 소재 좋은 옷은 늙을수록 멋있다는 걸 이미 아시는 눈치입니다."], ["부츠나 모자 같은 소품 하나만 더하세요. 그래야 작업복이 아니라 워크웨어 룩이 됩니다."]) },
  { id: "denim_maniac", name: "데님 매니아형", group: "style", grade: "B", mode: "both", priority: 7,
    who: "데님 하의·아우터 비중이 35% 이상이고 데님 전문 브랜드가 있음", how: "워싱·핏 다양성, 전문 브랜드 비중, 상의로 받치는 구성을 봅니다",
    w: { x: 5, t: 3 }, rules: ["heritage_real", "brand_deep"],
    lines: L(["데님이 {denimPct}%. 청바지 이름을 워싱별로 외우시는 분이죠.", "데님 비중이 압도적입니다. 취미라고 하기엔 이미 늦은 수준이네요."],
      ["전문 브랜드 데님을 갖고 계시네요. 청바지는 브랜드에서 갈린다는 걸 아시는 건 인정합니다."], ["비슷한 워싱이 줄줄이 있다면 하나는 생지나 흑청으로 바꾸세요. 지금은 같은 바지를 여러 번 사신 걸로 보입니다."]) },
  { id: "outdoor_gorp", name: "아웃도어·고프코어형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "기능성 높은 아웃도어 브랜드", how: "쉘·미드·베이스 레이어 구성, 아웃도어 계열 일관, 도시 기본템과 믹스 가점",
    w: { b: 3, x: 3 }, rules: ["formal_free", "basics_gap"],
    lines: L(["아웃도어 브랜드가 {outdoorPct}%. 산은 안 가도 카페에선 언제든 조난 대비가 되시네요.", "기능성 옷이 가득합니다. 비가 와도 눈이 와도 끄떡없는데 정작 출근길이 제일 험하죠."],
      ["기능성 옷을 도시에서 그럴듯하게 입으시네요. 흐름은 잘 타셨습니다, 등산은 몰라도요."], ["도시용 기본템 한두 벌을 섞어 보세요. 그래야 지하철에서 정상 등반 직후로 안 보입니다."]) },
  { id: "sporty_runner", name: "스포티·러닝형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "러닝·트랙·애슬레저 계열", how: "기능성 소재와 신발·트랙 구성, 일상복과 믹스 가점. 포멀 부재는 감점 없음",
    w: { b: -3 }, rules: ["formal_free", "price_free"],
    lines: L(["러닝·트랙 계열이 많네요. 달리진 않아도 언제든 달릴 수 있다는 마음가짐이시죠.", "스포티한 옷이 눈에 띕니다. 운동화를 먼저 사고 나머지를 맞춘 티가 납니다."],
      ["기능성 소재가 일관되네요. 편해 보이는 이유가 있었습니다, 운동은 안 하셔도요."], ["일상복 하의 하나만 섞으세요. 그 순간 운동복이 운동복이 아니라 스타일이 됩니다."]) },
  { id: "formal_suit", name: "포멀·클래식·수트형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "포멀도 4~5가 우세, 테일러링·클래식 브랜드", how: "자켓·슬랙스·셔츠·구두 구성의 완성도, 어깨·기장 실측 정확도 비중 확대, 캐주얼 부재는 감점 없음",
    w: { f: 8, c: 3, b: -3 }, rules: ["fit_weight", "formal_free"],
    lines: L(["포멀한 브랜드 위주입니다. 365일 면접 대기 중인 옷장이네요.", "자켓, 슬랙스, 구두. 퇴근은 하셨는데 옷은 아직 출근 중입니다."],
      ["포멀은 핏이 전부인데 핏은 정확하시네요. 어깨 맞는 정장 찾기가 얼마나 귀찮은지 아시는 분입니다."], ["니트나 가디건 하나만 섞으세요. 주말까지 결재 받으러 가는 사람처럼 보일 필요는 없잖아요."]) },
  { id: "preppy", name: "프레피·아이비형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "프레피·아이비 브랜드, 셔츠·니트·치노·로퍼", how: "짝 구성과 네이비·화이트·카키 팔레트를 봅니다",
    w: { c: 5 }, rules: ["basics_gap"],
    lines: L(["프레피 브랜드가 {preppyPct}%. 잔디밭 화보 촬영은 언제든 가능하시겠네요.", "셔츠에 니트에 로퍼. 아이비 교과서를 밑줄 쳐 가며 읽으셨군요."],
      ["팔레트가 일관되네요. 프레피는 색에서 끝난다는 걸 정확히 알고 계십니다, 얄밉게도요."], ["가끔은 스웨트나 데님으로 힘을 좀 빼세요. 매일 교복 검사 받는 기분은 안 드셔도 됩니다."]) },
  { id: "y2k_retro", name: "Y2K·레트로형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "Y2K·레트로·빈티지 태그 브랜드가 많음", how: "한 시대 태그 일관, 로고 허용, 소품 구색",
    w: { c: 3, x: 3 }, rules: ["logo_care"],
    lines: L(["레트로 감성 브랜드가 {y2kPct}%. 옷장 안에 타임머신을 숨겨 두셨나 봐요.", "Y2K와 레트로가 가득하군요. 그 시절을 그리워하시는 마음은 충분히 전달됐습니다."],
      ["한 시대로 딱 모아 놓으셨네요. 레트로는 일관이 생명인데 그건 지키셨습니다."], ["모자, 가방, 선글라스 같은 소품을 더하세요. 지금은 시대극 의상팀에서 소품만 빠진 상태입니다."]) },
  { id: "colorful", name: "컬러풀·포인트형", group: "style", grade: "-", mode: "both", priority: 4,
    who: "비무채색 50% 이상, 색이 5가지 이상", how: "팔레트 3색 이내 반복으로 일관성 대체, 무채색 베이스와 포인트 색 비율이 적정하면 가점, 보색 충돌 과다는 감소",
    w: { c: -3, x: 5 }, rules: ["variety_ok"],
    lines: L(["유채색이 {chromaPct}%. 옷장 문 열면 무지개가 쏟아지겠네요. 길에서 놓칠 일은 없겠습니다.", "색을 하나도 안 두려워하시네요. 가끔은 좀 두려워하셔도 됩니다."],
      ["색 쓰는 배짱은 인정합니다. 그 와중에 무채색 베이스를 깔아 두신 건 꽤 영리하셨고요."], ["자주 쓰는 색 세 가지만 정하세요. 그래야 알록달록이 취향으로 승격됩니다."]) },
  { id: "feminine", name: "페미닌·로맨틱형", group: "style", grade: "-", mode: "both", priority: 5,
    who: "페미닌·로맨틱·러블리 브랜드가 40% 이상", how: "하의 기준에 원피스·스커트를 포함하고, 소재·길이·실루엣 다양성, 구두·가방 구색",
    w: { b: -3 }, rules: ["variety_ok"],
    lines: L(["페미닌 브랜드가 {femPct}%. 옷장이 꽃집처럼 화사하네요.", "로맨틱한 분위기가 확실합니다. 소재까지 말랑한 걸로 골라 담으셨네요."],
      ["분위기가 한결같네요. 취향이 확고해서 흔들 틈이 안 보입니다."], ["신발이나 가방 하나만 단단한 느낌으로 바꾸세요. 너무 달면 금방 물리거든요."]) },

  // ── 핏·실루엣 ──
  { id: "over_all", name: "오버사이즈 일색형", group: "fit", grade: "-", mode: "both", priority: 5,
    who: "내가 표기한 핏과 앱이 내 치수로 계산한 예상 핏이 모두 오버인 옷이 70% 이상", how: "두 값을 함께 봅니다. 표기와 예상이 모두 오버면 의도된 오버로 인정, 표기는 적당인데 예상이 오버면 표기 오류 가능성 안내. 볼륨 짝이 맞으면 가점, 지나치게 큰 것만 감소",
    w: { f: -5, c: 3, x: 3 }, rules: ["fit_over_ok", "volume_pair"],
    lines: L(["오버핏이 {overPct}%. 옷이 사람을 입었는지 사람이 옷을 입었는지 헷갈리네요.", "큼직한 실루엣 일색입니다. 표기 치수 대비로도 넉넉하게, 아주 넉넉하게 고르셨네요."],
      ["큰 옷을 의도적으로 입으시긴 하네요. 사이즈 실수가 아니라 고집이었다니 다행입니다."], ["상의가 크면 하의는 정리하세요. 전부 크면 실루엣이 아니라 이불 한 채가 됩니다."]) },
  { id: "slim_all", name: "슬림·타이트 일색형", group: "fit", grade: "-", mode: "both", priority: 5,
    who: "표기 또는 예상 핏이 슬림 이하인 옷이 70% 이상", how: "체형 대비 당겨 입은 정도만 감소, 상하의 핏 통일 가점",
    w: { f: 3 }, rules: ["fit_slim_ok"],
    lines: L(["슬림 핏이 {slimPct}%. 여유분이라는 단어는 옷장 사전에 없나 봐요.", "슬림한 옷 일색입니다. 옷들이 다 같이 숨을 참고 있는 옷장이네요."],
      ["상하의 핏 통일은 확실하시네요. 슬림은 일관성이 핵심이란 걸 알고 고르셨습니다."], ["한두 벌만 반 사이즈 크게 사 보세요. 옷장에도 숨 쉴 구멍이 좀 필요합니다."]) },
  { id: "regular_pref", name: "정핏·레귤러 선호형", group: "fit", grade: "-", mode: "both", priority: 4,
    who: "표기와 예상 핏이 모두 적당(레귤러)인 옷이 60% 이상", how: "핏 적합 비중을 키우고 어깨·기장·소매 실측 정확도로 평가. 무난해도 감점 없고 소재·색 조합이 좋으면 가점",
    w: { f: 8, x: -3 }, rules: ["fit_weight", "basics_gap"],
    lines: L(["정핏이 {regularPct}%. 모범 답안만 골라 쓰시는 옷장이네요.", "과하지도 모자라지도 않은 핏이 대부분입니다. 안정적이다 못해 지루할 지경이에요."],
      ["핏은 정확하시네요. 옷은 맞아야 비싸 보인다는 걸 아시니 다행입니다."], ["한 벌만 오버나 와이드를 섞어 보세요. 실루엣에 리듬이 생기고 옷장이 조금 덜 착실해 보입니다."]) },
  { id: "wide_bottom", name: "와이드·루즈 하의 선호형", group: "fit", grade: "-", mode: "both", priority: 4,
    who: "하의 중 와이드·배기·벌룬이 60% 이상", how: "상의 길이·볼륨과의 균형, 신발 볼륨 짝 평가, 기장이 바닥에 끌리지 않는지 확인",
    w: { f: -3 }, rules: ["fit_over_ok", "volume_pair"],
    lines: L(["하의가 전부 넉넉하네요. 바지통이 이 옷장의 세계관입니다.", "와이드 하의 비중이 {widePct}%. 스키니는 진작에 졸업장 받고 나가셨군요."],
      ["넉넉한 바지에 상의 길이는 또 맞추셨네요. 비율 감각은 생각보다 있으십니다."], ["바지통에 신발이 묻히지 않게 조금 투박한 신발을 맞추세요. 지금은 신발이 바지 속에 실종 상태입니다."]) },
  { id: "volume_contrast", name: "상하 볼륨 대비형", group: "fit", grade: "-", mode: "both", priority: 4,
    who: "상의와 하의의 핏 방향이 다름(오버 상의와 슬림 하의 등)", how: "의도된 대비로 보고 가점, 어정쩡하게 섞인 것만 감소",
    w: { x: 3 }, rules: ["volume_pair"],
    lines: L(["위는 크게, 아래는 좁게(혹은 반대로). 실루엣으로 밀당을 하시네요.", "상하의 핏이 일부러 엇갈립니다. 비율 계산을 꽤 하신 티가 나요."],
      ["대비가 의도적이네요. 우연히 이렇게 입었다고 하시면 안 믿겠습니다."], ["대비 방향을 하나로 정하세요. 오늘은 위가 크고 내일은 아래가 크면 그냥 헷갈리는 겁니다."]) },
  { id: "size_precise", name: "사이즈 정확형", group: "fit", grade: "-", mode: "both", priority: 3,
    who: "핏이 적당 범위(너무 작거나 큰 것 제외)인 옷이 85% 이상", how: "핏 점수가 높아도 비중을 올리지 않고 인정, 한 사이즈 업·다운 선택이 의도적이면 가점",
    w: { f: -2, x: 2 }, rules: [],
    lines: L(["사이즈 실패가 거의 없네요. 사이즈표를 시험지처럼 푸시는 분입니다.", "안 맞는 옷이 드뭅니다. 이 정도면 쇼핑이 아니라 측량이시죠."],
      ["사이즈 감각은 정확하시네요. 옷 사는 능력의 절반은 이미 갖고 계십니다, 나머지 절반은 두고 보죠."], ["핏은 안정적이니 이제 오버나 슬림으로 한 번쯤 모험해 보세요. 틀려도 반품 실력은 있으시잖아요."]) },
  { id: "fit_experiment", name: "핏 실험형", group: "fit", grade: "-", mode: "both", priority: 2,
    who: "슬림·정핏·오버가 골고루 섞임", how: "감점하지 않고 실험 중으로 보며, 가장 잘 맞는 핏을 짚어 줍니다",
    w: { f: -3 }, rules: ["variety_ok"],
    lines: L(["슬림도 정핏도 오버도 다 있네요. 옷장이 핏 시식 코너입니다.", "핏이 아직 하나로 안 정해졌습니다. 탐색이 꽤 길어지고 계시네요."],
      ["이것저것 입어 봤다는 건 그래도 맞는 걸 찾는 중이라는 뜻이죠. 열정은 인정합니다."], ["제일 마음에 든 핏 하나를 기준으로 정하세요. 다음 쇼핑부터는 시식 말고 주문을 하셔야죠."]) },
  { id: "length_play", name: "기장 실험형", group: "fit", grade: "-", mode: "both", priority: 3,
    who: "크롭·롱 기장 상품이 20% 이상", how: "기장 대비 상하의 균형, 허리 높이·신발 짝을 평가",
    w: { x: 3 }, rules: ["volume_pair"],
    lines: L(["크롭이나 롱 기장이 많네요. 어중간한 길이는 취급 안 하시는 옷장입니다.", "짧거나 길거나 둘 중 하나. 중간 기장은 출입 금지인가 봐요."],
      ["기장마다 이유가 있어 보이네요. 그냥 튀고 싶어서 고른 건 아니었다니 다행입니다."], ["길이가 극단으로 갈 땐 반대쪽을 단정하게 맞추세요. 위아래 다 극단이면 보는 사람이 피곤합니다."]) },

  // ── 구성·습관 ──
  { id: "allrounder", name: "올라운더 균형형", group: "habit", grade: "-", mode: "closet", priority: 2,
    who: "품목·계절·포멀도가 고르게 분포", how: "일관성 기준을 완화하고, 포멀도·가격 분산이 있어야 개성 가점",
    w: { b: 5, c: -5 }, rules: ["variety_ok"],
    lines: L(["품목도 계절도 빠짐없이 갖추셨네요. 무슨 일정이 와도 입을 건 있겠습니다, 재미는 몰라도요.", "균형 잡힌 옷장입니다. 약점이 없어서 놀릴 거리가 부족하네요."],
      ["빈틈이 거의 없는 구성이네요. 옷장 관리까지 숙제처럼 성실하게 하셨습니다."], ["이제 한 벌쯤은 모험해도 됩니다. 기본은 이미 다 있으니 망해도 갈아입을 옷은 있잖아요."]) },
  { id: "shoe_collector", name: "신발 컬렉터형", group: "habit", grade: "B", mode: "closet", priority: 6,
    who: "신발이 옷장의 35% 이상", how: "신발 브랜드 깊이·가격 안목을 따로 평가, 나머지 옷이 신발을 받치는지 평가, 같은 모델 색만 다르면 감소. 마니아 모델이면 몰입 보너스",
    w: { b: -8, x: 5 }, rules: ["shoe_deep", "repeat_penalty", "cult_plus"],
    lines: L(["신발이 {shoesPct}%. 신발이 옷을 신은 건지 옷이 신발을 입은 건지 모르겠네요.", "신발장이 옷장보다 큰 옷장입니다. 시선이 전부 발끝에 가 있네요."],
      ["신발 취향은 분명하시네요. 최소한 발끝에서 망할 일은 없으시겠습니다."], ["옷이 신발을 받쳐 주는지 보세요. 주인공이 신발이면 옷은 조연답게 조용히 정리하는 게 맞습니다."]) },
  { id: "outer_focus", name: "아우터 중시형", group: "habit", grade: "-", mode: "closet", priority: 4,
    who: "아우터 비중이 30% 이상", how: "아우터가 중심일 때 이너·하의는 기본템이어도 인정, 아우터 계열 일관 가점",
    w: { b: -5, t: 3 }, rules: ["outer_core"],
    lines: L(["아우터가 {outerPct}%. 겉옷에 돈 쓰는 데는 망설임이 없으시네요.", "겉옷이 중심인 옷장입니다. 계절 바뀌는 날이 거의 명절이시겠어요."],
      ["아우터 한 벌로 분위기를 정하는 방식이네요. 얄밉게도 효율적입니다."], ["아우터가 좋으니 이너는 무지로 정리하세요. 겉옷 벗는 순간 급이 떨어지면 안 되잖아요."]) },
  { id: "hat_acc", name: "모자·소품 활용형", group: "habit", grade: "-", mode: "closet", priority: 3,
    who: "모자 등 소품 비중이 12% 이상", how: "소품이 룩의 포인트로 짝이 맞으면 가점, 같은 소품 중복은 감소",
    w: { x: 3 }, rules: ["hype_pair"],
    lines: L(["모자가 {hatPct}%. 머리 위를 패션의 마지막 퍼즐이라고 굳게 믿으시는군요.", "소품 비중이 높은 편이네요. 옷보다 마무리에 더 공들이시는 타입입니다."],
      ["소품을 쓸 줄 아시네요. 덕분에 룩이 입체적으로 보이긴 합니다, 가끔은 과하게요."], ["모자는 옷 색과 한 가지만 맞추세요. 전부 맞추면 세트 상품처럼 보이고 하나도 안 맞추면 정신없습니다."]) },
  { id: "layered", name: "레이어드 활용형", group: "habit", grade: "-", mode: "both", priority: 3,
    who: "레이어드 상품이나 겹쳐 입는 구성이 많음", how: "두께·기장 차이가 나게 짜면 가점, 계절별 겹쳐 입는 구성 평가",
    w: { b: 3, x: 3 }, rules: ["volume_pair"],
    lines: L(["레이어드 아이템이 눈에 띄네요. 한 겹으로는 성에 안 차시는 분이죠.", "겹쳐 입기를 즐기는 옷장입니다. 집에 오면 벗는 데만 한참 걸리시겠어요."],
      ["겹쳐 입는 구성이 꽤 계산돼 있네요. 두께 차이까지 챙기신 건 좀 얄밉습니다."], ["겹칠 때 색은 두 가지까지만 쓰세요. 세 가지가 넘어가면 레이어드가 아니라 짐 정리입니다."]) },
  { id: "beginner", name: "패션 입문형", group: "habit", grade: "-", mode: "both", priority: 9,
    who: "옷이 10~20벌 정도이고 기본템이 부족", how: "낮게 깎지 않고 '기본기 쌓는 중'으로 보고 부족한 기본템을 조언, 방향이 잡히면 가점",
    w: { b: -5, c: 5, t: -3 }, rules: ["basics_gap", "price_free"],
    lines: L(["옷이 아직 많지 않네요. 옷장이 이제 막 걸음마를 뗐습니다.", "시작 단계의 옷장이네요. 텅 빈 옷걸이가 아직 희망으로 보이는 시기죠."],
      ["처음치고 방향은 잡혀 있네요. 기본기부터 쌓는 순서는 제대로 아셨습니다."], ["기본 상의 두 벌, 하의 두 벌만 제대로 사세요. 조합이 폭발적으로 늘어서 옷 없다는 핑계가 사라집니다."]) },
  { id: "wanderer", name: "취향 방랑형", group: "habit", grade: "-", mode: "both", priority: 2,
    who: "스타일 태그가 흩어지고 색도 많음", how: "감점 대신 '실험 중'으로 보고 조언, 최근으로 갈수록 한 방향으로 모이면 가점",
    w: { c: -5, x: 3 }, rules: ["variety_ok"],
    lines: L(["스타일이 한곳에 안 모입니다. 취향이 아직 가출 중이시네요.", "옷장이 장르 불문 편집숍 같네요. 취향 찾기 여행이 꽤 길어지고 있습니다."],
      ["다양하게 시도해 보신 건 높이 삽니다. 실패한 옷들도 나름 수업료였겠죠."], ["지금 제일 좋아하는 옷 세 벌의 공통점을 찾아보세요. 그게 방랑을 끝낼 지도입니다."]) },
  { id: "season_skew", name: "시즌 편중형", group: "habit", grade: "-", mode: "closet", priority: 2,
    who: "한 계절 옷이 60% 이상", how: "있는 계절 안에서 평가하고 비어 있는 계절을 조언",
    w: { b: -5 }, rules: ["season_scoped"],
    lines: L(["{seasonName} 옷이 {seasonPct}%. 다른 계절에는 동면이라도 하실 계획이세요.", "한 계절 옷에 몰려 있네요. 계절 바뀌는 날 옷장 앞에서 한참 서 계시겠습니다."],
      ["있는 계절 옷은 빵빵하게 갖추셨네요. 그 계절만큼은 걱정 없으시겠습니다, 그 계절만큼은요."], ["다음 계절 아우터나 신발부터 하나씩 채우세요. 계절은 기다려 주지 않습니다."]) },
  { id: "new_arrivals", name: "신상 몰림형", group: "habit", grade: "-", mode: "orders", priority: 3,
    who: "최근 6개월 구매가 40% 이상", how: "최근 구매끼리의 일관성만 따로 평가",
    w: { c: 3 }, rules: ["recent_only"],
    lines: L(["최근 6개월에 산 옷이 {recentPct}%. 택배 기사님과 꽤 친해지셨겠네요.", "최근 구매가 몰려 있습니다. 올해 결제 버튼이 유난히 가벼우셨군요."],
      ["최근 산 옷끼리는 방향이 이어지네요. 지르긴 많이 지르셨어도 막 지르진 않으셨습니다."], ["새 옷에 맞출 하의가 있는지부터 확인하고 사세요. 따로 노는 신상은 결국 옷걸이 장식이 됩니다."]) },
  { id: "size_wander", name: "사이즈 유랑형", group: "habit", grade: "-", mode: "orders", priority: 4,
    who: "반품·교환 비율이 높음", how: "반품 감점 한도 -10을 유지하고 사이즈 조언 문장을 붙입니다",
    w: { x: -3 }, rules: ["return_strict"],
    lines: L(["주문 {orders}건에 반품·교환 {events}번. 사이즈표 앞에서 매번 고민만 길어지시네요.", "반품과 교환이 잦습니다. 택배 상자가 왕복 티켓을 끊고 다니는 중이에요."],
      ["그래도 환불은 꼬박꼬박 챙기시네요. 사이즈는 놓쳐도 돈은 안 놓치십니다."], ["산 옷의 실측을 적어 두세요. 다음엔 감으로 고르지 말고 숫자로 고르시면 반품 상자가 줄어듭니다."]) },
  { id: "sale_buyer", name: "세일 구매형", group: "habit", grade: "-", mode: "orders", priority: 3,
    who: "보통 가격보다 크게 싸게 산 결제가 비중이 높음", how: "세일로 샀어도 브랜드·품목이 좋으면 가점, 안 어울리는 싼 옷 반복은 감소",
    w: { t: -3 }, rules: ["sale_ok", "price_free"],
    lines: L(["보통 가격보다 크게 싸게 산 옷이 {salePct}%. 세일 알림만큼은 절대 안 끄시죠.", "할인 때 산 옷이 많네요. 싸게 사는 눈은 확실한데 왜 샀는지는 가끔 잊으셨을 겁니다."],
      ["싸게 사서 좋은 옷을 건지셨다면 그건 실력이죠. 운도 실력이라고 해 드릴게요."], ["싸서 사는 옷과 원래 갖고 싶던 옷을 구분하세요. 70% 할인이어도 안 입으면 100% 손해입니다."]) },
  { id: "careful_buyer", name: "소량 신중 구매형", group: "habit", grade: "-", mode: "orders", priority: 3,
    who: "구매가 적고 반품이 거의 없음", how: "구매 규율 가점, 자료가 적으면 '자료가 적어요'를 함께 표시",
    w: { x: 3 }, rules: ["steady_plus"],
    lines: L(["주문 {orders}건에 반품은 거의 없음. 장바구니에서 숙성시키는 타입이시네요.", "필요한 것만 사고 후회는 적은 쇼핑입니다. 충동구매라는 단어를 모르시나 봐요."],
      ["살 때 신중하신 게 보입니다. 반품이 없는 게 증거죠. 좀 재미없을 정도로요."], ["자료가 적어서 평가가 덜 정확합니다. 옷장 평가도 함께 해 보세요. 보여 주셔야 제대로 놀려 드리죠."]) },
];

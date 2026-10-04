import "server-only";

/**
 * 총 옷장 점수에 더하거나 빼는 값(질문·퀴즈 답별). 관리자 문장 편집의 "점수" 탭에서 고칠 수 있다(texts.ts의 score).
 * 키는 질문 id → 선택지 id. 선택지를 코드가 만드는 질문은 반응 종류로 쓴다
 * (퀴즈 right/wrong, 비싼 옷 버리기 most/mid/least, 브랜드 셋 spend/count/recent/spend2).
 * 점수는 옷장 수치로 낸 기본 점수에 이 값을 더한 뒤 0~100으로 자른다.
 */
export const SCORE_DELTAS: Record<string, Record<string, number>> = {
  /** 퀴즈: 맞혀도 가점 없음, 틀리면 감점만(사용자 요청 2026-10-01) */
  quiz: { right: 0, wrong: -9 },
  /** 밴드 퀴즈: 패션 퀴즈와 같은 증감(사용자 요청) */
  band_quiz: { right: 0, wrong: -9 },
  /** 3대 500: 넘음·곧 넘음은 가점, 나머지는 0점(사용자 요청) */
  three_500: { over: 3, soon: 1, dots: 0, comfy: 0 },
  drop_item: { most: 0, mid: 0, least: 0 },
  brand_best: { spend: 0, count: 0, recent: 0, spend2: 0 },
  odd_photo: { mine: 1, gift: 0, dunno: -2 },
  justify_combo: { different: -2, similar: 1, dunno: -1 },
  color_taste: { black_easy: -1, just_happens: -2, have_colors: 1 },
  brand_employee: { love: 0, sale: 1, didnt_know: -2 },
  food_vs_clothes: { food: -2, clothes: 2, both: -1 },
  golden_spoon: { no: 0, yes: 0, skip: 0 },
  rationalize: { none: -2, some: 1, why: -1 },
  extreme_one: { of_course: 0, no: -2, already: 0 },
  black_why: { matches: 0, no_thinking: -2, charcoal: -1 },
  chroma_love: { love: 1, suits: 2, didnt_know: -1 },
  category_why: { wear_most: 1, cant_stop: -2, elsewhere: 0 },
  few_clothes: { minimal: 2, not_yet: 0, thats_all: 1 },
  many_clothes_wear: { most: 3, half: 0, few: -2, same: -3 },
  timeless_q: { never: 1, bit: 0, comes_back: -1 },
  hype_alarm: { yes: -2, no: 1, secret: -1 },
  country_q: { intended: 1, quality: 1, didnt_know: -1 },
  mountain: { often: 2, sometimes: 0, subway: -2 },
  sports_q: { workout: 2, daily: 0, no_workout: -2 },
  recent_reason: { sale: 0, season: 1, birthday: 1, just: -2 },
  binge_month: { sale: -1, payday: -1, forgot: -2 },
  season_gap: { rotate: 2, stay_in: 0, buy_soon: -2 },
  top_item_q: { often: 3, few: -1, saving: -3 },
  sale_q: { yes: 1, luck: 0, never_full: 1 },
  splurge_q: { special: 1, late: -2, normal: 0 },
  subcat_spend_q: { knew: 1, less: -1, dont_tell: -2 },
  max_budget: { b10: 1, b30: 0, b100: -1, nolimit: -3 },
  fit_choice: { intended: 1, comfy: 0, dunno: -2 },
  style_self: { yes: 1, no: -1, none: -2 },
  brand_pick: { design: 1, price: 1, vibe: -1 },
  old_trust: { history: 1, chance: 0, new_too: 1 },
  niche_known: { nobody: 0, those_who_know: -1, rather_not: -1 },
  formal_job: { yes: 1, no: -1, like: 1 },
  same_outfit_street: { often: -2, sometimes: -1, not_yet: 1 },
  /** SPA 브랜드를 많이 사는 이유(사용자 요청 2026-10-03) */
  spa_why: { price: 1, no_interest: -1, basic: 1 },
  brand_alert: { on: 0, off: 0, no_need: 0 },
  brand_spend_q: { knew: 1, less: -1, dont_tell: -2 },
  shoes_q: { all_wear: 2, collect: -2, one_pair: -2 },
  shoe_sub_q: { two: 1, mood: 0, different: -1 },
  hats_q: { mood: 0, hair: -1, collect: -2 },
  hat_sub_q: { face: 1, safe: 0, different: -1 },
  jjanggu_q: { yes: -2, liked: 0, laundry: 1 },
  musinsa_q: { ranking: -3, sale: 0, convenient: 1, not_me: -1 },
  fruits_q: { vintage: 0, price: -1, resell: -2 },
  bunjang_q: { deal: -1, rare: 0, regret: -2 },
  shop_q: { points: -1, habit: -2, best: 1 },
  vintage_q: { often: 2, browse: 0, no_used: -1 },
  influencer_q: { daily: -2, sometimes: 0, never: 1 },
  /** 마지막 질문: 옷장 점수 구간(high 79+, mid 57~78, low 57 미만) × 답 */
  fashionable_q: {
    high_yes: 3,
    high_normal: 1,
    high_no: -1,
    high_others_say: 2,
    mid_yes: -2,
    mid_normal: 1,
    mid_no: 0,
    mid_others_say: -1,
    low_yes: -5,
    low_normal: -2,
    low_no: 2,
    low_others_say: -3,
  },
  /** 침착맨·얼렁뚱땅 상점 브랜드가 있으면 꼭 묻는 질문(점수 증감 없음) */
  chimchak_q: { love: 0, sometimes: 0, clothes_only: 0 },
};

/**
 * 총 옷장 점수 기준("얼마나 힙한가", 계획서 /mnt/project-files/roast/score-plan.md).
 * 기본 점수에서 더하고 빼고, 질문·퀴즈 증감(SCORE_DELTAS)을 더한 뒤 0~100으로 자른다.
 * 비율은 %, 금액은 만 원, 점수는 정수(감점도 양수로 적는다). 관리자 문장 편집의 "점수" 탭(score.rules)에서 고친다.
 */
export const SCORE_RULES = {
  base: 45,
  // 더하는 점수
  designer_each: 2,
  designer_max: 6,
  /** 컨템포러리·디자이너·스트릿 중고가(대중적 제외): 하나당 가점, 합쳐서 최대 */
  mid_each: 1,
  mid_max: 3,
  style_mid_pct: 40,
  style_mid: 2,
  style_high_pct: 60,
  style_high: 4,
  taste_full: 20,
  taste_max: 3,
  fruits_n: 3,
  fruits: 3,
  accent_basic_pct: 70,
  accent_max_n: 4,
  accent: 3,
  basic_pct: 85,
  basic_lux_n: 3,
  basic_lux: 4,
  /** 해외 브랜드 가점은 이 가격 레벨(4 = 중고가) 이상만 센다 */
  foreign_price: 4,
  steady_gap: 3,
  steady: 1,
  good_outer: 2,
  leather_shoes: 2,
  kr_new_age: 5,
  kr_new_n: 2,
  kr_new: 3,
  jp_n: 3,
  jp: 2,
  repro: 2,
  repro_many_n: 3,
  repro_many: 3,
  foreign_pct: 30,
  foreign: 2,
  bold_won: 50,
  bold: 2,
  regular_n: 3,
  regular: 2,
  shoe_set: 3,
  spend_top_won: 30,
  spend_top: 2,
  /** 총 구매액 가점: (총 구매액 ÷ total_won만 원 − n) × total_each점. n = 가장 오래된 구매 후 햇수 − total_free_years(마이너스 가능), 최대 total_max점 */
  total_won: 300,
  total_each: 2,
  total_free_years: 3,
  total_max: 5,
  /** 무신사 좋아요 수가 없는데 중고가 이상인 브랜드: 하나당 가점, 최대 */
  nolikes_each: 2,
  nolikes_max: 3,
  // 빼는 점수
  /** 무신사 좋아요 ≥ popular_likes, 가격이 고가 미만, 대중성이 대중적~매우 대중적인 브랜드 비율 */
  popular_likes: 50000,
  popular_from: 40,
  popular_per10: 3,
  popular_max: 12,
  /** 인기 쏠림에서 산 때 나이가 young_age세 이하인 옷은 young_pct%로만 센다. young_age세를 넘으면 young_end세까지 1배로 서서히 돌아온다(나이 모르면 그대로) */
  young_age: 27,
  young_end: 33,
  young_pct: 50,
  musinsa_from: 60,
  musinsa_per10: 3,
  musinsa_max: 9,
  /** musinsa_young_age세 이하에 산 옷은 무신사 인기 브랜드 쏠림에서 1/musinsa_young_div만 센다 */
  musinsa_young_age: 24,
  musinsa_young_div: 3,
  /** 무신사 좋아요 상위 이 %에 드는 브랜드도 무신사풍으로 센다(0이면 끔) */
  musinsa_likes_top: 30,
  /** 구매 시기별 변화: 반기 구간에 이 벌 수 이상인 구간만 쓰고, 가장 오래된 구간과 최근 구간을 비교한다 */
  shift_min_n: 3,
  /** 주 스타일이 바뀌었다고 보는 비중 증가(%p) */
  shift_style_pp: 30,
  /** 가격대가 바뀌었다고 보는 평균 가격 레벨 차이(레벨은 1~6) */
  shift_price: 1,
  /** 변화가 있을 때 점수에 더할 값(기본 0: 문장만) */
  shift_score: 0,
  trendy_pct: 50,
  trendy: 8,
  dup_each: 1.5,
  dup_max: 7.5,
  scattered_pct: 20,
  scattered: 5,
  /** 핏: 슬림·레귤러가 더 힙한 쪽. 핏을 아는 옷 fit_min벌 이상, 상의·하의 각각 3벌 이상일 때 그쪽을 본다 */
  fit_min: 5,
  fit_trim_pct: 60,
  fit_trim: 3,
  fit_big_pct: 60,
  fit_big: 2,
  misfit_each: 2,
  misfit_max: 10,
  gap_months: 4,
  gap_max: 12,
  basic_mass: 8,
  /** 무채색이 basic_full_pct% 이상이면 basic_mass, basic_pct~그 미만이면 basic_mass_mid */
  basic_full_pct: 95,
  basic_mass_mid: 4,
  lux_mismatch: 0,
  /** 신발이 shoes_few_n켤레 이하이거나 전부 운동화·스포츠화: 감점 */
  shoes_few_n: 2,
  sneakers_only: 5,
  /** 모자·신발 뺀 옷이 이 벌 수 이하: 감점 */
  /** 최종 점수 보정(옷장·주문내역 공통): 합계 0점 → floor_min점, 합계 50점 → floor_mid점, 합계 100점 → 100점을 꺾은선으로 잇는다 */
  floor_min: 28,
  floor_mid: 66,
  thin_n: 20,
  thin: 4,
  logo_pct: 20,
  logo: 7.5,
  /** 계절 구멍: 한 계절이라도 입을 수 있는 코디(상의×하의×신발)가 이 수 미만이면 감점. 계절을 안 적은 옷은 사계절로 본다 */
  season_combo_min: 12,
  season_gap: 5,
  spend_a_won: 20,
  spend_a: 2,
  spend_b_won: 10,
  spend_b: 6,
  spend_c: 10,
  // 마지막 질문("스스로 패셔너블하다고 생각하나요?")의 점수 구간
  // (옷장·주문내역 공통: 최저 28점~100점을 3등분)
  tier_high: 76,
  tier_low: 52,
};

export type ScoreRules = typeof SCORE_RULES;

/**
 * 나이에 맞는 옷: 옷을 산 때 나이 구간별 기준(구매일이 없으면 지금 나이). 구간마다 그 구간에 산 옷끼리 비율을 내고,
 * 그 구간 옷이 차지하는 비중만큼 반영한다. *_pct는 %, 나머지는 점수(감점도 양수).
 * street: 스트릿·하이프, mature: 컨템포러리·헤리티지·포멀, musinsa: 무신사 인기 브랜드(SPA 제외), formal: 포멀·럭셔리, lux_n: 럭셔리 벌 수
 */
export const AGE_RULES: Record<string, Record<string, number>> = {
  b0: {
    street_plus_pct: 40,
    street_plus: 2,
    formal_pct: 40,
    formal_minus: 6,
    lux_n: 2,
    lux_minus: 6,
  },
  b20: { street_plus_pct: 40, street_plus: 2, formal_pct: 40, formal_minus: 4 },
  b24: {},
  b27: { mature_pct: 30, mature_plus: 2, musinsa_pct: 60, musinsa_minus: 2 },
  b30: { mature_pct: 30, mature_plus: 2, musinsa_pct: 50, musinsa_minus: 6 },
  b36: {
    mature_pct: 40,
    mature_plus: 3,
    musinsa_pct: 45,
    musinsa_minus: 8,
    street_pct: 60,
    street_minus: 8,
  },
  b41: {
    mature_pct: 40,
    mature_plus: 4,
    musinsa_pct: 40,
    musinsa_minus: 10,
    street_pct: 50,
    street_minus: 10,
  },
  b51: {
    mature_pct: 40,
    mature_plus: 5,
    musinsa_pct: 40,
    musinsa_minus: 12,
    street_pct: 40,
    street_minus: 12,
  },
  b61: {
    mature_pct: 50,
    mature_plus: 5,
    musinsa_pct: 40,
    musinsa_minus: 12,
    street_pct: 30,
    street_minus: 14,
  },
};
/** 구간 시작 나이(위 AGE_RULES 키 순서대로) */
export const AGE_BANDS: [string, number][] = [
  ["b0", 0],
  ["b20", 20],
  ["b24", 24],
  ["b27", 27],
  ["b30", 30],
  ["b36", 36],
  ["b41", 41],
  ["b51", 51],
  ["b61", 61],
];

/** 첫 줄(HEADLINE) 구간: 최저 점수~100점을 10칸으로 나눈다(b0 = 가장 낮은 칸 … b90 = 가장 높은 칸). 옷장·주문내역 공통 */
export function headlineBand(total: number, min: number = SCORE_RULES.floor_min): `b${number}` {
  const idx = Math.max(0, Math.min(9, Math.floor(((total - min) * 10) / (100 - min))));
  return `b${idx * 10}`;
}

/** 첫 줄 구간의 점수 범위 이름(관리자 화면용) */
export function headlineRange(band: string, min: number = SCORE_RULES.floor_min): string {
  const i = Number(band.slice(1)) / 10;
  const lo = Math.ceil(min + (i * (100 - min)) / 10);
  const hi = i === 9 ? 100 : Math.ceil(min + ((i + 1) * (100 - min)) / 10) - 1;
  return i === 9 ? `${lo}점 이상` : `${lo}~${hi}점`;
}

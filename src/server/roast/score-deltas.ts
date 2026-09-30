import "server-only";

/**
 * 총 옷장 점수에 더하거나 빼는 값(질문·퀴즈 답별). 관리자 문장 편집의 "점수" 탭에서 고칠 수 있다(texts.ts의 score).
 * 키는 질문 id → 선택지 id. 선택지를 코드가 만드는 질문은 반응 종류로 쓴다
 * (퀴즈 right/wrong, 비싼 옷 버리기 most/mid/least, 브랜드 셋 spend/count/recent/spend2, 벌 수 맞히기 under/right/over).
 * 점수는 옷장 수치로 낸 기본 점수에 이 값을 더한 뒤 0~100으로 자른다.
 */
export const SCORE_DELTAS: Record<string, Record<string, number>> = {
  quiz: { right: 5, wrong: -5 },
  drop_item: { most: 0, mid: 0, least: 0 },
  brand_best: { spend: 1, count: 1, recent: -1, spend2: -2 },
  count_guess: { under: -2, right: 3, over: 1 },
  odd_photo: { mine: 1, gift: 0, dunno: -2 },
  justify_combo: { different: -2, similar: 1, dunno: -1 },
  color_taste: { black_easy: -1, just_happens: -2, have_colors: 1 },
  brand_employee: { love: 0, sale: 1, didnt_know: -2 },
  food_vs_clothes: { food: 2, clothes: -2, both: -1 },
  golden_spoon: { no: 0, yes: -1, skip: 0 },
  rationalize: { none: -2, some: 1, why: -1 },
  extreme_one: { of_course: -1, no: 1, already: -2 },
  black_why: { matches: 0, no_thinking: -2, charcoal: -1 },
  chroma_love: { love: 1, suits: 2, didnt_know: -1 },
  category_why: { wear_most: 1, cant_stop: -2, elsewhere: 0 },
  subcat_known: { exact: 2, roughly: 0, no: -2 },
  few_clothes: { minimal: 2, not_yet: 0, thats_all: 1 },
  many_clothes_wear: { most: 3, half: 0, few: -2, same: -3 },
  trend_source: { sns: -1, friends: 0, first: 1 },
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
  fit_choice: { comfy: 1, awkward: -1, have_others: 1 },
  style_self: { yes: 1, no: -1, none: -2 },
  brand_pick: { design: 1, price: 1, vibe: -1 },
  old_trust: { history: 1, chance: 0, new_too: 1 },
  niche_known: { nobody: 0, those_who_know: -1, rather_not: -1 },
  formal_job: { yes: 1, no: -1, like: 1 },
  same_outfit_street: { often: -2, sometimes: -1, not_yet: 1 },
  brand_alert: { on: -2, off: 1, no_need: -3 },
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
  fashionable_q: { yes: -2, normal: 0, no: 1, others_say: -1 },
};

/**
 * 총 옷장 점수 기준("얼마나 힙한가", 사용자 요청: 다양하다고 좋은 게 아니라 힙하고 패셔너블할수록 높게).
 * 기본 점수에서 더하고 빼고, 질문·퀴즈 증감(SCORE_DELTAS)을 더한 뒤 0~100으로 자른다. 가격은 넣지 않는다.
 * 비율 기준은 %(0~100), 점수는 정수. 관리자 문장 편집의 "점수" 탭(score.rules)에서 고친다.
 */
export const SCORE_RULES = {
  base: 50,
  /** 디자이너·하이엔드·컨템포러리·럭셔리 브랜드 비율이 designer_full%면 +designer_max */
  designer_max: 20,
  designer_full: 80,
  /** 대중성 낮은 브랜드(대중성 2 이하) 비율이 niche_full%면 +niche_max */
  niche_max: 10,
  niche_full: 60,
  /** 1위 스타일 태그 비율 */
  style_mid_pct: 50,
  style_mid: 5,
  style_high_pct: 65,
  style_high: 10,
  /** 헤리티지·일본 데님·워크웨어 브랜드 비율이 taste_full%면 +taste_max */
  taste_max: 5,
  taste_full: 50,
  /** 후르츠패밀리·번개장터 구매 3벌 이상 */
  digging: 3,
  /** 무채색이 60% 이상인데 유채색이 1~3벌 */
  accent: 3,
  /** SPA·매스마켓 비율이 mass_from%를 넘는 10%p마다 -mass_per10(최대 mass_max) */
  mass_from: 20,
  mass_per10: 4,
  mass_max: 20,
  /** 무신사 인기 브랜드 비율 */
  musinsa_from: 50,
  musinsa_per10: 3,
  musinsa_max: 10,
  /** 하이프 4 이상이고 대중성 4 이상인 브랜드가 trendy_pct% 이상 */
  trendy_pct: 50,
  trendy: 5,
  /** 세부분류·색이 같은 묶음의 3벌째부터, 제품명이 같은 옷의 2벌째부터 한 벌당 */
  dup_each: 3,
  dup_max: 15,
  /** 1위 스타일 태그가 scattered_pct% 미만이고 브랜드가 문어발 */
  scattered_pct: 25,
  scattered: 5,
  /** 내 치수 기준 너무 작거나 큰 옷 한 벌당 */
  misfit_each: 2,
  misfit_max: 10,
};

export type ScoreRules = typeof SCORE_RULES;

/**
 * 주문내역 훈수 점수 기준(계획서 /mnt/project-files/roast/order-roast-plan.md). 관리자 "주문내역 훈수" 탭(orders.score)에서 고친다.
 * 관리자 화면의 숫자 칸은 0~100 정수만 받으므로 큰 수(하트·후기·좋아요)는 단위를 붙여 적는다(_h: ×100, _k: ×1,000, _10k: ×10,000).
 * 비율은 %, 금액은 만 원, 점수는 정수(감점도 양수로 적는다).
 */
export const ORDER_RULES = {
  base: 50,
  // 랭킹템·숨은 상품 판단
  /** 상품 하트가 이 값 × 1,000 이상이면 랭킹템 */
  rank_likes_k: 10,
  /** 상품 후기가 이 값 × 100 이상이면 랭킹템 */
  rank_reviews_h: 30,
  /** 하트를 못 읽은 상품: 브랜드 무신사 좋아요가 이 값 × 10,000 이상이면 랭킹템 */
  rank_brand_10k: 30,
  /** 상품 하트가 이 값 × 100 미만이면 숨은 상품 */
  hidden_likes_h: 5,
  /** 하트를 못 읽은 상품: 브랜드 무신사 좋아요가 이 값 × 1,000 미만이면 숨은 상품 */
  hidden_brand_k: 10,
  // 더하는 점수
  designer_each: 2,
  designer_max: 10,
  hidden_full: 25,
  hidden_max: 8,
  style_mid_pct: 30,
  style_mid: 4,
  style_high_pct: 50,
  style_high: 8,
  taste_full: 20,
  taste_max: 5,
  /** 시기별 비교: 오래된 1/3과 최근 1/3이 각각 이 벌 수 이상일 때만 */
  shift_min_n: 4,
  hipper_pp: 15,
  hipper: 3,
  pricier_pct: 30,
  pricier: 2,
  return_min_orders: 20,
  return_low_pct: 5,
  return_low: 2,
  leather_shoes: 2,
  spend_top_won: 30,
  spend_top: 3,
  // 빼는 점수
  rank_from: 30,
  rank_per10: 3,
  rank_max: 12,
  musinsa_from: 60,
  musinsa_per10: 3,
  musinsa_max: 9,
  musinsa_young_div: 3,
  standard_a_pct: 25,
  standard_a: 3,
  standard_b_pct: 40,
  standard_b: 6,
  one_brand_pct: 40,
  one_brand_n: 10,
  one_brand: 4,
  mainstream_pp: 15,
  mainstream: 3,
  sale_month_pct: 35,
  sale_month: 3,
  cheap_won: 3,
  cheap: 4,
  dup_each: 3,
  dup_max: 15,
  return_high_pct: 25,
  return_high: 3,
  cancel_pct: 20,
  cancel: 2,
  scattered_pct: 20,
  scattered: 5,
  logo_pct: 20,
  logo: 3,
  sneakers_only: 2,
  spend_a_won: 20,
  spend_a: 1,
  spend_b_won: 10,
  spend_b: 3,
  spend_c: 5,
  // 마지막 질문("스스로 패셔너블하다고 생각하나요?")의 점수 구간
  tier_high: 70,
  tier_low: 40,
};
export type OrderRules = typeof ORDER_RULES;

/**
 * 나이에 맞는 주문: 옷을 산 때 나이 구간별 기준(옷장 훈수와 같은 구간). 구간마다 그 구간에 산 옷끼리 비율을 내고 그 구간 비중만큼 반영한다.
 * rank: 랭킹템(하트·후기 많은 상품), standard: 무신사 스탠다드, street: 스트릿·하이프, mature: 컨템포러리·헤리티지·포멀, lux_n: 럭셔리 벌 수
 */
export const ORDER_AGE_RULES: Record<string, Record<string, number>> = {
  b0: { street_plus_pct: 40, street_plus: 2, lux_n: 2, lux_minus: 3 },
  b20: { street_plus_pct: 40, street_plus: 2 },
  b24: { rank_pct: 60, rank_minus: 1 },
  b27: { mature_pct: 30, mature_plus: 2, rank_pct: 50, rank_minus: 2, standard_pct: 40, standard_minus: 1 },
  b30: { mature_pct: 30, mature_plus: 2, rank_pct: 40, rank_minus: 3, standard_pct: 30, standard_minus: 2, street_pct: 70, street_minus: 2 },
  b36: { mature_pct: 40, mature_plus: 3, rank_pct: 35, rank_minus: 4, standard_pct: 25, standard_minus: 3, street_pct: 60, street_minus: 4 },
  b41: { mature_pct: 40, mature_plus: 4, rank_pct: 30, rank_minus: 5, standard_pct: 25, standard_minus: 4, street_pct: 50, street_minus: 5 },
  b51: { mature_pct: 40, mature_plus: 5, rank_pct: 30, rank_minus: 6, standard_pct: 20, standard_minus: 5, street_pct: 40, street_minus: 6 },
  b61: { mature_pct: 50, mature_plus: 5, rank_pct: 25, rank_minus: 6, standard_pct: 20, standard_minus: 5, street_pct: 30, street_minus: 7 },
};

/** 주문내역 전용 질문의 답별 증감(-20~20). 퀴즈·밥과 옷·패셔너블 질문은 옷장 훈수 점수 탭 값을 같이 쓴다. */
export const ORDER_DELTAS: Record<string, Record<string, number>> = {
  o_only_musinsa: { all: -2, also_other: 1, offline: 1 },
  o_ranking: { ranking: -3, popular_after: 0, didnt_know: -1 },
  o_review_read: { read: 0, photo: -1, skip: 1 },
  o_review_write: { points: -1, good_only: 0, never: 0 },
  o_returns: { size: -1, mind: -2, try_on: 0 },
  o_cancel: { impulse: -2, price_drop: 0, mistake: -1 },
  o_sale_month: { cart: -2, same_day: -1, coincidence: 0 },
  o_brand_vip: { love: 0, sale: 1, didnt_know: -2 },
  o_standard: { value: -1, lazy: -2, quit: 1 },
  o_courier: { friends: -2, bundle: -1, just_now: 0 },
  o_shift: { taste: 1, trend: -2, both: 0 },
  o_cheapest: { wear: 1, once: -2, lost: -2 },
  o_grade: { top: -2, mid: 0, dont_care: 1 },
};

/**
 * 주문내역 훈수 점수 기준(점수 계산표 /mnt/project-files/roast/order-score-table.md, 옷장 훈수 기준 v4 바탕). 관리자 "주문내역 훈수" 탭(orders.score)에서 고친다.
 * 관리자 화면의 숫자 칸은 0~100 정수만 받으므로 큰 수(하트·후기·좋아요)는 단위를 붙여 적는다(_h: ×100, _k: ×1,000, _10k: ×10,000).
 * 비율은 %, 금액은 만 원, 점수는 정수(감점도 양수로 적는다).
 */
export const ORDER_RULES = {
  base: 45,
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
  // 더하는 점수(옷장 훈수 점수 기준 v4와 같은 것은 같은 값)
  designer_each: 2,
  designer_max: 6,
  /** 컨템포러리·디자이너·스트릿 중고가(대중적 제외): 1벌당 가점, 최대 */
  mid_each: 1,
  mid_max: 3,
  style_mid_pct: 40,
  style_mid: 2,
  style_high_pct: 60,
  style_high: 4,
  taste_full: 20,
  taste_max: 3,
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
  // 옷장 훈수와 같은 가점
  good_outer: 2,
  shoe_set: 3,
  /** 설립 kr_new_age년 이내 국내 디자이너 브랜드(대중성 낮음) kr_new_n벌 이상 */
  kr_new_age: 5,
  kr_new_n: 2,
  kr_new: 3,
  jp_n: 3,
  jp: 2,
  repro: 2,
  repro_many_n: 3,
  repro_many: 3,
  /** 해외 브랜드 가점은 이 가격 레벨(4 = 중고가) 이상만 센다 */
  foreign_price: 4,
  foreign_pct: 30,
  foreign: 2,
  bold_won: 30,
  bold: 2,
  regular_n: 3,
  regular: 2,
  accent_basic_pct: 70,
  accent_max_n: 4,
  accent: 3,
  basic_lux_n: 3,
  basic_lux: 4,
  steady_gap: 3,
  steady: 1,
  spend_top_won: 25,
  spend_top: 2,
  // 빼는 점수
  /** 무신사 좋아요 이 값 × 10,000 이상·고가 미만·대중적~매우 대중적 브랜드(무신사 스탠다드는 따로 셈) 비율 */
  popular_likes_10k: 5,
  /** 이 가격 레벨 미만만 센다(4 = 중고가: 중고가 미만) */
  popular_price: 4,
  /** 인기 쏠림(랭킹템 + 인기 대중 브랜드 + 무신사 인기 브랜드를 한 항목으로): 이 % 넘는 10%p마다 감점, 최대 */
  popular_from: 40,
  popular_per10: 3,
  popular_max: 12,
  /** 쏠림 감점(인기 쏠림·스탠다드·한 브랜드 몰빵·유행 브랜드) 합계가 이 값을 넘지 않게 자름 */
  pile_max: 25,
  /** 하이프·대중성 모두 높은 브랜드 비율 */
  trendy_pct: 50,
  trendy: 10,
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
  /** 같은 옷 반복: 같은 상품을 같은 실측(없으면 같은 사이즈)으로 다른 주문에서 또 산 것 */
  dup_each: 3,
  dup_max: 9,
  return_high_pct: 25,
  return_high: 3,
  cancel_pct: 20,
  cancel: 2,
  scattered_pct: 20,
  scattered: 5,
  logo_pct: 20,
  logo: 15,
  sneakers_only: 5,
  /** 무채색 basic_pct% 이상인데 고급 브랜드(컨템포러리 이상 또는 중고가 이상)가 한 벌도 없음 */
  basic_pct: 85,
  basic_mass: 12,
  basic_full_pct: 95,
  basic_mass_mid: 6,
  /** 명품 하우스 1~2벌의 스타일이 나머지 주력 스타일과 안 겹침 */
  lux_mismatch: 5,
  /** 구매 공백: 최근 24개월 중 gap_months개월 이상 연속으로 안 산 기간 1개월당 −1, 최대 */
  gap_months: 4,
  gap_max: 12,
  /** 몰아 사기 날: 하루에 서로 다른 주문으로 옷 binge_n벌 이상 산 날 1일당 감점, 최대 */
  binge_n: 5,
  binge_each: 2,
  binge_max: 6,
  /** 반품하고 또 사는 브랜드: 반품 2건 이상인 브랜드를 return_brand_n벌 이상 가지고 있음 */
  return_brand_n: 3,
  return_brand: 3,
  /** 기본 상의만: 반팔·긴팔 티, 맨투맨, 후드가 옷의 basic_tops_pct% 이상 */
  basic_tops_pct: 50,
  basic_tops: 4,
  /** 새 브랜드 탐색: 최근 explore_months개월 안에 처음 산 브랜드가 브랜드 전체(explore_min_brands곳 이상일 때)의 explore_pct% 이상 */
  explore_months: 6,
  explore_pct: 30,
  explore_min_brands: 5,
  explore: 2,
  spend_a_won: 15,
  spend_a: 2,
  spend_b_won: 10,
  spend_b: 6,
  spend_c: 10,
  // 마지막 질문("스스로 패셔너블하다고 생각하나요?")의 점수 구간
  tier_high: 70,
  tier_low: 40,
};
export type OrderRules = typeof ORDER_RULES;

/**
 * 나이에 맞는 주문: 옷을 산 때 나이 구간별 기준(옷장 훈수와 같은 구간). 구간마다 그 구간에 산 옷끼리 비율을 내고 그 구간 비중만큼 반영한다.
 * 감점은 옷장 훈수 점수 기준 v4처럼 처음 값의 2배.
 * formal: 포멀·럭셔리(옷장 훈수와 같은 값), rank: 랭킹템(하트·후기 많은 상품), standard: 무신사 스탠다드, street: 스트릿·하이프, mature: 컨템포러리·헤리티지·포멀, lux_n: 럭셔리 벌 수
 */
export const ORDER_AGE_RULES: Record<string, Record<string, number>> = {
  b0: { street_plus_pct: 40, street_plus: 2 },
  b20: { street_plus_pct: 40, street_plus: 2 },
  b24: { rank_pct: 60, rank_minus: 2 },
  b27: { mature_pct: 30, mature_plus: 2, rank_pct: 50, rank_minus: 4, standard_pct: 40, standard_minus: 2 },
  b30: { mature_pct: 30, mature_plus: 2, rank_pct: 40, rank_minus: 6, standard_pct: 30, standard_minus: 4, street_pct: 70, street_minus: 4 },
  b36: { mature_pct: 40, mature_plus: 3, rank_pct: 35, rank_minus: 8, standard_pct: 25, standard_minus: 6, street_pct: 60, street_minus: 8 },
  b41: { mature_pct: 40, mature_plus: 4, rank_pct: 30, rank_minus: 10, standard_pct: 25, standard_minus: 8, street_pct: 50, street_minus: 10 },
  b51: { mature_pct: 40, mature_plus: 5, rank_pct: 30, rank_minus: 12, standard_pct: 20, standard_minus: 10, street_pct: 40, street_minus: 12 },
  b61: { mature_pct: 50, mature_plus: 5, rank_pct: 25, rank_minus: 12, standard_pct: 20, standard_minus: 10, street_pct: 30, street_minus: 14 },
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
  o_grade: { top: -2, mid: 0, low: 1, dont_care: 1 },
};

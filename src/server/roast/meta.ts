import "server-only";
import { LINE_SECTION } from "./lines";
import { Q_TEXT, QUESTIONS } from "./questions";
import { REPORT_TEXT } from "./report-text";
import { SCORE_DELTAS } from "./score-deltas";
import { ORDER_QUESTIONS } from "./orders/questions";
import { ORDER_DELTAS } from "./orders/rules";
import { ORDER_AGE_KEY_NAME, ORDER_COMMON, ORDER_QUESTION_COND, ORDER_REPORT_NAME, ORDER_RULE_NAME, ORDER_SCREEN_NAME } from "./orders/texts";

/**
 * 관리자 문장 편집 화면과 검토 문서에 보여 주는 설명(언제 나오는지, 자리 이름). 분석 계산에는 쓰지 않는다.
 */

/** {자리} → 사람이 읽는 이름 */
export const VAR_LABEL: Record<string, string> = {
  n: "개수", pct: "비율%", brand: "브랜드", brands: "브랜드 수", names: "브랜드 이름들(쉼표로)", catName: "대분류", sub: "세부분류", color: "색", colorful: "유채색 벌 수",
  country: "나라", tag: "스타일", fit: "핏", fitPhrase: "핏(알 때만 '○○ 핏 ')", familyName: "제품군", owner: "호칭('○○님의' 또는 '당신의')", first: "첫째 캐릭터 이름", who1: "첫째 캐릭터 한 줄 정의", who2: "둘째 캐릭터 한 줄 정의", what: "반복되는 옷(예: 블랙 반팔 티셔츠)", colorPct: "유채색 비율%", tag1: "스타일 1위", tag2: "스타일 2위", tag3: "스타일 3위", cheapCat: "평균가 가장 낮은 종류", cheapWon: "그 평균 금액", pricyCat: "평균가 가장 높은 종류", pricyWon: "그 평균 금액", minWon: "최저 구매가", months: "평균 보유 개월", year: "브랜드 설립 연도 중간값", topPct: "상의 오버 비율%", bottomPct: "하의 슬림·레귤러 비율%", recent: "최근 6개월 구매 벌 수", recentPct: "최근 6개월 구매분 비율%", level: "낮음·중간·높음", position: "시장 포지션", itemName: "브랜드의 상품명", kind: "옷 종류(모두 하의면 '바지', 아니면 '옷')", month: "월",
  most: "많은 계절", mostN: "많은 계절 벌 수", least: "적은 계절", leastN: "적은 계절 벌 수", avgWon: "평균 금액", priceWon: "금액", amountWon: "금액",
  ratio: "배수", name: "제품명", oldest: "가장 오래된 브랜드", maxWon: "최고 구매가", traitText: "다른 점(색, 종류 등)",
  spendPct: "금액 비중%", countPct: "벌 수 비중%", count: "벌 수", total: "전체 개수", shop: "쇼핑몰", krN: "국내 대중 브랜드 벌 수", krPct: "국내 대중 브랜드 비율%",
  top: "상의 벌 수", bottom: "하의 벌 수", shoes: "신발 켤레 수", outer: "아우터 벌 수", hat: "모자 개수", base: "기본 조합 수(상의×하의×신발)", combos: "전체 조합 수", missing: "없는 종류", reason: "고른 이유(드문 색·종류 등)",
};

export const SECTION_NAME: Record<string, string> = {
  size: "옷장 크기", category: "옷 종류", acc: "모자·신발", color: "컬러", brand: "브랜드", group: "브랜드 계열", trait: "브랜드 성향", style: "스타일", shop: "구매처", repeat: "반복", season: "시즌", timing: "구매 시기", money: "금액", spend: "지출 비중", odd: "튀는 옷",
};

export const PATTERN_COND: Record<string, string> = {
  count_small: "모자·신발 뺀 옷 10~19벌",
  count_many: "60~99벌",
  count_huge: "100벌 이상",
  category_bias: "한 대분류가 50% 이상(모자·신발 제외)",
  subcategory_bias: "같은 세부분류 4벌 이상이고 20% 이상",
  shoes_many: "신발 8켤레 이상",
  hats_many: "모자 5개 이상",
  shoe_sub_bias: "신발 5켤레 이상 중 한 종류가 4켤레 이상이고 60% 이상",
  hat_sub_bias: "모자 4개 이상 중 한 종류가 3개 이상이고 60% 이상",
  black_bias: "색을 적은 옷 중 검정 35% 이상",
  achromatic_bias: "검정·회색·흰색 60% 이상",
  chroma_bias: "한 유채색 계열 25% 이상",
  brand_focus: "한 브랜드 4벌 이상이고 15% 이상",
  group_luxury: "명품 12% 이상(3벌 이상)",
  group_designer: "디자이너 20% 이상",
  group_contemporary: "컨템포러리 30% 이상",
  group_premium_casual: "프리미엄 캐주얼 35% 이상",
  group_specialist: "전문 브랜드 30% 이상",
  group_jp_denim: "일본 데님·워크웨어 12% 이상",
  group_heritage: "헤리티지 성향 높은 브랜드 30% 이상",
  group_street: "스트릿 30% 이상",
  group_sports: "스포츠 25% 이상",
  group_outdoor: "아웃도어 25% 이상",
  group_mass: "SPA·대중 브랜드 35% 이상",
  trend_brands: "요즘 뜨는 브랜드 3벌 이상이고 20% 이상",
  country_bias: "브랜드 아는 옷 중 한 나라 60% 이상",
  trait_hype: "브랜드 화제성 평균 3.5 이상",
  trait_trendy: "유행 성향 평균 3.8 이상",
  trait_timeless: "유행 성향 평균 1.9 이하",
  trait_functional: "기능성 평균 3.5 이상",
  trait_niche: "대중성 평균 2.5 이하(마니아)",
  trait_mainstream: "대중성 평균 4.5 이상",
  trait_formal: "포멀도 평균 3.5 이상",
  trait_casual: "포멀도 평균 1.6 이하",
  trait_heritage: "헤리티지 평균 3.8 이상",
  trait_pricey: "브랜드 가격대 평균 4.8 이상",
  tag_bias: "한 스타일 태그가 40% 이상",
  same_color: "브랜드 8개 이상으로 제각각인데 무채색 65% 이상",
  same_fit: "브랜드 8개 이상인데 한 핏 60% 이상",
  same_tag: "브랜드 8개 이상인데 한 스타일 60% 이상",
  old_brands: "설립 50년 넘은 브랜드 60% 이상",
  combo_repeat: "세부분류+색+핏이 같은 옷 3벌 이상",
  family_repeat: "제품명 키워드(카고·와이드 등) 같은 것 3벌 이상",
  measure_repeat: "같은 세부분류에서 총장·가슴이 2cm 안쪽인 옷 3벌 이상",
  fit_bias: "핏 아는 옷 5벌 이상 중 한 핏 50% 이상",
  season_bias: "가장 많은 계절이 가장 적은 계절의 1.8배 이상",
  recent_30: "최근 30일 3벌 이상",
  recent_90: "최근 90일 5벌 이상(30일 조건이 안 될 때)",
  taste_shift: "구매일 있는 옷을 반기별로 묶어 3벌 이상인 가장 오래된·최근 구간을 비교해 주 스타일이 바뀌고 새 스타일 비중이 30%p 이상 늘어남",
  price_shift: "위와 같은 비교에서 스타일은 그대로인데 평균 가격 레벨이 1 이상 달라짐",
  month_binge: "연도와 상관없이 같은 달(예: 9월)에 산 옷이 4벌 이상이고 달 평균의 2배 이상",
  avg_price: "구매가 있는 옷 5벌 이상, 평균 8만 원 이상",
  top_item: "최고가가 가운데 가격의 3배 이상",
  category_spend: "한 대분류(아우터·신발 제외)의 금액 비중이 벌 수 비중보다 15%p 이상 높음",
  subcategory_spend: "한 세부분류에 3벌 이상, 50만 원 이상, 쓴 돈의 25% 이상",
  brand_spend: "1위 브랜드 금액이 30% 이상",
  sale_luxury: "초고가 브랜드를 30만 원 미만에 산 옷 2벌 이상",
  cheap_brand_splurge: "저가·중저가 브랜드에서 30만 원 이상",
  musinsa_kr: "구매 링크 5개 이상 중 무신사 50% 이상(4개 이상)이고, 누구나 아는 국내 브랜드가 브랜드 아는 옷의 40% 이상",
  shop_focus: "구매 링크 5개 이상 중 한 쇼핑몰 60% 이상(무신사 패턴이 나오면 무신사는 빼고)",
  identical_items: "제품명·색이 같은 옷 3벌 이상(같은 옷을 여러 벌)",
  odd_one: "옷장에서 드문 특성(12% 이하)이 2개 이상인 옷 한 벌",
};

export const QUESTION_COND: Record<string, string> = {
  fruits_q: "구매 링크가 후르츠패밀리인 옷 3벌 이상",
  bunjang_q: "구매 링크가 번개장터인 옷 3벌 이상",
  odd_photo: "튀는 옷이 있고 사진이 있을 때",
  justify_combo: "세부분류+색+핏이 같은 옷 3벌 이상",
  color_taste: "무채색 60% 이상",
  brand_employee: "한 브랜드 4벌 이상이고 15% 이상",
  food_vs_clothes: "가격 적은 옷 5벌 이상 중 20만 원 이상이 20% 이상",
  golden_spoon: "가격 적은 옷 5벌 이상 중 50만 원 이상이 20% 이상",
  drop_item: "가격 적은 옷 5벌 이상. 가장 비싼 옷 3벌이 선택지(반응: 가장 비싼 것 / 가운데 / 셋 중 가장 싼 것)",
  brand_best: "금액 1위·벌 수 1위·최근 90일 구매 1위(2벌 이상, 없으면 금액 2위) 브랜드가 서로 다르고 각각 2벌 이상일 때. 반응: 고른 브랜드가 어느 쪽인지에 따라",
  rationalize: "치수가 거의 같은 옷 또는 같은 제품군 4벌 이상. 해당 옷 사진을 모두 가로로 보여 줌",
  extreme_one: "같은 제품군 5벌 이상. 해당 옷 사진을 모두 가로로 보여 줌",
  quiz: "옷장에 퀴즈가 있는 브랜드가 하나라도 있을 때, 그 브랜드 문제",
  band_quiz: "옷 이름·브랜드에 밴드 이름이 있을 때 꼭(흔한 단어 이름은 밴드·투어·티셔츠 같은 말이 같이 있을 때만). 문제는 bands.ts",
  three_500: "언더아머 옷이 있을 때 꼭",
  black_why: "검정 35% 이상",
  chroma_love: "한 유채색 25% 이상",
  category_why: "한 대분류 50% 이상",
  few_clothes: "옷 10~19벌",
  many_clothes_wear: "옷 60벌 이상",
  trend_source: "요즘 뜨는 브랜드 편중",
  timeless_q: "유행 안 타는 브랜드 편중",
  hype_alarm: "화제성 높은 브랜드 편중",
  country_q: "한 나라 60% 이상",
  mountain: "기능성 또는 아웃도어 편중",
  sports_q: "스포츠 브랜드 25% 이상",
  recent_reason: "최근 30일에 3벌 이상 구매",
  binge_month: "해마다 특정 달(예: 9월)에 몰아 사기",
  season_gap: "계절 편중",
  top_item_q: "최고가가 가운데 가격의 3배 이상",
  sale_q: "초고가 브랜드를 30만 원 미만에 산 옷 2벌 이상",
  splurge_q: "저가·중저가 브랜드에서 30만 원 이상",
  subcat_spend_q: "한 세부분류에 3벌 이상, 50만 원 이상, 쓴 돈의 25% 이상",
  max_budget: "가격 적은 옷 5벌 이상이고 그중 가장 비싼 옷이 20만 원 이상. 반응: 고른 한도가 가장 비싼 옷보다 낮음 / 같거나 높음 / 한도 없음",
  fit_choice: "핏 아는 옷(직접 고른 핏 우선, 없으면 예상 핏) 5벌 이상",
  style_self: "한 스타일 40% 이상",
  brand_pick: "브랜드는 다양한데 색·핏·스타일이 결국 비슷함",
  old_trust: "50년 넘은 브랜드 60% 이상",
  niche_known: "마니아 브랜드 편중",
  formal_job: "포멀 브랜드 편중",
  same_outfit_street: "SPA·대중 브랜드 편중",
  brand_alert: "한 브랜드 4벌 이상이고 15% 이상",
  brand_spend_q: "1위 브랜드 금액 30% 이상",
  shoes_q: "신발 8켤레 이상. 신발 사진을 가로로 보여 줌",
  shoe_sub_q: "신발 중 한 종류 4켤레 이상이고 60% 이상",
  hats_q: "모자 5개 이상. 모자 사진을 가로로 보여 줌",
  hat_sub_q: "모자 중 한 종류 3개 이상이고 60% 이상",
  vintage_q: "누구에게나(오래된·헤리티지·일본 데님 브랜드가 많으면 더 자주)",
  influencer_q: "누구에게나(요즘 뜨는·유행 타는 브랜드가 많으면 더 자주)",
  fashionable_q: "누구에게나, 늘 마지막에. 반응·결과 글·점수 증감은 옷장 점수 구간(높음·중간·낮음)별로 다름",
  chimchak_q: "침착맨 또는 얼렁뚱땅 상점 옷이 있을 때 꼭(질문 수에 안 셈). 점수 증감 없음",
};

export const REACT_NAME: Record<string, string> = {
  under: "실제보다 적게 고름", right: "정답", over: "실제보다 많게 고름",
  below: "한도가 최고가보다 낮음", within: "한도가 최고가 이상", nolimit: "한도 없음",
  most: "가장 비싼 옷", mid: "가운데", least: "셋 중 가장 싼 옷",
  spend: "금액 1위 브랜드", count: "벌 수 1위 브랜드", recent: "최근 구매 1위 브랜드", spend2: "금액 2위 브랜드",
};

export const SCREEN_NAME: Record<string, string> = {
  INTRO: "시작 멘트",
  CREDIT: "시작 멘트 아래 작은 글씨(영감 출처)",
  START_LABEL: "시작 버튼",
  CRITERIA_LABEL: "평가 기준 버튼",
  CRITERIA: "평가 기준 버튼을 눌렀을 때 설명(대략적인 기준만 짧게)",
  ASK_NAME: "이름·나이 묻기",
  NAME_HINT: "이름·나이 입력칸 아래 안내",
  AGE_HINT: "한국식 나이로 적으라는 안내 + 나이를 저장하지 않는다는 안내",
  TOO_FEW: "옷이 10벌보다 적을 때",
  OPENING: "분석 시작 전 첫 멘트",
  WRITING: "결과를 쓰는 중",
  NO_AI_LEFT: "오늘 AI 글쓰기를 다 썼을 때",
  DISCLAIMER: "결과 맨 아래 안내",
  CHANGED: "옷장이 바뀌었을 때(결과 위)",
  RETRY_LABEL: "다시 해보기 버튼",
};

export const COMMON_NAME: Record<string, string> = {
  QUIZ_CORRECT: "퀴즈 맞혔을 때 앞말",
  QUIZ_WRONG: "퀴즈 틀렸을 때 앞말",
  QUIZ_ROAST_RIGHT: "결과 글: 퀴즈를 맞혔을 때",
  QUIZ_ROAST_WRONG: "결과 글: 퀴즈를 틀렸을 때",
  SECTION_STATUS: "상태 문구(섹션 시작)",
  SCAN_OPEN: "분석 시작",
  NAME_GREETING: "호칭 부르며 시작",
  THINKING: "추임새(패턴 말하기 전)",
  MID_REMARKS: "중간 혼잣말(섹션 사이)",
  FEW_PATTERNS: "패턴이 적을 때",
  WRAP_UP: "마무리 전",
  CLOSING: "결과 맨 끝(2~3줄 고름)",
  OUTFIT_COMBOS: "결과 글: 코디 조합 가짓수",
  OUTFIT_NONE: "결과 글: 조합이 0가지일 때(상의·하의·신발 중 없는 것)",
  PLAIN_HEADLINE: "패턴이 없을 때 헤드라인",
  PLAIN_PARA: "패턴이 없을 때 본문",
  HEAD_SINGLE_PREFIX: "헤드라인을 패턴 하나로 만들 때 앞말",
};

/** 묶음마다 자리 이름을 달리 부를 때 */
export function varLabel(group: string, key: string): string {
  if (key === "name" && group === "common.NAME_GREETING") return "호칭";
  return VAR_LABEL[key] ?? key;
}

/** 편집 화면의 묶음(패턴 하나, 질문 하나 등). 퀴즈는 편집 화면이 따로 모은다. */
export interface TextGroupMeta {
  id: string;
  kind: "screen" | "common" | "lines" | "questions" | "report" | "score" | "layout" | "orders";
  title: string;
  when: string;
}

/** 결과 구성 탭: 섹션·문단 이름과 내용이 무엇으로 정해지는지 */
export const LAYOUT_SECTION: Record<string, { name: string; how: string }> = {
  intro: { name: "\"> \" 소개 문장", how: "뚜렷한 진단 두 개와 캐릭터(조건이 맞는 것 중 뚜렷한 순서로 셋)로 자동으로 정해집니다." },
  summary: { name: "요약 한 문장(제목 바로 아래)", how: "가장 뚜렷한 옷장 특징 세 개(모자라면 두 개)를 서로 다른 종류(색·브랜드·스타일·핏 등)에서 골라 한 문장으로 잇습니다." },
  lists: { name: "목록 두 개", how: "많이 가진 옷(세부분류 + 색 + 핏이 같은 옷 3벌 이상, 없으면 뺌)과 많이 산 브랜드(옷장 대비 %, 1위가 기준 미만이면 뺌). 제목은 고정 문구입니다." },
  total: { name: "총점", how: "옷장 점수(점수 탭 기준) + 질문·퀴즈 답의 증감. 한마디는 총점 구간별 문장에서 고릅니다." },
  points: { name: "진단 문단들", how: "아래 \"진단 문단 순서\"대로 이어집니다." },
  notes: { name: "안내 문구", how: "브랜드 정보가 있는 옷 수 같은 기준 안내입니다." },
};
export const LAYOUT_POINT: Record<string, { name: string; how: string }> = {
  diag_lead: { name: "첫 진단", how: "옷장 패턴 중 가장 뚜렷한 것 하나" },
  color: { name: "컬러 한마디", how: "색을 적은 옷 5벌 이상(데님 제외)일 때 무채색 비율로" },
  fit: { name: "핏 한마디", how: "핏을 아는 옷 5벌 이상일 때 주력 핏으로" },
  diag: { name: "나머지 진단", how: "뚜렷한 순서로, 진단 문단 수만큼" },
  wallet: { name: "지갑(비싼 옷 vs 싼 옷 브랜드)", how: "가격과 브랜드 정보가 있는 옷 8벌 이상" },
  vintage: { name: "빈티지·구제", how: "브랜드를 빈티지·구제로 적은 옷 3벌 이상" },
  age: { name: "나이 한마디", how: "시작할 때 나이를 적었을 때" },
  last: { name: "마지막 문단", how: "따로 붙일 곳이 없는 질문 답, 없으면 가장 비싼 옷" },
};
const LAYOUT_COUNT: Record<string, string> = {
  diag_min: "진단 문단 최소 개수",
  diag_max: "진단 문단 최대 개수",
  list_rows: "많이 가진 옷 목록 줄 수",
  dup_min: "많이 가진 옷: 같은 옷이 이 벌 수 이상일 때만 목록에 넣음",
  brand_rows: "브랜드 목록 줄 수",
  brand_top_pct: "브랜드 목록: 1위 브랜드가 이 % 이상일 때만 보여 줌",
  brand_row_pct: "브랜드 목록: 이 % 이상인 브랜드만 넣음",
  photos: "사진 줄 하나의 사진 수",
  photo_blocks: "사진을 넣는 문단 수(가장 특이한 문단부터)",
  answers: "문단에 붙는 질문 답 수",
};
/** 결과 구성 탭에 같이 보여 주는 고정 문구(결과 페이지 탭과 같은 값) */
const LAYOUT_FIXED = ["LIST_DUP", "LIST_BRAND", "TOTAL_LEAD", "INTRO_MORE", "BASIS_BRAND"];

const SUMMARY_NAME: Record<string, string> = {
  achro: "무채색 60% 이상",
  black: "검정 40% 이상",
  colorful: "무채색 40% 미만",
  brand_one: "한 브랜드 25% 이상",
  brand_many: "브랜드가 제각각",
  musinsa: "무신사 인기 브랜드 50% 이상",
  country: "한 나라 브랜드 45% 이상",
  designer: "디자이너·명품·컨템포러리 35% 이상",
  mass: "SPA·대중 브랜드 40% 이상",
  hype: "하이프 높음",
  heritage: "헤리티지 높음",
  style: "한 스타일 태그 50% 이상",
  casual: "포멀도 낮음",
  formal: "포멀도 높음",
  func: "기능성 높음",
  big: "세미오버핏 이상 60% 이상",
  trim: "슬림·레귤러핏 60% 이상",
  category: "한 종류(상의·하의·아우터) 45% 이상",
  dup: "같은 옷 3벌 이상",
  new_items: "최근 6개월 구매 40% 이상",
  old_items: "3년 넘은 옷 40% 이상",
};

const SUSPICIOUS_NAME: Record<string, string> = {
  top_item: "다른 문단에 걸리는 게 없을 때: 가장 비싼 항목",
};

const COLOR_NAME: Record<string, string> = {
  achro_85: "무채색 85% 이상",
  achro_70: "무채색 70~84%",
  achro_50: "무채색 60~69%",
  balanced: "무채색 40~59%",
  colorful: "무채색 40% 미만",
  black: "덧붙임: 검정이 40% 이상",
  white: "덧붙임: 흰색 계열이 25% 이상",
  earth: "덧붙임: 베이지·브라운·카키가 35% 이상",
  blue: "덧붙임: 네이비·데님이 30% 이상",
  one_chroma: "덧붙임: 유채색 중 한 계열이 절반 이상",
  vivid: "덧붙임: 원색이 25% 이상",
  pastel: "덧붙임: 파스텔 톤 3벌 이상",
  many: "덧붙임: 색 계열 9가지 이상",
  few: "덧붙임: 색 계열 3가지 이하",
  recent: "덧붙임: 최근 6개월에도 무채색 60% 이상",
};

const FIT_NAME: Record<string, string> = {
  trim: "슬림·레귤러 60% 이상",
  big: "세미오버·오버(와이드) 60% 이상",
  even: "고루 섞임",
  contrast: "덧붙임: 위아래 핏이 엇갈림",
  all_big: "덧붙임: 위아래 모두 크게",
  misfit: "덧붙임: 치수에 안 맞는 옷 3벌 이상",
};

const AGE_REMARK_NAME: Record<string, string> = {
  street: "나이에 비해 스트릿이 많음",
  musinsa: "나이에 비해 무신사 인기 브랜드가 많음",
  mature: "나이에 맞게 성숙한 옷장",
  formal: "나이에 비해 포멀·럭셔리가 많음",
  lux: "나이에 비해 럭셔리가 많음",
  young_street: "어린 나이에 스트릿",
};

const WALLET_NAME: Record<string, string> = {
  heritage: "비싼 옷일수록 헤리티지 브랜드",
  luxury: "싼 옷은 자잘하게, 비싼 옷은 럭셔리·디자이너",
  style: "싼 옷과 비싼 옷의 스타일이 다름",
};

const RULE_NAME: Record<string, string> = {
  base: "기본 점수",
  designer_each: "디자이너·명품(고가 이상, 대중적 제외): 1벌당 가점",
  designer_max: "디자이너·명품(고가 이상, 대중적 제외): 최대 가점",
  mid_each: "컨템포러리·디자이너·스트릿 중고가(대중적 제외): 1벌당 가점",
  mid_max: "컨템포러리·디자이너·스트릿 중고가(대중적 제외): 최대 가점",
  style_mid_pct: "스타일 뚜렷함: 1단계 비율(%)",
  style_mid: "스타일 뚜렷함: 1단계 가점",
  style_high_pct: "스타일 뚜렷함: 2단계 비율(%)",
  style_high: "스타일 뚜렷함: 2단계 가점",
  taste_full: "진짜 헤리티지·일본 데님·워크웨어 계열: 만점 비율(%)",
  taste_max: "진짜 헤리티지·일본 데님·워크웨어 계열: 최대 가점",
  fruits_n: "후르츠패밀리: 기준 벌 수",
  fruits: "후르츠패밀리: 가점",
  accent_basic_pct: "기본색 위주 + 포인트 컬러: 무채색 비율(%)",
  accent_max_n: "기본색 위주 + 포인트 컬러: 포인트 컬러 최대 벌 수",
  accent: "기본색 위주 + 포인트 컬러: 가점",
  basic_pct: "기본색뿐인 옷장: 무채색 비율(%)",
  basic_lux_n: "기본색뿐인데 고급 브랜드: 기준 벌 수",
  foreign_price: "해외 브랜드: 이 가격 레벨(4=중고가) 이상만 셈",
  basic_lux: "기본색뿐인데 고급 브랜드: 가점",
  steady_gap: "꾸준한 구매: 연속으로 안 산 달이 이보다 적으면",
  steady: "꾸준한 구매: 가점",
  good_outer: "좋은 아우터 하나: 가점",
  leather_shoes: "가죽 신발: 가점",
  kr_new_year: "국내 신진 디자이너: 설립 연도 기준",
  kr_new_n: "국내 신진 디자이너: 기준 벌 수",
  kr_new: "국내 신진 디자이너: 가점",
  jp_n: "일본 브랜드: 기준 벌 수",
  jp: "일본 브랜드: 가점",
  repro: "일본 복각 데님·LVC: 1벌 이상 가점",
  repro_many_n: "일본 복각 데님·LVC: 많을 때 기준 벌 수",
  repro_many: "일본 복각 데님·LVC: 많을 때 가점",
  foreign_pct: "해외 브랜드: 기준 비율(%)",
  foreign: "해외 브랜드: 가점",
  bold_won: "과감한 한 벌: 기준 금액(만 원)",
  bold: "과감한 한 벌: 가점",
  regular_n: "단골 브랜드: 기준 브랜드 수",
  regular: "단골 브랜드: 가점",
  shoe_set: "신발 풀세트: 가점",
  spend_top_won: "소비액: 3개월 평균 이 금액(만 원) 이상이면 가점",
  spend_top: "소비액: 가점",
  nolikes_each: "좋아요 없는 중고가 이상 브랜드: 1벌당 가점",
  nolikes_max: "좋아요 없는 중고가 이상 브랜드: 최대 가점",
  popular_likes: "인기 대중 브랜드: 무신사 좋아요 이 값 이상(고가 미만·대중적)",
  popular_from: "인기 대중 브랜드: 감점 시작(%)",
  popular_per10: "인기 대중 브랜드: 10%p마다 감점",
  popular_max: "인기 대중 브랜드: 최대 감점",
  musinsa_from: "무신사 인기 브랜드: 감점 시작(%)",
  musinsa_per10: "무신사 인기 브랜드: 10%p마다 감점",
  musinsa_max: "무신사 인기 브랜드: 최대 감점",
  musinsa_young_age: "무신사 인기 브랜드: 이 나이 이하에 산 옷은 덜 셈",
  musinsa_young_div: "무신사 인기 브랜드: 위 나이 이하에 산 옷은 1/이 값만 셈",
  musinsa_likes_top: "무신사풍: 무신사 좋아요 상위 이 %(0이면 끔) 브랜드도 무신사풍으로 셈",
  shift_min_n: "구매 시기 변화: 반기 구간에 이 벌 수 이상이어야 비교",
  shift_style_pp: "구매 시기 변화: 주 스타일 비중 증가 기준(%p)",
  shift_price: "구매 시기 변화: 평균 가격 레벨 차이 기준(1~6)",
  shift_score: "구매 시기 변화: 점수(기본 0, 문장만)",
  trendy_pct: "유행 따라가기: 기준 비율(%)",
  trendy: "유행 따라가기: 감점",
  dup_each: "복붙 중복: 한 벌당 감점",
  dup_max: "복붙 중복: 최대 감점",
  scattered_pct: "스타일 없음: 1위 스타일이 이 비율(%) 미만",
  scattered: "스타일 없음: 감점",
  fit_min: "핏: 핏을 아는 옷이 이 벌 수 이상일 때만",
  fit_trim_pct: "핏: 슬림·레귤러 가점 기준(%)",
  fit_trim: "핏: 슬림·레귤러 위주 가점",
  fit_big_pct: "핏: 오버·와이드 감점 기준(%)",
  fit_big: "핏: 오버·와이드 위주 감점",
  fit_contrast: "핏: 위아래 실루엣 대비 가점",
  misfit_each: "치수에 안 맞는 옷: 한 벌당 감점",
  misfit_max: "치수에 안 맞는 옷: 최대 감점",
  gap_months: "구매 공백: 연속으로 안 산 달 기준",
  gap_max: "구매 공백: 최대 감점",
  basic_mass: "기본색뿐인데 고급 브랜드 없음: 감점",
  lux_mismatch: "스타일 모르고 산 명품: 감점",
  sneakers_only: "신발이 전부 운동화: 감점",
  logo_pct: "로고 과다: 기준 비율(%)",
  logo: "로고 과다: 감점",
  season_gap_pct: "계절 구멍: 가장 많은 계절의 이 비율(%) 미만",
  season_gap: "계절 구멍: 감점",
  spend_a_won: "소비액: 1단계 기준(만 원)",
  spend_a: "소비액: 1단계 감점",
  spend_b_won: "소비액: 2단계 기준(만 원)",
  spend_b: "소비액: 2단계 감점",
  spend_c: "소비액: 그보다 적을 때 감점",
  tier_high: "마지막 질문: '높음' 구간 시작 점수",
  tier_low: "마지막 질문: '중간' 구간 시작 점수",
};

const AGE_BAND_NAME: Record<string, string> = { b0: "19세 이하", b20: "20~23세", b24: "24~26세", b27: "27~29세", b30: "30~35세", b36: "36~40세", b41: "41~50세", b51: "51~60세", b61: "61세 이상" };
const AGE_KEY_NAME: Record<string, string> = {
  street_plus_pct: "스트릿 가점 기준(%)",
  street_plus: "스트릿 가점",
  street_pct: "스트릿 감점 기준(%)",
  street_minus: "스트릿 감점",
  mature_pct: "성숙 가점 기준(%)",
  mature_plus: "성숙 가점",
  musinsa_pct: "무신사풍 감점 기준(%)",
  musinsa_minus: "무신사풍 감점",
  formal_pct: "포멀·럭셔리 감점 기준(%)",
  formal_minus: "포멀·럭셔리 감점",
  lux_n: "럭셔리 감점 기준 벌 수",
  lux_minus: "럭셔리 감점",
};

const REPORT_NAME: Record<string, string> = {
  HEADLINE: "첫 줄: 총점 구간별 평가",
  INTRO_THANKS: "\"> \" 첫 문장(뚜렷한 특징 둘)",
  INTRO_THANKS_ONE: "\"> \" 첫 문장(뚜렷한 특징 하나)",
  INTRO_CHAR_TWO: "\"> \" 캐릭터 문장(캐릭터 둘)",
  INTRO_CHAR_ONE: "\"> \" 캐릭터 문장(캐릭터 하나)",
  INTRO_ALSO: "\"> \" 캐릭터가 셋일 때 앞 문장",
  INTRO_SECOND: "\"> \" 캐릭터가 셋일 때 세 번째 캐릭터",
  INTRO_MORE: "\"> \" 마지막 문장(진단 문단 앞)",
  LIST_DUP: "목록 제목: 많이 가진 옷",
  LIST_BRAND: "목록 제목: 많이 산 브랜드",
  TOTAL_LEAD: "총 옷장 점수(굵게)",
  TOTAL: "총점 구간별 한마디",
  DUP_RECENT: "같은 옷을 최근에도 또 샀을 때(중복 문단 뒤)",
  BRAND_RECENT: "같은 브랜드를 최근에도 또 샀을 때(브랜드 문단 뒤)",
  color: "컬러 한마디",
  fit: "핏 한마디",
  VINTAGE: "브랜드를 빈티지·구제로 적은 옷이 많을 때",
  age: "나이 한마디(나이를 적었을 때)",
  wallet: "비싼 옷과 싼 옷의 브랜드 비교",
  SUMMARY_3: "요약 한 문장(특징 세 개)",
  SUMMARY_2: "요약 한 문장(특징 두 개)",
  summary: "요약 한 문장에 들어가는 특징 말",
  BASIS_BRAND: "기준 안내(브랜드 정보)",
  suspicious: "마지막 문단",
};

/** 주문내역 결과 문장의 경우 이름 */
const ORDER_REPORT_SIDE: Record<string, string> = {
  high: "랭킹템 30% 이상",
  low: "숨은 상품 25% 이상",
  cheap: "한 벌 평균 3만 원 미만",
  mid: "한 벌 평균 3만~10만 원",
  pricey: "한 벌 평균 10만 원 이상",
  style: "주 스타일이 바뀜",
  hipper: "랭킹템 비율이 줄어듦",
  mainstream: "랭킹템 비율이 늘어남",
  pricier: "한 벌 평균가가 30% 이상 오름",
  cheaper: "한 벌 평균가가 30% 이상 내림",
  rank: "나이에 비해 랭킹템이 많음",
  standard: "나이에 비해 무신사 스탠다드가 많음",
  street: "나이에 비해 스트릿이 많음",
  mature: "나이에 맞게 성숙한 주문",
  young_street: "어린 나이에 스트릿",
  lux: "어린 나이에 명품",
};

export function textGroups(): TextGroupMeta[] {
  const out: TextGroupMeta[] = [];
  for (const [k, name] of Object.entries(SCREEN_NAME)) out.push({ id: `screen.${k}`, kind: "screen", title: name, when: "" });
  for (const [k, name] of Object.entries(COMMON_NAME)) out.push({ id: `common.${k}`, kind: "common", title: name, when: "" });
  for (const [id, sec] of Object.entries(LINE_SECTION))
    out.push({ id: `lines.${id}`, kind: "lines", title: `${id} (${SECTION_NAME[sec]})`, when: PATTERN_COND[id] ?? "" });
  for (const q of QUESTIONS)
    out.push({ id: `questions.${q.id}`, kind: "questions", title: Q_TEXT[q.id]?.text || (q.id === "quiz" ? "패션 퀴즈(앞 멘트)" : q.id), when: `${q.id} · ${QUESTION_COND[q.id] ?? ""}` });
  for (const [k, name] of Object.entries(REPORT_NAME)) out.push({ id: `report.${k}`, kind: "report", title: name, when: "" });
  for (const [k, v] of Object.entries(REPORT_TEXT.diag)) out.push({ id: `report.diag.${k}`, kind: "report", title: `진단: ${v.title}`, when: k });
  for (const [k, v] of Object.entries(REPORT_TEXT.character)) out.push({ id: `report.character.${k}`, kind: "report", title: `캐릭터: ${v.name}`, when: k });
  out.push({ id: "report.layout.order", kind: "layout", title: "섹션 순서", when: "작은 숫자가 위(1~20). 첫 줄(점수 평가)은 항상 맨 위입니다." });
  out.push({ id: "report.layout.show", kind: "layout", title: "섹션 켜기·끄기", when: "1이면 보이고 0이면 뺍니다." });
  out.push({ id: "report.layout.point_order", kind: "layout", title: "진단 문단 순서", when: "작은 숫자가 위(1~20). 조건이 안 맞는 문단은 저절로 빠집니다." });
  out.push({ id: "report.layout.point_show", kind: "layout", title: "진단 문단 켜기·끄기", when: "1이면 보이고 0이면 뺍니다." });
  out.push({ id: "report.layout.count", kind: "layout", title: "개수", when: "0~40" });
  for (const k of LAYOUT_FIXED) out.push({ id: `report.${k}`, kind: "layout", title: `고정 문구: ${REPORT_NAME[k]}`, when: "결과 페이지 탭의 같은 문구와 함께 바뀝니다." });
  out.push({ id: "score.rules", kind: "score", title: "총 옷장 점수 기준", when: "기본 점수에서 더하고 빼는 기준(비율은 %, 금액은 만 원, 감점도 양수로)" });
  out.push({ id: "score.age", kind: "score", title: "나이에 맞는 옷", when: "옷을 산 때 나이 구간별 기준(비율은 %, 감점도 양수로)" });
  for (const qid of Object.keys(SCORE_DELTAS).filter((k) => k !== "rules" && k !== "age"))
    out.push({ id: `score.${qid}`, kind: "score", title: qid === "quiz" ? "패션 퀴즈" : Q_TEXT[qid]?.text || qid, when: `${qid} · 답에 따라 총 옷장 점수에 더하는 값(-20~20)` });
  // 주문내역 훈수(숨은 주소 /roast/orders): 한 탭에 화면·질문·결과 문장·점수를 모은다.
  const O = "[주문내역] ";
  for (const [k, name] of Object.entries(ORDER_SCREEN_NAME))
    out.push({ id: `orders.${k in ORDER_COMMON ? "common" : "screen"}.${k}`, kind: "orders", title: `${O}화면: ${name}`, when: "" });
  for (const q of ORDER_QUESTIONS.filter((d) => d.id.startsWith("o_")))
    out.push({ id: `questions.${q.id}`, kind: "orders", title: `${O}질문: ${Q_TEXT[q.id]?.text ?? q.id}`, when: `${q.id} · ${ORDER_QUESTION_COND[q.id] ?? ""}` });
  for (const [k, name] of Object.entries(ORDER_REPORT_NAME)) out.push({ id: `orders.report.${k}`, kind: "orders", title: `${O}결과: ${name}`, when: "" });
  out.push({ id: "score.orules", kind: "orders", title: `${O}점수 기준`, when: "기본 점수에서 더하고 빼는 기준(비율은 %, 금액은 만 원, 감점도 양수로). 퀴즈·밥과 옷·패셔너블 질문 증감은 '점수' 탭 값을 같이 씁니다." });
  out.push({ id: "score.oage", kind: "orders", title: `${O}나이에 맞는 주문`, when: "옷을 산 때 나이 구간별 기준(비율은 %, 감점도 양수로)" });
  for (const qid of Object.keys(ORDER_DELTAS))
    out.push({ id: `score.${qid}`, kind: "orders", title: `${O}점수: ${Q_TEXT[qid]?.text || qid}`, when: `${qid} · 답에 따라 총점에 더하는 값(-20~20)` });
  return out;
}

/** 고치는 단위 위치 → 사람이 읽는 칸 이름. 예: "lines.x.head" → "헤드라인(앞절 + 뒷절)" */
export function fieldLabel(key: string, optionLabel?: (qid: string, opt: string) => string | undefined): string {
  const p = key.split(".");
  if (p[0] === "screen") return p[1] === "OPENING" ? "문장들(하나 고름)" : "문장";
  if (p[0] === "common") return p[1] === "SECTION_STATUS" ? `${SECTION_NAME[p[2]] ?? p[2]} (하나 고름)` : "문장들(하나 고름)";
  if (p[0] === "lines") {
    if (p[2] === "say") return "대화 문장(하나 고름)";
    if (p[2] === "para") return "결과 본문(하나 고름)";
    if (p[2] === "head") return "헤드라인 앞절 + 뒷절(두 패턴을 이을 때 앞 패턴은 앞절, 뒤 패턴은 뒷절을 씀)";
  }
  if (p[0] === "score") {
    if (p[1] === "rules") return RULE_NAME[p[2]] ?? p[2];
    if (p[1] === "orules") return ORDER_RULE_NAME[p[2]] ?? p[2];
    if (p[1] === "oage") return `${AGE_BAND_NAME[p[2]] ?? p[2]}: ${ORDER_AGE_KEY_NAME[p[3]] ?? p[3]}`;
    if (p[1] === "age") return `${AGE_BAND_NAME[p[2]] ?? p[2]}: ${AGE_KEY_NAME[p[3]] ?? p[3]}`;
    if (p[1] === "fashionable_q") {
      const [tier, ...opt] = p[2].split("_");
      return `${{ high: "높음", mid: "중간", low: "낮음" }[tier] ?? tier} 구간 · ${optionLabel?.(p[1], opt.join("_")) ?? opt.join("_")}`;
    }
    if (p[1] === "quiz") return p[2] === "right" ? "맞혔을 때" : "틀렸을 때";
    return REACT_NAME[p[2]] ?? optionLabel?.(p[1], p[2]) ?? p[2];
  }
  if (p[0] === "orders") {
    const last = p[p.length - 1];
    if (p[1] === "report" && (p[2] === "HEADLINE")) return last === "b90" ? "90점 이상" : last === "b0" ? "10점 미만" : `${last.slice(1)}~${Number(last.slice(1)) + 9}점`;
    if (p[1] === "report" && p.length === 4) return `${ORDER_REPORT_SIDE[last] ?? last} (하나 고름)`;
    return p[1] === "screen" && !["LOADING", "OPENING"].includes(p[2]) ? "문장" : "문장들(하나 고름, LOADING은 차례로 번갈아 나옴)";
  }
  if (p[0] === "report") {
    const last = p[p.length - 1];
    if (p[1] === "layout") {
      if (p[2] === "order" || p[2] === "show") return LAYOUT_SECTION[last]?.name ?? last;
      if (p[2] === "point_order" || p[2] === "point_show") return LAYOUT_POINT[last]?.name ?? last;
      return LAYOUT_COUNT[last] ?? last;
    }
    if (p[1] === "diag") {
      if (last === "title") return "이름(관리용)";
      if (last === "fact") return "\"> \" 첫 문장에 들어가는 짧은 말";
      if (last === "factLow") return "\"> \" 첫 문장에 들어가는 짧은 말(반대쪽)";
      return last === "high" ? "뚜렷할 때(하나 고름, 첫 문장은 굵게)" : "반대쪽으로 뚜렷할 때(하나 고름, 첫 문장은 굵게)";
    }
    if (p[1] === "character") return last === "name" ? "캐릭터 이름(한 줄 정의 앞쪽)" : "한 줄 정의 뒤쪽·\"> \" 문장에 들어가는 말";
    if (p[1] === "HEADLINE" || p[1] === "TOTAL") return last === "b90" ? "90점 이상" : last === "b0" ? "10점 미만" : `${last.slice(1)}~${Number(last.slice(1)) + 9}점`;
    if (p[1] === "color") return `${COLOR_NAME[last] ?? last} (하나 고름)`;
    if (p[1] === "fit") return `${FIT_NAME[last] ?? last} (하나 고름)`;
    if (p[1] === "age") return `${AGE_REMARK_NAME[last] ?? last} (하나 고름)`;
    if (p[1] === "wallet") return `${WALLET_NAME[last] ?? last} (하나 고름)`;
    if (p[1] === "summary") return `${SUMMARY_NAME[last] ?? last} (하나 고름, "~이고"·"~인" 앞에 붙는 말)`;
    if (p[1] === "suspicious") return `${SUSPICIOUS_NAME[last] ?? last} (하나 고름)`;
    return "문장들(하나 고름)";
  }
  if (p[0] === "questions") {
    if (p[2] === "lead") return "앞 멘트(차례로 모두 말함)";
    if (p[2] === "text") return "질문";
    if (p[2] === "options") return `선택지: ${p[3]}`;
    const tiered = p[1] === "fashionable_q" && /^(high|mid|low)_/.exec(p[3] ?? "");
    const who = tiered
      ? `${{ high: "높음", mid: "중간", low: "낮음" }[tiered[1]]} 구간 · ${optionLabel?.(p[1], p[3].slice(tiered[0].length)) ?? p[3]}`
      : (REACT_NAME[p[3]] ?? optionLabel?.(p[1], p[3]) ?? p[3]);
    if (p[2] === "react") return `바로 반응: ${who}`;
    if (p[2] === "roast") return `결과 글: ${who}`;
  }
  return key;
}

import "server-only";
import { LINE_SECTION } from "./lines";
import { Q_TEXT, QUESTIONS } from "./questions";
import { QUIZ } from "./quiz";

/**
 * 관리자 문장 편집 화면과 검토 문서에 보여 주는 설명(언제 나오는지, 자리 이름). 분석 계산에는 쓰지 않는다.
 */

/** {자리} → 사람이 읽는 이름 */
export const VAR_LABEL: Record<string, string> = {
  n: "개수", pct: "비율%", brand: "브랜드", brands: "브랜드 수", catName: "대분류", sub: "세부분류", color: "색", colorful: "유채색 벌 수",
  country: "나라", tag: "스타일", fit: "핏", fitPhrase: "핏(알 때만 '○○ 핏 ')", familyName: "제품군", year: "연도", month: "월",
  most: "많은 계절", mostN: "많은 계절 벌 수", least: "적은 계절", leastN: "적은 계절 벌 수", avgWon: "평균 금액", priceWon: "금액", amountWon: "금액",
  ratio: "배수", name: "제품명(대화) 또는 호칭(인사)", oldest: "가장 오래된 브랜드", maxWon: "최고 구매가", traitText: "다른 점(색, 종류 등)",
  spendPct: "금액 비중%", countPct: "벌 수 비중%", count: "벌 수", total: "전체 개수",
};

export const SECTION_NAME: Record<string, string> = {
  size: "옷장 크기", acc: "모자·신발", color: "컬러", brand: "브랜드", repeat: "반복", season: "시즌", timing: "구매 시기", money: "금액", odd: "튀는 옷",
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
  month_binge: "한 달에 4벌 이상이고 월평균의 2배 이상",
  avg_price: "구매가 있는 옷 5벌 이상, 평균 8만 원 이상",
  top_item: "최고가가 가운데 가격의 3배 이상",
  category_spend: "한 대분류의 금액 비중이 벌 수 비중보다 15%p 이상 높음",
  subcategory_spend: "한 세부분류에 3벌 이상, 50만 원 이상, 쓴 돈의 25% 이상",
  brand_spend: "1위 브랜드 금액이 30% 이상",
  sale_luxury: "초고가 브랜드를 30만 원 미만에 산 옷 2벌 이상",
  cheap_brand_splurge: "저가·중저가 브랜드에서 30만 원 이상",
  odd_one: "옷장에서 드문 특성(12% 이하)이 2개 이상인 옷 한 벌",
};

export const QUESTION_COND: Record<string, string> = {
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
  quiz: "옷장에 퀴즈가 있는 명품·디자이너·일본 데님 브랜드가 하나라도 있을 때, 그 브랜드 문제",
  black_why: "검정 35% 이상",
  chroma_love: "한 유채색 25% 이상",
  category_why: "한 대분류 50% 이상",
  subcat_known: "같은 세부분류 4벌 이상이고 20% 이상",
  count_guess: "모자·신발 뺀 옷 20벌 이상. 선택지는 정답과 적당히 떨어진 숫자 셋(예: 40·60·90벌). 반응: 실제보다 적게 / 정답 / 많게",
  few_clothes: "옷 10~19벌",
  many_clothes_wear: "옷 60벌 이상",
  trend_source: "요즘 뜨는 브랜드 편중",
  timeless_q: "유행 안 타는 브랜드 편중",
  hype_alarm: "화제성 높은 브랜드 편중",
  country_q: "한 나라 60% 이상",
  mountain: "기능성 또는 아웃도어 편중",
  sports_q: "스포츠 브랜드 25% 이상",
  recent_reason: "최근 30일에 3벌 이상 구매",
  binge_month: "특정 달에 몰아 사기",
  season_gap: "계절 편중",
  top_item_q: "최고가가 가운데 가격의 3배 이상",
  sale_q: "초고가 브랜드를 30만 원 미만에 산 옷 2벌 이상",
  splurge_q: "저가·중저가 브랜드에서 30만 원 이상",
  subcat_spend_q: "한 세부분류에 3벌 이상, 50만 원 이상, 쓴 돈의 25% 이상",
  max_budget: "가격 적은 옷 5벌 이상이고 그중 가장 비싼 옷이 20만 원 이상. 반응: 고른 한도가 가장 비싼 옷보다 낮음 / 같거나 높음 / 한도 없음",
  fit_choice: "핏 아는 옷 중 한 핏 50% 이상",
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
  fashionable_q: "누구에게나",
};

export const REACT_NAME: Record<string, string> = {
  under: "실제보다 적게 고름", right: "정답", over: "실제보다 많게 고름",
  below: "한도가 최고가보다 낮음", within: "한도가 최고가 이상", nolimit: "한도 없음",
  most: "가장 비싼 옷", mid: "가운데", least: "셋 중 가장 싼 옷",
  spend: "금액 1위 브랜드", count: "벌 수 1위 브랜드", recent: "최근 구매 1위 브랜드", spend2: "금액 2위 브랜드",
};

export const COMMON_NAME: Record<string, string> = {
  SECTION_STATUS: "상태 문구(섹션 시작)",
  SCAN_OPEN: "분석 시작",
  NAME_GREETING: "호칭 부르며 시작",
  THINKING: "추임새(패턴 말하기 전)",
  MID_REMARKS: "중간 혼잣말(섹션 사이)",
  FEW_PATTERNS: "패턴이 적을 때",
  WRAP_UP: "마무리 전",
  CLOSING: "결과 맨 끝(2~3줄 고름)",
  PLAIN_HEADLINE: "패턴이 없을 때 헤드라인",
  PLAIN_PARA: "패턴이 없을 때 본문",
  HEAD_SINGLE_PREFIX: "헤드라인을 패턴 하나로 만들 때 앞말",
};

/** 편집 화면의 묶음(패턴 하나, 질문 하나 등) */
export interface TextGroupMeta {
  id: string;
  kind: "common" | "lines" | "questions" | "quiz";
  title: string;
  when: string;
}

export function textGroups(): TextGroupMeta[] {
  const out: TextGroupMeta[] = [];
  for (const [k, name] of Object.entries(COMMON_NAME)) out.push({ id: `common.${k}`, kind: "common", title: name, when: "" });
  for (const [id, sec] of Object.entries(LINE_SECTION))
    out.push({ id: `lines.${id}`, kind: "lines", title: `${id} (${SECTION_NAME[sec]})`, when: PATTERN_COND[id] ?? "" });
  for (const q of QUESTIONS)
    out.push({ id: `questions.${q.id}`, kind: "questions", title: Q_TEXT[q.id]?.text || (q.id === "quiz" ? "패션 퀴즈(앞 멘트)" : q.id), when: `${q.id} · ${QUESTION_COND[q.id] ?? ""}` });
  for (const q of QUIZ) out.push({ id: `quiz.${q.id}`, kind: "quiz", title: q.brand, when: `${q.id} · 정답: ${q.answer + 1}번` });
  return out;
}

/** 문장 위치 → 사람이 읽는 칸 이름. 예: "lines.x.head.0.1" → "헤드라인 뒷절 1" */
export function fieldLabel(key: string, optionLabel?: (qid: string, opt: string) => string | undefined): string {
  const p = key.split(".");
  const num = (s: string) => Number(s) + 1;
  if (p[0] === "common") return p[1] === "SECTION_STATUS" ? `${SECTION_NAME[p[2]] ?? p[2]} ${num(p[3])}` : `${num(p[2])}`;
  if (p[0] === "lines") {
    if (p[2] === "say") return `대화 ${num(p[3])}`;
    if (p[2] === "para") return `결과 본문 ${num(p[3])}`;
    if (p[2] === "head") return `헤드라인 ${p[4] === "0" ? "앞절" : "뒷절"} ${num(p[3])}`;
  }
  if (p[0] === "questions") {
    if (p[2] === "lead") return `앞 멘트 ${num(p[3])}`;
    if (p[2] === "text") return "질문";
    if (p[2] === "options") return `선택지: ${p[3]}`;
    if (p[2] === "react") return `반응(${REACT_NAME[p[3]] ?? optionLabel?.(p[1], p[3]) ?? p[3]}) ${num(p[4])}`;
  }
  if (p[0] === "quiz") {
    if (p[2] === "question") return "문제";
    if (p[2] === "options") {
      const q = QUIZ.find((x) => x.id === p[1]);
      return `선택지 ${num(p[3])}${q && q.answer === Number(p[3]) ? " (정답)" : ""}`;
    }
    if (p[2] === "correct") return `맞혔을 때 ${num(p[3])}`;
    if (p[2] === "wrong") return `틀렸을 때 ${num(p[3])}`;
  }
  return key;
}

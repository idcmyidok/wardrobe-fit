import "server-only";
import { BRANDS } from "../brands";
import { DEFAULT_CONFIG, REPORT_BLOCKS, TALK_BLOCKS, type FlConfig } from "./config";
import { AXIS_KEYS, AXIS_NAME, BASE_WEIGHTS, GROUP_NAME, RULES, TYPE_DEFS } from "./types";
import { VARS, type VarArea } from "./store";

/**
 * 관리자 "훈수 설계" 화면에 넘길 설명 자료. 문장마다 "언제 나오는지"와 쓸 수 있는 자리를 붙인다.
 * 화면(클라이언트)은 server-only 파일을 못 읽으므로 여기서 직렬화할 수 있는 값으로 만든다.
 */

const VAR_LABEL: Record<string, string> = {
  n: "옷(구매) 수",
  name: "부를 이름",
  type: "유형 이름",
  score: "점수",
  grade: "보너스 등급(A·B)",
  points: "보너스 점수",
  brand: "대표 브랜드",
  brandPct: "대표 브랜드 비율(%)",
  brandN: "대표 브랜드 벌 수",
  brandCount: "브랜드 가짓수",
  orders: "주문 건수",
  events: "반품·교환·취소 수",
  axis: "항목 이름",
  achroPct: "무채색 비율",
  chromaPct: "유채색 비율",
  overPct: "오버핏 비율",
  slimPct: "슬림핏 비율",
  regularPct: "레귤러핏 비율",
  widePct: "와이드 하의 비율",
  outerPct: "아우터 비율",
  shoesPct: "신발 비율",
  hatPct: "모자 비율",
  spaPct: "SPA 비율",
  massPct: "대중·유행 브랜드 비율",
  lowPct: "저가 브랜드 비율",
  midPct: "중가 브랜드 비율",
  highPct: "고가 브랜드 비율",
  designerPct: "디자이너·럭셔리 비율",
  cultPct: "마니아 브랜드 비율",
  usedPct: "편집숍·중고 구매 비율",
  heritagePct: "헤리티지 브랜드 비율",
  popularPct: "무신사 인기 브랜드 비율",
  sportsPct: "스포츠 브랜드 비율",
  streetPct: "스트릿 브랜드 비율",
  domesticPct: "국내 중가 브랜드 비율",
  minimalPct: "미니멀 태그 비율",
  logoPct: "로고·그래픽 옷 비율",
  workPct: "워크웨어 태그 비율",
  denimPct: "데님 비율",
  outdoorPct: "아웃도어 비율",
  preppyPct: "프레피 태그 비율",
  y2kPct: "Y2K·레트로 태그 비율",
  femPct: "페미닌 태그 비율",
  recentPct: "최근 1년 구매 비율",
  salePct: "할인 구매 비율",
  seasonName: "가장 몰린 계절",
  seasonPct: "그 계절 전용 비율",
  topTag: "가장 많은 스타일 태그",
  color: "색 이름",
  band: "밴드 이름",
  wrong: "오답 노래",
  wrongBy: "오답 노래의 가수",
  priceWon: "가격",
  count: "개수",
  tier: "점수 구간",
};

const varsOf = (area: VarArea) => VARS[area].map((key) => ({ key, label: VAR_LABEL[key] ?? key }));

/** 공통 문장이 쓰이는 곳 */
const COMMON_WHERE: Record<keyof FlConfig["common"], { where: string; block: string }> = {
  NAME_GREETING: { where: "대화 맨 처음, 이름을 적었을 때 부르는 말", block: "talk:greet" },
  SCAN_OPEN: { where: "옷을 다 훑은 직후 첫마디", block: "talk:scan" },
  TYPE_STATUS: { where: "유형 이야기마다 앞에 붙는 상태 줄", block: "talk:types" },
  NO_TYPE: { where: "뚜렷한 유형이 하나도 없을 때(대화·결과 모두)", block: "talk:types" },
  AXIS_STATUS: { where: "항목 칭찬·조언 앞의 상태 줄", block: "talk:axes" },
  BONUS_SAY: { where: "몰입 보너스를 받았을 때 한마디", block: "talk:bonus" },
  WRAP_UP: { where: "질문이 끝나고 결과를 쓰기 직전", block: "talk:wrap" },
  QUIZ_CORRECT: { where: "브랜드 퀴즈를 맞혔을 때 반응 첫마디", block: "talk:questions" },
  QUIZ_WRONG: { where: "브랜드 퀴즈를 틀렸을 때 반응 첫마디", block: "talk:questions" },
  QUIZ_ROAST_RIGHT: { where: "결과 페이지: 퀴즈를 맞혔을 때 문단", block: "report:points" },
  QUIZ_ROAST_WRONG: { where: "결과 페이지: 퀴즈를 틀렸을 때 문단", block: "report:points" },
  LOW_DATA: { where: "결과 페이지: 자료가 적을 때 안내", block: "report:notes" },
  ORDERS_NOTE: { where: "결과 페이지: 주문내역 훈수일 때 기준 안내", block: "report:notes" },
  CLOSING: { where: "결과 페이지 맨 끝 마무리(2~3개를 섞어 씀)", block: "report:end" },
};

const SPECIAL_WHEN: Record<string, { name: string; when: string }> = {
  quiz: { name: "브랜드 퀴즈", when: "가진 브랜드 중 퀴즈가 있는 브랜드가 있으면(문제는 '퀴즈' 탭)" },
  band_quiz: { name: "밴드 퀴즈", when: "밴드 굿즈 옷이 있으면(곡 목록은 코드)" },
  three_500: { name: "언더아머 3대 500", when: "언더아머 옷이 있으면" },
  jjanggu_q: { name: "짱구 옷장", when: "같은 옷(분류·이름·색)이 3벌 이상이면" },
  chimchak_q: { name: "침착맨", when: "침착맨·얼렁뚱땅 상점 옷이 있으면" },
  fashionable_q: { name: "스스로 패셔너블한가요?", when: "항상 마지막 질문. 반응은 점수 구간(높음·중간·낮음) × 답" },
};

/** 화면 문구 설명(없는 칸은 키 이름만) */
const SCREEN_WHERE: Record<string, string> = {
  INTRO: "첫 화면 소개 글",
  CREDIT: "소개 아래 작은 글",
  START_LABEL: "시작 버튼",
  PICK_ASK: "옷장/주문내역 고르기 질문",
  PICK_CLOSET: "옷장으로 훈수 버튼",
  PICK_ORDERS: "주문내역으로 훈수 버튼",
  CRITERIA_LABEL: "평가 기준 펼치기 제목",
  CRITERIA: "평가 기준 설명",
  START_NOTE: "시작 전 안내",
  ASK_NAME: "이름·나이 묻기",
  NAME_HINT: "이름 칸 안내",
  AGE_HINT: "나이 칸 안내",
  CONSENT: "동의 선언문",
  CONSENT_WARN: "동의 안 했을 때 경고",
  READY_Q: "모든 옷을 넣었는지 묻기",
  TOO_FEW: "옷이 모자랄 때",
  OPENING: "분석 시작 직후 번갈아 나오는 말",
  WRITING: "결과 쓰는 중",
  DISCLAIMER: "결과 아래 주의 문구",
  CHANGED: "옷장이 바뀐 뒤 다시 할 때",
  RETRY_LABEL: "다시 하기 버튼",
  PASTE_ASK: "주문내역 붙여 넣기 요청",
  PASTE_GUIDE: "붙여 넣기 방법",
  PASTE_EMPTY: "주문을 못 읽었을 때",
  PASTE_LABEL: "붙여 넣은 뒤 시작 버튼",
  DAILY_NOTICE: "하루 한 번 안내",
  DAILY_USED: "오늘 이미 했을 때",
  LOADING_WAIT: "상품 읽는 동안 안내",
  LOADING: "상품 읽는 동안 번갈아 나오는 말",
  LOADING_FAIL: "상품을 다 못 읽었을 때",
};

export function designerData(C: FlConfig, editedSections: string[]) {
  return {
    config: C,
    defaults: DEFAULT_CONFIG,
    edited: editedSections,
    meta: {
      axes: AXIS_KEYS.map((k) => ({ key: k, closet: AXIS_NAME[k].closet, orders: AXIS_NAME[k].orders, base: { closet: BASE_WEIGHTS.closet[k], orders: BASE_WEIGHTS.orders[k] } })),
      groups: Object.entries(GROUP_NAME).map(([id, name]) => ({ id, name })),
      types: TYPE_DEFS.map((t) => ({ id: t.id, group: t.group, mode: t.mode, priority: t.priority })),
      rules: Object.entries(RULES).map(([id, text]) => ({ id, text })),
      talkBlocks: TALK_BLOCKS,
      reportBlocks: REPORT_BLOCKS,
      common: COMMON_WHERE,
      special: SPECIAL_WHEN,
      screen: SCREEN_WHERE,
      vars: { common: varsOf("common"), type: varsOf("type"), axis: varsOf("axis"), special: varsOf("special"), quiz: varsOf("quiz"), band: varsOf("band") },
      brands: BRANDS.map((b) => b.name).sort((a, b) => a.localeCompare(b)),
    },
  };
}

export type DesignerData = ReturnType<typeof designerData>;

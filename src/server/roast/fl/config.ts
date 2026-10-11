import "server-only";
import { ROAST_COPY } from "@/lib/roast/copy";
import { QUIZ, type QuizEntry } from "../quiz";
import type { Mode } from "./feat";
import { DEFAULT_ASKS, type AskText } from "./asks";
import { DEFAULT_BRAND_TEXT, type BrandText } from "./brand-talk";
import { ORDER_SCREEN } from "./screen";
import { SPECIAL_Q_TEXT, type QuestionText } from "./special-texts";
import { BASE_WEIGHTS, TYPE_DEFS, type AxisKey, type Grade, type RuleId, type TypeLines } from "./types";

/**
 * 훈수 설계 전체(관리자 화면에서 고치는 값). 기본값은 여기와 types.ts에 있고,
 * 고친 값만 roast_text_edits의 "fl.*" 행에 JSON으로 저장해 기본값 위에 덮어쓴다(store.ts).
 * 구조(대화·결과 순서, 켜기/끄기)와 문장, 숫자(비중·보너스·기준)를 모두 여기서 고친다.
 */

export interface TypeConf {
  name: string;
  who: string;
  how: string;
  grade: Grade;
  enabled: boolean;
  /** 이 유형만의 판정 문턱(기본 tune.threshold) */
  threshold: number | null;
  w: Partial<Record<AxisKey, number>>;
  rules: RuleId[];
  lines: TypeLines;
}

export interface Block {
  id: string;
  on: boolean;
}

export interface FlConfig {
  types: Record<string, TypeConf>;
  tune: {
    /** 이 적합도 이상이면 뚜렷한 유형 */
    threshold: number;
    maxTypes: number;
    /** 유형이 여럿일 때 적합도 순 섞는 비율(%) */
    blend: number[];
    /** 표시 점수 = floor + 원점수 × scale */
    floor: number;
    scale: number;
    /** 곡선(1이면 직선). 클수록 중간 점수를 더 낮춘다: floor + 100×scale×(원점수/100)^curve */
    curve: number;
    /** 감점 상한: 흔한 옷장(SPA·대중·인기 브랜드 쏠림), 핏 실패(너무 크거나 작은 옷) */
    penalty: { common: number; fit: number };
    bonus: Record<Mode, { A: number; B: number }>;
    weights: Record<Mode, Record<AxisKey, number>>;
    /** 브랜드 자료가 있는 옷 비율이 이 값 미만이면 안목 비중을 절반으로 */
    knownMin: number;
    /** 주문내역 구매가 이 값 미만이면 구매 규율 비중 절반 + "자료가 적어요" */
    ordersMin: number;
    /** 대화에서 이야기할 유형 수 / 유형당 문장 수 */
    talkTypes: number;
    talkLines: number;
    /** 패셔너블 질문 반응 구간 경계(표시 점수) */
    tierHigh: number;
    tierLow: number;
    /** 퀴즈 정답·오답이 원점수에 더하는 값 */
    quizRight: number;
    quizWrong: number;
    /** 점수 질문 최대 수 */
    maxAsks: number;
  };
  /** 브랜드 분석 문장 */
  brands: BrandText;
  /** 점수 질문(상황별로 묻고 답에 따라 점수 증감) */
  asks: Record<string, AskText>;
  /** 항목별 문장: 점수 구간(low<0.45, mid<0.72, high)에 따라 하나 고름 */
  axisLines: Record<AxisKey, { low: string[]; mid: string[]; high: string[]; tip: string[]; praise: string[] }>;
  /** 등급: 표시 점수가 max 이하인 첫 구간 */
  bands: { max: number; name: string; say: string[] }[];
  /** 대화 구조: 순서와 켜기 */
  talk: Block[];
  /** 결과 페이지 구조: 순서와 켜기 */
  report: Block[];
  /** 남겨 둔 특수 질문의 문구(퀴즈·밴드·언더아머·침착맨·짱구·패셔너블) */
  special: Record<string, QuestionText>;
  /** 패션 퀴즈(브랜드별 문제). 새 퀴즈 id는 "c-"로 시작 */
  quiz: Record<string, QuizEntry>;
  /** 화면 문구(옷장 / 주문내역 전용) */
  screen: Record<string, string | string[]>;
  orderScreen: Record<string, string | string[]>;
  common: {
    SCAN_OPEN: string[];
    NAME_GREETING: string[];
    TYPE_STATUS: string[];
    NO_TYPE: string[];
    AXIS_STATUS: string[];
    WRAP_UP: string[];
    CLOSING: string[];
    LOW_DATA: string[];
    ORDERS_NOTE: string[];
    BONUS_SAY: string[];
    QUIZ_CORRECT: string[];
    QUIZ_WRONG: string[];
    QUIZ_ROAST_RIGHT: string[];
    QUIZ_ROAST_WRONG: string[];
  };
}

/** 대화 블록 id → 이름·설명(관리자 화면) */
export const TALK_BLOCKS: Record<string, { name: string; hint: string }> = {
  greet: { name: "인사·이름", hint: "이름을 넣었을 때 가끔 부릅니다" },
  scan: { name: "훑어보기 한 줄", hint: "옷 몇 벌을 훑었는지 말합니다" },
  types: { name: "유형 이야기", hint: "붙은 유형마다 근거를 짚는 말을 합니다(유형 수·문장 수는 숫자 설정)" },
  axes: { name: "항목 칭찬·조언", hint: "가장 높은 항목 칭찬, 가장 낮은 항목 조언" },
  bonus: { name: "몰입 보너스 한마디", hint: "패션 몰입 보너스를 받았을 때만" },
  brands: { name: "브랜드 분석", hint: "많이 가진 브랜드 한두 개를 짚고, 브랜드 구성 한마디" },
  questions: { name: "질문·퀴즈", hint: "브랜드 퀴즈·밴드·언더아머·침착맨·짱구(재미 질문) → 점수 질문 → 마지막 '패셔너블한가요?'" },
  wrap: { name: "마무리 말", hint: "결과를 쓰기 전 한마디" },
};
export const REPORT_BLOCKS: Record<string, { name: string; hint: string }> = {
  types: { name: "패션 유형 목록", hint: "붙은 유형 이름과 비율" },
  points: { name: "유형별 진단", hint: "유형마다 한 문단(근거·칭찬·조언)과 질문 답 문단" },
  brands: { name: "브랜드 분석", hint: "많이 가진 브랜드 최대 3개와 브랜드 구성" },
  axes: { name: "항목별 점수", hint: "다섯 항목의 해석 한 줄씩" },
  notes: { name: "기준 안내", hint: "자료가 적을 때, 무신사 구매 기준 안내 등" },
};

const AX = (low: string[], mid: string[], high: string[], tip: string[], praise: string[]) => ({ low, mid, high, tip, praise });

export const DEFAULT_CONFIG: FlConfig = {
  types: Object.fromEntries(
    TYPE_DEFS.map((t) => [
      t.id,
      { name: t.name, who: t.who, how: t.how, grade: t.grade, enabled: true, threshold: null, w: { ...t.w }, rules: [...t.rules], lines: structuredClone(t.lines) } satisfies TypeConf,
    ]),
  ),
  tune: {
    threshold: 0.6,
    maxTypes: 4,
    blend: [40, 30, 20, 10],
    floor: 31,
    scale: 0.69,
    curve: 1.35,
    penalty: { common: 8, fit: 4 },
    bonus: { closet: { A: 20, B: 10 }, orders: { A: 12, B: 6 } },
    weights: structuredClone(BASE_WEIGHTS),
    knownMin: 0.5,
    ordersMin: 15,
    talkTypes: 3,
    talkLines: 2,
    tierHigh: 75,
    tierLow: 55,
    quizRight: 1,
    quizWrong: 0,
    maxAsks: 3,
  },
  brands: structuredClone(DEFAULT_BRAND_TEXT),
  asks: structuredClone(DEFAULT_ASKS),
  axisLines: {
    c: AX(
      ["{axis|이} {score}점이네요. 옷장이 아니라 단체 바자회 수거함인 줄 알았습니다.", "{axis|이} 흩어져도 너무 흩어졌네요. 옷마다 산 사람이 다 다른 것 같습니다."],
      ["{axis|은} 그럭저럭입니다. 방향은 있는데 본인도 확신은 없으시죠?", "방향이 보이긴 합니다. 안개 너머로요. {axis|은} 딱 중간이네요."],
      ["{axis|이} 확실하네요. 이 정도면 고집이라고 불러도 되겠습니다.", "분위기가 일관됩니다. 같은 옷만 사신 건 아니라고 믿어 볼게요. {axis|은} 인정입니다."],
      ["제일 아끼는 옷 세 벌의 공통점부터 찾으시죠. 다음 쇼핑은 그거 기준으로만 하시면 됩니다. 어렵지 않죠?"],
      ["스타일 방향은 분명하네요. 그걸 다른 데서도 좀 발휘하시면 좋겠습니다."],
    ),
    t: AX(
      ["{axis|이} {score}점입니다. 브랜드는 할인율 보고 고르셨죠? 다 티 납니다.", "{axis|이} 아쉽네요. 장바구니에 담긴 순서대로 결제하신 것 같습니다."],
      ["{axis|은} 평균입니다. 실패는 안 하셨는데 기억에 남을 것도 없네요.", "{axis|은} 중간입니다. 한두 개만 바꾸면 되는데, 그 한두 개를 안 바꾸시더라고요."],
      ["{axis|이} 좋네요. 브랜드 보는 눈은 있으시군요. 눈만요.", "브랜드 선택은 탄탄합니다. {axis} 덕에 옷장이 겨우 체면을 지키네요."],
      ["아우터나 신발 하나만 한 단계 좋은 브랜드로 바꾸세요. 전부 바꾸라는 게 아니니 겁먹지 마시고요."],
      ["브랜드 고르는 눈은 확실히 있네요. 아쉽게도 그 눈이 다른 데선 쉬는 것 같지만요."],
    ),
    b: AX(
      ["상의만 잔뜩 사시고 하의는 어디 두셨나요? {axis|이} {score}점이네요.", "빠진 품목이 훤히 보입니다. 계절 하나는 그냥 버티실 생각이시죠? {axis|이} 낮습니다."],
      ["{axis|은} 평균입니다. 큰 구멍은 없는데, 작은 구멍은 여럿 보이네요.", "구성은 무난합니다. 무난함 말고는 딱히 드릴 말씀이 없네요. {axis|은} 중간입니다."],
      ["{axis|이} 좋네요. 필요한 건 다 있습니다. 필요 없는 것도 좀 있지만요.", "품목과 계절이 고르게 채워졌습니다. 쇼핑 리스트라도 써 두셨나 봐요. {axis|은} 인정합니다."],
      ["제일 적은 품목 하나만 채우세요. 그것만 해도 코디가 확 늘어납니다. 같은 걸 또 사지 마시고요."],
      ["옷장 구성이 고르네요. 관리는 하시는 분이었군요, 의외로."],
    ),
    f: AX(
      ["사이즈표는 장식인 줄 아셨나 봐요. {axis|이} {score}점이네요.", "사이즈 실패가 줄줄이 보입니다. 반품 버튼과 많이 친해지셨겠어요. {axis|이} 약합니다."],
      ["{axis|은} 중간입니다. 대체로 맞는데, 몇 벌은 '언젠간 맞겠지' 하고 사셨죠?", "핏은 무난합니다. 감으로 사신 것치곤 선방하셨네요. {axis|은} 평균입니다."],
      ["{axis|이} 아주 좋네요. 사이즈표를 읽는 분이 아직 계셨군요.", "핏이 정확합니다. 이것까지 틀렸으면 정말 드릴 말이 없을 뻔했네요. {axis|은} 강점입니다."],
      ["산 옷 실측을 적어 두세요. 그러면 다음엔 감 말고 숫자로 고르실 수 있습니다. 놀랍죠?"],
      ["핏 맞추는 감각은 좋네요. 다른 감각도 이만큼만 따라와 주면 좋겠습니다."],
    ),
    x: AX(
      ["{axis|이} {score}점입니다. 마네킹에 걸린 그대로 사 오신 것 같네요.", "{axis|이} 약합니다. 밋밋하거나, 같은 실패를 꾸준히 반복하시거나요. 성실하시네요."],
      ["{axis|은} 중간입니다. 나쁘진 않은데, 내일이면 기억 안 날 옷장이네요.", "{axis|은} 평균입니다. 조금 더 밀어도 됩니다. 아무도 안 말려요."],
      ["{axis|이} 좋네요. 깊이가 느껴집니다. 옷장에 거의 도를 닦으셨네요.", "개성이 분명합니다. 호불호는 갈리겠지만 {axis|은} 확실히 눈에 띄네요."],
      ["한 계열만 깊게 파 보세요. 이것저것 찔러보는 건 개성이 아니라 우유부단입니다."],
      ["깊이 있는 취향이 보이네요. 그 깊이로 빠져서 헤어나오지 못하실까 걱정입니다."],
    ),
  },
  bands: [
    { max: 45, name: "취향 탐색 중", say: ["{score}점입니다. 취향을 탐색 중이시라는데, 아직 출발도 안 하신 것 같네요. 바닥이니 올라갈 일만 남았습니다.", "{score}점이요. 옷장이 길을 잃었습니다. 지도 앱이라도 깔아 드리고 싶네요."] },
    { max: 60, name: "기본기 단단함", say: ["{score}점, 기본기는 있습니다. 기본기'만' 있다는 게 문제지만요.", "{score}점입니다. 무난하네요. 칭찬 같죠? 반은 칭찬 아닙니다."] },
    { max: 75, name: "감각 있는 편", say: ["{score}점, 감각은 있으시네요. 놀릴 거리가 줄어서 제가 좀 섭섭합니다.", "{score}점입니다. 옷 좀 입는다는 말 들어 보셨겠죠. 그 말 너무 믿지는 마시고요."] },
    { max: 90, name: "안목 뚜렷", say: ["{score}점, 안목이 뚜렷합니다. 인정하기 싫은데 인정합니다. 많이 분하네요.", "{score}점입니다. 취향이 확실하시군요. 놀릴 구석을 찾느라 제가 고생 좀 했습니다."] },
    { max: 100, name: "완성형", say: ["{score}점, 완성형입니다. 놀릴 데를 끝내 못 찾았습니다. 오늘은 제가 졌네요.", "{score}점입니다. 패션에 진심인 분의 옷장이군요. 박수는 쳐 드릴게요. 작게요."] },
  ],
  talk: [
    { id: "greet", on: true },
    { id: "scan", on: true },
    { id: "types", on: true },
    { id: "brands", on: true },
    { id: "axes", on: true },
    { id: "bonus", on: true },
    { id: "questions", on: true },
    { id: "wrap", on: true },
  ],
  report: [
    { id: "types", on: true },
    { id: "points", on: true },
    { id: "brands", on: true },
    { id: "axes", on: true },
    { id: "notes", on: true },
  ],
  special: structuredClone(SPECIAL_Q_TEXT),
  quiz: structuredClone(QUIZ),
  screen: structuredClone(ROAST_COPY),
  orderScreen: structuredClone(ORDER_SCREEN),
  common: {
    SCAN_OPEN: ["옷 {n}벌, 다 훑어봤습니다. 마음의 준비는 되셨죠?", "{n}벌 확인했습니다. 어떤 분인지 벌써 감이 오네요. 좋은 감은 아니고요."],
    NAME_GREETING: ["{name}님, 옷장 잘 봤습니다. 네, 정말 잘 봤습니다.", "{name}님이시군요. 옷장 보고 나서 인사드려도 늦지 않겠네요."],
    TYPE_STATUS: ["{type} 쪽부터 짚어 보겠습니다. 할 말이 좀 많네요.", "먼저 {type} 얘기입니다. 본인도 알고 계셨죠?", "{type} 얘기를 안 하고 넘어갈 수가 없네요."],
    NO_TYPE: ["한쪽으로 몰린 데가 없네요. 좋게 말하면 무난, 솔직히 말하면 무색무취입니다.", "딱 이 유형이라고 하기엔 이것저것 다 섞였네요. 뷔페 접시 같은 옷장입니다."],
    AXIS_STATUS: ["이제 항목별로 하나씩 뜯어보겠습니다.", "점수 깎아 먹은 범인을 찾아보죠."],
    WRAP_UP: ["분석 끝났습니다. 결과 쓰는 동안 옷장 문이라도 닫아 두시죠.", "다 봤습니다. 순화해서 정리하는 데 시간이 좀 걸리네요."],
    CLOSING: ["옷은 사는 것보다 입는 게 중요합니다. 장바구니 말고 옷장을 먼저 여시죠.", "점수는 참고만 하세요. 신경 쓰이신다면 다음 결제 버튼 앞에서 세 번만 더 생각하시면 됩니다.", "다음에 또 오세요. 달라진 게 없으면 그때도 똑같이 말씀드리겠습니다."],
    LOW_DATA: ["자료가 너무 적어서 정확도가 낮습니다. 숨기신 옷이 있는 건 아니죠? 있는 만큼은 봤습니다."],
    ORDERS_NOTE: ["무신사에서 산 내역 기준입니다. 다른 데서 산 옷이나 이미 처분한 흑역사는 안 보이니 안심하세요."],
    BONUS_SAY: ["{grade}급 유형 보너스 {points}점 받으셨습니다. 패션에 진심인 건 알겠네요. 결과물은 별개고요.", "몰입 보너스 {points}점입니다. 이건 인정해 드려야겠네요. 마지못해서요."],
    QUIZ_CORRECT: ["정답입니다.", "맞았네요."],
    QUIZ_WRONG: ["아쉽네요.", "틀렸습니다."],
    QUIZ_ROAST_RIGHT: ["{brand} 퀴즈를 맞히셨네요. 옷만 사신 게 아니라 상세페이지도 읽으셨군요.", "{brand} 문제는 정답입니다. 아는 건 많으시네요. 입는 건 다음에 얘기하고요."],
    QUIZ_ROAST_WRONG: ["{brand} 퀴즈는 틀리셨습니다. 그렇게 사 놓고 모르시는 건 좀 서운하네요.", "{brand} 문제는 오답입니다. 결제는 빠르신데 공부는 느리시네요."],
  },
};

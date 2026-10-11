import "server-only";
import { ROAST_COPY } from "@/lib/roast/copy";
import { QUIZ, type QuizEntry } from "../quiz";
import type { Mode } from "./feat";
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
  };
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
  questions: { name: "질문·퀴즈", hint: "브랜드 퀴즈, 밴드, 언더아머, 침착맨, 짱구 등 특수 질문" },
  wrap: { name: "마무리 말", hint: "결과를 쓰기 전 한마디" },
};
export const REPORT_BLOCKS: Record<string, { name: string; hint: string }> = {
  types: { name: "패션 유형 목록", hint: "붙은 유형 이름과 비율" },
  points: { name: "유형별 진단", hint: "유형마다 한 문단(근거·칭찬·조언)" },
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
  },
  axisLines: {
    c: AX(
      ["스타일이 한 방향으로 모이지 않았습니다. {axis}이 약한 편이네요.", "{axis}이 흩어져 있어요. 옷마다 다른 사람이 산 것 같습니다."],
      ["{axis}은 무난합니다. 방향은 있는데 조금 더 선명해도 되겠네요.", "방향이 어렴풋이 보입니다. {axis}은 중간 정도예요."],
      ["{axis}이 확실합니다. 어떤 옷을 입고 싶은지 아는 사람의 선택이네요.", "분위기가 일관됩니다. {axis}이 이 옷장의 힘이에요."],
      ["가장 마음에 드는 옷 세 벌의 공통점을 기준으로 다음 쇼핑을 해 보세요."],
      ["스타일 방향이 분명한 건 큰 장점입니다."],
    ),
    t: AX(
      ["브랜드를 고르는 눈은 아직 다듬을 여지가 큽니다. {axis}이 낮게 나왔어요.", "{axis}이 아쉽습니다. 가격 대비 선택에 힘이 안 실렸네요."],
      ["{axis}은 평균적입니다. 무난하게 잘 골랐습니다.", "{axis}은 중간입니다. 한두 개만 더 올리면 확 달라지겠어요."],
      ["{axis}이 좋습니다. 브랜드를 보는 눈이 있네요.", "브랜드 선택이 탄탄합니다. {axis}이 이 옷장의 중심이에요."],
      ["아우터나 신발 한 가지를 한 단계 좋은 브랜드로 바꿔 보세요."],
      ["브랜드를 고르는 눈은 확실히 있습니다."],
    ),
    b: AX(
      ["옷의 구성이 한쪽으로 쏠렸습니다. {axis}이 약합니다.", "빠진 품목이 보입니다. {axis}이 낮게 나왔어요."],
      ["{axis}은 평균입니다. 큰 구멍은 없습니다.", "구성은 무난합니다. {axis}은 중간 정도예요."],
      ["{axis}이 좋습니다. 필요한 건 다 갖췄네요.", "품목과 계절이 고르게 채워졌습니다. {axis}이 훌륭해요."],
      ["가장 적은 품목 하나만 채워도 코디 조합이 눈에 띄게 늘어납니다."],
      ["옷장 구성이 고르다는 건 관리가 잘 됐다는 뜻입니다."],
    ),
    f: AX(
      ["맞지 않는 옷이 꽤 있습니다. {axis}이 낮게 나왔어요.", "사이즈 실패가 눈에 띕니다. {axis}이 약한 편입니다."],
      ["{axis}은 중간입니다. 대체로 맞는데 몇 벌이 아쉽네요.", "핏은 무난합니다. {axis}은 평균 정도예요."],
      ["{axis}이 아주 좋습니다. 옷이 몸에 맞게 입혀져 있네요.", "핏이 정확합니다. {axis}이 이 옷장의 강점이에요."],
      ["산 옷의 실측을 입력해 두면 다음 사이즈 선택이 훨씬 쉬워집니다."],
      ["핏을 맞춰 입는 감각이 좋습니다."],
    ),
    x: AX(
      ["개성이나 습관 면에서 아쉬운 점이 있습니다. {axis}이 낮게 나왔어요.", "{axis}이 약한 편입니다. 밋밋하거나 같은 실패가 반복돼요."],
      ["{axis}은 중간입니다. 나쁘진 않은데 인상이 약해요.", "{axis}은 평균입니다. 조금 더 밀어도 됩니다."],
      ["{axis}이 좋습니다. 깊이가 느껴지는 옷장이에요.", "개성이 분명합니다. {axis}이 눈에 띄네요."],
      ["한 계열을 깊게 파 보세요. 깊이가 개성이 됩니다."],
      ["깊이 있는 취향이 보입니다."],
    ),
  },
  bands: [
    { max: 45, name: "취향 탐색 중", say: ["{score}점, 취향 탐색 중입니다. 시작이 이 정도면 올라갈 일만 남았네요.", "{score}점입니다. 옷장은 이제 막 방향을 찾는 중이네요. 그래도 가능성은 보입니다."] },
    { max: 60, name: "기본기 단단함", say: ["{score}점, 기본기가 단단합니다. 큰 실수는 없는 옷장이네요.", "{score}점입니다. 무난하게 잘 입는 쪽이에요. 한 끗만 더하면 달라지겠습니다."] },
    { max: 75, name: "감각 있는 편", say: ["{score}점, 감각 있는 편입니다. 솔직히 인정할 부분이 많네요.", "{score}점입니다. 옷 좀 입는다는 말, 들어 보셨겠는데요."] },
    { max: 90, name: "안목 뚜렷", say: ["{score}점, 안목이 뚜렷합니다. 꽤 분한데 인정합니다.", "{score}점입니다. 이 옷장은 취향이 확실하군요. 제가 놀릴 구석이 별로 없네요."] },
    { max: 100, name: "완성형", say: ["{score}점, 완성형입니다. 놀릴 데를 못 찾았습니다. 분하네요.", "{score}점입니다. 패션을 진짜 좋아하는 사람의 옷장이군요. 졌습니다."] },
  ],
  talk: [
    { id: "greet", on: true },
    { id: "scan", on: true },
    { id: "types", on: true },
    { id: "axes", on: true },
    { id: "bonus", on: true },
    { id: "questions", on: true },
    { id: "wrap", on: true },
  ],
  report: [
    { id: "types", on: true },
    { id: "points", on: true },
    { id: "axes", on: true },
    { id: "notes", on: true },
  ],
  special: structuredClone(SPECIAL_Q_TEXT),
  quiz: structuredClone(QUIZ),
  screen: structuredClone(ROAST_COPY),
  orderScreen: structuredClone(ORDER_SCREEN),
  common: {
    SCAN_OPEN: ["옷 {n}벌, 훑어봤습니다. 이제 말씀드리죠.", "{n}벌 확인했습니다. 어떤 사람인지 대충 감이 오네요."],
    NAME_GREETING: ["{name}님, 옷장 잘 봤습니다.", "{name}님이군요. 옷장부터 보겠습니다."],
    TYPE_STATUS: ["{type} 쪽부터 보겠습니다.", "먼저 {type}에 해당하는 부분입니다.", "{type} 얘기 좀 해야겠네요."],
    NO_TYPE: ["특별히 한쪽으로 몰린 옷장은 아니네요. 무난한 편입니다.", "딱 이 유형이라고 하기엔 고르게 섞여 있습니다."],
    AXIS_STATUS: ["이제 항목별로 보겠습니다.", "점수를 가른 항목을 짚어 보죠."],
    WRAP_UP: ["분석을 마칩니다. 결과를 쓰고 있어요.", "다 봤습니다. 결과를 정리하겠습니다."],
    CLOSING: ["옷은 사는 것보다 입는 게 중요합니다. 오늘은 일단 입고 나가 보시죠.", "점수는 참고만 하세요. 그래도 신경 쓰이면 다음 쇼핑을 신중하게 하시면 됩니다.", "다음에 다시 오시면 얼마나 달라졌는지 봐 드리겠습니다."],
    LOW_DATA: ["자료가 적어서 정확도가 낮습니다. 그래도 지금 있는 만큼은 봤어요."],
    ORDERS_NOTE: ["무신사에서 산 내역 기준입니다. 무신사 밖에서 산 옷이나 이미 처분한 옷은 보이지 않아요."],
    BONUS_SAY: ["{grade}급 유형 보너스 {points}점을 받았습니다. 패션을 진짜 좋아하는 티가 납니다.", "몰입 보너스 {points}점. 이건 인정할 수밖에 없네요."],
    QUIZ_CORRECT: ["정답입니다.", "맞았네요."],
    QUIZ_WRONG: ["아쉽네요.", "틀렸습니다."],
    QUIZ_ROAST_RIGHT: ["{brand} 퀴즈를 맞히셨습니다. 옷만 산 게 아니라 브랜드도 아는 사람이네요.", "{brand} 문제는 정답이었습니다. 아는 만큼 입는 타입입니다."],
    QUIZ_ROAST_WRONG: ["{brand} 퀴즈는 틀리셨습니다. 입는 것과 아는 것은 다른 일이죠.", "{brand} 문제는 오답입니다. 옷은 사도 공부는 안 하셨네요."],
  },
};

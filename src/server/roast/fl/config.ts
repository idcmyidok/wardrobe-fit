import "server-only";
import { ROAST_COPY } from "@/lib/roast/copy";
import { QUIZ, type QuizEntry } from "../quiz";
import type { Mode } from "./feat";
import { DEFAULT_ASKS, type AskText } from "./asks";
import { DEFAULT_BRAND_TEXT, type BrandText } from "./brand-talk";
import { DEFAULT_LIFE_TEXT, type LifeText } from "./life";
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
    penalty: { common: number; fit: number; age: number };
    /** 구매 흐름 가감점 최대 */
    shift: number;
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
  /** 나이·구매 시기 문장 */
  life: LifeText;
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
  age: { name: "나이와 스타일", hint: "입력한 나이와 옷장 나이를 비교합니다" },
  timeline: { name: "구매 시기 변화", hint: "최근 1년에 산 옷과 2년 이상 앞서 산 옷을 비교합니다(각각 5벌 이상)" },
  questions: { name: "남은 질문", hint: "질문은 관련 이야기 바로 뒤에서 묻고, 자리가 꺼졌거나 없는 질문과 마지막 '패셔너블한가요?'만 여기서 묻습니다" },
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
    penalty: { common: 8, fit: 4, age: 5 },
    shift: 3,
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
    maxAsks: 4,
  },
  brands: structuredClone(DEFAULT_BRAND_TEXT),
  life: structuredClone(DEFAULT_LIFE_TEXT),
  asks: structuredClone(DEFAULT_ASKS),
  axisLines: {
    c: AX(
      ["{axis|이} {score}점입니다. 단톡방 공동구매로 이것저것 모으신 건 아니죠?", "방향이 이리저리 흩어져 있네요. {axis|은} {score}점, 나침반이 하나 필요해 보입니다.", "스트릿 한 벌, 댄디 한 벌, 등산복 한 벌. 이렇게 모이면 {axis|이} 낮게 나올 수밖에 없어요."],
      ["{axis|은} {score}점, 방향은 보이는데 안개가 살짝 껴 있어요.", "큰 줄기는 있는데 가끔 샛길로 새는 옷이 섞여 있네요. {axis|은} 딱 중간입니다.", "열 벌 중 일곱 벌은 같은 얘기를 하는데 세 벌이 딴소리를 해요. {axis} {score}점의 이유죠."],
      ["{axis|이} {score}점이에요. 이 정도면 취향이 아니라 고집이라고 불러도 되겠습니다.", "옷끼리 서로 말이 잘 통하네요. {axis|은} 확실한 강점이에요.", "어떤 옷을 꺼내도 같은 사람 옷처럼 보입니다. {axis} 점수가 높은 데는 다 이유가 있죠."],
      ["제일 아끼는 옷 세 벌의 공통점부터 찾아보세요. 다음 쇼핑은 그 기준에 맞는 것만 사면 됩니다.", "새로 사기 전에 '이거랑 같이 입을 옷이 두 벌 있나'만 물어보세요. 없으면 안 사는 게 {axis|을} 올리는 지름길입니다."],
      ["{axis|이} 뚜렷해서 아침에 옷 고르는 시간이 짧으시겠어요. 생각보다 큰 장점입니다.", "가진 옷끼리 대부분 잘 섞이네요. 운이 아니라 고르는 기준이 있다는 뜻이죠."],
    ),
    t: AX(
      ["{axis|이} {score}점이네요. 브랜드를 할인율 순으로 고르신 게 살짝 티가 납니다.", "장바구니에 담긴 순서대로 결제하신 것 같아요. {axis|은} {score}점입니다.", "친구가 링크 달라고 할 만한 옷이 잘 안 보여요. {axis} 점수가 낮게 나온 이유입니다."],
      ["{axis|은} {score}점, 평균이에요. 실패작은 없는데 자랑할 한 벌도 아직이네요.", "브랜드 선택은 무난한 편입니다. 한두 벌만 바꾸면 되는데, 그 한두 벌이 늘 다음으로 미뤄지죠.", "안전한 브랜드 위주라 {axis|이} 중간에 머물렀어요. 모험을 안 하면 점수도 모험을 안 합니다."],
      ["{axis|이} {score}점입니다. 브랜드 보는 눈은 확실히 있으시네요.", "브랜드 선택이 탄탄해요. 이 항목 덕에 전체 점수가 꽤 버텼습니다.", "고른 브랜드 목록만 봐도 공부를 좀 하신 게 보여요. {axis|은} 높게 쳤습니다."],
      ["아우터나 신발 하나만 한 단계 좋은 브랜드로 바꾸세요. 전부 바꾸라는 게 아니니 겁먹지 마시고요.", "{axis|을} 올리는 제일 빠른 길은 자주 입는 옷부터 좋은 걸로 사는 겁니다. 일 년에 두 번 입는 옷은 나중에요."],
      ["브랜드 고르는 눈은 확실해요. 그 눈을 조합할 때도 똑같이 써 주시면 더 좋겠네요.", "좋은 브랜드를 알아보는 게 패션의 절반인데, 그 절반은 이미 갖고 계세요."],
    ),
    b: AX(
      ["상의만 잔뜩 있고 하의는 어디 두셨나요? {axis|이} {score}점입니다.", "빠진 품목이 훤히 보여요. 한 계절은 그냥 버티실 생각이시죠? {axis|은} {score}점이네요.", "코디를 짜려고 하면 늘 한 조각이 모자라는 구성이에요. 퍼즐로 치면 모서리 조각이 없는 상태입니다."],
      ["{axis|은} {score}점이에요. 큰 구멍은 없는데 작은 구멍이 여럿 보입니다.", "구성은 무난한 편이에요. 급할 땐 꺼낼 게 있는데 고를 게 많진 않죠.", "필요한 건 대충 있는데 특정 품목만 유독 많아요. {axis|이} 중간에 멈춘 이유입니다."],
      ["{axis|이} {score}점이네요. 필요한 건 다 있어요. 필요 없는 것도 조금 있지만요.", "품목과 계절이 고르게 채워졌습니다. 쇼핑 목록이라도 써 두셨나 봐요.", "어떤 날씨에도 꺼낼 옷이 있겠어요. {axis|은} 이번 평가에서 제일 든든한 항목입니다."],
      ["제일 적은 품목 하나만 채우세요. 그것만 해도 코디 경우의 수가 확 늘어납니다. 같은 걸 또 사지 마시고요.", "다음 결제 전에 '이미 세 벌 이상 있는 품목인가'만 확인하세요. {axis|은} 그 질문 하나로 올라갑니다."],
      ["구성이 고르게 잡혀 있어요. 관리하시는 분이었군요, 의외로.", "{axis|이} 좋아서 어떤 약속이 잡혀도 입을 옷 걱정은 없으시겠습니다."],
    ),
    f: AX(
      ["사이즈표는 장식인 줄 아셨나 봐요. {axis|은} {score}점입니다.", "큰 옷과 작은 옷이 줄줄이 섞여 있네요. 반품 버튼과 꽤 친해지셨겠어요. {axis|이} 약합니다.", "'언젠간 맞겠지' 하고 산 옷이 좀 많아요. 그 언젠가는 보통 안 옵니다. {axis} {score}점이에요."],
      ["{axis|은} {score}점, 대체로 맞는데 몇 벌은 감으로 고르셨죠?", "핏은 무난합니다. 감으로 사신 것치곤 선방하셨네요.", "잘 맞는 옷과 애매한 옷이 반반쯤이에요. 애매한 쪽이 {axis|을} 깎아 먹었습니다."],
      ["{axis|이} {score}점이에요. 사이즈표를 정독하는 분이 아직 계셨네요.", "핏이 정확합니다. 이것까지 틀렸으면 드릴 말이 많았을 텐데 아쉽네요.", "몸에 맞는 옷을 고르는 감이 좋아요. {axis|은} 오늘 제일 칭찬하고 싶은 부분입니다."],
      ["어깨, 가슴, 총장 세 군데만 기억해 두세요. 상세 페이지 실측표와 비교하면 실패가 확 줄어듭니다.", "애매하게 큰 옷은 수선집에 한 번 맡겨 보세요. 만 원 남짓으로 {axis|이} 올라가는 가장 싼 방법입니다."],
      ["핏 맞추는 감각이 좋네요. 같은 옷을 입어도 훨씬 정돈돼 보이는 이유가 그겁니다.", "{axis|이} 좋다는 건 산 옷을 실제로 입는다는 뜻이기도 하죠. 버리는 돈이 적은 분이에요."],
    ),
    x: AX(
      ["{axis|이} {score}점이에요. 마네킹에 걸린 그대로 사 오셨거나, 같은 실수를 성실하게 반복하셨거나요.", "{axis|은} 낮게 나왔습니다. 고른 옷들에서 본인만의 이유가 잘 안 보여요.", "쇼핑에 원칙이 있다기보단 그날 기분이 결제한 느낌이네요. {axis} {score}점입니다."],
      ["{axis|은} {score}점, 나쁘진 않은데 내일이면 기억 안 날 수준이에요.", "조금만 더 밀어도 됩니다. 아무도 안 말려요. {axis|은} 딱 평균이네요.", "가끔 번뜩이는 선택이 있는데 그게 이어지질 않아요. {axis|이} 중간에 머문 이유입니다."],
      ["{axis|이} {score}점입니다. 고른 옷마다 이유가 보여요.", "어디서 샀는지보다 왜 샀는지가 먼저 보이는 목록이네요. {axis|은} 높게 나왔습니다.", "호불호는 갈려도 본인 기준은 분명합니다. {axis} 점수가 그걸 말해 줘요."],
      ["다음 다섯 벌은 한 가지 기준으로만 골라 보세요. 기준이 하나면 {axis|은} 저절로 올라갑니다.", "사기 전에 '이걸 왜 사지?'에 한 문장으로 답해 보세요. 답이 안 나오면 장바구니에 하루 더 두시면 됩니다."],
      ["본인 기준이 확실해서 고른 옷마다 이유가 있어 보여요. 이게 진짜 실력이죠.", "{axis|이} 높은 사람은 흔치 않습니다. 쇼핑을 그냥 하는 게 아니라 생각하면서 하시네요."],
    ),
  },
  bands: [
    { max: 45, name: "취향 탐색 중", say: ["{score}점입니다. 출발선에 서 계신 거니까 이제부터는 오를 일만 남았어요.", "아직 지도가 없는 옷장이네요. {score}점이면 길을 잃었다기보단 길을 찾기 시작한 단계입니다.", "솔직히 말하면 {score}점이에요. 대신 다음 결제 몇 번이면 점수가 확 달라질 수 있는 구간입니다."] },
    { max: 60, name: "기본기 단단함", say: ["{score}점, 기본기는 있습니다. 문제는 기본기'만' 있다는 거죠.", "무난함으로 받은 {score}점이에요. 칭찬 반, 숙제 반으로 받아 주세요.", "넘어지진 않는데 달리지도 않는 옷장이네요. {score}점입니다."] },
    { max: 75, name: "감각 있는 편", say: ["{score}점이에요. 감각이 있으셔서 놀릴 거리가 줄었습니다. 좀 섭섭하네요.", "옷 좀 입는다는 소리 들어 보셨죠? {score}점이면 빈말은 아니었네요. 너무 믿지만 마시고요.", "{score}점, 조금만 다듬으면 친구들이 쇼핑 조언 구하러 올 수준입니다."] },
    { max: 90, name: "안목 뚜렷", say: ["{score}점입니다. 놀릴 구석 찾느라 제가 꽤 고생했어요.", "안목이 뚜렷하네요. {score}점, 분하지만 깎을 데가 별로 없었습니다.", "취향이 단단해서 흔들 데가 없어요. {score}점이면 주변에서 옷 잘 입는 사람으로 통하실 겁니다."] },
    { max: 100, name: "완성형", say: ["{score}점, 완성형입니다. 놀릴 데를 끝내 못 찾았어요. 오늘은 제가 졌습니다.", "패션에 진심인 분이군요. {score}점, 박수는 쳐 드릴게요. 작게요.", "이 정도면 제가 훈수 둘 처지가 아니네요. {score}점입니다. 비결은 나중에 따로 여쭤볼게요."] },
  ],
  talk: [
    { id: "greet", on: true },
    { id: "scan", on: true },
    { id: "types", on: true },
    { id: "brands", on: true },
    { id: "age", on: true },
    { id: "timeline", on: true },
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
    SCAN_OPEN: ["옷 {n}벌, 하나도 안 빼고 다 봤습니다. 마음의 준비는 되셨죠?", "{n}벌 훑어보는 동안 벌써 할 말이 쌓였어요. 천천히 풀어 드릴게요.", "총 {n}벌이네요. 어떤 분인지 대충 감이 왔습니다. 좋은 감인지는 끝까지 들어 보시죠.", "{n}벌 확인 끝. 웃을 준비, 살짝 억울할 준비 둘 다 해 두세요."],
    NAME_GREETING: ["{name}님, 잘 봤습니다. 네, 구석구석 아주 잘 봤어요.", "{name}님이시군요. 인사는 다 보고 나서 제대로 드릴게요.", "반갑습니다, {name}님. 오늘 좀 솔직하게 갈 건데 괜찮으시죠?"],
    TYPE_STATUS: ["{type} 쪽부터 짚고 가겠습니다. 할 말이 좀 많아요.", "{type}, 이 얘기를 안 하고 넘어갈 순 없죠.", "다음은 {type} 차례입니다.", "{type} 기운이 꽤 진하게 느껴지네요."],
    NO_TYPE: ["한쪽으로 쏠린 데가 없네요. 좋게 말하면 무난, 솔직하게 말하면 무색무취입니다.", "딱 이 유형이라고 하기엔 이것저것 다 섞였어요. 뷔페 접시처럼 조금씩 다 담으셨네요.", "유형을 붙여 보려다 실패했습니다. 개성인지 아직 고민 중인 건지는 다음에 확인해 보죠."],
    AXIS_STATUS: ["이제 항목별로 하나씩 뜯어보겠습니다.", "점수 깎아 먹은 범인을 찾아보죠.", "잘한 것 하나, 아쉬운 것 하나만 콕 집어 볼게요."],
    WRAP_UP: ["분석 끝났습니다. 결과 쓰는 동안 숨 한 번 고르세요.", "다 봤어요. 순화해서 정리하는 데 시간이 조금 걸립니다.", "할 말은 다 했습니다. 점수표 뽑아 올게요."],
    CLOSING: ["옷은 사는 것보다 입는 게 중요해요. 장바구니보다 가진 옷부터 한 번 더 열어 보세요.", "점수는 참고만 하세요. 신경 쓰이신다면 다음 결제 버튼 앞에서 딱 세 번만 더 고민하시면 됩니다.", "다음에 또 오세요. 그때 달라진 게 있으면 제일 먼저 알아봐 드릴게요.", "오늘 들은 말 중 하나만 실천해도 다음 점수는 오릅니다. 어느 것부터 할지는 맡길게요."],
    LOW_DATA: ["자료가 적어서 정확도가 낮아요. 숨겨 둔 옷이 있다면 다음엔 같이 보여 주세요.", "등록된 옷이 많지 않아 이번 평가는 맛보기에 가깝습니다. 더 채워 주시면 더 정확하게 놀려 드릴게요.", "볼 수 있는 옷이 몇 벌 안 됐어요. 있는 만큼은 꼼꼼히 봤지만 점수는 넉넉히 감안해서 받아 주세요."],
    ORDERS_NOTE: ["무신사에서 산 내역 기준입니다. 다른 데서 산 옷이나 이미 처분한 흑역사는 안 보이니 안심하세요.", "무신사 주문 내역만 봤어요. 오프라인 매장이나 다른 앱에서 산 옷은 이번 평가에서 빠져 있습니다.", "여기 나온 건 무신사 구매 기록뿐이에요. 엄마가 사 준 옷까지는 제가 알 길이 없습니다."],
    BONUS_SAY: ["{grade}급 유형 보너스 {points}점을 드렸습니다. 패션에 진심인 건 확실하네요. 결과물 얘기는 따로 하고요.", "몰입 보너스 {points}점이 붙었어요. 좋아하는 게 이렇게 티 나는 분께는 점수를 안 드릴 수가 없죠.", "보너스 {points}점입니다. 덕질도 깊으면 실력이 된다는 걸 보여 주셨어요."],
    QUIZ_CORRECT: ["정답입니다.", "맞았네요.", "오, 아시네요."],
    QUIZ_WRONG: ["아쉽네요.", "틀렸습니다.", "땡입니다."],
    QUIZ_ROAST_RIGHT: ["{brand} 퀴즈를 맞히셨네요. 옷만 사신 게 아니라 상세페이지까지 읽으셨군요.", "{brand} 문제 정답입니다. 아는 건 확실히 많으세요. 입는 건 다음에 다시 얘기하고요.", "{brand}에 대해선 할 말이 많으시겠어요. 퀴즈를 틀릴 리가 없었네요."],
    QUIZ_ROAST_WRONG: ["{brand} 퀴즈는 틀리셨어요. 그렇게 사 놓고 모르시는 건 좀 서운한데요.", "{brand} 문제는 오답입니다. 결제는 빠르신데 공부는 천천히 하시는 편이네요.", "{brand} 옷은 있는데 {brand} 상식은 아직이네요. 옷에 붙은 택이라도 한 번 읽어 보세요."],
  },
};

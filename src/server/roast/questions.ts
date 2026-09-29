import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { CategoryId } from "@/lib/types/domain";
import type { Analysis, Pattern } from "./analyze";
import { familyName, type FamilyId } from "./keywords";
import { pickQuiz, type QuizItem } from "./quiz";
import { won, type Rng, type Vars } from "./text";

/**
 * 대화 중 질문(계획서 6장 + 사용자 요청으로 늘림). 한 번에 1~3개, 조건이 맞는 것만 후보가 된다.
 * 같은 묶음(bucket)에서는 하나만 묻는다. 답은 옷장 데이터를 바꾸지 않고 결과 글에서 recall로 다시 꺼낸다.
 * 문구의 {자리}는 when()이 돌려준 값으로 채운다.
 */

export interface QOption {
  id: string;
  label: string;
  /** 브랜드 버리기: 대표 사진 */
  photoId?: string;
}

export interface QuestionDef {
  id: string;
  bucket: string;
  /** 앞 멘트(차례로 출력) */
  lead: string[];
  text: string;
  /** 조건이 맞으면 문구에 쓸 값, 아니면 null */
  when: (a: Analysis) => Vars | null;
  /** 관련 패턴 이름(우선순위를 그 패턴 강도로 정한다) */
  pattern?: string;
  /** 기본 우선순위 0~1 */
  base: number;
  options: QOption[];
  /** 답을 고른 직후 반응(선택지 id별, 하나 고름) */
  react: Record<string, string[]>;
  /** 결과 글에서 답을 다시 꺼내는 문장 */
  recall: Record<string, string[]>;
  /** 질문과 함께 보여 줄 옷 사진(사진 있는 옷만) */
  photos?: (a: Analysis) => string[];
}

const pat = (a: Analysis, id: string) => a.patterns.find((p) => p.id === id);
const patStartsWith = (a: Analysis, prefix: string) => a.patterns.filter((p) => p.id.startsWith(prefix));
const has = (a: Analysis, id: string) => Boolean(pat(a, id));
const photoIds = (a: Analysis, ids: string[]) => ids.filter((id) => a.items.find((i) => i.id === id)?.hasPhoto);
const o = (id: string, label: string): QOption => ({ id, label });
const avgPrice = (a: Analysis) => Number(pat(a, "avg_price")?.stats.avg ?? 0);
const stats = (p: Pattern | undefined) => (p ? { ...p.stats } : null);

export const QUESTIONS: QuestionDef[] = [
  // 계획서의 10가지 --------------------------------------------------------------
  {
    id: "odd_photo",
    bucket: "odd",
    lead: ["잠깐만요."],
    text: "이건 정말 본인 옷 맞나요?",
    pattern: "odd_one",
    base: 0.9,
    when: (a) => (a.oddOne?.item.hasPhoto ? { brand: a.oddOne.item.brandLabel || "이 옷", name: a.oddOne.item.g.productName } : null),
    photos: (a) => (a.oddOne ? [a.oddOne.item.id] : []),
    options: [o("mine", "내 옷 맞음"), o("gift", "선물 받은 거"), o("dunno", "나도 왜 샀는지 모르겠음")],
    react: {
      mine: ["알겠습니다. 그렇다면 이 옷만 다른 세계관에서 온 이유는 아직 설명되지 않았네요.", "본인 옷이군요. 그럼 이 옷이 옷장에서 어떤 기분일지 한 번쯤 생각해 주세요."],
      gift: ["선물이었군요. 이제야 흐름이 다시 이해됩니다.", "선물이라면 모든 게 설명됩니다. 준 사람의 취향까지는 묻지 않겠습니다."],
      dunno: ["솔직해서 좋습니다. 저도 모르겠습니다.", "그 대답이 제일 설득력 있습니다."],
    },
    recall: {
      mine: ["{brand} {name|은} 본인 옷이 맞다고 했습니다. 그렇다면 이 옷장에는 아직 드러나지 않은 다른 자아가 있는 겁니다."],
      gift: ["{brand} {name|은} 선물이었다고 합니다. 옷장의 흐름이 깨진 이유가 드디어 설명됐습니다."],
      dunno: ["{brand} {name|은} 왜 샀는지 본인도 모른다고 했습니다. 옷장에서 가장 정직한 순간이었습니다."],
    },
  },
  {
    id: "justify_combo",
    bucket: "justify",
    lead: [],
    text: "이 {color} {sub}들은 정말 전부 다른 역할이 있나요?",
    pattern: "combo_repeat",
    base: 0.85,
    when: (a) => stats(pat(a, "combo_repeat")),
    photos: (a) => photoIds(a, pat(a, "combo_repeat")?.garmentIds ?? []).slice(0, 3),
    options: [o("different", "당연히 다 다름"), o("similar", "비슷한 건 맞음"), o("dunno", "나도 잘 모르겠음")],
    react: {
      different: ["설명은 이해했습니다. 납득까지 했다고는 안 하겠습니다.", "{n}벌 모두 다르다고요. 그 차이를 알아보는 건 아마 본인뿐일 겁니다."],
      similar: ["인정이 빠르시네요. 그래도 {n}벌은 {n}벌입니다.", "비슷하다는 걸 알면서 {n}벌. 그게 더 흥미롭습니다."],
      dunno: ["본인도 모르면 저는 더 모릅니다.", "그럴 수 있습니다. {n}벌쯤 되면 구분이 어렵죠."],
    },
    recall: {
      different: ["{color} {sub} {n}벌이 전부 다른 역할이라고 했습니다. 그 역할표를 한 번 보고 싶습니다."],
      similar: ["{color} {sub} {n}벌이 비슷하다는 건 본인도 인정했습니다. 인정은 했지만 줄일 생각은 없어 보였습니다."],
      dunno: ["{color} {sub} {n}벌의 차이는 본인도 잘 모른다고 했습니다. 옷장이 혼자 늘어난 것 같네요."],
    },
  },
  {
    id: "color_taste",
    bucket: "color",
    lead: [],
    text: "색 있는 옷을 별로 안 좋아하나요?",
    pattern: "achromatic_bias",
    base: 0.8,
    when: (a) => stats(pat(a, "achromatic_bias")),
    options: [o("black_easy", "검정이 제일 편함"), o("just_happens", "그냥 자꾸 그렇게 됨"), o("have_colors", "색 있는 옷도 많은데?")],
    react: {
      black_easy: ["편한 게 최고죠. 옷장이 조금 어두울 뿐입니다.", "편하다는 이유로 {pct}%까지 왔군요."],
      just_happens: ["자꾸 그렇게 된 게 {n}벌입니다. 우연도 이 정도면 습관입니다.", "매장에서도 손이 자동으로 어두운 쪽으로 가나 봅니다."],
      have_colors: ["맞습니다. 흰색이랑 회색도 꽤 있네요. 제가 너무 성급했습니다.", "그렇죠. 색 있는 옷이 {colorful}벌이나 있습니다. 무채색 {n}벌 옆에서요."],
    },
    recall: {
      black_easy: ["무채색이 {pct}%인 건 검정이 제일 편해서라고 했습니다. 편함이 취향을 이긴 대표적인 사례입니다."],
      just_happens: ["무채색이 {pct}%인 이유는 그냥 자꾸 그렇게 돼서라고 했습니다. 계획 없이 이 정도면 오히려 재능입니다."],
      have_colors: ["색 있는 옷도 많다고 항변했지만, 숫자로는 {colorful}벌입니다. 흰색과 회색을 색으로 쳐 드려도 크게 달라지지는 않았습니다."],
    },
  },
  {
    id: "brand_employee",
    bucket: "brand",
    lead: [],
    text: "이 브랜드 직원 할인이라도 받나요?",
    pattern: "brand_focus",
    base: 0.85,
    when: (a) => stats(pat(a, "brand_focus")),
    photos: (a) => photoIds(a, pat(a, "brand_focus")?.garmentIds ?? []).slice(0, 3),
    options: [o("love", "그냥 좋아함"), o("sale", "세일할 때 삼"), o("didnt_know", "그렇게 많은 줄 몰랐음")],
    react: {
      love: ["좋아하는 마음은 {n}벌로 충분히 증명됐습니다.", "그냥 좋아하는 걸로 {n}벌이면, 많이 좋아하는 겁니다."],
      sale: ["세일할 때마다 한 벌씩. 그렇게 {n}벌이 됐군요.", "세일은 핑계로 쓰기 좋죠. {n}번이나요."],
      didnt_know: ["몰랐다고 하기엔 옷장 안에서 존재감이 꽤 큽니다.", "{n}벌입니다. 이제 아셨으니 됐습니다."],
    },
    recall: {
      love: ["{brand|은} 그냥 좋아서 {n}벌이 됐다고 했습니다. 이유가 단순할수록 고치기 어렵습니다."],
      sale: ["{brand} {n}벌은 세일 때 산 거라고 했습니다. 할인율과 상관없이 옷장은 꽉 찼습니다."],
      didnt_know: ["{brand|이} {n}벌이라는 건 몰랐다고 했습니다. 모르는 사이에 {n}벌이 되는 건 흔한 일은 아닙니다."],
    },
  },
  {
    id: "food_vs_clothes",
    bucket: "money",
    lead: ["중요한 질문 하나 하겠습니다."],
    text: "밥이랑 옷 중 하나만 고르면?",
    pattern: "avg_price",
    base: 0.75,
    when: (a) => (avgPrice(a) >= 100_000 ? { avgWon: won(avgPrice(a)) } : null),
    options: [o("food", "밥"), o("clothes", "옷"), o("both", "둘 다 포기 못 함")],
    react: {
      food: ["다행입니다. 평균 구매가를 보고 잠깐 걱정했습니다.", "밥이군요. 옷장 숫자와는 조금 다른 대답이지만 믿겠습니다."],
      clothes: ["네. 숫자를 보기 전부터 어느 정도 예상했습니다.", "솔직하시네요. 평균 {avgWon|이} 이미 말해 줬습니다."],
      both: ["가장 비용이 많이 드는 답을 골랐네요.", "둘 다라니. 예산표가 조금 걱정됩니다."],
    },
    recall: {
      food: ["밥과 옷 중에서는 밥을 골랐습니다. 한 벌 평균 {avgWon|을} 생각하면 꽤 용기 있는 대답입니다."],
      clothes: ["밥과 옷 중에서는 망설임 없이 옷을 골랐습니다. 한 벌 평균 {avgWon|이} 그 대답을 뒷받침합니다."],
      both: ["밥과 옷 중 하나를 고르라고 했더니 둘 다 포기 못 한다고 했습니다. 가장 비싼 대답이었습니다."],
    },
  },
  {
    id: "golden_spoon",
    bucket: "money",
    lead: ["실례지만 하나만 물어보겠습니다."],
    text: "혹시 금수저인가요?",
    pattern: "avg_price",
    base: 0.8,
    when: (a) => (avgPrice(a) >= 250_000 ? { avgWon: won(avgPrice(a)) } : null),
    options: [o("no", "아님"), o("yes", "맞음"), o("skip", "대답하지 않겠음")],
    react: {
      no: ["아니라고요? 그럼 이 옷장에 들어간 돈은 조금 더 미스터리해졌습니다."],
      yes: ["알겠습니다. 갑자기 숫자들이 설명되기 시작했습니다."],
      skip: ["현명한 선택입니다. 저는 옷장만 보겠습니다."],
    },
    recall: {
      no: ["금수저냐는 질문에는 아니라고 했습니다. 그렇다면 한 벌 평균 {avgWon|은} 순수한 의지의 결과입니다."],
      yes: ["금수저냐는 질문에 맞다고 했습니다. 농담이라고 믿겠습니다. 숫자는 농담이 아니었지만요."],
      skip: ["금수저냐는 질문에는 대답하지 않았습니다. 가장 현명한 대답이었습니다."],
    },
  },
  {
    id: "drop_brand",
    bucket: "drop",
    lead: ["이제 조금 불편한 질문을 해보겠습니다.", "다음 셋 중 한 브랜드의 옷을 전부 포기해야 합니다."],
    text: "뭘 버릴 건가요?",
    base: 0.7,
    when: (a) => (a.topSpendBrands.length >= 3 ? {} : null),
    options: [],
    react: {},
    recall: {},
  },
  {
    id: "rationalize",
    bucket: "justify",
    lead: [],
    text: "이 중에 같은 역할을 하는 옷은 하나도 없다고 생각하나요?",
    base: 0.7,
    when: (a) => {
      const m = pat(a, "measure_repeat");
      const f = pat(a, "family_repeat");
      const p = [m, f].filter((x): x is Pattern => Boolean(x) && x!.garmentIds.length >= 4)[0];
      return p ? { n: p.garmentIds.length } : null;
    },
    photos: (a) => photoIds(a, (pat(a, "measure_repeat") ?? pat(a, "family_repeat"))?.garmentIds ?? []).slice(0, 3),
    options: [o("none", "하나도 없음"), o("some", "몇 개는 겹침"), o("why", "그걸 왜 물어봄")],
    react: {
      none: ["하나도 없다고요. 대단한 자신감입니다.", "그렇다면 {n}벌 모두 각자 사연이 있겠네요. 듣지는 않겠습니다."],
      some: ["몇 개라도 인정하셨으니 한 걸음 나아갔습니다.", "겹치는 걸 알고 있었군요. 그래서 더 궁금합니다."],
      why: ["궁금해서요. 대답을 피하시는 것 자체가 대답 같지만요.", "그냥요. 옷장이 먼저 대답한 것 같습니다."],
    },
    recall: {
      none: ["비슷한 옷 {n}벌 중에 역할이 겹치는 건 하나도 없다고 했습니다. 저와 옷장은 조금 생각이 다릅니다."],
      some: ["비슷한 옷 {n}벌 중 몇 개는 겹친다고 인정했습니다. 인정은 정리의 첫 단계입니다. 대부분 거기서 멈추지만요."],
      why: ["비슷한 옷 {n}벌에 대해 물었더니 그걸 왜 묻냐고 되물었습니다. 방어가 곧 대답이었습니다."],
    },
  },
  {
    id: "extreme_one",
    bucket: "justify",
    lead: [],
    text: "내일부터 평생 한 종류만 입을 수 있다면, 역시 {familyName|을} 고르겠나요?",
    pattern: "family_repeat",
    base: 0.65,
    when: (a) => {
      const p = pat(a, "family_repeat");
      return p && Number(p.stats.n) >= 5 ? { ...p.stats, familyName: familyName(p.stats.family as FamilyId) } : null;
    },
    options: [o("of_course", "당연히 이거"), o("no", "그건 좀"), o("already", "이미 그렇게 사는 중")],
    react: {
      of_course: ["예상했습니다. {n}벌이 이미 투표를 마쳤습니다.", "망설임이 없네요. 그래서 {n}벌이군요."],
      no: ["의외네요. {n}벌이나 있는데요.", "그럼 {n}벌은 어떻게 된 걸까요."],
      already: ["네, 옷장을 보니 알겠습니다.", "그렇게 보였습니다. 굳이 말씀 안 하셔도 됐습니다."],
    },
    recall: {
      of_course: ["평생 한 종류만 입어야 한다면 {familyName|을} 고르겠다고 했습니다. {n}벌을 보면 이미 준비는 끝났습니다."],
      no: ["평생 {familyName}만 입는 건 싫다고 했습니다. 그런데 옷장에는 이미 {n}벌이 있습니다."],
      already: ["평생 한 종류만 입는다면? 이미 그렇게 살고 있다고 했습니다. {familyName} {n}벌이 증인입니다."],
    },
  },
  {
    id: "quiz",
    bucket: "quiz",
    lead: ["잠깐만요.", "이 정도 브랜드를 가지고 있으면 이것 정도는 알고 있겠죠."],
    text: "",
    base: 0.8,
    when: (a) => {
      const g = a.items.filter((i) => i.groups.some((x) => x === "luxury" || x === "designer" || x === "jp_denim"));
      return g.length >= 3 || (a.items.length && g.length / a.items.length >= 0.2) ? {} : null;
    },
    options: [],
    react: {},
    recall: {},
  },

  // 늘린 질문 -------------------------------------------------------------------
  {
    id: "black_why",
    bucket: "color",
    lead: [],
    text: "검정 옷을 고르는 특별한 이유가 있나요?",
    pattern: "black_bias",
    base: 0.8,
    when: (a) => stats(pat(a, "black_bias")),
    options: [o("matches", "뭐랑 입어도 맞아서"), o("no_thinking", "고민하기 싫어서"), o("charcoal", "그거 검정 아니고 차콜인데")],
    react: {
      matches: ["맞습니다. 검정끼리는 싸우지 않죠. {n}벌이 평화롭게 지내고 있습니다.", "그래서 검정 옷끼리 입으면 또 잘 맞겠네요. 검정으로."],
      no_thinking: ["고민을 줄인 대가로 옷장이 어두워졌습니다. 공정한 거래입니다.", "현명합니다. 그 에너지는 다른 데 쓰시면 됩니다."],
      charcoal: ["죄송합니다. 적어 두신 색 이름을 기준으로 봤습니다. 검정으로 적혀 있더군요.", "제 눈에는 둘 다 어두운 색입니다. 옷장 조명 탓으로 하겠습니다."],
    },
    recall: {
      matches: ["검정 옷 {n}벌은 뭐랑 입어도 맞아서라고 했습니다. 맞긴 합니다. 다만 뭐랑 입어도 비슷해 보이기도 합니다."],
      no_thinking: ["검정을 고르는 이유는 고민하기 싫어서라고 했습니다. 이 옷장은 결정 피로를 이긴 옷장입니다."],
      charcoal: ["검정이 아니라 차콜이라고 반박했지만, 옷장에 적힌 색 이름은 검정이었습니다."],
    },
  },
  {
    id: "chroma_love",
    bucket: "color",
    lead: [],
    text: "{color}에 무슨 사연이라도 있나요?",
    pattern: "chroma_bias",
    base: 0.75,
    when: (a) => stats(pat(a, "chroma_bias")),
    photos: (a) => photoIds(a, pat(a, "chroma_bias")?.garmentIds ?? []).slice(0, 3),
    options: [o("love", "그냥 좋아함"), o("suits", "잘 어울린다는 말 들음"), o("didnt_know", "이게 그렇게 많았나")],
    react: {
      love: ["좋아하는 색이 있다는 건 좋은 일입니다. {n}벌이면 아주 좋아하는 거고요.", "사연 없는 사랑이 제일 오래갑니다."],
      suits: ["한 번 들은 칭찬이 {n}벌이 됐군요.", "그 말을 해 준 사람은 이 옷장을 보고 뭐라고 할지 궁금합니다."],
      didnt_know: ["{n}벌입니다. 이제 아셨습니다.", "모르는 사이에 {color|이} 옷장을 점령했습니다."],
    },
    recall: {
      love: ["{color|은} 그냥 좋아서 {n}벌이 됐다고 했습니다. 가장 순수한 이유입니다."],
      suits: ["{color|이} 잘 어울린다는 말을 들었다고 했습니다. 그 한마디의 결과가 {n}벌입니다."],
      didnt_know: ["{color} 옷이 {n}벌이라는 건 몰랐다고 했습니다. 색은 조용히 늘어납니다."],
    },
  },
  {
    id: "category_why",
    bucket: "category",
    lead: [],
    text: "{catName}만 유독 많이 모은 이유가 있나요?",
    pattern: "category_bias",
    base: 0.55,
    when: (a) => {
      const p = pat(a, "category_bias");
      return p ? { ...p.stats, catName: CATEGORY_NAME[p.stats.cat as CategoryId] } : null;
    },
    options: [o("wear_most", "제일 자주 입어서"), o("cant_stop", "다른 건 안 사게 됨"), o("elsewhere", "나머지는 등록을 안 했음")],
    react: {
      wear_most: ["합리적입니다. 다만 나머지 옷들이 조금 서운해하겠네요.", "자주 입는 만큼 샀다면 계산은 맞습니다."],
      cant_stop: ["{catName} 코너 앞에서만 발이 멈추나 봅니다.", "그런 날이 쌓여서 {n}벌이 됐군요."],
      elsewhere: ["그럼 제가 본 옷장은 절반짜리였군요. 그래도 {n}벌은 {n}벌입니다.", "알겠습니다. 등록한 옷만 보고 말하겠습니다."],
    },
    recall: {
      wear_most: ["{catName|이} 많은 건 제일 자주 입어서라고 했습니다. 수요와 공급이 정확히 맞는 옷장입니다."],
      cant_stop: ["{catName} 말고 다른 건 안 사게 된다고 했습니다. {n}벌이 그 말을 증명합니다."],
      elsewhere: ["나머지 옷은 아직 등록하지 않았다고 했습니다. 그렇다면 이 분석은 옷장의 일부만 본 겁니다. 그 일부만으로도 충분했지만요."],
    },
  },
  {
    id: "subcat_known",
    bucket: "count",
    lead: [],
    text: "{sub|이} 몇 벌인지 알고 있었나요?",
    pattern: "subcategory_bias",
    base: 0.65,
    when: (a) => stats(pat(a, "subcategory_bias")),
    photos: (a) => photoIds(a, pat(a, "subcategory_bias")?.garmentIds ?? []).slice(0, 3),
    options: [o("exact", "정확히 앎"), o("roughly", "대충 앎"), o("no", "전혀 몰랐음")],
    react: {
      exact: ["{n}벌인 걸 알면서 계속 샀다는 뜻이군요.", "알고 있었다면, 그건 계획입니다."],
      roughly: ["대충 생각한 숫자보다 많을 겁니다. {n}벌입니다.", "{n}벌입니다. 대충이 맞았는지 확인해 보세요."],
      no: ["{n}벌입니다. 놀라셨다면 다행입니다.", "모르는 사이에 {n}벌. 옷장이 알아서 번식한 것 같네요."],
    },
    recall: {
      exact: ["{sub|이} {n}벌인 걸 정확히 알고 있었다고 했습니다. 알면서 산 옷은 변명이 어렵습니다."],
      roughly: ["{sub|이} 몇 벌인지 대충 안다고 했지만, 정확한 숫자는 {n}벌이었습니다."],
      no: ["{sub|이} {n}벌인 줄 전혀 몰랐다고 했습니다. 그게 가장 무서운 부분입니다."],
    },
  },
  {
    id: "count_guess",
    bucket: "count",
    lead: ["숫자 하나 맞혀 보시겠어요?"],
    text: "모자·신발 빼고, 옷장에 옷이 몇 벌쯤 있을 것 같나요?",
    base: 0.6,
    when: (a) => (a.clothes.length >= 40 ? { n: a.clothes.length } : null),
    options: [],
    react: {
      under: ["실제로는 {n}벌입니다. 생각보다 많죠.", "{n}벌입니다. 옷장은 늘 생각보다 큽니다."],
      right: ["정확합니다. 알면서도 계속 샀다는 뜻이네요.", "맞습니다. {n}벌. 숫자 감각은 확실하시네요."],
      over: ["그보다는 적습니다. {n}벌입니다. 그렇게 느껴질 수는 있습니다.", "{n}벌입니다. 스스로에게 조금 엄격하시네요."],
    },
    recall: {
      under: ["옷이 몇 벌인지 물었을 때 실제보다 적게 답했습니다. 실제로는 {n}벌이었습니다."],
      right: ["옷이 몇 벌인지 물었을 때 정확히 맞혔습니다. {n}벌을 알면서도 늘려 온 셈입니다."],
      over: ["옷이 몇 벌인지 물었을 때 실제보다 많게 답했습니다. {n}벌도 이미 충분히 많은데요."],
    },
  },
  {
    id: "few_clothes",
    bucket: "count",
    lead: [],
    text: "옷이 적은 건 미니멀리즘인가요, 아직 다 안 넣은 건가요?",
    pattern: "count_small",
    base: 0.5,
    when: (a) => stats(pat(a, "count_small")),
    options: [o("minimal", "미니멀리스트임"), o("not_yet", "아직 다 안 넣음"), o("thats_all", "원래 이게 다임")],
    react: {
      minimal: ["존중합니다. 그렇다면 {n}벌 하나하나가 정예군이겠네요.", "미니멀리스트에게 옷 분석은 조금 가혹했을지도 모르겠습니다."],
      not_yet: ["그럼 다 넣고 다시 오세요. 더 할 말이 생길 겁니다.", "알겠습니다. 오늘은 맛보기라고 해 두죠."],
      thats_all: ["{n}벌로 사는 건 대단한 기술입니다.", "그렇다면 이 옷장은 효율 그 자체입니다."],
    },
    recall: {
      minimal: ["옷이 {n}벌뿐인 건 미니멀리즘이라고 했습니다. 이 옷장에서 가장 확실한 철학입니다."],
      not_yet: ["아직 옷을 다 넣지 않았다고 했습니다. 다 넣고 나면 이 글이 꽤 달라질 겁니다."],
      thats_all: ["원래 옷이 {n}벌이 전부라고 했습니다. 적은 옷으로 버티는 건 생각보다 어려운 일입니다."],
    },
  },
  {
    id: "trend_source",
    bucket: "trend",
    lead: [],
    text: "요즘 뜨는 브랜드는 주로 어디서 알게 되나요?",
    pattern: "trend_brands",
    base: 0.7,
    when: (a) => stats(pat(a, "trend_brands")),
    options: [o("sns", "인스타그램·유튜브"), o("friends", "친구·지인"), o("first", "원래 알던 게 뜬 거임")],
    react: {
      sns: ["알고리즘이 옷장을 꽤 많이 채웠네요.", "피드가 쇼핑 목록이 된 거군요. 흔한 일입니다."],
      friends: ["친구분들 취향이 옷장에 {n}벌 남았네요.", "좋은 친구들입니다. 비싼 친구들이기도 하고요."],
      first: ["원래 알던 거라고요. 다들 그렇게 말합니다.", "그렇다면 선구자시네요. 증명할 방법은 없지만요."],
    },
    recall: {
      sns: ["요즘 뜨는 브랜드는 주로 SNS에서 알게 된다고 했습니다. 이 옷장의 {n}벌은 알고리즘과의 공동 작업입니다."],
      friends: ["요즘 뜨는 브랜드는 친구에게서 알게 된다고 했습니다. 옷장 {n}벌 중 일부는 친구 지분입니다."],
      first: ["요즘 뜨는 브랜드들은 원래 알던 게 떴을 뿐이라고 했습니다. 증거는 없지만 자신감은 확실합니다."],
    },
  },
  {
    id: "timeless_q",
    bucket: "trend",
    lead: [],
    text: "유행은 아예 신경 안 쓰는 편인가요?",
    pattern: "trait_timeless",
    base: 0.6,
    when: (a) => stats(pat(a, "trait_timeless")),
    options: [o("never", "전혀 안 씀"), o("bit", "조금은 봄"), o("comes_back", "유행이 나한테 돌아옴")],
    react: {
      never: ["그렇게 보입니다. 옷장이 시간을 멈춰 두었네요.", "유행도 이 옷장에는 노크하고 들어와야겠습니다."],
      bit: ["조금은 보신다니 다행입니다. 옷장에는 아직 안 보이지만요.", "그 조금이 옷장에 반영되기까지는 시간이 좀 걸리나 봅니다."],
      comes_back: ["기다리는 전략이군요. 꽤 오래 기다리셔야 할 수도 있습니다.", "좋은 전략입니다. 인내심이 필요하다는 것만 빼면요."],
    },
    recall: {
      never: ["유행은 전혀 신경 쓰지 않는다고 했습니다. 옷장이 그 말을 충실히 따르고 있습니다."],
      bit: ["유행은 조금 본다고 했습니다. 옷장에서는 그 조금이 아직 잘 보이지 않습니다."],
      comes_back: ["유행이 알아서 돌아온다고 했습니다. 그 날을 기다리는 옷장입니다."],
    },
  },
  {
    id: "hype_alarm",
    bucket: "trend",
    lead: [],
    text: "발매일에 알람 맞춰 본 적 있나요?",
    pattern: "trait_hype",
    base: 0.65,
    when: (a) => stats(pat(a, "trait_hype")),
    options: [o("yes", "있음"), o("no", "없음"), o("secret", "그건 비밀")],
    react: {
      yes: ["솔직하시네요. 옷장이 이미 자백했지만요.", "그 알람, 아직 켜져 있을 것 같습니다."],
      no: ["없다고요. 그럼 운이 아주 좋으셨나 봅니다.", "알람 없이 이 정도면 감이 좋으신 겁니다."],
      secret: ["비밀은 지켜 드리겠습니다. 옷장은 못 지켰지만요.", "알겠습니다. 저도 묻지 않은 걸로 하겠습니다."],
    },
    recall: {
      yes: ["발매일에 알람을 맞춰 본 적이 있다고 했습니다. 이 옷장은 선착순으로 완성됐습니다."],
      no: ["발매일 알람은 맞춰 본 적 없다고 했습니다. 그런데도 화제의 브랜드가 이렇게 모였습니다."],
      secret: ["발매일 알람에 대해서는 비밀이라고 했습니다. 옷장이 대신 대답했습니다."],
    },
  },
  {
    id: "country_q",
    bucket: "brand2",
    lead: [],
    text: "{country} 브랜드가 대부분인 건 의도한 건가요?",
    pattern: "country_bias",
    base: 0.5,
    when: (a) => stats(pat(a, "country_bias")),
    options: [o("intended", "의도함"), o("quality", "그냥 좋은 걸 골랐더니"), o("didnt_know", "몰랐음")],
    react: {
      intended: ["확고하시네요. {pct}%면 확고한 게 맞습니다.", "의도한 거라면 성공입니다."],
      quality: ["좋은 걸 골랐더니 다 {country}였다. 꽤 강한 주장입니다.", "그럴 수 있습니다. 다른 나라 브랜드들은 조금 서운하겠지만요."],
      didnt_know: ["{pct}%입니다. 이제 아셨습니다.", "라벨의 원산지는 잘 안 보게 되죠."],
    },
    recall: {
      intended: ["{country} 브랜드가 {pct}%인 건 의도한 거라고 했습니다. 옷장에도 국적이 있다면 이건 {country}입니다."],
      quality: ["좋은 걸 고르다 보니 {country} 브랜드가 {pct}%가 됐다고 했습니다. 다른 나라들에는 조금 가혹한 평가입니다."],
      didnt_know: ["{country} 브랜드가 {pct}%라는 건 몰랐다고 했습니다. 모르는 사이에 옷장의 국적이 정해졌습니다."],
    },
  },
  {
    id: "logo_mood",
    bucket: "brand2",
    lead: [],
    text: "로고가 크게 보이는 옷과 로고 없는 옷, 진짜 취향은 어느 쪽인가요?",
    pattern: "contradiction_logo_quiet",
    base: 0.8,
    when: (a) => stats(pat(a, "contradiction_logo_quiet")),
    options: [o("logo", "로고 있는 쪽"), o("quiet", "로고 없는 쪽"), o("depends", "그날 기분 따라")],
    react: {
      logo: ["그럼 로고 없는 {quiet}벌은 어떻게 된 걸까요.", "알겠습니다. 로고 없는 옷들은 휴가 중인 걸로 하죠."],
      quiet: ["그럼 로고 있는 {logo}벌은 누구 옷인가요.", "조용한 취향이라면서 로고가 {logo}벌입니다. 흥미롭네요."],
      depends: ["기분이 옷장을 둘로 나눴군요.", "가장 비싼 기분 관리법입니다."],
    },
    recall: {
      logo: ["진짜 취향은 로고 있는 쪽이라고 했습니다. 그런데 로고 없는 옷도 {quiet}벌입니다."],
      quiet: ["진짜 취향은 로고 없는 쪽이라고 했습니다. 그런데 로고가 큰 옷이 {logo}벌 있습니다."],
      depends: ["로고와 무로고 사이에서 그날 기분 따라 고른다고 했습니다. 기분이 꽤 자주 바뀌는 것 같습니다."],
    },
  },
  {
    id: "mountain",
    bucket: "outdoor",
    lead: [],
    text: "그 기능성, 실제로 산에서 써 본 적 있나요?",
    base: 0.65,
    when: (a) => (has(a, "trait_functional") || has(a, "group_outdoor") ? {} : null),
    pattern: "group_outdoor",
    options: [o("often", "자주 감"), o("sometimes", "가끔"), o("subway", "주로 지하철에서 씀")],
    react: {
      often: ["그렇다면 이 옷들은 제 몫을 하고 있습니다. 부럽네요.", "훌륭합니다. 옷들이 보람을 느끼겠습니다."],
      sometimes: ["가끔이라도 쓰셨다니 다행입니다.", "그 가끔을 위해 준비가 철저하시네요."],
      subway: ["출근길도 나름 험하긴 합니다.", "지하철 냉방도 극한 환경이긴 하죠."],
    },
    recall: {
      often: ["기능성 옷들은 실제로 산에서 자주 쓴다고 했습니다. 이 옷장에서 가장 부지런한 옷들입니다."],
      sometimes: ["기능성 옷들은 가끔 산에 간다고 했습니다. 나머지 날에는 도시에서 대기 중입니다."],
      subway: ["기능성 옷들이 주로 활약하는 곳은 지하철이라고 했습니다. 방수 등급이 아깝지만, 비 오는 날 출근길에는 든든할 겁니다."],
    },
  },
  {
    id: "sports_q",
    bucket: "outdoor",
    lead: [],
    text: "스포츠 브랜드 옷, 운동할 때도 입나요?",
    pattern: "group_sports",
    base: 0.6,
    when: (a) => stats(pat(a, "group_sports")),
    options: [o("workout", "운동할 때만"), o("daily", "평소에 입음"), o("no_workout", "운동은 안 함")],
    react: {
      workout: ["모범적입니다. 옷의 원래 용도를 지켜 주셨네요.", "옷들이 땀을 흘려 봤다니 다행입니다."],
      daily: ["운동복의 두 번째 인생이군요.", "편한 건 인정합니다."],
      no_workout: ["솔직하시네요. 옷들은 언젠가를 기다리고 있습니다.", "괜찮습니다. 운동하는 분위기도 중요하니까요."],
    },
    recall: {
      workout: ["스포츠 브랜드 옷은 운동할 때 입는다고 했습니다. 이 옷장에서 가장 정직한 쓰임입니다."],
      daily: ["스포츠 브랜드 옷을 평소에도 입는다고 했습니다. 운동복과 일상복의 경계는 이미 사라졌습니다."],
      no_workout: ["스포츠 브랜드 옷이 {n}벌인데 운동은 안 한다고 했습니다. 옷들은 아직 출전을 기다리고 있습니다."],
    },
  },
  {
    id: "recent_reason",
    bucket: "timing",
    lead: [],
    text: "최근에 뭔가 사고 싶어지는 일이 있었나요?",
    base: 0.75,
    pattern: "recent_30",
    when: (a) => stats(pat(a, "recent_30") ?? pat(a, "recent_90")),
    options: [o("sale", "세일이 있었음"), o("season", "계절이 바뀜"), o("just", "그냥 샀음")],
    react: {
      sale: ["세일은 늘 있습니다. 그게 문제죠.", "할인율이 결제를 밀어준 거군요."],
      season: ["계절이 바뀌면 옷도 바뀌어야 하죠. {n}벌이나요.", "계절은 핑계로 쓰기 가장 좋은 이유입니다."],
      just: ["그냥이 {n}벌이 됐습니다.", "가장 솔직한 이유입니다. 가장 위험하기도 하고요."],
    },
    recall: {
      sale: ["최근에 {n}벌을 산 건 세일 때문이라고 했습니다. 할인은 끝났지만 옷은 남았습니다."],
      season: ["최근에 {n}벌을 산 건 계절이 바뀌어서라고 했습니다. 다음 계절도 곧 옵니다."],
      just: ["최근에 {n}벌을 산 이유는 그냥이라고 했습니다. 이 옷장에서 가장 무서운 단어입니다."],
    },
  },
  {
    id: "binge_month",
    bucket: "timing",
    lead: [],
    text: "{year}년 {month}월에 무슨 일이 있었나요?",
    pattern: "month_binge",
    base: 0.75,
    when: (a) => stats(pat(a, "month_binge")),
    options: [o("sale", "큰 세일"), o("payday", "보너스·월급"), o("forgot", "기억 안 남")],
    react: {
      sale: ["세일이 {n}벌을 데려왔군요.", "그 세일, 꽤 성공적이었네요. 판매자 입장에서요."],
      payday: ["돈이 들어오자마자 옷이 들어왔군요. 순환이 빠릅니다.", "경제는 이렇게 돌아가는 거죠."],
      forgot: ["기억은 없어도 {n}벌은 남았습니다.", "결제 내역은 기억하고 있을 겁니다."],
    },
    recall: {
      sale: ["{year}년 {month}월에 {n}벌을 몰아 산 건 큰 세일 때문이라고 했습니다."],
      payday: ["{year}년 {month}월에 {n}벌을 산 건 보너스나 월급 때문이라고 했습니다. 돈은 들어왔다가 옷이 되어 남았습니다."],
      forgot: ["{year}년 {month}월에 {n}벌을 산 이유는 기억이 안 난다고 했습니다. 옷장만 그달을 기억합니다."],
    },
  },
  {
    id: "season_gap",
    bucket: "season",
    lead: [],
    text: "{least}에는 뭘 입고 다니나요?",
    pattern: "season_bias",
    base: 0.6,
    when: (a) => stats(pat(a, "season_bias")),
    options: [o("rotate", "있는 옷으로 버팀"), o("stay_in", "그땐 밖에 잘 안 나감"), o("buy_soon", "곧 사려고 했음")],
    react: {
      rotate: ["{leastN}벌로 버티는 {least}. 꽤 치열하겠네요.", "돌려 입기의 달인이시군요."],
      stay_in: ["그것도 방법입니다. 가장 저렴한 방법이기도 하고요.", "집에서는 옷이 덜 중요하죠."],
      buy_soon: ["그럴 줄 알았습니다. 옷장이 조금 긴장하겠네요.", "다음 분석 때 {least} 옷이 늘어 있을 것 같습니다."],
    },
    recall: {
      rotate: ["{least} 옷은 {leastN}벌로 돌려 입으며 버틴다고 했습니다. {most} 옷 {mostN}벌과는 대우가 다릅니다."],
      stay_in: ["{least}에는 밖에 잘 안 나간다고 했습니다. 옷장이 그 계절을 쉬는 이유가 설명됐습니다."],
      buy_soon: ["{least} 옷은 곧 살 거라고 했습니다. 이 옷장은 곧 더 커질 예정입니다."],
    },
  },
  {
    id: "top_item_q",
    bucket: "money2",
    lead: [],
    text: "가장 비싼 옷, 몇 번이나 입었나요?",
    pattern: "top_item",
    base: 0.7,
    when: (a) => {
      const p = pat(a, "top_item");
      return p ? { ...p.stats, priceWon: won(Number(p.stats.price)) } : null;
    },
    photos: (a) => photoIds(a, pat(a, "top_item")?.garmentIds ?? []),
    options: [o("often", "자주 입음"), o("few", "몇 번"), o("saving", "아까워서 모셔 둠")],
    react: {
      often: ["훌륭합니다. 한 번 입을 때마다 가격이 조금씩 내려가고 있습니다.", "그렇다면 가장 잘한 소비입니다."],
      few: ["{priceWon}짜리를 몇 번. 한 번에 얼마인지는 계산하지 않겠습니다.", "몇 번이라도 입었다면 다행입니다."],
      saving: ["모셔 두는 옷이 가장 비싼 옷이군요. 옷도 외출하고 싶을 텐데요.", "아까워서 못 입는 옷이 {priceWon}입니다."],
    },
    recall: {
      often: ["가장 비싼 {priceWon}짜리 옷은 자주 입는다고 했습니다. 이 옷장에서 가장 효율 좋은 투자입니다."],
      few: ["가장 비싼 {priceWon}짜리 옷은 몇 번 입었다고 했습니다. 한 번 입을 때의 가격은 계산하지 않겠습니다."],
      saving: ["가장 비싼 {priceWon}짜리 옷은 아까워서 모셔 둔다고 했습니다. 옷장 안의 가장 비싼 전시품입니다."],
    },
  },
  {
    id: "sale_q",
    bucket: "money2",
    lead: [],
    text: "명품은 세일할 때만 사는 편인가요?",
    pattern: "sale_luxury",
    base: 0.7,
    when: (a) => stats(pat(a, "sale_luxury")),
    options: [o("yes", "그렇다"), o("luck", "우연이다"), o("never_full", "정가로 산 적 없음")],
    react: {
      yes: ["기다림도 실력입니다. {n}벌이나 성공하셨네요.", "현명한 소비자시네요. 옷장은 그 인내의 결과입니다."],
      luck: ["우연이 {n}번이면 실력입니다.", "운이 좋으시네요. 아주 여러 번."],
      never_full: ["원칙이 확고하시네요.", "정가는 남의 이야기군요."],
    },
    recall: {
      yes: ["명품은 세일할 때만 산다고 했습니다. {n}벌이 그 인내심의 성과입니다."],
      luck: ["명품을 싸게 산 건 우연이라고 했습니다. 우연이 {n}번 겹쳤습니다."],
      never_full: ["명품을 정가로 산 적은 없다고 했습니다. 이 옷장은 할인율로 지어졌습니다."],
    },
  },
  {
    id: "splurge_q",
    bucket: "money2",
    lead: [],
    text: "{brand}에서 {priceWon|이}면, 특별한 사연이 있는 옷인가요?",
    pattern: "cheap_brand_splurge",
    base: 0.7,
    when: (a) => {
      const p = pat(a, "cheap_brand_splurge");
      return p ? { ...p.stats, priceWon: won(Number(p.stats.price)) } : null;
    },
    options: [o("special", "특별한 옷임"), o("late", "가격을 나중에 봄"), o("normal", "원래 그 가격임")],
    react: {
      special: ["특별한 옷이라면 이해합니다. 특별히 비쌌네요.", "사연 있는 옷은 가격이 중요하지 않죠."],
      late: ["가격표는 늘 늦게 보이죠.", "영수증이 먼저 말해 줬겠네요."],
      normal: ["그렇다면 제가 브랜드를 잘못 알고 있었을지도 모르겠습니다. 그래도 {priceWon|은} {priceWon}입니다.", "알겠습니다. 그 브랜드에서도 특별한 라인이었나 봅니다."],
    },
    recall: {
      special: ["{brand}에서 {priceWon|을} 쓴 건 특별한 옷이라서라고 했습니다."],
      late: ["{brand}에서 {priceWon|을} 쓴 건 가격을 나중에 봐서라고 했습니다. 가장 흔하고 가장 비싼 실수입니다."],
      normal: ["{brand}의 {priceWon}짜리 옷은 원래 그 가격이라고 했습니다. 그렇다면 그 브랜드에서도 꽤 높은 라인을 고른 겁니다."],
    },
  },
  {
    id: "max_budget",
    bucket: "money",
    lead: [],
    text: "옷 한 벌에 쓸 수 있는 최대 금액은 얼마인가요?",
    pattern: "top_item",
    base: 0.55,
    when: (a) => {
      const priced = a.items.filter((i) => i.price != null);
      if (priced.length < 5) return null;
      const max = Math.max(...priced.map((i) => i.price!));
      return max >= 100_000 ? { maxWon: won(max) } : null;
    },
    options: [o("b10", "10만 원까지"), o("b30", "30만 원까지"), o("b100", "100만 원까지"), o("nolimit", "한도 없음")],
    react: {
      b10: ["옷장에 {maxWon}짜리가 있는데요.", "원칙은 좋습니다. 옷장은 그 원칙을 한 번쯤 어겼습니다."],
      b30: ["기준이 명확하시네요. 옷장이 그걸 지켰는지는 {maxWon}짜리 옷에게 물어보세요.", "합리적인 선입니다."],
      b100: ["넉넉한 한도입니다.", "그 한도 안에서 가장 비싼 옷이 {maxWon}이군요."],
      nolimit: ["가장 위험한 대답입니다.", "솔직해서 좋습니다. 카드사도 좋아하겠네요."],
    },
    recall: {
      b10: ["한 벌에 10만 원까지만 쓴다고 했지만, 가장 비싼 옷은 {maxWon}입니다."],
      b30: ["한 벌에 30만 원까지 쓸 수 있다고 했습니다. 가장 비싼 옷은 {maxWon}입니다."],
      b100: ["한 벌에 100만 원까지 쓸 수 있다고 했습니다. 가장 비싼 옷은 {maxWon}입니다."],
      nolimit: ["한 벌에 쓸 수 있는 금액에는 한도가 없다고 했습니다. 가장 비싼 옷은 {maxWon}입니다. 아직은요."],
    },
  },
  {
    id: "fit_choice",
    bucket: "fit",
    lead: [],
    text: "{fit} 핏만 고르는 건 의도한 건가요?",
    pattern: "fit_bias",
    base: 0.6,
    when: (a) => stats(pat(a, "fit_bias")),
    options: [o("comfy", "이게 제일 편함"), o("awkward", "다른 핏은 어색함"), o("have_others", "다른 핏도 있는데?")],
    react: {
      comfy: ["편한 핏을 찾았다면 반은 성공입니다.", "편함은 타협할 수 없는 가치죠."],
      awkward: ["어색함을 피하다 보니 {n}벌이 같아졌군요.", "한 번쯤 어색해 보는 것도 나쁘지 않습니다."],
      have_others: ["있긴 합니다. {pct}%가 {fit}인 옷장에서요.", "맞습니다. 소수 의견도 존중합니다."],
    },
    recall: {
      comfy: ["{fit} 핏만 고르는 건 제일 편해서라고 했습니다. 편함을 찾은 옷장은 쉽게 바뀌지 않습니다."],
      awkward: ["다른 핏은 어색해서 {fit} 핏만 고른다고 했습니다. 그 어색함을 한 번 넘어 보면 옷장이 조금 넓어질 겁니다."],
      have_others: ["다른 핏도 있다고 했지만, 핏을 아는 옷 중 {pct}%가 {fit}이었습니다."],
    },
  },
  {
    id: "style_self",
    bucket: "style",
    lead: [],
    text: "스스로 생각하는 스타일이 {tag} 쪽인가요?",
    pattern: "tag_bias",
    base: 0.6,
    when: (a) => stats(pat(a, "tag_bias")),
    options: [o("yes", "맞음"), o("no", "아님"), o("none", "스타일 같은 거 없음")],
    react: {
      yes: ["자기 객관화가 잘 되어 있으시네요.", "옷장과 본인의 의견이 일치합니다. 드문 일입니다."],
      no: ["옷장은 그렇다고 하는데요.", "그럼 옷장이 거짓말을 하고 있는 걸까요."],
      none: ["없다고 하시기엔 {pct}%가 {tag}입니다.", "스타일이 없다는 것도 스타일입니다. 그리고 옷장은 {tag}라고 합니다."],
    },
    recall: {
      yes: ["스스로도 {tag} 스타일이라고 인정했습니다. 옷장과 의견이 일치한 몇 안 되는 순간입니다."],
      no: ["{tag} 스타일은 아니라고 했지만, 브랜드들의 {pct}%는 그렇다고 말합니다."],
      none: ["스타일 같은 건 없다고 했지만, 옷장의 {pct}%는 {tag} 쪽이었습니다."],
    },
  },
  {
    id: "brand_pick",
    bucket: "style",
    lead: [],
    text: "브랜드를 고를 때 가장 중요한 건 뭔가요?",
    base: 0.6,
    pattern: "same_color",
    when: (a) => {
      const p = pat(a, "same_color") ?? pat(a, "same_fit") ?? pat(a, "same_tag");
      return p ? { brands: p.stats.brands } : null;
    },
    options: [o("design", "디자인"), o("price", "가격"), o("vibe", "브랜드 분위기")],
    react: {
      design: ["디자인이라고요. 그런데 결국 비슷한 걸 고르셨습니다.", "그 디자인들이 서로 꽤 닮았더군요."],
      price: ["현실적이시네요.", "가격을 보고 골랐는데 결과는 비슷하다니, 일관성은 확실합니다."],
      vibe: ["분위기는 브랜드마다 달랐을 텐데, 옷장에 오면 다 비슷해지네요.", "{brands}개 브랜드의 분위기가 옷장에서 하나로 합쳐졌습니다."],
    },
    recall: {
      design: ["브랜드를 고를 때 디자인이 가장 중요하다고 했습니다. {brands}개 브랜드의 디자인은 결국 한곳으로 모였습니다."],
      price: ["브랜드를 고를 때 가격이 가장 중요하다고 했습니다. 가격은 달라도 결과물은 비슷했습니다."],
      vibe: ["브랜드를 고를 때 분위기가 가장 중요하다고 했습니다. {brands}개 브랜드의 분위기가 옷장 안에서 하나로 합쳐졌습니다."],
    },
  },
  {
    id: "old_trust",
    bucket: "style",
    lead: [],
    text: "오래된 브랜드가 더 믿음이 가나요?",
    pattern: "old_brands",
    base: 0.5,
    when: (a) => stats(pat(a, "old_brands")),
    options: [o("history", "역사가 곧 품질"), o("chance", "우연임"), o("new_too", "새 브랜드도 좋아함")],
    react: {
      history: ["{year}년부터 이어진 신뢰군요.", "오래 살아남은 데는 이유가 있다는 말씀이군요."],
      chance: ["우연이 {pct}%면 꽤 꾸준한 우연입니다.", "우연이라고 하기엔 브랜드들 나이가 비슷하게 많습니다."],
      new_too: ["옷장에서는 아직 잘 안 보입니다.", "그 새 브랜드들은 어디에 숨어 있나요."],
    },
    recall: {
      history: ["오래된 브랜드가 믿음이 간다고 했습니다. 옷장 브랜드의 {pct}%가 50년을 넘긴 이유입니다."],
      chance: ["오래된 브랜드가 많은 건 우연이라고 했습니다. {pct}%짜리 우연입니다."],
      new_too: ["새 브랜드도 좋아한다고 했지만, 옷장 브랜드의 {pct}%는 50년이 넘었습니다."],
    },
  },
  {
    id: "niche_known",
    bucket: "style",
    lead: [],
    text: "주변 사람들이 이 브랜드들을 알아보나요?",
    pattern: "trait_niche",
    base: 0.6,
    when: (a) => stats(pat(a, "trait_niche")),
    options: [o("nobody", "아무도 모름"), o("those_who_know", "알 사람은 앎"), o("rather_not", "알아보면 오히려 불편함")],
    react: {
      nobody: ["그게 매력이겠죠. 설명하는 재미도 있고요.", "아무도 모르는 옷에 돈을 쓰는 건 꽤 고급 취미입니다."],
      those_who_know: ["그 '알 사람'이 몇 명인지 궁금합니다.", "좁고 깊은 인맥 같은 옷장이네요."],
      rather_not: ["알아보면 불편하다니, 취향이 꽤 까다로우시네요.", "그렇다면 이 옷장은 성공적으로 숨어 있습니다."],
    },
    recall: {
      nobody: ["주변에서 이 브랜드들을 아무도 모른다고 했습니다. 아는 사람만 아는 옷장의 숙명입니다."],
      those_who_know: ["알 사람은 안다고 했습니다. 그 몇 명을 위해 꾸린 옷장입니다."],
      rather_not: ["누가 알아보면 오히려 불편하다고 했습니다. 이 옷장은 들키지 않는 것이 목표입니다."],
    },
  },
  {
    id: "formal_job",
    bucket: "style",
    lead: [],
    text: "평소에 단정하게 입어야 하는 일을 하나요?",
    pattern: "trait_formal",
    base: 0.5,
    when: (a) => stats(pat(a, "trait_formal")),
    options: [o("yes", "맞음"), o("no", "아님"), o("like", "그냥 단정한 게 좋음")],
    react: {
      yes: ["그렇다면 옷장이 성실하게 일하고 있는 겁니다.", "출근복이 옷장을 이끌고 있군요."],
      no: ["그럼 이 단정함은 순수한 취향이군요.", "아무도 시키지 않았는데 단정하다니, 대단합니다."],
      like: ["단정함이 취미군요.", "좋은 취미입니다. 다림질은 조금 힘들겠지만요."],
    },
    recall: {
      yes: ["단정하게 입어야 하는 일을 한다고 했습니다. 이 옷장은 성실한 직장인입니다."],
      no: ["단정하게 입을 필요가 없는데도 포멀한 브랜드가 많습니다. 순수한 취향입니다."],
      like: ["그냥 단정한 게 좋다고 했습니다. 옷장이 늘 면접 보러 갈 준비가 되어 있는 이유입니다."],
    },
  },
  {
    id: "same_outfit_street",
    bucket: "brand2",
    lead: [],
    text: "길에서 같은 옷 입은 사람 본 적 있나요?",
    base: 0.55,
    pattern: "group_mass",
    when: (a) => (has(a, "group_mass") || has(a, "trait_mainstream") ? {} : null),
    options: [o("often", "자주 봄"), o("sometimes", "가끔"), o("not_yet", "아직 없음")],
    react: {
      often: ["그럴 때 눈인사는 하시나요?", "같은 취향의 동지들이 많다는 뜻입니다."],
      sometimes: ["가끔이면 운이 좋은 편입니다.", "대중적인 브랜드의 숙명이죠."],
      not_yet: ["아직이라는 단어가 중요합니다.", "곧 만나게 될 겁니다."],
    },
    recall: {
      often: ["길에서 같은 옷 입은 사람을 자주 본다고 했습니다. 대중적인 브랜드가 많은 옷장의 부작용입니다."],
      sometimes: ["길에서 같은 옷 입은 사람을 가끔 본다고 했습니다. 그 정도면 선방입니다."],
      not_yet: ["길에서 같은 옷 입은 사람은 아직 못 봤다고 했습니다. '아직'이라는 말이 걸립니다."],
    },
  },
  {
    id: "brand_alert",
    bucket: "brand",
    lead: [],
    text: "{brand} 신상 알림, 켜 두었나요?",
    pattern: "brand_focus",
    base: 0.7,
    when: (a) => stats(pat(a, "brand_focus")),
    options: [o("on", "켜 둠"), o("off", "아님"), o("no_need", "알림 없이도 앎")],
    react: {
      on: ["역시. {n}벌은 그렇게 모이는 거군요.", "알림이 옷장을 채우고 있었군요."],
      off: ["알림 없이 {n}벌이라니, 더 대단합니다.", "그럼 {n}벌은 순전히 본인의 의지입니다."],
      no_need: ["그 정도면 알림보다 빠른 거죠.", "이미 몸이 기억하는 단계군요."],
    },
    recall: {
      on: ["{brand} 신상 알림을 켜 두었다고 했습니다. {n}벌이 모인 경로가 밝혀졌습니다."],
      off: ["{brand} 신상 알림은 꺼 두었다고 했습니다. 알림 없이 {n}벌이면 순수한 의지입니다."],
      no_need: ["{brand} 신상은 알림 없이도 안다고 했습니다. 이 정도면 브랜드가 알림을 받아야 합니다."],
    },
  },
  {
    id: "brand_spend_q",
    bucket: "brand",
    lead: [],
    text: "{brand}에 쓴 돈이 {amountWon|이}라는 거, 알고 있었나요?",
    pattern: "brand_spend",
    base: 0.7,
    when: (a) => {
      const p = pat(a, "brand_spend");
      return p ? { ...p.stats, amountWon: won(Number(p.stats.amount)) } : null;
    },
    options: [o("knew", "알고 있었음"), o("less", "이것보단 적을 줄"), o("dont_tell", "말하지 마")],
    react: {
      knew: ["알고 있었다면 확신범입니다.", "계산이 된 소비였군요."],
      less: ["숫자는 늘 생각보다 큽니다.", "옷은 한 벌씩 사도 금액은 한꺼번에 보이니까요."],
      dont_tell: ["이미 말해 버렸습니다. 죄송합니다.", "늦었습니다."],
    },
    recall: {
      knew: ["{brand}에 {amountWon|을} 쓴 걸 알고 있었다고 했습니다. 계산된 애정입니다."],
      less: ["{brand}에 쓴 돈이 {amountWon|이}라는 걸 듣고, 이보다는 적을 줄 알았다고 했습니다."],
      dont_tell: ["{brand}에 쓴 금액을 말하자 말하지 말라고 했습니다. 이미 늦었습니다. {amountWon}입니다."],
    },
  },
  {
    id: "many_clothes_wear",
    bucket: "count",
    lead: [],
    text: "{n}벌 중에 최근 한 달 동안 입은 옷은 몇 벌쯤 될까요?",
    pattern: "count_many",
    base: 0.65,
    when: (a) => stats(pat(a, "count_huge") ?? pat(a, "count_many")),
    options: [o("most", "대부분"), o("half", "절반쯤"), o("few", "열 벌 정도")],
    react: {
      most: ["대단하시네요. 믿겠습니다. 일단은요.", "그렇다면 매일 두 번씩 갈아입으시나 봅니다."],
      half: ["절반이면 나머지 절반은 휴가 중이군요.", "솔직하고 적당한 대답입니다."],
      few: ["솔직하시네요. 나머지는 옷장을 지키고 있습니다.", "그게 대부분의 옷장이 사는 방식입니다."],
    },
    recall: {
      most: ["{n}벌 중 최근 한 달 동안 대부분을 입었다고 했습니다. 믿기로 했습니다."],
      half: ["{n}벌 중 최근 한 달 동안 절반쯤 입었다고 했습니다. 나머지 절반은 대기 중입니다."],
      few: ["{n}벌 중 최근 한 달 동안 입은 옷은 열 벌 정도라고 했습니다. 나머지는 옷장을 지키는 경비원입니다."],
    },
  },
];

export interface AskedQuestion {
  id: string;
  lead: string[];
  text: string;
  options: QOption[];
  /** 선택지 id별 반응(이미 값이 채워진 문장) */
  reactions: Record<string, string>;
  /** 선택지 id별 결과 글 문장 */
  recalls: Record<string, string>;
  photos: string[];
  /** 퀴즈 정답 */
  answer?: string;
  quizId?: string;
}

/** 브랜드 버리기 선택지 반응 */
const DROP_REACT = {
  most: "의외네요. 그래도 여기에는 이 브랜드가 {count}벌이나 있는데요.",
  least: "가장 피해가 적은 쪽을 정확하게 골랐습니다.",
  mid: "과감하네요. 이걸 빼면 옷장 분위기가 꽤 많이 달라질 텐데요.",
};
const DROP_RECALL = "세 브랜드 중 하나를 버리라고 했더니 {brand|을} 골랐습니다. 이 옷장에 {count}벌이 있는 브랜드인데도요.";

/** 옷장 벌 수 맞히기 선택지: 정답 구간 하나와 아래·위 구간 */
function countRanges(n: number) {
  const step = n >= 100 ? 50 : 20;
  const lo = Math.floor(n / step) * step;
  return [
    { id: "under", label: `${Math.max(lo - step, 0)}~${lo}벌` },
    { id: "right", label: `${lo}~${lo + step}벌` },
    { id: "over", label: `${lo + step}벌 이상` },
  ];
}

export function pickQuestions(a: Analysis, r: Rng, fill: (t: string, v: Vars) => string): AskedQuestion[] {
  const candidates = QUESTIONS.map((q) => ({ q, vars: q.when(a) }))
    .filter((c): c is { q: QuestionDef; vars: Vars } => c.vars != null)
    .map((c) => {
      const p = c.q.pattern ? pat(a, c.q.pattern) : undefined;
      const score = c.q.base * 0.6 + (p ? p.strength * p.interest * 0.4 : 0.15) + r.next() * 0.35;
      return { ...c, score };
    })
    .sort((x, y) => y.score - x.score);
  const asked: AskedQuestion[] = [];
  const buckets = new Set<string>();
  const want = candidates.length >= 3 ? (r.next() < 0.3 ? 2 : 3) : candidates.length;
  for (const c of candidates) {
    if (asked.length >= want) break;
    if (buckets.has(c.q.bucket)) continue;
    // 밥 vs 옷 / 금수저, 해명 요구 / 자기합리화 / 극단적 선택은 같은 묶음이라 하나만 나온다.
    const built = build(c.q, c.vars, a, r, fill);
    if (!built) continue;
    buckets.add(c.q.bucket);
    asked.push(built);
  }
  return asked;
}

function build(q: QuestionDef, vars: Vars, a: Analysis, r: Rng, fill: (t: string, v: Vars) => string): AskedQuestion | null {
  const f = (t: string) => fill(t, vars);
  const photos = q.photos?.(a) ?? [];
  if (q.id === "odd_photo" && !photos.length) return null;
  if (q.id === "quiz") {
    const quiz: QuizItem | null = pickQuiz(a, r);
    if (!quiz) return null;
    return {
      id: q.id,
      quizId: quiz.id,
      lead: q.lead,
      text: quiz.question,
      options: r.shuffle(quiz.options).map((label) => ({ id: label, label })),
      answer: quiz.answer,
      reactions: Object.fromEntries(quiz.options.map((opt) => [opt, opt === quiz.answer ? r.pick(quiz.correct) : r.pick(quiz.wrong)])),
      recalls: Object.fromEntries(
        quiz.options.map((opt) => [
          opt,
          opt === quiz.answer
            ? `${quiz.brandLabel} 퀴즈는 맞혔습니다. 적어도 라벨만 보고 산 건 아니라는 증거입니다.`
            : `${quiz.brandLabel} 퀴즈는 틀렸습니다. 괜찮습니다. 옷을 입는 데 시험은 없으니까요.`,
        ]),
      ),
      photos: [],
    };
  }
  if (q.id === "drop_brand") {
    const top3 = a.topSpendBrands.slice(0, 3);
    const options = top3.map((b) => ({ id: b.label, label: b.label, photoId: photoIds(a, b.ids)[0] }));
    const reactions: Record<string, string> = {};
    const recalls: Record<string, string> = {};
    top3.forEach((b, i) => {
      const kind = i === 0 ? "most" : i === top3.length - 1 ? "least" : "mid";
      reactions[b.label] = fill(DROP_REACT[kind], { count: b.count });
      recalls[b.label] = fill(DROP_RECALL, { brand: b.label, count: b.count });
    });
    return { id: q.id, lead: q.lead, text: q.text, options: r.shuffle(options), reactions, recalls, photos: [] };
  }
  const options = q.id === "count_guess" ? countRanges(Number(vars.n)) : q.options;
  return {
    id: q.id,
    lead: q.lead.map(f),
    text: f(q.text),
    options,
    reactions: Object.fromEntries(options.map((opt) => [opt.id, f(r.pick(q.react[opt.id]))])),
    recalls: Object.fromEntries(options.map((opt) => [opt.id, f(r.pick(q.recall[opt.id]))])),
    photos,
  };
}

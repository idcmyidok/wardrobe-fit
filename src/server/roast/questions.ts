import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { CategoryId } from "@/lib/types/domain";
import type { Analysis, Item, Pattern } from "./analyze";
import { familyName, type FamilyId } from "./keywords";
import { pickQuiz } from "./quiz";
import { MissingVar, won, type Rng, type Vars } from "./text";
import type { RoastTexts } from "./texts";

/**
 * 대화 중 질문. 한 번에 1~3개, 조건이 맞는 것만 후보가 된다. 같은 묶음(bucket)에서는 하나만 묻는다.
 * 답은 옷장 데이터를 바꾸지 않는다. 결과 글에서 답을 되풀이하지 않는다(사용자 요청).
 * 문구(Q_TEXT)는 관리자 화면에서 고칠 수 있고, 조건·선택지 id는 여기 코드에만 있다.
 * 문구의 {자리}는 when()이 돌려준 값으로 채운다.
 */

export interface QuestionDef {
  id: string;
  bucket: string;
  /** 조건이 맞으면 문구에 쓸 값, 아니면 null */
  when: (a: Analysis) => Vars | null;
  /** 관련 패턴 이름(우선순위를 그 패턴 강도로 정한다) */
  pattern?: string;
  /** 기본 우선순위 0~1 */
  base: number;
  /** 선택지 id(문구는 Q_TEXT.options). 빈 배열이면 코드가 만든다. */
  options: string[];
  /** 질문과 함께 보여 줄 옷 사진(사진 있는 옷만). 4장 이상이면 화면이 가로로 넘겨 본다. */
  photos?: (a: Analysis) => string[];
}

export interface QuestionText {
  lead: string[];
  text: string;
  /** 선택지 id → 글자 */
  options: Record<string, string>;
  /** 반응 종류(대개 선택지 id) → 문장들(하나 고름) */
  react: Record<string, string[]>;
}

const pat = (a: Analysis, id: string) => a.patterns.find((p) => p.id === id);
const has = (a: Analysis, id: string) => Boolean(pat(a, id));
const photoIds = (a: Analysis, ids: string[]) => ids.filter((id) => a.items.find((i) => i.id === id)?.hasPhoto);
const stats = (p: Pattern | undefined) => (p ? { ...p.stats } : null);
const priced = (a: Analysis) => a.items.filter((i) => i.price != null && i.price > 0);
/** 가격을 적은 옷 중 기준 금액 이상인 옷의 비율(5벌 이상일 때만) */
const shareOver = (a: Analysis, min: number) => {
  const list = priced(a);
  return list.length >= 5 ? list.filter((i) => i.price! >= min).length / list.length : 0;
};
const DAY = 86_400_000;

export const QUESTIONS: QuestionDef[] = [
  { id: "odd_photo", bucket: "odd", pattern: "odd_one", base: 0.9, options: ["mine", "gift", "dunno"],
    when: (a) => (a.oddOne?.item.hasPhoto ? { brand: a.oddOne.item.brandLabel || "이 옷", name: a.oddOne.item.g.productName } : null),
    photos: (a) => (a.oddOne ? [a.oddOne.item.id] : []) },
  { id: "justify_combo", bucket: "justify", pattern: "combo_repeat", base: 0.85, options: ["different", "similar", "dunno"],
    when: (a) => stats(pat(a, "combo_repeat")),
    photos: (a) => photoIds(a, pat(a, "combo_repeat")?.garmentIds ?? []).slice(0, 3) },
  { id: "color_taste", bucket: "color", pattern: "achromatic_bias", base: 0.8, options: ["black_easy", "just_happens", "have_colors"],
    when: (a) => stats(pat(a, "achromatic_bias")) },
  { id: "brand_employee", bucket: "brand", pattern: "brand_focus", base: 0.85, options: ["love", "sale", "didnt_know"],
    when: (a) => stats(pat(a, "brand_focus")),
    photos: (a) => photoIds(a, pat(a, "brand_focus")?.garmentIds ?? []).slice(0, 3) },
  // 가격을 적은 옷 중 20만 원 이상이 20% 이상
  { id: "food_vs_clothes", bucket: "money", base: 0.75, options: ["food", "clothes", "both"],
    when: (a) => (shareOver(a, 200_000) >= 0.2 ? { pct: Math.round(shareOver(a, 200_000) * 100) } : null) },
  // 가격을 적은 옷 중 50만 원 이상이 20% 이상
  { id: "golden_spoon", bucket: "money", base: 0.85, options: ["no", "yes", "skip"],
    when: (a) => (shareOver(a, 500_000) >= 0.2 ? { pct: Math.round(shareOver(a, 500_000) * 100) } : null) },
  // 가장 비싼 옷 3벌 중 하나 버리기(가격 적은 옷 5벌 이상)
  { id: "drop_item", bucket: "drop", base: 0.75, options: [], when: (a) => (priced(a).length >= 5 ? {} : null) },
  { id: "brand_best", bucket: "pick", base: 0.7, options: [], when: (a) => (brandTrio(a) ? {} : null) },
  { id: "rationalize", bucket: "justify", base: 0.7, options: ["none", "some", "why"],
    when: (a) => {
      const p = [pat(a, "measure_repeat"), pat(a, "family_repeat")].find((x) => x && x.garmentIds.length >= 4);
      return p ? { n: p.garmentIds.length } : null;
    },
    photos: (a) => {
      const p = [pat(a, "measure_repeat"), pat(a, "family_repeat")].find((x) => x && x.garmentIds.length >= 4);
      return photoIds(a, p?.garmentIds ?? []);
    } },
  { id: "extreme_one", bucket: "justify", pattern: "family_repeat", base: 0.65, options: ["of_course", "no", "already"],
    when: (a) => {
      const p = pat(a, "family_repeat");
      return p && Number(p.stats.n) >= 5 ? { ...p.stats, familyName: familyName(p.stats.family as FamilyId) } : null;
    },
    photos: (a) => photoIds(a, pat(a, "family_repeat")?.garmentIds ?? []) },
  { id: "quiz", bucket: "quiz", base: 0.85, options: [], when: (a) => (a.quizBrands.length ? {} : null) },
  { id: "black_why", bucket: "color", pattern: "black_bias", base: 0.8, options: ["matches", "no_thinking", "charcoal"],
    when: (a) => stats(pat(a, "black_bias")) },
  { id: "chroma_love", bucket: "color", pattern: "chroma_bias", base: 0.75, options: ["love", "suits", "didnt_know"],
    when: (a) => stats(pat(a, "chroma_bias")),
    photos: (a) => photoIds(a, pat(a, "chroma_bias")?.garmentIds ?? []).slice(0, 3) },
  { id: "category_why", bucket: "category", pattern: "category_bias", base: 0.55, options: ["wear_most", "cant_stop", "elsewhere"],
    when: (a) => {
      const p = pat(a, "category_bias");
      return p ? { ...p.stats, catName: CATEGORY_NAME[p.stats.cat as CategoryId] } : null;
    } },
  { id: "subcat_known", bucket: "count", pattern: "subcategory_bias", base: 0.65, options: ["exact", "roughly", "no"],
    when: (a) => stats(pat(a, "subcategory_bias")),
    photos: (a) => photoIds(a, pat(a, "subcategory_bias")?.garmentIds ?? []).slice(0, 3) },
  { id: "count_guess", bucket: "count", base: 0.6, options: [], when: (a) => (a.clothes.length >= 20 ? { n: a.clothes.length } : null) },
  { id: "few_clothes", bucket: "count", pattern: "count_small", base: 0.5, options: ["minimal", "not_yet", "thats_all"],
    when: (a) => stats(pat(a, "count_small")) },
  { id: "many_clothes_wear", bucket: "count", pattern: "count_many", base: 0.65, options: ["most", "half", "few", "same"],
    when: (a) => stats(pat(a, "count_huge") ?? pat(a, "count_many")) },
  { id: "trend_source", bucket: "trend", pattern: "trend_brands", base: 0.7, options: ["sns", "friends", "first"],
    when: (a) => stats(pat(a, "trend_brands")) },
  { id: "timeless_q", bucket: "trend", pattern: "trait_timeless", base: 0.6, options: ["never", "bit", "comes_back"],
    when: (a) => stats(pat(a, "trait_timeless")) },
  { id: "hype_alarm", bucket: "trend", pattern: "trait_hype", base: 0.65, options: ["yes", "no", "secret"],
    when: (a) => stats(pat(a, "trait_hype")) },
  { id: "country_q", bucket: "brand2", pattern: "country_bias", base: 0.5, options: ["intended", "quality", "didnt_know"],
    when: (a) => stats(pat(a, "country_bias")) },
  { id: "mountain", bucket: "outdoor", pattern: "group_outdoor", base: 0.65, options: ["often", "sometimes", "subway"],
    when: (a) => (has(a, "trait_functional") || has(a, "group_outdoor") ? {} : null) },
  { id: "sports_q", bucket: "outdoor", pattern: "group_sports", base: 0.6, options: ["workout", "daily", "no_workout"],
    when: (a) => stats(pat(a, "group_sports")) },
  { id: "recent_reason", bucket: "timing", pattern: "recent_30", base: 0.75, options: ["sale", "season", "birthday", "just"],
    when: (a) => stats(pat(a, "recent_30")) },
  { id: "binge_month", bucket: "timing", pattern: "month_binge", base: 0.75, options: ["sale", "payday", "forgot"],
    when: (a) => stats(pat(a, "month_binge")) },
  { id: "season_gap", bucket: "season", pattern: "season_bias", base: 0.6, options: ["rotate", "stay_in", "buy_soon"],
    when: (a) => stats(pat(a, "season_bias")) },
  { id: "top_item_q", bucket: "money2", pattern: "top_item", base: 0.7, options: ["often", "few", "saving"],
    when: (a) => {
      const p = pat(a, "top_item");
      return p ? { ...p.stats, priceWon: won(Number(p.stats.price)) } : null;
    },
    photos: (a) => photoIds(a, pat(a, "top_item")?.garmentIds ?? []) },
  { id: "sale_q", bucket: "money2", pattern: "sale_luxury", base: 0.7, options: ["yes", "luck", "never_full"],
    when: (a) => stats(pat(a, "sale_luxury")) },
  { id: "splurge_q", bucket: "money2", pattern: "cheap_brand_splurge", base: 0.7, options: ["special", "late", "normal"],
    when: (a) => {
      const p = pat(a, "cheap_brand_splurge");
      return p ? { ...p.stats, priceWon: won(Number(p.stats.price)) } : null;
    },
    photos: (a) => photoIds(a, pat(a, "cheap_brand_splurge")?.garmentIds ?? []) },
  { id: "subcat_spend_q", bucket: "money2", pattern: "subcategory_spend", base: 0.75, options: ["knew", "less", "dont_tell"],
    when: (a) => {
      const p = pat(a, "subcategory_spend");
      return p ? { ...p.stats, amountWon: won(Number(p.stats.amount)) } : null;
    } },
  // 가격을 적은 옷이 5벌 이상이고, 그중 가장 비싼 옷이 20만 원 이상일 때
  { id: "max_budget", bucket: "money", base: 0.55, options: ["b10", "b30", "b100", "nolimit"],
    when: (a) => {
      const list = priced(a);
      if (list.length < 5) return null;
      const max = Math.max(...list.map((i) => i.price!));
      return max >= 200_000 ? { maxWon: won(max), max } : null;
    } },
  { id: "fit_choice", bucket: "fit", pattern: "fit_bias", base: 0.6, options: ["comfy", "awkward", "have_others"],
    when: (a) => stats(pat(a, "fit_bias")) },
  { id: "style_self", bucket: "style", pattern: "tag_bias", base: 0.6, options: ["yes", "no", "none"],
    when: (a) => stats(pat(a, "tag_bias")) },
  { id: "brand_pick", bucket: "style", pattern: "same_color", base: 0.6, options: ["design", "price", "vibe"],
    when: (a) => {
      const p = pat(a, "same_color") ?? pat(a, "same_fit") ?? pat(a, "same_tag");
      return p ? { brands: p.stats.brands } : null;
    } },
  { id: "old_trust", bucket: "style", pattern: "old_brands", base: 0.5, options: ["history", "chance", "new_too"],
    when: (a) => stats(pat(a, "old_brands")) },
  { id: "niche_known", bucket: "style", pattern: "trait_niche", base: 0.6, options: ["nobody", "those_who_know", "rather_not"],
    when: (a) => stats(pat(a, "trait_niche")) },
  { id: "formal_job", bucket: "style", pattern: "trait_formal", base: 0.5, options: ["yes", "no", "like"],
    when: (a) => stats(pat(a, "trait_formal")) },
  { id: "same_outfit_street", bucket: "brand2", pattern: "group_mass", base: 0.55, options: ["often", "sometimes", "not_yet"],
    when: (a) => (has(a, "group_mass") || has(a, "trait_mainstream") ? {} : null) },
  { id: "brand_alert", bucket: "brand", pattern: "brand_focus", base: 0.7, options: ["on", "off", "no_need"],
    when: (a) => stats(pat(a, "brand_focus")) },
  { id: "brand_spend_q", bucket: "brand", pattern: "brand_spend", base: 0.7, options: ["knew", "less", "dont_tell"],
    when: (a) => {
      const p = pat(a, "brand_spend");
      return p ? { ...p.stats, amountWon: won(Number(p.stats.amount)) } : null;
    } },
  { id: "shoes_q", bucket: "acc", pattern: "shoes_many", base: 0.7, options: ["all_wear", "collect", "one_pair"],
    when: (a) => stats(pat(a, "shoes_many")),
    photos: (a) => photoIds(a, pat(a, "shoes_many")?.garmentIds ?? []) },
  { id: "shoe_sub_q", bucket: "acc", pattern: "shoe_sub_bias", base: 0.65, options: ["two", "mood", "different"],
    when: (a) => stats(pat(a, "shoe_sub_bias")) },
  { id: "hats_q", bucket: "acc", pattern: "hats_many", base: 0.65, options: ["mood", "hair", "collect"],
    when: (a) => stats(pat(a, "hats_many")),
    photos: (a) => photoIds(a, pat(a, "hats_many")?.garmentIds ?? []) },
  { id: "hat_sub_q", bucket: "acc", pattern: "hat_sub_bias", base: 0.6, options: ["face", "safe", "different"],
    when: (a) => stats(pat(a, "hat_sub_bias")) },
  // 옷장과 상관없이 누구에게나 물을 수 있는 질문. 관련 패턴이 있으면 조금 더 자주 나온다.
  { id: "vintage_q", bucket: "self", base: 0.35, options: ["often", "browse", "no_used"],
    when: (a) => ({ boost: has(a, "old_brands") || has(a, "trait_heritage") || has(a, "group_jp_denim") || has(a, "group_heritage") ? 1 : 0 }) },
  { id: "influencer_q", bucket: "self", base: 0.4, options: ["daily", "sometimes", "never"],
    when: (a) => ({ boost: has(a, "trend_brands") || has(a, "trait_trendy") || has(a, "trait_hype") ? 1 : 0 }) },
  { id: "fashionable_q", bucket: "self", base: 0.45, options: ["yes", "normal", "no", "others_say"], when: () => ({}) },
];

export const Q_TEXT: Record<string, QuestionText> = {
  odd_photo: {
    lead: ["잠깐만요."],
    text: "이건 정말 본인 옷 맞나요?",
    options: { mine: "내 옷 맞음", gift: "선물 받은 거", dunno: "나도 왜 샀는지 모르겠음" },
    react: {
      mine: ["알겠습니다. 그렇다면 이 옷만 다른 세계관에서 온 이유는 아직 설명되지 않았네요.", "본인 옷이군요. 그럼 이 옷이 옷장에서 어떤 기분일지 한 번쯤 생각해 주세요."],
      gift: ["선물이었군요. 이제야 흐름이 다시 이해됩니다.", "선물이라면 모든 게 설명됩니다. 준 사람의 취향까지는 묻지 않겠습니다."],
      dunno: ["솔직해서 좋습니다. 저도 모르겠습니다.", "그 대답이 제일 설득력 있습니다."],
    },
  },
  justify_combo: {
    lead: [],
    text: "이 {color} {sub}들은 정말 전부 다른 역할이 있나요?",
    options: { different: "당연히 다 다름", similar: "비슷한 건 맞음", dunno: "나도 잘 모르겠음" },
    react: {
      different: ["설명은 이해했습니다. 납득까지 했다고는 안 하겠습니다.", "{n}벌 모두 다르다고요. 그 차이를 알아보는 건 아마 본인뿐일 겁니다."],
      similar: ["인정이 빠르시네요. 그래도 {n}벌은 {n}벌입니다.", "비슷하다는 걸 알면서 {n}벌. 그게 더 흥미롭습니다."],
      dunno: ["본인도 모르면 저는 더 모릅니다.", "그럴 수 있습니다. {n}벌쯤 되면 구분이 어렵죠."],
    },
  },
  color_taste: {
    lead: [],
    text: "색 있는 옷을 별로 안 좋아하나요?",
    options: { black_easy: "검정이 제일 편함", just_happens: "그냥 자꾸 그렇게 됨", have_colors: "색 있는 옷도 많은데?" },
    react: {
      black_easy: ["편한 게 최고죠. 옷장이 조금 어두울 뿐입니다.", "편하다는 이유로 {pct}%까지 왔군요."],
      just_happens: ["자꾸 그렇게 된 게 {n}벌입니다. 우연도 이 정도면 습관입니다.", "매장에서도 손이 자동으로 어두운 쪽으로 가나 봅니다."],
      have_colors: ["색 있는 옷이 {colorful}벌 있긴 합니다. 무채색 {n}벌 옆에서요.", "그렇죠. {colorful}벌이나요. 반올림하면 없는 거지만요."],
    },
  },
  brand_employee: {
    lead: [],
    text: "이 브랜드 직원 할인이라도 받나요?",
    options: { love: "그냥 좋아함", sale: "세일할 때 삼", didnt_know: "그렇게 많은 줄 몰랐음" },
    react: {
      love: ["좋아하는 마음은 {n}벌로 충분히 증명됐습니다.", "그냥 좋아하는 걸로 {n}벌이면, 많이 좋아하는 겁니다."],
      sale: ["세일할 때마다 한 벌씩. 그렇게 {n}벌이 됐군요.", "세일은 핑계로 쓰기 좋죠. {n}번이나요."],
      didnt_know: ["몰랐다고 하기엔 옷장 안에서 존재감이 꽤 큽니다.", "{n}벌입니다. 이제 아셨으니 됐습니다."],
    },
  },
  food_vs_clothes: {
    lead: ["중요한 질문 하나 하겠습니다."],
    text: "밥이랑 옷 중 하나만 고르면?",
    options: { food: "밥", clothes: "옷", both: "둘 다 포기 못 함" },
    react: {
      food: ["다행입니다. 20만 원 넘는 옷이 {pct}%라서 잠깐 걱정했습니다.", "밥이군요. 옷장 숫자와는 조금 다른 대답이지만 믿겠습니다."],
      clothes: ["네. 숫자를 보기 전부터 어느 정도 예상했습니다.", "솔직하시네요. 20만 원 넘는 옷이 {pct}%인 옷장다운 대답입니다."],
      both: ["가장 비용이 많이 드는 답을 골랐네요.", "둘 다라니. 예산표가 조금 걱정됩니다."],
    },
  },
  golden_spoon: {
    lead: ["실례지만 하나만 물어보겠습니다."],
    text: "혹시 금수저인가요?",
    options: { no: "아님", yes: "맞음", skip: "대답하지 않겠음" },
    react: {
      no: ["아니라고요? 50만 원 넘는 옷이 {pct}%인데요. 옷장이 더 미스터리해졌습니다.", "그렇다면 이 옷장은 순수한 의지로 지어졌습니다. 무섭네요."],
      yes: ["알겠습니다. 갑자기 숫자들이 설명되기 시작했습니다.", "농담이라고 믿겠습니다. 숫자는 농담이 아니었지만요."],
      skip: ["현명한 선택입니다. 저는 옷장만 보겠습니다.", "대답하지 않는 것도 대답입니다."],
    },
  },
  drop_item: {
    lead: ["이제 조금 불편한 질문을 해보겠습니다.", "가장 비싼 옷 세 벌 중 하나를 지금 버려야 합니다."],
    text: "뭘 버릴 건가요?",
    options: {},
    react: {
      most: ["제일 비싼 걸 버리시네요. 대범하거나, 이미 후회하고 있었거나.", "{priceWon}짜리를 망설임 없이 고르셨습니다. 영수증이 울겠네요."],
      mid: ["가운데를 골랐네요. 가장 무난한 선택입니다. 이 옷장답게요.", "과감하지도, 쩨쩨하지도 않은 선택입니다."],
      least: ["셋 중 가장 싼 걸 골랐네요. 계산이 빠르십니다.", "피해가 가장 적은 쪽을 정확하게 골랐습니다. 그래도 {priceWon}입니다."],
    },
  },
  brand_best: {
    lead: ["브랜드 셋을 골라 왔습니다."],
    text: "이 중에 어디가 제일 좋나요?",
    options: {},
    react: {
      spend: ["돈을 제일 많이 쓴 곳을 골랐네요. 적어도 말과 지갑은 일치합니다.", "예상대로입니다. 영수증이 먼저 대답했거든요."],
      count: ["제일 많이 가진 브랜드군요. 여기까지는 예상 범위입니다.", "{count}벌이 이미 투표를 끝냈습니다."],
      recent: ["요즘 빠져 있는 곳이군요. 이 사랑이 얼마나 갈지 지켜보겠습니다.", "최근에 자주 산 곳이네요. 첫사랑은 조금 서운하겠습니다."],
      spend2: ["의외네요. 돈은 다른 데 더 썼는데요.", "좋아하는 곳과 돈을 쓴 곳이 다르군요. 흔한 일입니다."],
    },
  },
  rationalize: {
    lead: [],
    text: "이 중에 같은 역할을 하는 옷은 하나도 없다고 생각하나요?",
    options: { none: "하나도 없음", some: "몇 개는 겹침", why: "그걸 왜 물어봄" },
    react: {
      none: ["하나도 없다고요. 대단한 자신감입니다.", "그렇다면 {n}벌 모두 각자 사연이 있겠네요. 듣지는 않겠습니다."],
      some: ["몇 개라도 인정하셨으니 한 걸음 나아갔습니다.", "겹치는 걸 알고 있었군요. 그래서 더 궁금합니다."],
      why: ["궁금해서요. 대답을 피하시는 것 자체가 대답 같지만요.", "그냥요. 옷장이 먼저 대답한 것 같습니다."],
    },
  },
  extreme_one: {
    lead: [],
    text: "내일부터 평생 한 종류만 입을 수 있다면, 역시 {familyName|을} 고르겠나요?",
    options: { of_course: "당연히 이거", no: "그건 좀", already: "이미 그렇게 사는 중" },
    react: {
      of_course: ["예상했습니다. {n}벌이 이미 투표를 마쳤습니다.", "망설임이 없네요. 그래서 {n}벌이군요."],
      no: ["의외네요. {n}벌이나 있는데요.", "그럼 {n}벌은 어떻게 된 걸까요."],
      already: ["네, 옷장을 보니 알겠습니다.", "그렇게 보였습니다. 굳이 말씀 안 하셔도 됐습니다."],
    },
  },
  quiz: {
    lead: ["잠깐만요.", "이 정도 브랜드를 가지고 있으면 이것 정도는 알고 있겠죠."],
    text: "",
    options: {},
    react: {},
  },
  black_why: {
    lead: [],
    text: "검정 옷을 고르는 특별한 이유가 있나요?",
    options: { matches: "뭐랑 입어도 맞아서", no_thinking: "고민하기 싫어서", charcoal: "그거 검정 아니고 차콜인데" },
    react: {
      matches: ["맞습니다. 검정끼리는 싸우지 않죠. {n}벌이 평화롭게 지내고 있습니다.", "그래서 검정 옷끼리 입으면 또 잘 맞겠네요. 검정으로."],
      no_thinking: ["고민을 줄인 대가로 옷장이 어두워졌습니다. 공정한 거래입니다.", "현명합니다. 그 에너지는 다른 데 쓰시면 됩니다."],
      charcoal: ["죄송합니다. 적어 두신 색 이름을 기준으로 봤습니다. 검정으로 적혀 있더군요.", "제 눈에는 둘 다 어두운 색입니다. 옷장 조명 탓으로 하겠습니다."],
    },
  },
  chroma_love: {
    lead: [],
    text: "{color}에 무슨 사연이라도 있나요?",
    options: { love: "그냥 좋아함", suits: "잘 어울린다는 말 들음", didnt_know: "이게 그렇게 많았나" },
    react: {
      love: ["좋아하는 색이 있다는 건 좋은 일입니다. {n}벌이면 아주 좋아하는 거고요.", "사연 없는 사랑이 제일 오래갑니다."],
      suits: ["한 번 들은 칭찬이 {n}벌이 됐군요.", "그 말을 해 준 사람은 이 옷장을 보고 뭐라고 할지 궁금합니다."],
      didnt_know: ["{n}벌입니다. 이제 아셨습니다.", "모르는 사이에 {color|이} 옷장을 점령했습니다."],
    },
  },
  category_why: {
    lead: [],
    text: "{catName}만 유독 많이 모은 이유가 있나요?",
    options: { wear_most: "제일 자주 입어서", cant_stop: "다른 건 안 사게 됨", elsewhere: "나머지는 등록을 안 했음" },
    react: {
      wear_most: ["합리적입니다. 다만 나머지 옷들이 조금 서운해하겠네요.", "자주 입는 만큼 샀다면 계산은 맞습니다."],
      cant_stop: ["{catName} 코너 앞에서만 발이 멈추나 봅니다.", "그런 날이 쌓여서 {n}벌이 됐군요."],
      elsewhere: ["그럼 제가 본 옷장은 절반짜리였군요. 그래도 {n}벌은 {n}벌입니다.", "알겠습니다. 등록한 옷만 보고 말하겠습니다."],
    },
  },
  subcat_known: {
    lead: [],
    text: "{sub|이} 몇 벌인지 알고 있었나요?",
    options: { exact: "정확히 앎", roughly: "대충 앎", no: "전혀 몰랐음" },
    react: {
      exact: ["{n}벌인 걸 알면서 계속 샀다는 뜻이군요.", "알고 있었다면, 그건 계획입니다."],
      roughly: ["대충 생각한 숫자보다 많을 겁니다. {n}벌입니다.", "{n}벌입니다. 대충이 맞았는지 확인해 보세요."],
      no: ["{n}벌입니다. 놀라셨다면 다행입니다.", "모르는 사이에 {n}벌. 옷장이 알아서 번식한 것 같네요."],
    },
  },
  count_guess: {
    lead: ["숫자 하나 맞혀 보시겠어요?"],
    text: "모자·신발 빼고, 옷장에 옷이 몇 벌 있을까요?",
    options: {},
    react: {
      under: ["실제로는 {n}벌입니다. 생각보다 많죠.", "{n}벌입니다. 옷장은 늘 주인 생각보다 큽니다."],
      right: ["정확합니다. 알면서도 계속 샀다는 뜻이네요.", "맞습니다. {n}벌. 숫자 감각은 확실하시네요. 절제 감각과는 별개로요."],
      over: ["그보다는 적습니다. {n}벌입니다. 그렇게 느껴질 수는 있습니다.", "{n}벌입니다. 스스로에게 조금 엄격하시네요."],
    },
  },
  few_clothes: {
    lead: [],
    text: "옷이 적은 건 미니멀리즘인가요, 아직 다 안 넣은 건가요?",
    options: { minimal: "미니멀리스트임", not_yet: "아직 다 안 넣음", thats_all: "원래 이게 다임" },
    react: {
      minimal: ["존중합니다. 그렇다면 {n}벌 하나하나가 정예군이겠네요.", "미니멀리스트에게 옷 분석은 조금 가혹했을지도 모르겠습니다."],
      not_yet: ["그럼 다 넣고 다시 오세요. 더 할 말이 생길 겁니다.", "알겠습니다. 오늘은 맛보기라고 해 두죠."],
      thats_all: ["{n}벌로 사는 건 대단한 기술입니다.", "그렇다면 이 옷장은 효율 그 자체입니다."],
    },
  },
  many_clothes_wear: {
    lead: [],
    text: "{n}벌 중에 실제로 입고 다니는 옷은 몇 벌쯤 되나요?",
    options: { most: "대부분", half: "절반쯤", few: "열 벌 남짓", same: "매일 같은 옷만 입음" },
    react: {
      most: ["대단하시네요. 믿겠습니다. 일단은요.", "{n}벌을 다 입는다면 매일 옷장 앞 회의가 길겠습니다."],
      half: ["그럼 나머지 절반은 휴가 중이군요. 유급으로요.", "솔직하고 적당한 대답입니다."],
      few: ["솔직하시네요. 나머지는 옷장을 지키는 경비원입니다.", "그게 대부분의 옷장이 사는 방식입니다. 비싼 방식이죠."],
      same: ["{n}벌을 사 놓고 같은 옷을 입는다. 이 옷장의 가장 큰 미스터리입니다.", "그럼 나머지는 전시용이군요. 입장료는 안 받으시나요."],
    },
  },
  trend_source: {
    lead: [],
    text: "요즘 뜨는 브랜드는 주로 어디서 알게 되나요?",
    options: { sns: "인스타그램·유튜브", friends: "친구·지인", first: "원래 알던 게 뜬 거임" },
    react: {
      sns: ["알고리즘이 옷장을 꽤 많이 채웠네요.", "피드가 쇼핑 목록이 된 거군요. 흔한 일입니다."],
      friends: ["친구분들 취향이 옷장에 {n}벌 남았네요.", "좋은 친구들입니다. 비싼 친구들이기도 하고요."],
      first: ["원래 알던 거라고요. 다들 그렇게 말합니다.", "그렇다면 선구자시네요. 증명할 방법은 없지만요."],
    },
  },
  timeless_q: {
    lead: [],
    text: "유행은 아예 신경 안 쓰는 편인가요?",
    options: { never: "전혀 안 씀", bit: "조금은 봄", comes_back: "유행이 나한테 돌아옴" },
    react: {
      never: ["그렇게 보입니다. 옷장이 시간을 멈춰 두었네요.", "유행도 이 옷장에는 노크하고 들어와야겠습니다."],
      bit: ["조금은 보신다니 다행입니다. 옷장에는 아직 안 보이지만요.", "그 조금이 옷장에 반영되기까지는 시간이 좀 걸리나 봅니다."],
      comes_back: ["기다리는 전략이군요. 꽤 오래 기다리셔야 할 수도 있습니다.", "좋은 전략입니다. 인내심이 필요하다는 것만 빼면요."],
    },
  },
  hype_alarm: {
    lead: [],
    text: "발매일에 알람 맞춰 본 적 있나요?",
    options: { yes: "있음", no: "없음", secret: "그건 비밀" },
    react: {
      yes: ["솔직하시네요. 옷장이 이미 자백했지만요.", "그 알람, 아직 켜져 있을 것 같습니다."],
      no: ["없다고요. 그럼 운이 아주 좋으셨나 봅니다.", "알람 없이 이 정도면 감이 좋으신 겁니다."],
      secret: ["비밀은 지켜 드리겠습니다. 옷장은 못 지켰지만요.", "알겠습니다. 저도 묻지 않은 걸로 하겠습니다."],
    },
  },
  country_q: {
    lead: [],
    text: "{country} 브랜드가 대부분인 건 의도한 건가요?",
    options: { intended: "의도함", quality: "그냥 좋은 걸 골랐더니", didnt_know: "몰랐음" },
    react: {
      intended: ["확고하시네요. {pct}%면 확고한 게 맞습니다.", "의도한 거라면 성공입니다."],
      quality: ["좋은 걸 골랐더니 다 {country}였다. 꽤 강한 주장입니다.", "그럴 수 있습니다. 다른 나라 브랜드들은 조금 서운하겠지만요."],
      didnt_know: ["{pct}%입니다. 이제 아셨습니다.", "라벨의 원산지는 잘 안 보게 되죠."],
    },
  },
  mountain: {
    lead: [],
    text: "그 기능성, 실제로 산에서 써 본 적 있나요?",
    options: { often: "자주 감", sometimes: "가끔", subway: "주로 지하철에서 씀" },
    react: {
      often: ["그렇다면 이 옷들은 제 몫을 하고 있습니다. 부럽네요.", "훌륭합니다. 옷들이 보람을 느끼겠습니다."],
      sometimes: ["가끔이라도 쓰셨다니 다행입니다.", "그 가끔을 위해 준비가 철저하시네요."],
      subway: ["출근길도 나름 험하긴 합니다.", "지하철 냉방도 극한 환경이긴 하죠."],
    },
  },
  sports_q: {
    lead: [],
    text: "스포츠 브랜드 옷, 운동할 때도 입나요?",
    options: { workout: "운동할 때만", daily: "평소에 입음", no_workout: "운동은 안 함" },
    react: {
      workout: ["모범적입니다. 옷의 원래 용도를 지켜 주셨네요.", "옷들이 땀을 흘려 봤다니 다행입니다."],
      daily: ["운동복의 두 번째 인생이군요.", "편한 건 인정합니다."],
      no_workout: ["솔직하시네요. 옷들은 언젠가를 기다리고 있습니다.", "괜찮습니다. 운동하는 분위기도 중요하니까요."],
    },
  },
  recent_reason: {
    lead: [],
    text: "최근 한 달 사이에 {n}벌을 샀던데, 무슨 일 있었나요?",
    options: { sale: "세일이 있었음", season: "계절이 바뀜", birthday: "생일이었음", just: "그냥 샀음" },
    react: {
      sale: ["세일은 늘 있습니다. 그게 문제죠.", "할인율이 결제를 밀어준 거군요."],
      season: ["계절이 바뀌면 옷도 바뀌어야 하죠. {n}벌이나요.", "계절은 핑계로 쓰기 가장 좋은 이유입니다."],
      birthday: ["생일 축하합니다. {n}벌짜리 생일이었군요.", "스스로에게 주는 선물이 {n}벌. 통이 크시네요."],
      just: ["그냥이 {n}벌이 됐습니다.", "가장 솔직한 이유입니다. 가장 위험하기도 하고요."],
    },
  },
  binge_month: {
    lead: [],
    text: "{year}년 {month}월에 무슨 일이 있었나요?",
    options: { sale: "큰 세일", payday: "보너스·월급", forgot: "기억 안 남" },
    react: {
      sale: ["세일이 {n}벌을 데려왔군요.", "그 세일, 꽤 성공적이었네요. 판매자 입장에서요."],
      payday: ["돈이 들어오자마자 옷이 들어왔군요. 순환이 빠릅니다.", "경제는 이렇게 돌아가는 거죠."],
      forgot: ["기억은 없어도 {n}벌은 남았습니다.", "결제 내역은 기억하고 있을 겁니다."],
    },
  },
  season_gap: {
    lead: [],
    text: "{least}에는 뭘 입고 다니나요?",
    options: { rotate: "있는 옷으로 버팀", stay_in: "그땐 밖에 잘 안 나감", buy_soon: "곧 사려고 했음" },
    react: {
      rotate: ["{leastN}벌로 버티는 {least}. 꽤 치열하겠네요.", "돌려 입기의 달인이시군요."],
      stay_in: ["그것도 방법입니다. 가장 저렴한 방법이기도 하고요.", "집에서는 옷이 덜 중요하죠."],
      buy_soon: ["그럴 줄 알았습니다. 옷장이 조금 긴장하겠네요.", "다음 분석 때 {least} 옷이 늘어 있을 것 같습니다."],
    },
  },
  top_item_q: {
    lead: [],
    text: "가장 비싼 옷, 몇 번이나 입었나요?",
    options: { often: "자주 입음", few: "몇 번", saving: "아까워서 모셔 둠" },
    react: {
      often: ["훌륭합니다. 한 번 입을 때마다 가격이 조금씩 내려가고 있습니다.", "그렇다면 가장 잘한 소비입니다."],
      few: ["{priceWon}짜리를 몇 번. 한 번에 얼마인지는 계산하지 않겠습니다.", "몇 번이라도 입었다면 다행입니다."],
      saving: ["모셔 두는 옷이 가장 비싼 옷이군요. 옷도 외출하고 싶을 텐데요.", "아까워서 못 입는 옷이 {priceWon}입니다."],
    },
  },
  sale_q: {
    lead: [],
    text: "명품은 세일할 때만 사는 편인가요?",
    options: { yes: "그렇다", luck: "우연이다", never_full: "정가로 산 적 없음" },
    react: {
      yes: ["기다림도 실력입니다. {n}벌이나 성공하셨네요.", "현명한 소비자시네요. 옷장은 그 인내의 결과입니다."],
      luck: ["우연이 {n}번이면 실력입니다.", "운이 좋으시네요. 아주 여러 번."],
      never_full: ["원칙이 확고하시네요.", "정가는 남의 이야기군요."],
    },
  },
  splurge_q: {
    lead: [],
    text: "{brand}에서 {priceWon|이}면, 특별한 사연이 있는 옷인가요?",
    options: { special: "특별한 옷임", late: "가격을 나중에 봄", normal: "원래 그 가격임" },
    react: {
      special: ["특별한 옷이라면 이해합니다. 특별히 비쌌네요.", "사연 있는 옷은 가격이 중요하지 않죠. 카드 명세서만 빼고요."],
      late: ["가격표는 늘 늦게 보이죠.", "영수증이 먼저 말해 줬겠네요."],
      normal: ["그렇다면 그 브랜드에서도 꽤 높은 라인을 고르신 겁니다.", "알겠습니다. 그래도 {priceWon|은} {priceWon}입니다."],
    },
  },
  subcat_spend_q: {
    lead: [],
    text: "{sub}에만 쓴 돈이 {amountWon|이}라는 거, 알고 있었나요?",
    options: { knew: "알고 있었음", less: "이것보단 적을 줄", dont_tell: "말하지 마" },
    react: {
      knew: ["알고 있었다면 확신범입니다.", "계산된 소비였군요. {n}벌에 걸쳐서요."],
      less: ["숫자는 늘 생각보다 큽니다.", "{sub|은} 한 벌씩 샀어도 금액은 한꺼번에 보이니까요."],
      dont_tell: ["이미 말해 버렸습니다. 죄송합니다.", "늦었습니다. {amountWon}입니다."],
    },
  },
  max_budget: {
    lead: [],
    text: "옷 한 벌에 쓸 수 있는 최대 금액은 얼마인가요?",
    options: { b10: "10만 원까지", b30: "30만 원까지", b100: "100만 원까지", nolimit: "한도 없음" },
    react: {
      below: ["옷장에 {maxWon}짜리가 있는데요.", "원칙은 좋습니다. 옷장은 그 원칙을 적어도 한 번 어겼습니다. {maxWon}으로요."],
      within: ["한도 안에서 가장 비싼 옷이 {maxWon}이군요. 말과 옷장이 일치합니다. 드문 일입니다.", "넉넉한 한도입니다. 아직 {maxWon}까지밖에 안 썼다는 게 더 무섭네요."],
      nolimit: ["가장 위험한 대답입니다.", "솔직해서 좋습니다. 카드사도 좋아하겠네요."],
    },
  },
  fit_choice: {
    lead: [],
    text: "{fit} 핏만 고르는 건 의도한 건가요?",
    options: { comfy: "이게 제일 편함", awkward: "다른 핏은 어색함", have_others: "다른 핏도 있는데?" },
    react: {
      comfy: ["편한 핏을 찾았다면 반은 성공입니다.", "편함은 타협할 수 없는 가치죠."],
      awkward: ["어색함을 피하다 보니 {n}벌이 같아졌군요.", "한 번쯤 어색해 보는 것도 나쁘지 않습니다."],
      have_others: ["있긴 합니다. {pct}%가 {fit}인 옷장에서요.", "맞습니다. 소수 의견도 존중합니다."],
    },
  },
  style_self: {
    lead: [],
    text: "스스로 생각하는 스타일이 {tag} 쪽인가요?",
    options: { yes: "맞음", no: "아님", none: "스타일 같은 거 없음" },
    react: {
      yes: ["자기 객관화가 잘 되어 있으시네요.", "옷장과 본인의 의견이 일치합니다. 드문 일입니다."],
      no: ["옷장은 그렇다고 하는데요.", "그럼 옷장이 거짓말을 하고 있는 걸까요."],
      none: ["없다고 하시기엔 {pct}%가 {tag}입니다.", "스타일이 없다는 것도 스타일입니다. 그리고 옷장은 {tag}라고 합니다."],
    },
  },
  brand_pick: {
    lead: [],
    text: "브랜드를 고를 때 가장 중요한 건 뭔가요?",
    options: { design: "디자인", price: "가격", vibe: "브랜드 분위기" },
    react: {
      design: ["디자인이라고요. 그런데 결국 비슷한 걸 고르셨습니다.", "그 디자인들이 서로 꽤 닮았더군요."],
      price: ["현실적이시네요.", "가격을 보고 골랐는데 결과는 비슷하다니, 일관성은 확실합니다."],
      vibe: ["분위기는 브랜드마다 달랐을 텐데, 옷장에 오면 다 비슷해지네요.", "{brands}개 브랜드의 분위기가 옷장에서 하나로 합쳐졌습니다."],
    },
  },
  old_trust: {
    lead: [],
    text: "오래된 브랜드가 더 믿음이 가나요?",
    options: { history: "역사가 곧 품질", chance: "우연임", new_too: "새 브랜드도 좋아함" },
    react: {
      history: ["{year}년부터 이어진 신뢰군요.", "오래 살아남은 데는 이유가 있다는 말씀이군요."],
      chance: ["우연이 {pct}%면 꽤 꾸준한 우연입니다.", "우연이라고 하기엔 브랜드들 나이가 비슷하게 많습니다."],
      new_too: ["옷장에서는 아직 잘 안 보입니다.", "그 새 브랜드들은 어디에 숨어 있나요."],
    },
  },
  niche_known: {
    lead: [],
    text: "주변 사람들이 이 브랜드들을 알아보나요?",
    options: { nobody: "아무도 모름", those_who_know: "알 사람은 앎", rather_not: "알아보면 오히려 불편함" },
    react: {
      nobody: ["그게 매력이겠죠. 설명하는 재미도 있고요.", "아무도 모르는 옷에 돈을 쓰는 건 꽤 고급 취미입니다."],
      those_who_know: ["그 '알 사람'이 몇 명인지 궁금합니다.", "좁고 깊은 인맥 같은 옷장이네요."],
      rather_not: ["알아보면 불편하다니, 취향이 꽤 까다로우시네요.", "그렇다면 이 옷장은 성공적으로 숨어 있습니다."],
    },
  },
  formal_job: {
    lead: [],
    text: "평소에 단정하게 입어야 하는 일을 하나요?",
    options: { yes: "맞음", no: "아님", like: "그냥 단정한 게 좋음" },
    react: {
      yes: ["그렇다면 옷장이 성실하게 일하고 있는 겁니다.", "출근복이 옷장을 이끌고 있군요."],
      no: ["그럼 이 단정함은 순수한 취향이군요.", "아무도 시키지 않았는데 단정하다니, 대단합니다."],
      like: ["단정함이 취미군요.", "좋은 취미입니다. 다림질은 조금 힘들겠지만요."],
    },
  },
  same_outfit_street: {
    lead: [],
    text: "길에서 같은 옷 입은 사람 본 적 있나요?",
    options: { often: "자주 봄", sometimes: "가끔", not_yet: "아직 없음" },
    react: {
      often: ["그럴 때 눈인사는 하시나요?", "같은 취향의 동지들이 많다는 뜻입니다."],
      sometimes: ["가끔이면 운이 좋은 편입니다.", "대중적인 브랜드의 숙명이죠."],
      not_yet: ["아직이라는 단어가 중요합니다.", "곧 만나게 될 겁니다."],
    },
  },
  brand_alert: {
    lead: [],
    text: "{brand} 신상 알림, 켜 두었나요?",
    options: { on: "켜 둠", off: "아님", no_need: "알림 없이도 앎" },
    react: {
      on: ["역시. {n}벌은 그렇게 모이는 거군요.", "알림이 옷장을 채우고 있었군요."],
      off: ["알림 없이 {n}벌이라니, 더 대단합니다.", "그럼 {n}벌은 순전히 본인의 의지입니다."],
      no_need: ["그 정도면 알림보다 빠른 거죠.", "이미 몸이 기억하는 단계군요."],
    },
  },
  brand_spend_q: {
    lead: [],
    text: "{brand}에 쓴 돈이 {amountWon|이}라는 거, 알고 있었나요?",
    options: { knew: "알고 있었음", less: "이것보단 적을 줄", dont_tell: "말하지 마" },
    react: {
      knew: ["알고 있었다면 확신범입니다.", "계산이 된 소비였군요."],
      less: ["숫자는 늘 생각보다 큽니다.", "옷은 한 벌씩 사도 금액은 한꺼번에 보이니까요."],
      dont_tell: ["이미 말해 버렸습니다. 죄송합니다.", "늦었습니다."],
    },
  },
  shoes_q: {
    lead: [],
    text: "신발이 {n}켤레입니다. 전부 신고 다니나요?",
    options: { all_wear: "돌아가면서 다 신음", collect: "모으는 게 취미", one_pair: "결국 한두 켤레만 신음" },
    react: {
      all_wear: ["{n}켤레를 다 돌리려면 한 켤레는 한 달에 한 번쯤 외출하겠네요.", "성실한 신발장입니다. 믿기로 하겠습니다."],
      collect: ["그럼 신발장이 아니라 전시장이군요.", "솔직하시네요. 신발들도 알고는 있었을 겁니다."],
      one_pair: ["나머지는 신발장 경비원이군요.", "{n}켤레 중 한두 켤레. 가장 흔하고 가장 비싼 결말입니다."],
    },
  },
  shoe_sub_q: {
    lead: [],
    text: "{sub|이} {n}켤레입니다. 발이 두 개인 건 알고 계시죠?",
    options: { two: "알고 있음", mood: "기분 따라 다름", different: "다 다르게 생겼음" },
    react: {
      two: ["다행입니다. 그런데도 {n}켤레라는 게 더 흥미롭네요.", "알면서 {n}켤레. 확신범이시군요."],
      mood: ["기분이 {n}가지나 되는군요.", "그 기분들, 대부분 {sub} 모양이네요."],
      different: ["본인 눈에는 그렇겠죠. 제 눈에는 {sub} {n}켤레입니다.", "차이를 아는 건 본인과 신발뿐입니다."],
    },
  },
  hats_q: {
    lead: [],
    text: "모자가 {n}개입니다. 머리는 하나인데 순서는 어떻게 정하나요?",
    options: { mood: "그날 기분", hair: "머리 안 감은 날 순서", collect: "쓰진 않고 모음" },
    react: {
      mood: ["기분이 {n}가지는 되는 것 같습니다.", "모자가 기분을 정하는 건지, 기분이 모자를 정하는 건지."],
      hair: ["가장 현실적인 대답입니다. 모자의 진짜 용도죠.", "그럼 모자 {n}개는 {n}일치 비상식량이군요."],
      collect: ["모자걸이가 전시대가 됐군요.", "머리에 쓰지 않는 모자라니, 가장 편안한 모자들입니다."],
    },
  },
  hat_sub_q: {
    lead: [],
    text: "모자 {total}개 중 {sub|이} {n}개네요. 다른 모자는 안 어울려서인가요?",
    options: { face: "이게 제일 어울림", safe: "실패가 없어서", different: "다 다른 모자임" },
    react: {
      face: ["얼굴이 정답을 알려 줬군요.", "찾았으면 됐습니다. 계속 찾으시는 것 같지만요."],
      safe: ["안전한 선택을 {n}번 하셨네요.", "실패는 없었지만 모험도 없었습니다."],
      different: ["다 다르다는 말, 오늘 여러 번 듣는 것 같습니다.", "{sub} {n}개가 다 다르다니, 저는 모르겠습니다."],
    },
  },
  vintage_q: {
    lead: [],
    text: "빈티지숍은 자주 가나요?",
    options: { often: "자주 감", browse: "가끔 구경만", no_used: "남이 입던 옷은 좀" },
    react: {
      often: ["그럼 등록 안 한 옷이 더 있겠군요. 무섭네요.", "옷에도 전생이 있다고 믿는 분이군요."],
      browse: ["구경만 한다는 말, 매장 직원들도 많이 듣습니다.", "구경이 결제로 바뀌는 건 한순간입니다."],
      no_used: ["새 옷만 고집하시는군요. 옷장이 늘 새것 냄새가 나겠습니다.", "깔끔하시네요. 지갑은 덜 깔끔하겠지만요."],
    },
  },
  influencer_q: {
    lead: [],
    text: "패션 인플루언서 영상, 자주 보나요?",
    options: { daily: "매일 봄", sometimes: "가끔", never: "안 봄" },
    react: {
      daily: ["그럼 이 옷장 일부는 공동 작업이네요.", "알고리즘이 스타일리스트였군요."],
      sometimes: ["가끔이라기엔 옷장에 흔적이 꽤 있습니다.", "가끔 본 영상이 가끔 결제로 이어졌겠죠."],
      never: ["그렇다면 이 옷장은 순수 창작물입니다. 칭찬인지는 모르겠습니다.", "안 본다는 사람일수록 추천 영상이 많던데요."],
    },
  },
  fashionable_q: {
    lead: ["마지막으로 하나만요."],
    text: "스스로 패셔너블한 사람이라고 생각하나요? 솔직하게 대답하세요.",
    options: { yes: "그렇다", normal: "평범하다", no: "전혀 아니다", others_say: "남들이 그렇다던데" },
    react: {
      yes: ["자신감은 훌륭합니다. 옷장과 상의는 해 보셨나요?", "알겠습니다. 결과 글을 읽고도 같은 생각이면 진짜입니다."],
      normal: ["겸손하시네요. 옷장은 조금 다른 의견입니다.", "평범함을 유지하는 데 이만큼의 옷이 필요했군요."],
      no: ["솔직해서 좋습니다. 그럼 이 옷들은 누가 고른 건가요.", "스스로 아니라고 하면 저는 할 말이 줄어듭니다. 줄기만 합니다."],
      others_say: ["그 남들이 누군지 궁금합니다. 혹시 판매 직원인가요?", "남의 말은 공짜입니다. 옷은 아니었지만요."],
    },
  },
};

export interface AskedQuestion {
  id: string;
  lead: string[];
  text: string;
  options: { id: string; label: string; photoId?: string }[];
  /** 선택지 id별 반응(이미 값이 채워진 문장) */
  reactions: Record<string, string>;
  photos: string[];
  /** 퀴즈 정답 선택지 id */
  answer?: string;
  quizId?: string;
}

/** 브랜드 셋: 금액 1위, 벌 수 1위, 최근 90일 구매 1위(없으면 금액 2위). 각 2벌 이상, 서로 달라야 한다. */
export function brandTrio(a: Analysis): { kind: "spend" | "count" | "recent" | "spend2"; label: string; count: number; ids: string[] }[] | null {
  const byBrand = new Map<string, Item[]>();
  for (const i of a.items) if (i.brand) byBrand.set(i.brand.name, [...(byBrand.get(i.brand.name) ?? []), i]);
  const brands = [...byBrand.entries()].filter(([, list]) => list.length >= 2).map(([key, list]) => ({
    key,
    list,
    label: list[0].brandLabel || key,
    amount: list.reduce((s, i) => s + (i.price ?? 0), 0),
    recent: list.filter((i) => i.date && a.now.getTime() - Date.parse(i.date) <= 90 * DAY && Date.parse(i.date) <= a.now.getTime()).length,
  }));
  if (brands.length < 3) return null;
  const pickBy = (score: (b: (typeof brands)[number]) => number, taken: Set<string>) =>
    brands.filter((b) => !taken.has(b.key) && score(b) > 0).sort((x, y) => score(y) - score(x) || x.key.localeCompare(y.key))[0];
  const taken = new Set<string>();
  const spend = pickBy((b) => b.amount, taken);
  if (!spend) return null;
  taken.add(spend.key);
  const count = pickBy((b) => b.list.length, taken);
  if (!count) return null;
  taken.add(count.key);
  let third = pickBy((b) => (b.recent >= 2 ? b.recent : 0), taken);
  let kind: "recent" | "spend2" = "recent";
  if (!third) {
    third = pickBy((b) => b.amount, taken);
    kind = "spend2";
  }
  if (!third) return null;
  return [
    { kind: "spend", label: spend.label, count: spend.list.length, ids: spend.list.map((i) => i.id) },
    { kind: "count", label: count.label, count: count.list.length, ids: count.list.map((i) => i.id) },
    { kind, label: third.label, count: third.list.length, ids: third.list.map((i) => i.id) },
  ];
}

/** 옷장 벌 수 맞히기: 정답 하나와 적당히 떨어진 숫자 둘(예: 40·60·90) */
function countChoices(n: number, r: Rng): number[] {
  const shapes = [
    [1, 1.5, 2.2],
    [0.45, 0.7, 1],
    [0.65, 1, 1.5],
  ];
  const round = (x: number) => (x >= 40 ? Math.round(x / 5) * 5 : Math.round(x));
  const nums = r.pick(shapes).map((k) => (k === 1 ? n : round(n * k)));
  const gap = Math.max(3, Math.round(n * 0.2));
  const ok = nums.every((x, i) => i === 0 || x - nums[i - 1] >= gap);
  return ok ? nums : [Math.max(1, n - 2 * gap), n, n + 2 * gap].map((x, i) => (i === 1 ? x : round(x)));
}

const BUDGET: Record<string, number> = { b10: 100_000, b30: 300_000, b100: 1_000_000 };

export function pickQuestions(a: Analysis, r: Rng, fill: (t: string, v: Vars) => string, T: RoastTexts): AskedQuestion[] {
  const candidates = QUESTIONS.map((q) => ({ q, vars: q.when(a) }))
    .filter((c): c is { q: QuestionDef; vars: Vars } => c.vars != null)
    .map((c) => {
      const p = c.q.pattern ? pat(a, c.q.pattern) : undefined;
      const boost = c.vars.boost ? 0.15 : 0;
      const score = c.q.base * 0.6 + (p ? p.strength * p.interest * 0.4 : 0.15) + boost + r.next() * 0.35;
      return { ...c, score };
    })
    .sort((x, y) => y.score - x.score);
  const asked: AskedQuestion[] = [];
  const buckets = new Set<string>();
  const want = candidates.length >= 3 ? (r.next() < 0.3 ? 2 : 3) : candidates.length;
  for (const c of candidates) {
    if (asked.length >= want) break;
    if (buckets.has(c.q.bucket)) continue;
    let built: AskedQuestion | null;
    try {
      built = build(c.q, c.vars, a, r, fill, T);
    } catch (e) {
      // 고친 문장에 이 옷장에서 채울 수 없는 자리가 있으면 그 질문만 건너뛴다.
      if (e instanceof MissingVar) continue;
      throw e;
    }
    if (!built) continue;
    buckets.add(c.q.bucket);
    asked.push(built);
  }
  return asked;
}

function build(q: QuestionDef, vars: Vars, a: Analysis, r: Rng, fill: (t: string, v: Vars) => string, T: RoastTexts): AskedQuestion | null {
  const tx = T.questions[q.id];
  if (!tx) return null;
  const f = (t: string, v: Vars = vars) => fill(t, v);
  const photos = q.photos?.(a) ?? [];
  const base = { id: q.id, lead: tx.lead.map((l) => f(l)), text: tx.text ? f(tx.text) : "", photos };
  if (q.id === "odd_photo" && !photos.length) return null;

  if (q.id === "quiz") {
    const quiz = pickQuiz(a, r, T);
    if (!quiz) return null;
    const ids = quiz.options.map((_, i) => String(i));
    return {
      ...base,
      quizId: quiz.id,
      text: quiz.question,
      options: r.shuffle(ids).map((id) => ({ id, label: quiz.options[Number(id)] })),
      answer: String(quiz.answer),
      reactions: Object.fromEntries(
        ids.map((id) => {
          const ok = Number(id) === quiz.answer;
          return [id, `${r.pick(ok ? T.common.QUIZ_CORRECT : T.common.QUIZ_WRONG)} ${r.pick(ok ? quiz.correct : quiz.wrong)}`.trim()];
        }),
      ),
      photos: [],
    };
  }
  if (q.id === "drop_item") {
    const top3 = priced(a).sort((x, y) => y.price! - x.price!).slice(0, 3);
    if (top3.length < 3) return null;
    const kinds = ["most", "mid", "least"];
    const options = top3.map((i) => ({ id: i.id, label: `${i.brandLabel} ${i.g.productName}`.trim(), photoId: i.hasPhoto ? i.id : undefined }));
    const reactions = Object.fromEntries(top3.map((i, k) => [i.id, f(r.pick(tx.react[kinds[k]]), { priceWon: won(i.price!) })]));
    return { ...base, options: r.shuffle(options), reactions };
  }
  if (q.id === "brand_best") {
    const trio = brandTrio(a);
    if (!trio) return null;
    const options = trio.map((b) => ({ id: b.label, label: b.label, photoId: photoIds(a, b.ids)[0] }));
    const reactions = Object.fromEntries(trio.map((b) => [b.label, f(r.pick(tx.react[b.kind]), { count: b.count })]));
    return { ...base, options: r.shuffle(options), reactions };
  }
  if (q.id === "count_guess") {
    const n = Number(vars.n);
    const nums = countChoices(n, r);
    const options = nums.map((x) => ({ id: String(x), label: `${x}벌` }));
    const reactions = Object.fromEntries(nums.map((x) => [String(x), f(r.pick(tx.react[x < n ? "under" : x === n ? "right" : "over"]))]));
    return { ...base, options, reactions };
  }
  const options = q.options.map((id) => ({ id, label: tx.options[id] ?? id }));
  const reactKey = (id: string) => {
    if (q.id !== "max_budget") return id;
    if (id === "nolimit") return "nolimit";
    return BUDGET[id] < Number(vars.max) ? "below" : "within";
  };
  return {
    ...base,
    options,
    reactions: Object.fromEntries(options.map((o) => [o.id, f(r.pick(tx.react[reactKey(o.id)]))])),
  };
}

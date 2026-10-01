import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { CategoryId } from "@/lib/types/domain";
import { fitSummary, type Analysis, type Item, type Pattern } from "./analyze";
import { familyName, type FamilyId } from "./keywords";
import { findBand } from "./bands";
import { ORDER_Q_TEXT } from "./orders/texts";
import { pickQuiz } from "./quiz";
import { reactPool } from "./react-when";
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
  /** 결과 글에서 답을 두고 한 번 더 비꼬는 문단. 반응 종류 → 문장들(하나 고름) */
  roast: Record<string, string[]>;
  /** 반응 종류 → 반응 목록과 같은 순서의 조건(react-when.ts). 빈 칸은 조건 없음 */
  when?: Record<string, string[]>;
  /** 반응 종류 → 반응 목록과 같은 순서의 결과 글. 조건이 맞아 그 반응이 나왔을 때 roast 대신 쓴다. 빈 칸은 원래 결과 글 */
  result?: Record<string, string[]>;
}

/** 반응마다 조건을 붙일 수 없는 질문(반응을 코드가 따로 만든다) */
export const NO_REACT_WHEN = new Set(["quiz", "band_quiz", "drop_item", "brand_best"]);

const pat = (a: Analysis, id: string) => a.patterns.find((p) => p.id === id);
const has = (a: Analysis, id: string) => Boolean(pat(a, id));
const photoIds = (a: Analysis, ids: string[]) => ids.filter((id) => a.items.find((i) => i.id === id)?.hasPhoto);
const stats = (p: Pattern | undefined) => (p ? { ...p.stats } : null);
const priced = (a: Analysis) => a.items.filter((i) => i.price != null && i.price > 0);
/** 가격을 적은 옷(모자·신발 제외) */
const pricedClothes = (a: Analysis) => priced(a).filter((i) => i.cat !== "hat" && i.cat !== "shoes");
/** 가격을 적은 옷 중 기준 금액 이상인 옷의 비율(5벌 이상일 때만) */
const shareOver = (a: Analysis, min: number) => {
  const list = priced(a);
  return list.length >= 5 ? list.filter((i) => i.price! >= min).length / list.length : 0;
};
const DAY = 86_400_000;
/** 선택지·사진 옆에 적는 금액(사이트의 "N ￦" 표기) */
const amountLabel = (n: number) => `${n.toLocaleString("ko-KR")} ￦`;
/** 답한 뒤 보여 줄 옷: 사진과 가격이 있는 옷을 비싼 순으로 여덟 벌까지 */
const pricedPhotos = (a: Analysis, ids: string[]) =>
  a.items
    .filter((i) => ids.includes(i.id) && i.hasPhoto && i.price != null && i.price > 0)
    .sort((x, y) => y.price! - x.price!)
    .slice(0, 8)
    .map((i) => ({ id: i.id, amount: amountLabel(i.price!) }));

/** 침착맨 또는 얼렁뚱땅 상점 옷이 하나라도 있으면 { n } (브랜드 자료의 두 브랜드는 서로 다른 브랜드다) */
export function chimchakItems(a: Analysis): { n: number } | null {
  const n = a.items.filter((i) => i.brand?.name === "CHIMCHAKMAN" || i.brand?.name === "얼렁뚱땅 상점").length;
  return n ? { n } : null;
}

/** 늘 따로 붙이는 질문(질문 수에 세지 않는다) */
const APPENDED = ["chimchak_q", "fashionable_q"];

/** 구매 링크가 그 쇼핑몰인 옷 */
export const fromShop = (a: Analysis, shop: string) => a.items.filter((i) => i.shop === shop);

export const QUESTIONS: QuestionDef[] = [
  { id: "odd_photo", bucket: "odd", pattern: "odd_one", base: 0.9, options: ["mine", "gift", "dunno"],
    when: (a) => (a.oddOne?.item.hasPhoto ? { brand: a.oddOne.item.brandLabel || "이 옷", name: a.oddOne.item.g.productName, reason: a.oddOne.reason || "다른 옷들과 거의 안 겹치는 점" } : null),
    photos: (a) => (a.oddOne ? [a.oddOne.item.id] : []) },
  { id: "justify_combo", bucket: "justify", pattern: "combo_repeat", base: 0.85, options: ["different", "similar", "dunno"],
    when: (a) => stats(pat(a, "combo_repeat")),
    photos: (a) => photoIds(a, pat(a, "combo_repeat")?.garmentIds ?? []) },
  { id: "color_taste", bucket: "color", pattern: "achromatic_bias", base: 0.8, options: ["black_easy", "just_happens", "have_colors"],
    when: (a) => stats(pat(a, "achromatic_bias")) },
  { id: "brand_employee", bucket: "brand", pattern: "brand_focus", base: 0.85, options: ["love", "sale", "didnt_know"],
    when: (a) => stats(pat(a, "brand_focus")),
    photos: (a) => photoIds(a, pat(a, "brand_focus")?.garmentIds ?? []) },
  // 가격을 적은 옷 중 20만 원 이상이 20% 이상
  { id: "food_vs_clothes", bucket: "money", base: 0.75, options: ["food", "clothes", "both"],
    when: (a) => (shareOver(a, 200_000) >= 0.2 ? { pct: Math.round(shareOver(a, 200_000) * 100) } : null) },
  // 가격을 적은 옷 중 50만 원 이상이 20% 이상
  { id: "golden_spoon", bucket: "money", base: 0.85, options: ["no", "yes", "skip"],
    when: (a) => (shareOver(a, 500_000) >= 0.2 ? { pct: Math.round(shareOver(a, 500_000) * 100) } : null) },
  // 가장 비싼 옷 3벌 중 하나 버리기(가격 적은 옷 5벌 이상)
  { id: "drop_item", bucket: "drop", base: 0.75, options: [], when: (a) => (pricedClothes(a).length >= 3 ? {} : null) },
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
  { id: "quiz", bucket: "quiz", base: 0.85, options: [], when: (a) => (a.brandNames.length ? {} : null) },
  // 옷 이름·브랜드에 밴드 이름이 있으면 꼭 낸다(사용자 요청)
  { id: "band_quiz", bucket: "band", base: 0.9, options: [], when: (a) => (findBand(a) ? { band: findBand(a)!.band.name } : null) },
  // 언더아머 옷이 있으면 꼭 묻는다(사용자 요청)
  { id: "three_500", bucket: "ua", base: 0.9, options: ["over", "soon", "dots", "comfy"],
    when: (a) => (a.items.some((i) => i.brand?.name === "Under Armour") ? {} : null),
    photos: (a) => photoIds(a, a.items.filter((i) => i.brand?.name === "Under Armour").map((i) => i.id)).slice(0, 3) },
  { id: "black_why", bucket: "color", pattern: "black_bias", base: 0.8, options: ["matches", "no_thinking", "charcoal"],
    when: (a) => stats(pat(a, "black_bias")) },
  { id: "chroma_love", bucket: "color", pattern: "chroma_bias", base: 0.75, options: ["love", "suits", "didnt_know"],
    when: (a) => stats(pat(a, "chroma_bias")),
    photos: (a) => photoIds(a, pat(a, "chroma_bias")?.garmentIds ?? []) },
  { id: "category_why", bucket: "category", pattern: "category_bias", base: 0.55, options: ["wear_most", "cant_stop", "elsewhere"],
    when: (a) => {
      const p = pat(a, "category_bias");
      return p ? { ...p.stats, catName: CATEGORY_NAME[p.stats.cat as CategoryId] } : null;
    } },
  { id: "few_clothes", bucket: "count", pattern: "count_small", base: 0.5, options: ["minimal", "not_yet", "thats_all"],
    when: (a) => stats(pat(a, "count_small")) },
  { id: "many_clothes_wear", bucket: "count", pattern: "count_many", base: 0.65, options: ["most", "half", "few", "same"],
    when: (a) => stats(pat(a, "count_huge") ?? pat(a, "count_many")) },
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
  { id: "fit_choice", bucket: "fit", base: 0.6, options: ["intended", "comfy", "dunno"],
    when: (a) => {
      const f = fitSummary(a.clothes);
      if (f.fitted.length < 5) return null;
      const trim = f.all.trimShare >= f.all.bigShare;
      return { n: f.fitted.length, pct: Math.round((trim ? f.all.trimShare : f.all.bigShare) * 100), fit: trim ? "슬림·레귤러" : "세미오버·오버" };
    } },
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
  { id: "jjanggu_q", bucket: "twin", pattern: "identical_items", base: 0.95, options: ["yes", "liked", "laundry"],
    when: (a) => stats(pat(a, "identical_items")),
    photos: (a) => photoIds(a, pat(a, "identical_items")?.garmentIds ?? []) },
  { id: "musinsa_q", bucket: "shop", pattern: "musinsa_kr", base: 0.85, options: ["ranking", "sale", "convenient", "not_me"],
    when: (a) => stats(pat(a, "musinsa_kr")) },
  { id: "shop_q", bucket: "shop", pattern: "shop_focus", base: 0.6, options: ["points", "habit", "best"],
    when: (a) => stats(pat(a, "shop_focus")) },
  // 중고 거래 앱 구매 링크가 3개 이상
  { id: "fruits_q", bucket: "used", base: 0.8, options: ["vintage", "price", "resell"],
    when: (a) => (fromShop(a, "후르츠패밀리").length >= 3 ? { n: fromShop(a, "후르츠패밀리").length } : null),
    photos: (a) => photoIds(a, fromShop(a, "후르츠패밀리").map((i) => i.id)) },
  { id: "bunjang_q", bucket: "used", base: 0.8, options: ["deal", "rare", "regret"],
    when: (a) => (fromShop(a, "번개장터").length >= 3 ? { n: fromShop(a, "번개장터").length } : null),
    photos: (a) => photoIds(a, fromShop(a, "번개장터").map((i) => i.id)) },
  // 옷장과 상관없이 누구에게나 물을 수 있는 질문. 관련 패턴이 있으면 조금 더 자주 나온다.
  { id: "vintage_q", bucket: "self", base: 0.35, options: ["often", "browse", "no_used"],
    when: (a) => ({ boost: has(a, "old_brands") || has(a, "trait_heritage") || has(a, "group_jp_denim") || has(a, "group_heritage") ? 1 : 0 }) },
  { id: "influencer_q", bucket: "self", base: 0.4, options: ["daily", "sometimes", "never"],
    when: (a) => ({ boost: has(a, "trait_trendy") || has(a, "trait_hype") ? 1 : 0 }) },
  // 아래 두 질문은 pickQuestions가 따로 붙인다(질문 수와 상관없이). 침착맨 질문 → 마지막 질문 순서.
  { id: "chimchak_q", bucket: "chimchak", base: 0, options: ["love", "sometimes", "clothes_only"], when: (a) => chimchakItems(a) },
  { id: "fashionable_q", bucket: "last", base: 0, options: ["yes", "normal", "no", "others_say"], when: () => ({}) },
];

export const Q_TEXT: Record<string, QuestionText> = {
  // 주문내역 훈수 질문(관리자 화면에서는 "주문내역 훈수" 탭에서 고친다)
  ...ORDER_Q_TEXT,
  odd_photo: {
    lead: ["잠깐만요.", "이 옷을 고른 이유는 {reason}입니다. 옷장 전체에서 열 벌에 한 벌도 안 되는 것들인데, 이 옷 하나에 전부 몰려 있어요."],
    text: "이건 정말 본인 옷 맞나요?",
    options: { mine: "내 옷 맞음", gift: "선물 받은 거", dunno: "나도 왜 샀는지 모르겠음" },
    react: {
      mine: ["알겠습니다. 그렇다면 이 옷만 다른 세계관에서 온 이유는 아직 설명되지 않았네요.", "본인 옷이군요. 그럼 이 옷이 옷장에서 어떤 기분일지 한 번쯤 생각해 주세요."],
      gift: ["선물이었군요. 이제야 흐름이 다시 이해됩니다.", "선물이라면 모든 게 설명됩니다. 준 사람의 취향까지는 묻지 않겠습니다."],
      dunno: ["솔직해서 좋습니다. 저도 모르겠습니다.", "그 대답이 제일 설득력 있습니다."],
    },
    roast: {
      mine: ["문제의 그 옷이 본인 옷이 맞다고 당당히 인정하셨습니다. 옷장 전체가 한 방향으로 걷는데 혼자 역주행하는 그 옷, 이제 핑계 댈 사람도 없습니다.", "본인 옷이 맞다는 인정은 빨랐습니다. 다만 그 옷이 옷장에서 혼자 겉도는 이유는 아직 아무도 설명하지 못했습니다."],
      gift: ["옷장에서 가장 이상한 옷을 선물로 돌리셨습니다. 편리한 알리바이지만, 버리지 않고 고이 모셔 두고 있다는 건 결국 본인 책임입니다.", "'선물'이라는 해명. 준 사람의 취향도 걱정되지만, 그걸 옷장에 정식으로 등록까지 한 쪽의 의리가 더 무섭습니다."],
      dunno: ["왜 샀는지 본인도 모르는 옷이 있다고 하셨습니다. 결제 버튼을 누르던 그날의 당신은 아직 아무에게도 사과하지 않았습니다.", "기억은 사라졌는데 옷은 남았습니다. 그 튀는 옷의 정체를 본인도 모른다니, 쇼핑이 무서운 이유가 바로 이겁니다."],
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
    roast: {
      different: ["같은 색, 같은 종류의 옷들이 전부 역할이 다르다고 우기셨습니다. 그 미세한 차이를 구분하는 눈으로 다른 색도 한번 봐 주시길 바랍니다.", "전부 다른 옷이라니요? 남들 눈에는 복사 붙여넣기인데, 본인 눈에만 보이는 차이로 옷장을 채우고 계십니다."],
      similar: ["비슷하다는 건 순순히 인정하셨습니다. 알면서도 또 샀다는 뜻이니, 이건 실수가 아니라 신념입니다. 신념은 존중하지만 옷장 공간은 한정돼 있습니다.", "겹치는 걸 알면서 샀다는 게 핵심입니다. 모르고 산 사람은 구제할 수 있어도, 알고 산 사람은 방법이 없습니다."],
      dunno: ["똑같이 생긴 옷들의 역할을 본인도 모르겠다고 하셨습니다. 주인도 구분 못 하는 옷들이 옷장 안에서 서로 자리싸움을 하고 있습니다.", "잘 모르겠다는 대답은 솔직해서 좋았습니다. 다만 모르는 채로 계속 사 모은 결과가 바로 지금 이 옷장입니다."],
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
    roast: {
      black_easy: ["검정이 제일 편하다고 하셨습니다. 편한 건 좋은데, 그 편함이 쌓이고 쌓여 이제 옷장 문을 열면 조명부터 찾게 됩니다.", "편하다는 이유 하나로 색을 통째로 포기한 결과가 이겁니다. 불 꺼진 창고 같은 옷장이라니, 꽤 비싼 편안함입니다."],
      just_happens: ["그냥 자꾸 그렇게 된다고 하셨죠. 매번 우연히 무채색을 집어 드는 손, 그걸 우리는 취향이 아니라 습관이라고 부릅니다.", "어쩌다 보니 무채색이 됐다고요? 어쩌다가 이렇게까지 한결같기도 쉽지 않은데, 그 일관성을 다른 데 쓰셨으면 좋겠습니다."],
      have_colors: ["색 있는 옷도 많다고 반박하셨습니다. 옷장을 다시 열어 보세요. 그 색들은 무채색 사이에 끼어 겨우 숨만 쉬고 있습니다.", "색 있는 옷이 많다는 주장은 잘 들었습니다. 다만 본인이 말하는 많다와 옷장이 말하는 많다는 서로 전혀 다른 언어를 쓰고 있습니다."],
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
    roast: {
      love: ["그냥 좋아한다고 하셨죠. 그 그냥이 옷장 한쪽을 통째로 점령했으니, 이제 그 브랜드는 취향이 아니라 거주지입니다.", "좋아하는 브랜드에 이유가 필요 없다는 건 인정합니다. 다만 이 정도면 그 브랜드 매장 직원이 당신 얼굴을 외우고 있을 겁니다."],
      sale: ["세일할 때만 산다고 하셨습니다. 세일은 매 시즌 돌아오고, 당신은 매 시즌 성실하게 응답했습니다. 브랜드 입장에서는 최고의 고객입니다.", "세일이라는 단어는 참 편리합니다. 하지만 할인받은 금액을 다 합쳐도 그 브랜드를 향한 충성심은 못 가립니다. 싸게 산 게 아니라 많이 산 겁니다."],
      didnt_know: ["그렇게 많은 줄 몰랐다고 하셨죠. 한 브랜드가 옷장을 장악하는 동안 주인은 아무것도 눈치채지 못했습니다. 아주 조용한 쿠데타였습니다.", "몰랐다는 대답이 가장 무섭습니다. 의식하지도 않았는데 손이 알아서 그 브랜드로 향하고 있었다는 뜻이니까요."],
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
    roast: {
      food: ["밥을 고르셨습니다. 모범 답안인데, 옷장 속 가격표들은 그 말을 전혀 믿지 않는 눈치입니다. 밥값이 옷값을 이긴 달이 과연 있었는지 궁금합니다.", "옷보다 밥이라니 현명한 선택입니다. 그렇다면 식비를 아껴서 옷을 산 건 아니길 바랍니다. 옷장을 보면 솔직히 좀 의심스럽거든요."],
      clothes: ["밥 대신 옷을 고르셨습니다. 솔직함은 높이 사지만, 옷장을 보니 그게 농담이 아니었다는 게 진짜 문제입니다.", "굶어도 멋은 포기 못 한다는 정신, 존경합니다. 밥 대신 옷이라는 선택은 용감하지만, 배고픈 멋쟁이는 표정에서부터 티가 납니다."],
      both: ["밥도 옷도 포기 못 한다고 하셨습니다. 욕심은 인정하지만, 둘 다 챙기다 보면 결국 가장 먼저 포기하게 되는 건 통장입니다.", "둘 다 고르는 건 대답이 아니라 선언입니다. 그리고 그 선언의 청구서는 매달 꼬박꼬박 날아오고 있을 겁니다."],
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
    roast: {
      no: ["금수저가 아니라고 하셨습니다. 그렇다면 이 옷장은 순전히 본인의 의지와 카드 한도로 지어진 셈이니, 그쪽이 훨씬 더 무섭습니다.", "금수저가 아니라면 이 가격대의 옷들은 대체 어디서 온 걸까요. 미스터리는 풀리지 않았고, 통장은 끝내 대답하지 않습니다."],
      yes: ["금수저라고 인정하셨습니다. 덕분에 옷장의 가격표들이 한 번에 설명됐지만, 안목까지 물려받지는 못하신 것 같습니다.", "부럽다는 말은 하지 않겠습니다. 금수저라는 대답이 사실이라도, 돈으로 살 수 없는 것도 있다는 걸 이 옷장이 몸소 보여 주고 있으니까요."],
      skip: ["대답을 거부하셨습니다. 현명한 선택이었지만, 옷장 속 가격표들이 이미 절반쯤은 대신 대답해 버렸습니다.", "노코멘트도 대답은 대답입니다. 말하지 않아도 옷장은 다 알고 있고, 침묵은 때때로 가장 큰 자백입니다."],
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
    // 강제로 고르게 한 질문이라 결과 글에는 이 답의 문장을 넣지 않는다.
    roast: {},
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
    roast: {
      spend: ["가장 좋아하는 브랜드로 {brand|을} 고르셨습니다. 돈을 가장 많이 쓴 곳과 마음이 향한 곳이 같다니, 지갑과 마음이 한 몸으로 움직이고 있습니다.", "제일 좋다고 고른 곳이 결국 돈을 제일 많이 쓴 곳이었습니다. 사랑이라고 부르기엔 영수증 뭉치가 너무 두껍습니다."],
      count: ["제일 많이 가진 {brand|을} 고르셨습니다. 좋아해서 많이 산 건지, 많이 사다 보니 좋아진 건지 이제는 본인도 헷갈리실 겁니다.", "놀랍지 않은 선택입니다. 가장 많이 가진 브랜드라니, 옷장이 먼저 투표를 끝내 놓았고 본인은 도장만 찍으셨습니다."],
      recent: ["요즘 제일 자주 사는 {brand|을} 고르셨습니다. 지금은 사랑이겠지만, 옷장에는 한때 사랑이었던 브랜드들이 이미 조용히 쌓여 있습니다.", "새 연애에 들뜬 사람처럼 보입니다. 최근에 푹 빠진 브랜드가 1등이라니, 옛 브랜드들은 옷장 구석에서 이 장면을 전부 지켜보고 있습니다."],
      spend2: ["좋아한다고 고른 {brand}보다 돈은 다른 곳에 더 쓰셨습니다. 마음과 지갑이 따로 노는 걸 보니, 결제는 늘 머리보다 손이 먼저였나 봅니다.", "제일 좋다는 곳과 제일 돈을 쓴 곳이 다릅니다. 진짜 좋아하는 곳엔 덜 쓰고 딴 곳에 더 쓰다니, 연애였다면 꽤 복잡한 관계입니다."],
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
    roast: {
      none: ["비슷한 옷들 중 역할이 겹치는 건 하나도 없다고 하셨습니다. 그 자신감이라면 같은 옷을 색만 바꿔 한 벌 더 들이는 것도 시간문제입니다.", "겹치는 게 하나도 없다는 단언, 대담합니다. 본인 눈엔 전부 다른 옷이겠지만, 세상은 그걸 같은 옷 여러 벌이라고 부릅니다."],
      some: ["몇 개는 겹친다고 인정하셨습니다. 한 걸음 나아간 건 맞는데, 그 몇 개를 정리할 생각은 전혀 없어 보입니다.", "겹치는 옷이 있다는 걸 알고 있었다니 더 곤란합니다. 알면서 사는 쪽이 모르고 사는 쪽보다 훨씬 치료가 어렵습니다."],
      why: ["그걸 왜 묻느냐고 되물으셨죠. 질문에 질문으로 답하는 건 보통 어딘가 찔리는 데가 있을 때 나오는 반응입니다.", "왜 물어보냐니요? 이유는 간단합니다. 옷장이 이미 너무 많은 걸 말하고 있어서, 본인 입으로 확인만 받고 싶었습니다."],
    },
  },
  extreme_one: {
    lead: [],
    text: "내일부터 평생 한 종류의 {kind}만 입을 수 있다면, 역시 {familyName|을} 고르겠나요?",
    options: { of_course: "당연히 이거", no: "그건 좀", already: "이미 그렇게 사는 중" },
    react: {
      of_course: ["예상했습니다. {n}벌이 이미 투표를 마쳤습니다.", "망설임이 없네요. 그래서 {n}벌이군요."],
      no: ["의외네요. {n}벌이나 있는데요.", "그럼 {n}벌은 어떻게 된 걸까요."],
      already: ["네, 옷장을 보니 알겠습니다.", "그렇게 보였습니다. 굳이 말씀 안 하셔도 됐습니다."],
    },
    roast: {
      of_course: ["평생 한 종류의 {kind}만 입으라고 해도 같은 걸 고르겠다고 하셨습니다. 결정 장애가 없는 건 좋은데, 옷장은 이미 그 미래를 미리 살고 있습니다.", "고민도 없이 나온 '당연하죠'. 사실 그 질문은 선택이 아니라 확인이었습니다. 옷장이 한참 전에 답을 정해 뒀거든요."],
      no: ["평생 그것만 입는 건 좀 싫다고 하셨습니다. 그렇게 싫다는 운명을 향해 옷장은 이미 한 벌씩 성실하게 걸어가고 있습니다.", "평생 한 종류는 싫다는 말, 믿고 싶습니다. 그런데 매번 같은 걸 집어 오는 손이 있습니다. 그 손과 한번 진지하게 대화를 나눠 보시길 권합니다."],
      already: ["이미 그렇게 살고 있다고 하셨습니다. 자각이 있다니 다행이지만, 자각만 있고 변화가 없다는 게 이 옷장의 핵심 문제입니다.", "교복을 벗은 지 한참인데 스스로 교복을 다시 맞춘 셈입니다. 이미 한 종류로 살고 있다는 고백이니, 더 설득할 필요도 없겠네요."],
    },
  },
  band_quiz: {
    // {band}가 처음 나오는 문장에 그 밴드 옷 사진을 붙인다. 문제·선택지는 bands.ts에 있다.
    lead: ["잠깐만요.", "{band} 옷이 있네요.", "팬이라면 이 정도는 알겠죠."],
    text: "다음 중 {band}의 노래가 아닌 것은?",
    options: {},
    react: {
      right: ["정답입니다. {wrong}은 {wrongBy}의 곡이죠. 티셔츠만 산 팬은 아니네요.", "맞습니다. {wrong}은 {wrongBy} 노래입니다. 입을 자격은 증명하셨습니다."],
      wrong: ["{wrong}이 {wrongBy}의 곡입니다. 티셔츠가 먼저였군요.", "아쉽네요. {wrongBy}의 {wrong}이 정답이었습니다. 로고가 예뻐서 산 것도 이유는 됩니다."],
    },
    roast: {
      right: ["{band} 옷을 입을 자격은 증명하셨습니다. 노래 제목까지 아는 사람이 입으면 그건 팬심이고, 모르는 사람이 입으면 그냥 프린트 티니까요.", "밴드 티를 입는 사람 중 노래를 아는 사람은 생각보다 적습니다. 적어도 {band} 앞에서는 그 소수에 드는군요."],
      wrong: ["{band} 옷을 입고 다니시면서 노래 문제는 틀리셨습니다. 길에서 진짜 팬이 말을 걸면 그냥 고개만 끄덕이세요.", "{band} 티셔츠는 음악보다 로고가 먼저였던 것 같습니다. 괜찮습니다. 밴드 티의 절반은 그렇게 팔립니다."],
    },
  },
  three_500: {
    lead: ["언더아머가 보이네요."],
    text: "혹시 3대 500인가요?",
    options: { over: "넘음", soon: "곧 넘음", dots: ".........", comfy: "그냥 편해서 삼" },
    react: {
      over: ["인정합니다. 그 옷은 입을 자격이 있습니다.", "역시. 옷이 먼저 알고 있었네요."],
      soon: ["곧이라는 말, 헬스장에서 가장 자주 듣는 말이죠.", "응원합니다. 옷은 이미 500입니다."],
      dots: ["......네. 더 묻지 않겠습니다.", "침묵이 대답이군요. 옷만 벌크업했습니다."],
      comfy: ["솔직해서 좋습니다. 언더아머는 원래 편하긴 하죠.", "그럼요. 편한 게 최고입니다. 오해는 주변 사람 몫이고요."],
    },
    roast: {
      over: ["언더아머를 입을 자격이 있는 3대 500이라고 하셨습니다. 옷장보다 헬스장 기록이 더 인상적인 사람입니다.", "3대 500이면 언더아머는 옷이 아니라 유니폼입니다. 옷장 점수보다 몸이 먼저 설명해 줍니다."],
      soon: ["3대 500이 ‘곧’이라고 하셨습니다. 그 ‘곧’이 몇 년째인지는 묻지 않겠습니다.", "언더아머는 이미 500을 들 준비가 되어 있습니다. 이제 사람만 따라가면 됩니다."],
      dots: ["3대 500이냐는 질문에 점만 찍으셨습니다. 언더아머가 대신 운동해 주진 않습니다.", "침묵도 대답입니다. 언더아머는 오늘도 주인 대신 근육을 연기하고 있습니다."],
      comfy: ["언더아머를 편해서 입는다고 하셨습니다. 맞는 말인데, 입은 모습을 본 사람들은 대개 3대부터 궁금해합니다.", "편해서 고른 언더아머, 합리적입니다. 다만 그 로고는 보는 사람에게 늘 3대부터 묻게 만듭니다."],
    },
  },
  quiz: {
    // {brand}가 처음 나오는 문장에 그 브랜드 옷 사진을 붙인다.
    lead: ["잠깐만요.", "{brand} 옷이 있네요.", "{brand|을} 가지고 있으면 이것 정도는 알고 있겠죠."],
    text: "",
    options: {},
    react: {},
    roast: {},
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
    roast: {
      matches: ["뭐랑 입어도 맞아서 검정을 고른다고 하셨습니다. 맞는 건 맞는데, 검정에 검정을 맞추는 건 코디가 아니라 그냥 어두운 겁니다.", "어디에나 어울리는 옷, 그게 함정입니다. 그런 옷만 모으다 보면 결국 어디에서도 기억에 남지 않는 사람이 됩니다."],
      no_thinking: ["고민하기 싫어서 검정을 고른다고 하셨습니다. 아낀 고민만큼 옷장이 어두워졌으니, 거래치고는 꽤 손해를 보셨습니다.", "솔직함 하나는 인정합니다. 생각하기 귀찮아서 고른 결과, 옷장도 주인을 따라 생각을 멈춘 상태가 됐습니다."],
      charcoal: ["그건 검정이 아니라 차콜이라고 정정하셨습니다. 검정과 차콜을 구분하는 그 섬세함으로 왜 다른 색은 한 번도 안 고르셨는지 궁금합니다.", "차콜이라는 반박이 들어왔습니다. 남들 눈에는 어두운 옷과 조금 덜 어두운 옷일 뿐입니다. 그 차이를 주장하는 순간 더 수상해집니다."],
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
    roast: {
      love: ["그 색을 그냥 좋아한다고 하셨습니다. 좋아하는 색이 있는 건 좋은데, 이 정도면 옷장이 아니라 그 색의 팬클럽 사무실입니다.", "이유 없는 사랑이 제일 무섭습니다. 그냥 좋다는 그 색에 대한 사랑을 이 옷장이 온몸으로 증명하고 있습니다."],
      suits: ["잘 어울린다는 말을 들었다고 하셨습니다. 한 번 들은 칭찬을 이렇게까지 성실하게 믿고 따르는 사람은 흔치 않습니다.", "어울린다는 칭찬 한마디가 시작이었군요. 그 말을 해 준 사람이 지금 옷장을 보면, 말을 조금 아꼈어야 했다고 후회할 겁니다."],
      didnt_know: ["그 색이 그렇게 많은 줄 몰랐다고 하셨습니다. 한 가지 색이 옷장을 조용히 점령하는 동안 주인은 전혀 눈치채지 못했습니다.", "정말 몰랐을까요? 옷장을 열 때마다 같은 색이 인사를 했을 텐데, 매번 못 본 척하신 건지 궁금합니다."],
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
    roast: {
      wear_most: ["제일 자주 입어서 그 종류만 많다고 하셨습니다. 논리는 맞는데, 나머지 옷들은 출근 한 번 못 해 보고 대기만 하는 중입니다.", "자주 입으니까 많이 샀다는 계산은 맞습니다. 다만 그 계산대로라면 다른 옷은 거의 안 입는다는 뜻이라, 옷장 균형이 이미 무너졌습니다."],
      cant_stop: ["다른 건 안 사게 된다고 하셨습니다. 매장에 들어가도 같은 코너 앞에서만 발이 멈추는 병, 꽤 오래된 것 같습니다.", "다른 옷에는 손이 안 간다는 건 취향이 확고하다는 뜻일까요, 시야가 좁다는 뜻일까요? 옷장만 봐서는 후자에 조금 더 가깝습니다."],
      elsewhere: ["나머지 옷은 등록을 안 했다고 하셨습니다. 편리한 변명이지만, 그렇다면 굳이 등록할 만큼 자랑스러운 옷이 그것뿐이었다는 말도 됩니다.", "보여 준 게 절반뿐이라면 이야기가 달라집니다. 나머지는 안 올렸다는 그 옷들이, 보여 준 절반보다 더 궁금해지는 건 어쩔 수 없습니다."],
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
    roast: {
      minimal: ["미니멀리스트라고 하셨습니다. 멋진 철학이지만, 옷장을 보면 철학이라기보다는 아직 쇼핑을 시작하지 않은 쪽에 더 가까워 보입니다.", "미니멀리즘이라니요? 그렇다면 한 벌 한 벌이 정예군이어야 하는데, 몇몇은 아무리 봐도 갓 들어온 신병 같습니다."],
      not_yet: ["아직 다 안 넣었다고 하셨습니다. 반쯤 채운 옷장으로 평가를 받으시다니, 시험 범위 절반만 공부하고 채점해 달라는 것과 같습니다.", "아직 등록하지 않은 옷이 있다니 긴장됩니다. 숨겨 둔 옷들이 전부 들어오는 날, 이 글의 말투는 훨씬 더 험해질 예정입니다."],
      thats_all: ["원래 이게 전부라고 하셨습니다. 이 옷들로 일주일을 돌리는 건 거의 곡예 수준이니, 코디 실력만큼은 인정해 드리겠습니다.", "옷이 적으면 지적할 게 없을 거라는 생각은 오산입니다. 이게 다라는 옷장일수록 하나하나가 더 잘 보입니다."],
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
    roast: {
      most: ["대부분 입는다고 하셨습니다. 그 말이 사실이라면 매일 아침 옷장 앞에서 열리는 회의가 출근 시간보다 길 겁니다.", "거의 다 입는다는 말, 믿어 드리고 싶습니다. 하지만 옷장 깊숙한 곳의 옷들은 마지막 외출이 언제였는지 기억도 못 할 겁니다."],
      half: ["절반쯤 입는다고 하셨습니다. 나머지 절반은 유급 휴가 중인 셈인데, 그 휴가비는 전부 본인이 내고 있습니다.", "솔직해서 좋습니다. 절반만 입는다는 대답은 옷장의 반이 관상용이라는 고백이기도 한데, 이렇게 담담하게 말씀하시니 오히려 할 말을 잃었습니다."],
      few: ["실제로 입는 건 몇 벌 안 된다고 하셨습니다. 나머지는 옷장을 지키는 경비원인데, 경비원이 주민보다 훨씬 많습니다.", "대부분의 옷장이 이렇게 삽니다. 손이 가는 옷이 몇 벌뿐인 방식은 흔하지만, 동시에 가장 비싸게 사는 방식이기도 합니다."],
      same: ["매일 같은 옷만 입는다고 하셨습니다. 이만한 옷장을 두고 같은 옷을 고르는 건, 뷔페에 가서 물만 마시고 나오는 것과 같습니다.", "늘 같은 옷을 입는다면 나머지 옷들은 관람객도 없는 전시회에 영구 전시 중인 셈입니다. 입장료는 이미 다 내셨고요."],
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
    roast: {
      never: ["유행은 전혀 신경 안 쓴다고 하셨습니다. 옷장을 보면 그 말이 맞는데, 문제는 시간까지 신경 안 쓰는 것처럼 보인다는 겁니다.", "유행에 관심 없는 태도, 멋집니다. 다만 옷장이 너무 굳건해서 가끔은 박물관 상설 전시실처럼 느껴집니다."],
      bit: ["유행을 조금은 본다고 하셨습니다. 그 조금이 옷장까지 도착하려면 아직 한참을 더 걸어야 할 것 같습니다.", "보기는 보는데 사지는 않는다면 그건 관심이 아니라 구경입니다. 유행에 조금은 신경 쓴다지만, 옷장은 여전히 몇 해 전 달력을 걸어 두고 있습니다."],
      comes_back: ["유행이 나한테 돌아온다고 하셨습니다. 기다리는 전략은 좋은데, 유행은 돌아와도 예전 그 옷 그대로 돌아오지는 않습니다.", "유행이 돌아오길 기다리는 전략이군요. 멈춘 시계도 하루에 두 번은 맞는다는 논리를 이렇게 당당하게 펼치시는 분은 처음입니다."],
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
    roast: {
      yes: ["발매일 알람을 맞춰 본 적이 있다고 하셨습니다. 새벽에 알람 끄고 새로고침을 연타하는 모습이 옷장 너머로 선명하게 그려집니다.", "알람까지 맞췄다니 대단한 성실함입니다. 그 성실함을 아침 기상 알람에도 썼다면 인생이 꽤 달라졌을 겁니다. 적어도 지각은 줄었겠죠."],
      no: ["알람 같은 건 맞춘 적 없다고 하셨습니다. 알람 없이도 이 옷장이 완성됐다면, 그건 운이 아니라 본능입니다.", "알람 없이 구했다면 더 아픈 이야기일 수 있습니다. 웃돈을 얹어 리셀로 샀다는 뜻일 수도 있으니까요."],
      secret: ["그건 비밀이라고 하셨습니다. 비밀은 지켜 드리겠지만, 옷장이 이미 발매 달력을 통째로 자백해 버렸습니다.", "비밀이라는 대답이 가장 시끄럽습니다. 부끄러운 일이 아니었다면 굳이 숨길 이유도 없었을 겁니다. 그 침묵 덕분에 오히려 알람 소리가 더 크게 들립니다."],
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
    roast: {
      intended: ["한 나라 브랜드만 모은 게 의도였다고 하셨습니다. 여권은 그대로인데 옷장은 이미 이민 수속을 마친 상태입니다.", "일부러 한 나라만 골랐다니, 취향이 확고합니다. 다만 이 옷장이면 그 나라 관광청에서 홍보대사 제안이 올 것 같습니다."],
      quality: ["좋은 걸 골랐더니 다 한 나라였다고 하셨습니다. 꽤 대담한 주장인데, 다른 나라 장인들이 들으면 서운해할 이야기입니다.", "품질만 봤을 뿐이라는 설명치고는 참 공교롭습니다. 그 품질 기준이 우연히도 한 나라에만 딱 맞춰져 있으니까요."],
      didnt_know: ["몰랐다고 하셨습니다. 라벨을 한 번만 뒤집어 봤어도 알았을 텐데, 그사이 옷장은 조용히 한 나라로 귀화하고 있었습니다.", "원산지를 신경도 안 썼는데 이렇게 한쪽으로 쏠렸다면, 무의식이 꽤 확고한 취향을 갖고 있는 셈입니다. 의식보다 무의식이 쇼핑을 더 성실하게 하고 있습니다."],
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
    roast: {
      often: ["산에 자주 간다고 하셨습니다. 드디어 기능성 옷들이 제 할 일을 하는 옷장을 만났네요. 이 부분만큼은 봐 드리겠습니다.", "정말 산에 자주 간다면 인정합니다. 다만 그 옷들이 산보다 카페에서 더 자주 목격된다는 제보가 있어서 조금 의심스럽습니다."],
      sometimes: ["가끔 산에 간다고 하셨습니다. 그 가끔을 위해 준비한 장비가 원정대 수준이라는 게 문제입니다. 뒷산이 이런 대접을 받을 줄은 몰랐을 겁니다.", "어쩌다 한 번 산에 가려고 방수와 투습을 이렇게까지 챙기는 건 거의 신앙에 가깝습니다. 가끔 쓰는 옷치고는 스펙이 지나치게 진지합니다."],
      subway: ["주로 지하철에서 쓴다고 하셨습니다. 방수, 방풍, 투습 기능이 출근길 인파 속에서 활약 중이라니, 옷들이 꽤 억울할 겁니다.", "극한 환경을 버티라고 만든 옷이 지하철을 주 무대로 삼고 있습니다. 설계자가 출근길 지옥철까지 상정하지는 않았을 겁니다."],
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
    roast: {
      workout: ["운동할 때만 입는다고 하셨습니다. 모범 답안인데, 옷장에 쌓인 양을 보면 운동을 하루에 몇 번 하시는지 궁금해집니다.", "운동할 때만 입는다는 말이 맞다면, 옷장이 운동 일지보다 훨씬 부지런한 셈입니다. 운동복만 벌크업에 성공했습니다."],
      daily: ["평소에 입는다고 하셨습니다. 운동복이 일상복으로 승진한 건 편하긴 한데, 옷장 전체가 헬스장 탈의실처럼 보이는 부작용이 있습니다.", "편한 건 인정합니다. 하지만 평소에도 매일 트레이닝복 차림이면 남들은 운동하는 사람이 아니라 운동 가려다 만 사람으로 봅니다."],
      no_workout: ["운동은 안 한다고 하셨습니다. 스포츠 브랜드가 이렇게 많은데 운동을 안 한다니, 옷들은 아직 땀 한 방울 흘려 보지 못했습니다.", "운동은 안 한다는 고백, 솔직해서 좋습니다. 운동복을 사는 것도 운동이라고 믿으신다면, 이미 국가대표급이십니다."],
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
    roast: {
      sale: ["최근에 옷을 몰아 산 이유가 세일이라고 하셨습니다. 세일은 일 년 내내 어딘가에서 하고 있으니, 그 논리라면 영원히 사게 됩니다.", "세일이라는 이유는 늘 그럴듯하게 들립니다. 하지만 할인으로 아낀 돈보다 할인 덕분에 쓴 돈이 훨씬 크다는 사실은 애써 모른 척하시는 것 같습니다."],
      season: ["계절이 바뀌어서 샀다고 하셨습니다. 계절은 해마다 어김없이 바뀌는데, 그때마다 옷장도 새로 짓는 건 아니길 바랍니다.", "계절이 바뀌어서라면, 작년 이맘때도 계절은 바뀌었습니다. 그때 산 옷들은 지금 어디서 뭘 하고 있는지 궁금합니다."],
      birthday: ["생일이라서 샀다고 하셨습니다. 생일은 축하드립니다. 다만 스스로에게 선물을 이렇게까지 후하게 주는 사람은 흔치 않습니다.", "생일이라는 핑계에는 한 가지 약점이 있습니다. 생일은 일 년에 한 번인데, 옷장을 보면 최근 한 달 사이에 생일이 여러 번 있었던 것 같습니다."],
      just: ["그냥 샀다고 하셨습니다. 이유 없는 소비가 가장 솔직하고, 동시에 카드사가 가장 사랑하는 소비입니다.", "그냥이 한 달 사이에 이만큼 쌓였다면, 이제 그냥은 생활 방식입니다. 특별한 이유가 없다는 게 가장 특별한 이유가 됐습니다."],
    },
  },
  binge_month: {
    lead: [],
    text: "해마다 {month}월만 되면 옷을 많이 사네요. {month}월에 무슨 일이 있나요?",
    options: { sale: "큰 세일", payday: "보너스·월급", forgot: "기억 안 남" },
    react: {
      sale: ["세일이 {n}벌을 데려왔군요.", "그 세일, 꽤 성공적이었네요. 판매자 입장에서요."],
      payday: ["돈이 들어오자마자 옷이 들어왔군요. 순환이 빠릅니다.", "경제는 이렇게 돌아가는 거죠."],
      forgot: ["기억은 없어도 {n}벌은 남았습니다.", "결제 내역은 기억하고 있을 겁니다."],
    },
    roast: {
      sale: ["그달엔 큰 세일이 있었다고 하셨습니다. 세일은 끝났지만, 그때 들인 옷들은 아직 옷장에 남아 움직일 수 없는 증거가 되고 있습니다.", "큰 세일의 최대 수혜자는 당신이 아니라 판매자였습니다. 이제는 그 사실을 인정하셔야 합니다."],
      payday: ["보너스나 월급 때문이었다고 하셨습니다. 돈이 들어오자마자 옷으로 바뀌어 나가는 속도가 거의 환전소 수준입니다.", "월급날의 여파라면 이해는 됩니다. 다만 통장에 돈이 머문 시간보다 택배가 오는 데 걸린 시간이 더 길었을 것 같습니다."],
      forgot: ["그달에 무슨 일이 있었는지 기억이 안 난다고 하셨습니다. 본인은 잊었지만, 카드 명세서는 아주 생생하게 기억하고 있습니다.", "기억도 안 나는 한 달 동안 옷장이 이만큼 불어났다면, 그건 쇼핑이 아니라 블랙아웃입니다. 영수증은 전부 기억하고 있을 텐데 말입니다."],
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
    roast: {
      rotate: ["옷이 부족한 계절은 있는 옷으로 버틴다고 하셨습니다. 다른 계절에 쏟은 정성의 절반만 나눠 줬어도 이렇게 버틸 필요는 없었을 겁니다.", "옷장 날씨가 꽤 극단적입니다. 한쪽 계절 옷은 넘쳐나는데 다른 계절엔 돌려 입으며 버틴다니, 거의 생존 모드입니다."],
      stay_in: ["그 계절엔 밖에 잘 안 나간다고 하셨습니다. 옷이 없어서 안 나가는 건지, 안 나가서 옷이 없는 건지 이제는 구분이 안 됩니다.", "그 계절엔 집에 있는다는 해결책, 가장 저렴하긴 합니다. 다만 옷장 때문에 계절 하나를 통째로 포기하는 건 꽤 큰 희생입니다."],
      buy_soon: ["곧 사려고 했다고 하셨습니다. 그럴 줄 알았습니다. 비어 있던 계절이 채워지는 순간, 옷장은 또 한 번 비명을 지를 겁니다.", "곧 산다는 계획이 쇼핑 좋아하는 사람 입에서 나오면, 그건 계획이 아니라 예고편입니다. 부족한 걸 채우겠다는 말은 늘 넘치는 쪽까지 채우는 것으로 끝납니다."],
    },
  },
  top_item_q: {
    lead: [],
    text: "가장 비싼 항목, 몇 번이나 써 봤나요?",
    options: { often: "자주 입음", few: "몇 번", saving: "아까워서 모셔 둠" },
    react: {
      often: ["훌륭합니다. 한 번 입을 때마다 가격이 조금씩 내려가고 있습니다.", "그렇다면 가장 잘한 소비입니다."],
      few: ["{priceWon}짜리를 몇 번. 한 번에 얼마인지는 계산하지 않겠습니다.", "몇 번이라도 입었다면 다행입니다."],
      saving: ["모셔 두는 옷이 가장 비싼 옷이군요. 옷도 외출하고 싶을 텐데요.", "아까워서 못 입는 옷이 {priceWon}입니다."],
    },
    roast: {
      often: ["가장 비싼 옷을 자주 입는다고 하셨습니다. 입을 때마다 한 번당 가격이 내려가고 있으니, 이 옷장에서 드물게 계산이 맞는 소비입니다.", "그 옷 하나가 참 열심히 일하고 있습니다. 자주 입는다는 건 인정하지만, 덕분에 나머지 옷들이 좀 게을러 보입니다."],
      few: ["가장 비싼 옷을 몇 번밖에 안 입었다고 하셨습니다. 한 번 입을 때마다 얼마가 드는지는 계산하지 않는 편이 정신 건강에 좋습니다.", "비싼 옷일수록 외출이 드물다는 법칙이 있습니다. 몇 번 입어 본 게 전부라니, 이 옷장이 그 법칙을 아주 충실하게 따르고 있습니다."],
      saving: ["가장 비싼 옷을 아까워서 모셔 둔다고 하셨습니다. 입으라고 산 옷인데, 지금 그 옷은 옷장 안에서 가장 비싼 장식품으로 살고 있습니다.", "아까워서 못 입는 옷의 결말은 정해져 있습니다. 그렇게 아끼다가 유행이 지나면, 그때는 아까워서가 아니라 민망해서 못 입게 됩니다."],
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
    roast: {
      yes: ["명품은 세일할 때만 산다고 하셨습니다. 현명한 전략인데, 옷장을 보면 세일 기간마다 한 번도 빠짐없이 출석하신 것 같습니다.", "세일만 노리는 인내심은 칭찬합니다. 다만 할인받은 명품도 결국 명품 가격이라는 사실은 변하지 않습니다."],
      luck: ["세일 때 산 건 우연이라고 하셨습니다. 우연이 이렇게 반복되면 그건 운이 아니라 할인 알림을 켜 둔 사람의 실력입니다.", "우연이라니요? 매번 우연히 세일 기간에 매장에 계셨다니, 우연치고는 꽤 부지런한 우연입니다."],
      never_full: ["정가로 산 적이 없다고 하셨습니다. 원칙은 확고한데, 할인가로 들인 명품이 이만큼이면 아낀 게 아니라 그냥 많이 산 겁니다.", "정가는 남의 이야기라는 자부심, 이해합니다. 하지만 매장은 당신을 알뜰한 손님이 아니라 성실한 단골로 기억합니다."],
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
    roast: {
      special: ["유독 비싸게 주고 산 그 옷이 특별한 옷이라고 하셨습니다. 특별한 건 맞는데, 가장 특별했던 건 아마 그 가격표였을 겁니다.", "사연 있는 옷이라는 건 존중합니다. 다만 그 사연을 끝까지 들어 준 건 카드 명세서뿐이었을 겁니다."],
      late: ["가격을 나중에 봤다고 하셨습니다. 결제하고 나서야 가격표를 확인하는 습관, 가장 낭만적이고 가장 위험한 쇼핑 방식입니다.", "가격을 나중에 알았다면 영수증을 받아 든 순간의 표정이 볼만했겠습니다. 그 표정이 이 글보다 훨씬 강력한 훈수였을 겁니다."],
      normal: ["원래 그 가격이라고 하셨습니다. 부담 없는 브랜드에서 굳이 가장 비싼 라인을 찾아낸 그 안목, 어떤 의미로는 재능입니다.", "그 브랜드에선 원래 그 가격이라는 설명은 맞을 겁니다. 다만 어느 매장에 가도 가장 비싼 구석을 정확히 찾아가는 레이더를 갖고 계신 것도 분명합니다."],
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
    roast: {
      knew: ["한 종류에만 그만큼 쓴 걸 알고 있었다고 하셨습니다. 알면서도 멈추지 않았다면, 그건 실수가 아니라 확신범의 소비입니다.", "계산을 다 해 보고도 결제를 눌렀다니 결단력이 놀랍습니다. 이미 알고 있었다는 그 결단력을 저축에 쓰셨으면 좋았을 뻔했습니다."],
      less: ["그것보다는 적을 줄 알았다고 하셨습니다. 한 벌씩 살 땐 가볍던 금액이 모아 놓으니 이렇게 무겁다는 걸 이제야 체감하셨을 겁니다.", "사람은 늘 자기 소비를 할인해서 기억합니다. 생각보다 많았다는 반응이 그 증거이고, 정가로 기억하는 건 통장뿐입니다."],
      dont_tell: ["말하지 말라고 하셨습니다. 안타깝게도 이미 들어 버리셨고, 그 금액은 이제 머릿속에서 쉽게 지워지지 않을 겁니다.", "듣고 싶지 않은 금액이 있다는 건 양심이 아직 살아 있다는 뜻입니다. 그러니 그나마 희망은 있습니다."],
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
    roast: {
      below: ["옷 한 벌에 쓸 수 있는 한도를 꽤 알뜰하게 말씀하셨습니다. 문제는 옷장 속 가장 비싼 옷이 그 한도를 이미 가볍게 뛰어넘었다는 겁니다. 원칙은 있었는데 지켜진 적은 없었습니다.", "스스로 정한 한도는 알뜰했지만, 옷장은 그 말을 믿지 않습니다. 말로는 절약가인데, 결제 내역 속에는 전혀 다른 사람이 살고 있습니다."],
      within: ["한도를 넉넉하게 말씀하셨고, 옷장은 아직 그 선을 넘지 않았습니다. 말과 행동이 일치하는 드문 경우지만, 그만큼 더 쓸 여유가 남았다는 뜻이기도 합니다.", "정해 둔 한도 안에서 산 건 맞습니다. 칭찬하려다 멈췄습니다. 그 한도까지 아직 올라갈 자리가 남아 있다는 게 더 무섭거든요."],
      nolimit: ["옷 한 벌에 한도가 없다고 하셨습니다. 이 대답을 들은 카드사가 어딘가에서 조용히 박수를 치고 있을 겁니다.", "한도 없음이라는 대답, 가장 위험하고 가장 솔직했습니다. 지금까지는 운 좋게 멈춰 있었을 뿐, 이 옷장의 천장은 아직 공사 중입니다."],
    },
  },
  fit_choice: {
    lead: ["옷 핏을 보면 {pct}%가 {fit}입니다."],
    text: "일부러 이렇게 입는 건가요?",
    options: { intended: "의도한 실루엣", comfy: "편해서", dunno: "사이즈 잘 모름" },
    react: {
      intended: ["실루엣을 생각하고 산다니, 일단 믿어 보겠습니다.", "의도했다는 말, 결과에서 확인해 보죠."],
      comfy: ["편한 게 최고죠. 거울 앞에서만 빼고요.", "편함은 타협할 수 없는 가치죠."],
      dunno: ["사이즈를 모르는데 {pct}%가 한 핏이면, 운도 실력입니다.", "모르고 샀는데 이렇게 됐다니 더 흥미롭네요."],
    },
    roast: {
      intended: ["의도한 실루엣이라고 하셨습니다. 의도가 있었다는 건 알겠고, 그 의도가 먹혔는지는 옷장이 대신 말해 줍니다.", "실루엣을 생각하고 샀다는 대답, 옷장 숫자와 맞춰 보니 거짓말은 아닌 것 같습니다."],
      comfy: ["편해서라고 하셨습니다. 편함을 찾다 여기까지 왔다면, 스타일은 편함 다음 순번이었나 봅니다.", "편한 옷만 고른 결과가 이 핏입니다. 몸은 편했고, 보는 사람은 그렇게 편하지 않았을 수 있습니다."],
      dunno: ["사이즈를 잘 모른다고 하셨습니다. 옷장에 치수가 다 적혀 있는데도요.", "자기 사이즈를 모르는 사람의 옷장치고는 핏이 너무 한쪽으로 몰려 있습니다. 모르는 게 아니라 안 보는 겁니다."],
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
    roast: {
      yes: ["옷장이 말하는 스타일이 맞다고 인정하셨습니다. 자기 객관화는 훌륭한데, 알면서도 한 우물만 판 결과가 지금 이 옷장입니다.", "본인과 옷장의 의견이 일치하는 드문 순간입니다. 그 스타일이 맞다니, 이제 다른 우물도 한번 파 보실 차례입니다."],
      no: ["그 스타일이 아니라고 부정하셨습니다. 본인은 아니라는데 옷장은 맞다고 하니, 둘 중 하나는 거짓말을 하고 있습니다. 그리고 옷장은 거짓말을 못 합니다.", "그 스타일이 아니라면 문제가 더 큽니다. 본인이 생각하는 스타일과 실제로 사 온 옷 사이에 꽤 넓은 강이 흐르고 있습니다."],
      none: ["스타일 같은 건 없다고 하셨습니다. 겸손한 척하셨지만 옷장은 이미 확고한 스타일을 갖고 있습니다. 주인만 모를 뿐입니다.", "스타일이 없다는 사람일수록 옷장은 누구보다 한결같습니다. 오늘 또 한 번 확인했습니다."],
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
    roast: {
      design: ["브랜드를 고를 때 디자인을 본다고 하셨습니다. 그런데 서로 다른 브랜드에서 고른 옷들이 신기할 만큼 닮았습니다. 디자인을 본 게 아니라 같은 디자인을 찾아다니신 겁니다.", "디자인이 가장 중요하다면 결과가 좀 이상합니다. 여러 브랜드를 돌아다니고도 결국 같은 옷을 사 오는 능력, 이것도 일종의 재능입니다."],
      price: ["가격을 가장 중요하게 본다고 하셨습니다. 현실적이지만, 가격만 보고 고른 옷들이 전부 비슷하다는 건 싼 곳에서 같은 걸 반복 구매했다는 뜻입니다.", "브랜드는 제각각인데 옷장 풍경은 한결같이 비슷합니다. 가격을 기준으로 삼은 덕분입니다."],
      vibe: ["브랜드 분위기를 본다고 하셨습니다. 분위기는 브랜드마다 다르다던데, 옷장에 들어오는 순간 전부 하나의 분위기로 녹아 버렸습니다.", "분위기로 고른다지만 결과는 하나입니다. 서로 다른 분위기를 사 모았는데 이렇게 똑같다면, 사실은 본인 분위기 하나만 계속 산 겁니다."],
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
    roast: {
      history: ["역사가 곧 품질이라고 하셨습니다. 오래된 브랜드를 믿는 건 좋은데, 옷장까지 같이 나이 들어 가고 있다는 건 모르셨을 겁니다.", "오래 버틴 브랜드에 대한 믿음은 존중합니다. 다만 옷장이 가끔은 옷장이 아니라 브랜드 역사관처럼 보입니다."],
      chance: ["오래된 브랜드가 많은 건 우연이라고 하셨습니다. 우연이 이렇게 꾸준하면 그건 취향이고, 취향이 이렇게 고집스러우면 신념입니다.", "매번 우연히 역사 깊은 브랜드만 골라 온다니, 우연치고는 역사 공부가 꽤 깊습니다. 그냥 우연이라는 설명은 조금 약합니다."],
      new_too: ["새 브랜드도 좋아한다고 하셨습니다. 마음은 믿겠지만, 옷장에서 그 증거를 찾는 건 숨은그림찾기 수준이었습니다.", "새 브랜드에 대한 사랑은 아직 장바구니 단계에 머물러 있는 것 같습니다. 옷장에는 그 흔적이 거의 없거든요."],
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
    roast: {
      nobody: ["주변에서 아무도 못 알아본다고 하셨습니다. 아무도 모르는 옷에 진심인 건 멋지지만, 설명하느라 쓰는 시간도 꽤 될 겁니다.", "아무도 모르는 옷에 이만큼 투자하는 건 혼자 보는 전시회에 입장료를 내는 것과 같습니다. 알아봐 주는 사람이 없어도 영수증은 꼬박꼬박 나옵니다."],
      those_who_know: ["알 사람은 안다고 하셨습니다. 그 알 사람이 전국에 몇 명인지는 모르겠지만, 아마 다 같은 커뮤니티에 계실 겁니다.", "알 사람은 안다는 대답, 예상했습니다. 그 말을 할 때 살짝 올라간 입꼬리까지 옷장 너머로 보이는 것 같습니다."],
      rather_not: ["알아보면 오히려 불편하다고 하셨습니다. 아무도 모르길 바라면서 옷을 사는 건, 숨바꼭질에 돈을 거는 것과 비슷합니다.", "남들이 알게 되는 순간 흥미를 잃는 취향이군요. 알아보는 게 싫다니, 옷장이 꽤 예민한 성격을 갖고 있습니다."],
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
    roast: {
      yes: ["단정하게 입어야 하는 일을 한다고 하셨습니다. 이해는 되지만, 출근복이 옷장 전체를 점령해서 퇴근 후의 당신까지 회사원으로 만들고 있습니다.", "일 때문이라는 핑계는 완벽합니다. 그런데 주말 옷까지 넥타이만 안 맨 출근복처럼 보이는 건 설명이 안 됩니다."],
      no: ["단정하게 입을 필요가 없는 일이라고 하셨습니다. 아무도 시키지 않았는데 이렇게 단정하다니, 스스로 만든 드레스 코드에 갇혀 계십니다.", "일과 상관없는 단정함이라면 순수한 자발적 선택입니다. 가끔은 단추 하나쯤 풀어 봐도 아무도 혼내지 않습니다."],
      like: ["그냥 단정한 게 좋다고 하셨습니다. 좋은 취향이지만, 단정함만 가득한 옷장에서는 가끔 면접 대기실 같은 긴장감이 흐릅니다.", "흐트러짐 없는 옷장은 존경스럽습니다. 단정한 게 좋다는 취향을 유지하느라 다리미 앞에서 보낸 시간도 존경받아 마땅합니다."],
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
    roast: {
      often: ["길에서 같은 옷 입은 사람을 자주 본다고 하셨습니다. 거리 곳곳에 도플갱어가 있다니, 개성보다는 소속감을 입고 다니시는 셈입니다.", "같은 옷을 입은 사람과 자주 마주친다면, 어색하게 시선을 피하는 그 순간이 이 옷장이 치러야 할 가장 큰 대가입니다. 대중적인 선택의 숙명입니다."],
      sometimes: ["가끔 본다고 하셨습니다. 가끔이라서 다행이라고 생각하셨다면, 그건 아직 번화가를 덜 걸어 보셨기 때문입니다.", "가끔이라면 아직은 가벼운 편입니다. 대중적인 브랜드를 고른 대가치고는 그렇지만, 그 가끔은 머지않아 자주로 바뀔 겁니다."],
      not_yet: ["아직 본 적 없다고 하셨습니다. 여기서 중요한 단어는 아직입니다. 이 옷장이라면 그날은 생각보다 금방 옵니다.", "아직 못 마주쳤다면 운이 좋았을 뿐입니다. 출근길 지하철 한 칸만 둘러봐도 같은 옷을 입은 동료 시민이 반드시 계실 겁니다."],
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
    roast: {
      on: ["그 브랜드 신상 알림을 켜 두었다고 하셨습니다. 알림이 울릴 때마다 옷장이 한 칸씩 좁아졌을 테니, 사실상 옷장 경보음입니다.", "알림을 켜 둔 고객은 브랜드 입장에서 가장 이상적입니다. 통장 입장에서는 가장 위험한 설정이고요."],
      off: ["알림은 안 켰다고 하셨습니다. 알림도 없이 그 브랜드를 이만큼 모았다면, 알림 따위 필요 없는 더 깊은 관계라는 뜻입니다.", "알림이 꺼져 있다면 핑계를 댈 기계조차 없습니다. 이 옷장은 순전히 본인이 직접 찾아가서 만든 작품이니까요."],
      no_need: ["알림 없이도 안다고 하셨습니다. 신상 소식을 알림보다 먼저 아는 경지라면, 이미 그 브랜드 직원보다 부지런하신 겁니다.", "몸이 발매 일정을 기억하는 수준이군요. 알림이 필요 없을 정도라면, 이건 취향이 아니라 생체 리듬입니다."],
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
    roast: {
      knew: ["그 브랜드에 쓴 돈을 알고 있었다고 하셨습니다. 알면서도 계속 썼다면 이건 충동구매가 아니라 장기 투자인데, 수익률은 묻지 않겠습니다.", "금액을 알고도 멈추지 않았다면 사실상 정기 결제 관계입니다. 이미 알고 있었다니, 그 브랜드와의 사이가 꽤 공고합니다."],
      less: ["그것보다는 적을 줄 알았다고 하셨습니다. 살 때마다 이번 한 번뿐이라고 생각하셨겠지만, 그 한 번들이 모여 꽤 두툼한 청구서가 됐습니다.", "생각보다 많았다는 반응, 흔합니다. 사람은 원래 자기가 쓴 돈을 반쯤 깎아서 기억합니다. 브랜드 매출 장부는 그러지 않지만요."],
      dont_tell: ["말하지 말라고 하셨습니다. 아쉽게도 이미 들어 버리셨고, 다음에 그 브랜드 매장 앞을 지날 때 그 금액이 불쑥 떠오를 겁니다.", "듣기 싫은 금액이 있다는 것 자체가 신호입니다. 그 브랜드와의 관계를 한 번쯤 돌아볼 때가 됐습니다."],
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
    roast: {
      all_wear: ["신발을 전부 돌아가면서 신는다고 하셨습니다. 그 말이 사실이라면 한 켤레당 외출 기회가 너무 드물어서, 신발들이 바깥 공기를 잊었을 겁니다.", "다 돌려 신는다면 순번표라도 있어야 합니다. 그게 아니라면 신발장 안쪽 녀석들은 차례를 기다리다 먼지부터 쌓였을 겁니다."],
      collect: ["모으는 게 취미라고 하셨습니다. 그렇다면 신발장이 아니라 전시장인데, 관람객이 본인 한 명뿐이라는 게 아쉽습니다.", "수집이 취미라는 건 존중합니다. 다만 신으라고 만든 신발을 모셔 두기만 하는 건, 발에게도 신발에게도 조금 미안한 일입니다."],
      one_pair: ["결국 한두 켤레만 신는다고 하셨습니다. 나머지는 신발장을 지키는 경비원인데, 경비원들 몸값이 꽤 비쌉니다.", "매일 손이 가는 건 한두 켤레뿐입니다. 나머지 신발들은 언젠가를 기다리며 신발장 안에서 조용히 유행이 지나가는 걸 지켜보고 있습니다."],
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
    roast: {
      two: ["발이 두 개인 건 알고 있다고 하셨습니다. 알면서도 같은 종류 신발을 계속 들였다면, 그건 산수 문제가 아니라 사랑 문제입니다.", "발이 두 개라는 건 알고 있는데, 신발장은 다른 이야기를 합니다. 발이 여러 쌍인 사람처럼 살고 계시니, 지네도 이 신발장 앞에서는 부러워할 겁니다."],
      mood: ["기분 따라 다르게 신는다고 하셨습니다. 그런데 그 기분들이 전부 비슷한 모양의 신발로 표현된다는 게 흥미롭습니다.", "기분은 매일 달라도 신발장은 매일 같은 표정입니다. 그날 기분에 따라 고른다지만, 기분 표현의 폭이 생각보다 좁으신 것 같습니다."],
      different: ["다 다르게 생겼다고 하셨습니다. 본인 눈에는 확연히 다르겠지만, 지나가는 사람 눈에는 똑같은 신발만 신는 사람입니다.", "전부 다르다는 주장, 일단 받아 두겠습니다. 그 차이는 아마 본인과 그 신발을 디자인한 사람만 알아볼 수 있을 겁니다."],
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
    roast: {
      mood: ["그날 기분으로 모자를 고른다고 하셨습니다. 모자가 이만큼이면 기분도 꽤 다채로워야 할 텐데, 결국 손이 가는 건 늘 그 모자일 겁니다.", "머리는 하나인데 기분은 끝이 없습니다. 기분 따라 쓴다는 그 모자들의 무게를 버티는 모자걸이가 대단합니다."],
      hair: ["머리 안 감은 날 순서로 쓴다고 하셨습니다. 가장 솔직한 대답이지만, 모자가 이만큼이면 안 감은 날도 꽤 많다는 뜻이 됩니다.", "머리 안 감은 날용이라는 답은 모자의 진짜 용도를 정확히 짚었습니다. 다만 이 정도 컬렉션이면 샴푸 값이 훨씬 쌌을 겁니다."],
      collect: ["쓰지 않고 모으기만 한다고 하셨습니다. 머리에 한 번도 올라가 보지 못한 모자들이 벽에서 조용히 먼지를 쓰고 있습니다. 모자가 모자를 쓴 셈입니다.", "쓰지도 않을 모자를 계속 들이는 건, 모자 입장에서는 꽤 서글픈 평생 대기입니다. 모으는 게 목적이라면 목적은 달성하셨습니다."],
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
    roast: {
      face: ["그 모자가 얼굴에 제일 잘 어울린다고 하셨습니다. 정답을 찾은 건 축하하지만, 찾은 뒤에도 같은 답을 계속 사는 건 복습이 아니라 집착입니다.", "얼굴에 맞는 모자를 찾았다면 이제 그만 찾아도 됩니다. 그런데 모자걸이를 보면 수색은 아직 진행 중입니다."],
      safe: ["실패가 없어서라고 하셨습니다. 안전한 선택만 반복하다 보니 머리 위는 늘 평화롭지만, 설렘도 같이 사라졌습니다.", "모자는 원래 가장 쉽게 모험할 수 있는 아이템입니다. 안전해서 고른다는 이유로, 그 기회를 매번 같은 모자로 흘려보내고 계십니다."],
      different: ["다 다른 모자라고 하셨습니다. 챙 길이와 로고 위치로 구분하시는 거라면 그 감별력은 인정하지만, 남들 눈엔 여전히 같은 모자입니다.", "그 미세한 차이를 설명하려면 발표 자료가 필요할 것 같습니다. 전부 다르다지만, 듣는 사람은 끝까지 차이를 못 찾을 겁니다."],
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
    roast: {
      often: ["빈티지숍에 자주 간다고 하셨습니다. 그렇다면 여기 등록하지 않은 옷이 더 있다는 뜻이고, 이 글은 빙산의 일각만 보고 쓴 셈입니다.", "빈티지숍 단골의 낭만은 좋습니다. 남이 입던 옷에서 이야기를 찾는 건 멋지지만, 그 이야기들이 옷장 공간까지 다 차지하고 있습니다."],
      browse: ["가끔 구경만 한다고 하셨습니다. 구경만 하겠다는 다짐은 빈티지숍 문턱을 넘는 순간 대부분 무너진다는 게 정설입니다.", "구경만 한다는 말은 매장 직원들이 하루에도 수십 번 듣습니다. 그리고 그 손님들 대부분과 결국 계산대 앞에서 다시 만납니다."],
      no_used: ["남이 입던 옷은 싫다고 하셨습니다. 깔끔한 원칙이지만, 새 옷만 고집하는 옷장은 가격표도 늘 새것처럼 빳빳합니다.", "중고는 안 입는다는 위생 관념, 칭찬합니다. 다만 그 원칙 덕분에 옷장이 전부 정가 영수증으로 채워졌습니다."],
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
    roast: {
      daily: ["패션 인플루언서 영상을 매일 본다고 하셨습니다. 그렇다면 이 옷장의 공동 저자는 알고리즘이고, 본인은 결제 담당입니다.", "영상 속 옷이 한 벌씩 옷장으로 이사 오고 있습니다. 매일 본다면, 구독 버튼이 사실은 구매 버튼이었던 셈입니다."],
      sometimes: ["가끔 본다고 하셨습니다. 그런데 옷장 곳곳에 영상에서 본 듯한 옷이 꽤 많이 보여서, 그 가끔의 기준이 궁금해졌습니다.", "가끔 챙겨 보는 정도라도 영상 하나면 장바구니는 충분히 찹니다. 이 옷장이 그걸 증명하고 있습니다."],
      never: ["인플루언서 영상은 안 본다고 하셨습니다. 그렇다면 이 옷장은 온전히 본인 작품인데, 그 사실이 칭찬인지 고발인지는 잘 모르겠습니다.", "안 본다는 사람일수록 추천 목록이 패션 영상으로 가득합니다. 업계의 오래된 비밀입니다."],
    },
  },
  jjanggu_q: {
    lead: ["{n}벌이 전부 같은 옷입니다. 진지하게 하나만 묻겠습니다."],
    text: "혹시 짱구세요?",
    options: { yes: "짱구 맞음. 같은 옷만 입음", liked: "좋아서 여러 벌 삼", laundry: "빨래 돌리는 사이에 입으려고" },
    react: {
      yes: ["솔직해서 좋습니다. 흰둥이는 어디 있나요?", "인정하셨군요. 그럼 엄마한테 혼나는 것도 익숙하시겠네요."],
      liked: ["좋은 옷은 여러 벌 사는 거죠. 문제는 남들 눈엔 한 벌로 보인다는 겁니다.", "마음에 들면 사재기. 전략은 명확하네요."],
      laundry: ["빨래 로테이션까지 계산하셨군요. 옷장이 아니라 교대 근무표입니다.", "합리적입니다. 친구들은 당신이 옷을 안 갈아입는다고 생각하겠지만요."],
    },
    roast: {
      yes: ["같은 옷만 입는다고 당당히 인정하셨습니다. 짱구는 다섯 살이라 귀엽기라도 하죠. 옷장만 보면 당신의 시간도 다섯 살에서 멈춰 있습니다.", "짱구라고 인정한 순간 이 옷장의 모든 수수께끼가 풀렸습니다. 같은 옷을 여러 벌 사는 건 스타일이 아니라 만화 설정입니다."],
      liked: ["좋아서 여러 벌 샀다고 하셨죠. 그 마음은 이해하지만, 옷장 입장에서는 같은 손님이 계속 들어오는 셈입니다. 한 번쯤은 다른 옷에게도 기회를 주세요.", "마음에 들면 여러 벌. 그 논리대로라면 이 옷장은 당신이 좋아하는 게 딱 한 가지라는 증거입니다."],
      laundry: ["빨래 때문에 같은 옷을 여러 벌 샀다는 답은 합리적으로 들립니다. 다만 그 합리성 덕분에 주변 사람들은 당신을 한 벌로 기억합니다.", "빨래 로테이션을 위해 똑같은 옷을 모았다고요. 효율은 만점인데 사진첩은 모든 날이 같은 날처럼 보일 겁니다."],
    },
  },
  musinsa_q: {
    lead: [],
    text: "무신사 랭킹, 하루에 몇 번 보세요?",
    options: { ranking: "눈 뜨면 랭킹부터 봄", sale: "세일할 때만 들어감", convenient: "배송이 빨라서 쓸 뿐", not_me: "나는 랭킹 안 봄" },
    react: {
      ranking: ["아침 루틴이 랭킹 확인이군요. 옷장이 왜 이렇게 됐는지 알겠습니다.", "랭킹 1위를 입으면 당신도 1위가 되는 건 아닙니다."],
      sale: ["무신사는 거의 매일 세일합니다. 알고 계셨죠?", "세일할 때만 들어간다는 말은 매일 들어간다는 말과 같습니다."],
      convenient: ["빠른 배송이 옷장 모양까지 정해 버렸네요.", "편리함은 좋습니다. 옷장이 무신사 창고처럼 보이는 것만 빼면요."],
      not_me: ["랭킹을 안 보는데 옷장이 랭킹과 똑같습니다. 놀라운 우연이네요.", "안 본다고 하셨지만 옷장은 다 봤다고 말하고 있습니다."],
    },
    roast: {
      ranking: ["눈 뜨자마자 랭킹부터 본다고 하셨죠. 이 옷장은 당신의 취향이 아니라 무신사 알고리즘의 취향입니다. 알고리즘이 옷을 고르고, 당신은 결제만 담당했습니다.", "아침마다 랭킹을 확인하는 성실함이 옷장에 그대로 남았습니다. 1위부터 20위까지를 한 벌씩 모으면 딱 이 옷장이 됩니다."],
      sale: ["세일할 때만 들어간다고 하셨는데, 무신사는 세일을 쉬지 않습니다. 그러니까 매일 들어갔다는 이야기죠. 옷장이 그걸 증명합니다.", "세일만 노린다는 답과 이 옷장의 무신사 비율을 나란히 놓으면 결론은 하나입니다. 세일은 핑계였고 습관은 진짜였습니다."],
      convenient: ["배송이 빨라서 쓸 뿐이라고 하셨죠. 빠른 배송 덕분에 고민할 시간도 빨리 끝났나 봅니다. 옷장은 편리함의 결과물입니다.", "편리해서 쓴다는 답, 이해합니다. 다만 편리하게 모은 옷장은 편리하게 남들과 겹칩니다."],
      not_me: ["랭킹은 안 본다고 하셨는데 옷장이 랭킹과 거의 같습니다. 보지 않고도 랭킹을 맞히는 재능이라면 무신사에 지원해 보셔도 되겠습니다.", "랭킹을 안 본다는 답은 이 옷장 앞에서 설득력을 잃습니다. 옷장은 거짓말을 하지 않으니까요."],
    },
  },
  shop_q: {
    lead: [],
    text: "{shop}만 쓰는 이유가 있나요?",
    options: { points: "적립금이 아까워서", habit: "그냥 습관", best: "거기가 제일 좋음" },
    react: {
      points: ["적립금을 쓰려고 또 사고, 또 적립되고. 완벽한 순환입니다.", "적립금은 {shop}의 가장 성공적인 발명품입니다."],
      habit: ["습관은 무섭습니다. 앱 위치까지 손이 기억하겠네요.", "습관이 옷장을 만들었군요."],
      best: ["{shop} 입장에서는 가장 고마운 대답이네요.", "충성도 높은 고객이십니다. 등급이 꽤 높겠네요."],
    },
    roast: {
      points: ["적립금이 아까워서 {shop|을} 떠나지 못한다고 하셨죠. 적립금을 쓰려고 산 옷이 또 적립금을 만드는 구조, 쇼핑몰이 가장 좋아하는 고객입니다.", "적립금 때문에 {shop}에 묶여 있다는 답은 이 옷장을 가장 정확하게 설명합니다. 옷장이 아니라 포인트 통장입니다."],
      habit: ["그냥 습관이라고 하셨습니다. 습관으로 모은 옷장은 습관처럼 생겼습니다. 새로운 곳을 한 번쯤 둘러보는 것도 나쁘지 않습니다.", "{shop}에 들어가는 게 습관이라니, 손가락이 옷장을 채우고 있었던 셈입니다."],
      best: ["{shop|이} 제일 좋다고 하셨죠. 제일 좋은 곳 하나만 다니면 제일 비슷한 옷장이 됩니다.", "{shop}에 대한 믿음이 확고하십니다. 그 믿음의 결과가 지금 이 옷장입니다."],
    },
  },
  fruits_q: {
    lead: ["후르츠패밀리에서 산 옷이 {n}벌입니다."],
    text: "빈티지를 사랑하는 건가요, 정가를 미워하는 건가요?",
    options: { vintage: "빈티지 감성이 좋아서", price: "정가 주고 사기 아까워서", resell: "입다가 다시 팔려고" },
    react: {
      vintage: ["감성은 좋습니다. 전 주인의 감성까지 딸려 왔겠지만요.", "빈티지라고 부르면 다 멋있어 보이긴 합니다."],
      price: ["정가를 미워하는 마음, 이해합니다. 옷장은 그 마음을 {n}번 증명했습니다.", "아낀 돈으로 또 샀다면 아낀 게 아닙니다."],
      resell: ["옷장이 아니라 재고 창고였군요.", "되팔 생각으로 사는 옷은 대체로 되팔리지 않습니다."],
    },
    roast: {
      vintage: ["빈티지 감성이 좋아서 후르츠패밀리를 쓴다고 하셨습니다. 감성은 인정하지만, 남이 입던 옷 {n}벌이면 감성보다 이력이 더 두꺼운 옷장입니다.", "빈티지는 멋이지만 남이 입던 옷 {n}벌은 옷장이 아니라 중고 매장 진열대입니다. 감성은 전 주인과 나눠 가지셨습니다."],
      price: ["정가 주고 사기 아깝다고 하셨습니다. 그 아까운 마음이 {n}번 반복되면서, 아낀 돈보다 쌓인 옷이 더 눈에 띄게 됐습니다.", "정가를 피해 다닌 덕분에 옷은 싸게 샀지만, 그 싼 옷이 {n}벌이면 결국 정가 한 벌 값은 넘었을 겁니다."],
      resell: ["입다가 다시 팔 생각이라고 하셨습니다. 그런데 옷장에 아직 다 남아 있는 걸 보면, 판매 계획은 계속 다음 시즌으로 미뤄지고 있습니다.", "되팔 옷은 대개 되팔리지 않습니다. 옷장은 지금 재고 창고 역할을 성실하게 하고 있습니다."],
    },
  },
  bunjang_q: {
    lead: ["번개장터에서 산 옷이 {n}벌입니다."],
    text: "번개처럼 사는 건가요, 번개처럼 후회하는 건가요?",
    options: { deal: "싸게 잘 샀음", rare: "구하기 힘든 거라서", regret: "솔직히 후회한 적 있음" },
    react: {
      deal: ["잘 샀다는 말은 판 사람도 똑같이 합니다.", "싸게 산 옷이 {n}벌이면 싼 게 아닙니다."],
      rare: ["구하기 힘든 옷은 입기도 아까워지는 법입니다.", "희귀템 사냥꾼이시군요."],
      regret: ["솔직해서 좋습니다. 다시 번개장터에 올리면 되니까요.", "후회까지 중고로 넘기면 됩니다."],
    },
    roast: {
      deal: ["번개장터에서 싸게 잘 샀다고 하셨습니다. 한 벌이면 득템이지만 {n}벌이면 그건 득템이 아니라 생활 습관입니다.", "싸게 산 옷이 {n}벌이면 그건 절약이 아니라 취미입니다. 판매자들이 당신을 기억할 겁니다."],
      rare: ["구하기 힘든 옷이라서 번개장터를 뒤진다고 하셨습니다. 희귀한 옷을 찾는 집념은 대단하지만, 그 옷들이 옷장에서 희귀하게 입히는 것도 사실입니다.", "희귀템 사냥은 끝이 없습니다. 구하기 힘들게 산 옷일수록 입기 아까워서 옷장에서만 빛납니다."],
      regret: ["번개장터 구매를 후회한 적이 있다고 하셨습니다. 그래도 {n}벌을 샀다는 건, 후회보다 알림이 더 빨랐다는 뜻입니다.", "후회는 번개처럼 오고 알림은 더 번개처럼 옵니다. {n}벌이 그 경주의 기록입니다."],
    },
  },
  // 반응·결과 글은 옷장 점수 구간(high 70+, mid 40~69, low 40 미만) × 답으로 나뉜다(사용자 요청). 늘 마지막에 묻는다.
  fashionable_q: {
    lead: ["마지막으로 하나만요."],
    text: "스스로 패셔너블한 사람이라고 생각하나요? 솔직하게 대답하세요.",
    options: { yes: "그렇다", normal: "평범하다", no: "전혀 아니다", others_say: "남들이 그렇다던데" },
    react: {
      high_yes: ["인정합니다. 오늘 처음으로 반박할 게 없네요.", "네, 옷장이 먼저 증명했습니다. 조금 얄밉지만요."],
      high_normal: ["겸손이 지나치면 자랑입니다. 옷장은 평범하지 않았어요.", "평범하다고요? 옷장이 서운해하겠습니다."],
      high_no: ["이 옷장을 두고 그 대답은 반칙입니다.", "그럼 이 옷들은 우연히 잘 산 건가요? 운이 좋으시네요."],
      high_others_say: ["남들 말이 이번엔 맞았습니다.", "그 남들, 보는 눈이 있네요."],
      mid_yes: ["자신감은 좋습니다. 옷장은 반쯤만 동의합니다.", "음, 절반은 맞습니다. 어느 절반인지는 결과에서요."],
      mid_normal: ["정확한 자기 평가입니다. 옷장도 고개를 끄덕입니다.", "평범하다는 말, 오늘 들은 대답 중 가장 정확합니다."],
      mid_no: ["그 정도는 아닙니다. 너무 자책하지 마세요.", "전혀는 아니고, 가끔은 맞습니다."],
      mid_others_say: ["그 남들, 조금 후한 편이네요.", "남의 칭찬은 반만 믿으세요."],
      low_yes: ["자신감은 만점입니다. 옷장 점수는 곧 보시게 될 겁니다.", "그 자신감, 옷장에도 조금 나눠 주세요."],
      low_normal: ["평범이라는 말을 꽤 넓게 쓰시는군요.", "평범보다 조금 아래입니다. 괜찮아요, 올라갈 곳이 많습니다."],
      low_no: ["자기 객관화는 되시는군요. 그게 이 옷장의 유일한 희망입니다.", "솔직해서 좋습니다. 절반은 해결됐습니다."],
      low_others_say: ["그 남들이 누군지 궁금합니다. 혹시 판매 직원인가요?", "남의 말은 공짜입니다. 옷은 아니었지만요."],
    },
    roast: {
      high_yes: ["스스로 패셔너블하다고 답하셨고, 드물게도 옷장이 그 말을 뒷받침합니다. 이번만은 자랑해도 됩니다.", "자신 있게 그렇다고 하셨습니다. 옷장 점수가 그 자신감을 보증하니, 반박은 다음 기회로 미루겠습니다."],
      high_normal: ["평범하다고 하셨지만 옷장은 평범하지 않습니다. 이 정도면 겸손이 아니라 은근한 자랑입니다.", "스스로를 평범하다고 부르는 사람의 옷장치고는 너무 정돈되어 있습니다."],
      high_no: ["전혀 아니라고 하셨지만, 이 옷장을 보고 그 말을 믿을 사람은 없습니다. 겸손도 과하면 거짓말입니다.", "패셔너블하지 않다는 사람이 이런 옷장을 가지고 있다면, 나머지 사람들은 뭐라고 해야 할까요."],
      high_others_say: ["남들이 그렇다고 한다더니, 이번만큼은 남들 말이 맞았습니다.", "칭찬해 준 그 사람들, 보는 눈이 있었습니다. 옷장이 증명했습니다."],
      mid_yes: ["스스로 패셔너블하다고 하셨습니다. 옷장은 반쯤 동의하고, 나머지 반은 아직 협상 중입니다.", "자신감은 충분합니다. 옷장이 그 자신감을 따라잡기까지 조금만 더 기다려 주세요."],
      mid_normal: ["평범하다고 하셨고, 옷장도 같은 의견입니다. 드물게 자기 평가와 데이터가 일치했습니다.", "평범하다는 답은 정확했습니다. 정확한 게 늘 좋은 건 아니지만요."],
      mid_no: ["전혀 아니라고 하셨지만 그 정도는 아닙니다. 옷장에 쓸 만한 옷도 분명 있습니다.", "스스로를 너무 낮게 보셨습니다. 옷장은 그보다는 조금 낫습니다."],
      mid_others_say: ["남들이 그렇다고 한다지만, 그 칭찬에는 예의가 꽤 섞여 있었던 것 같습니다.", "남들의 칭찬은 반만 믿으세요. 옷장이 나머지 반을 말해 주고 있습니다."],
      low_yes: ["스스로 패셔너블하다고 자신 있게 답하셨습니다. 이 점수를 보고도 같은 생각이라면, 그 자신감만큼은 진짜 명품입니다.", "자신감은 만점입니다. 패셔너블하다는 대답의 유일한 약점은 옷장과 미리 입을 맞춰 두지 않았다는 점입니다."],
      low_normal: ["평범하다고 하셨습니다. 옷장 점수를 보면 평범이라는 단어가 꽤 너그럽게 쓰였습니다.", "평범하다는 답에는 약간의 희망이 섞여 있었습니다. 옷장은 그 희망을 아직 따라가지 못합니다."],
      low_no: ["전혀 아니라고 솔직하게 답하셨습니다. 문제를 아는 게 해결의 절반이니, 이 옷장에도 아직 희망은 있습니다.", "스스로 인정하셨으니 더 몰아붙이지는 않겠습니다. 대신 다음 쇼핑 전에 이 글을 한 번 떠올려 주세요."],
      low_others_say: ["남들이 그렇다고 했다는데, 그 남들이 혹시 매장 직원이나 계산을 기다리던 사장님은 아니었는지 확인해 보시길 권합니다.", "칭찬은 공짜라서 쉽게 나옵니다. 그 칭찬에 맞춰 산 옷들은 공짜가 아니었습니다."],
    },
  },
  // 침착맨·얼렁뚱땅 상점 옷이 있으면 질문 수와 상관없이 꼭 묻는다(사용자 요청). 점수 증감은 없다.
  chimchak_q: {
    lead: ["침착맨 쪽 옷이 {n}벌 있습니다."],
    text: "침착맨, 좋아하세요?",
    options: { love: "좋아함", sometimes: "가끔 봄", clothes_only: "옷만 샀음" },
    react: {
      love: ["역시 그렇군요. 옷장에 침착맨이 살고 있었습니다.", "좋아하시는 건 알겠는데, 이 정도면 팬심이 옷장까지 들어왔네요."],
      sometimes: ["가끔 보는 사람의 옷장치고는 꽤 성실합니다.", "가끔이라고 하셨지만 옷장은 꽤 자주 본 모양입니다."],
      clothes_only: ["옷만 샀다는 분이 제일 의심스럽습니다.", "옷이 마음에 들었다는 말, 일단 믿어 보겠습니다."],
    },
    roast: {
      love: ["침착맨을 좋아한다고 하셨습니다. 옷장 한쪽에 굿즈가 자리를 잡은 걸 보면 응원이 말로만 끝나지 않았습니다.", "침착맨 팬이라는 고백으로 옷장의 출처가 설명됩니다. 취향이 아니라 팬심으로 채운 칸입니다."],
      sometimes: ["가끔 본다고 하셨는데 침착맨 옷은 가끔 사는 수준이 아닙니다. 가끔이 꽤 자주인가 봅니다.", "가끔 보는 사이에 옷장에 들어온 침착맨 옷입니다. 시청 시간보다 결제 속도가 빨랐나 봅니다."],
      clothes_only: ["옷만 샀다고 하셨습니다. 침착맨 로고가 박힌 옷을 옷만 보고 샀다는 말은 조금 용감합니다.", "침착맨 상점에서 파는 옷이 하필 마음에 들었다니, 우연도 참 성실합니다. 그 우연을 믿어 드리겠습니다."],
    },
  },
};

export interface AskedQuestion {
  id: string;
  lead: string[];
  text: string;
  options: { id: string; label: string; photoId?: string; photoIds?: string[]; amount?: string }[];
  /** 선택지 id별 반응(이미 값이 채워진 문장) */
  reactions: Record<string, string>;
  /** 선택지 id별 결과 글 문단 후보(이미 값이 채워진 문장). 없으면 결과 글에 쓰지 않는다. */
  roast: Record<string, string[]>;
  photos: string[];
  /** 앞 멘트 번호별 사진 */
  leadPhotos?: Record<number, string[]>;
  /** 퀴즈 정답 선택지 id */
  answer?: string;
  quizId?: string;
  /** 답한 뒤 반응 아래에 붙이는 옷 사진과 가격 */
  reveal?: { id: string; amount: string }[];
  /** 선택지 id → 점수 증감 키(선택지를 코드가 만드는 질문만. 없으면 선택지 id를 그대로 쓴다) */
  scoreKey?: Record<string, string>;
}

/** 브랜드 셋: 금액 1위, 벌 수 1위, 최근 90일 구매 1위(없으면 금액 2위). 각 2벌 이상, 서로 달라야 한다. */
export function brandTrio(a: Analysis): { kind: "spend" | "count" | "recent" | "spend2"; label: string; count: number; amount: number; ids: string[] }[] | null {
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
    { kind: "spend", label: spend.label, count: spend.list.length, amount: spend.amount, ids: spend.list.map((i) => i.id) },
    { kind: "count", label: count.label, count: count.list.length, amount: count.amount, ids: count.list.map((i) => i.id) },
    { kind, label: third.label, count: third.list.length, amount: third.amount, ids: third.list.map((i) => i.id) },
  ];
}

const BUDGET: Record<string, number> = { b10: 100_000, b30: 300_000, b100: 1_000_000 };

const ALWAYS_ASK = new Set(["quiz", "drop_item", "brand_best", "band_quiz", "three_500"]);

export function pickQuestions(
  a: Analysis,
  r: Rng,
  fill: (t: string, v: Vars) => string,
  T: RoastTexts,
  tier: "high" | "mid" | "low" = "mid",
  /** 후보 질문(주문내역 훈수는 orders/questions.ts의 ORDER_QUESTIONS) */
  defs: QuestionDef[] = QUESTIONS,
): AskedQuestion[] {
  const candidates = defs.filter((q) => !APPENDED.includes(q.id))
    .map((q) => ({ q, vars: q.when(a) }))
    .filter((c): c is { q: QuestionDef; vars: Vars } => c.vars != null)
    .map((c) => {
      const p = c.q.pattern ? pat(a, c.q.pattern) : undefined;
      const boost = c.vars.boost ? 0.15 : 0;
      // 퀴즈, 비싼 옷 셋 중 버리기, 브랜드 셋 중 고르기는 조건이 맞으면 항상 낸다(못 만들면 build에서 빠진다).
      const always = ALWAYS_ASK.has(c.q.id) ? 10 : 0;
      const score = c.q.base * 0.6 + (p ? p.strength * p.interest * 0.4 : 0.15) + boost + r.next() * 0.35 + always;
      return { ...c, score };
    })
    .sort((x, y) => y.score - x.score);
  const asked: AskedQuestion[] = [];
  const buckets = new Set<string>();
  // 질문은 최대 10개(후보가 많으면 8~10개)
  const want = Math.min(candidates.length, 8 + Math.floor(r.next() * 3));
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
  // 무신사 링크 질문(조건이 맞을 때)과 마지막 질문은 늘 끝에 붙인다.
  for (const id of APPENDED) {
    const q = defs.find((x) => x.id === id);
    if (!q) continue;
    const vars = q.when(a);
    if (!vars) continue;
    try {
      const built = build(q, { ...vars, tier }, a, r, fill, T);
      if (built) asked.push(built);
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  }
  return asked;
}

function build(q: QuestionDef, vars: Vars, a: Analysis, r: Rng, fill: (t: string, v: Vars) => string, T: RoastTexts): AskedQuestion | null {
  const tx = T.questions[q.id];
  if (!tx) return null;
  const f = (t: string, v: Vars = vars) => fill(t, v);
  const photos = q.photos?.(a) ?? [];
  // 퀴즈 앞 멘트는 브랜드를 고른 뒤에 채운다.
  const base = { id: q.id, lead: q.id === "quiz" ? [] : tx.lead.map((l) => f(l)), text: tx.text ? f(tx.text) : "", photos };
  if (q.id === "odd_photo" && !photos.length) return null;

  // 결과 글 문단: 채울 수 있는 문장을 모두 넘기고, 결과 글을 쓸 때 앞 문단과 겹치지 않게 하나 고른다.
  // 고를 수 있는 문장이 없으면 그 답은 결과 글에 쓰지 않는다.
  const fillAll = (list: string[] | undefined, v: Vars) =>
    (list ?? []).flatMap((t) => {
      try {
        return [fill(t, v)];
      } catch (e) {
        if (e instanceof MissingVar) return [];
        throw e;
      }
    });
  const roastOf = (kind: string, v: Vars = vars): string[] => fillAll(tx.roast?.[kind], v);
  const roastMap = (pairs: [string, string[]][]) => Object.fromEntries(pairs.filter((x) => x[1].length));

  if (q.id === "quiz") {
    const quiz = pickQuiz(a, r, T);
    if (!quiz) return null;
    const ids = quiz.options.map((_, i) => String(i));
    const brandLabel = a.items.find((i) => i.brand?.name === quiz.brand)?.brandLabel || quiz.brand;
    const quizRoast = (ok: boolean) => fillAll(ok ? T.common.QUIZ_ROAST_RIGHT : T.common.QUIZ_ROAST_WRONG, { brand: brandLabel });
    const brandPhotos = a.items
      .filter((i) => i.brand?.name === quiz.brand && i.hasPhoto)
      .slice(0, 3)
      .map((i) => i.id);
    const photoAt = tx.lead.findIndex((l) => l.includes("{brand"));
    return {
      ...base,
      lead: tx.lead.map((l) => fill(l, { brand: brandLabel })),
      leadPhotos: brandPhotos.length && photoAt >= 0 ? { [photoAt]: brandPhotos } : undefined,
      quizId: quiz.id,
      text: quiz.question,
      options: r.shuffle(ids).map((id) => ({ id, label: quiz.options[Number(id)] })),
      answer: String(quiz.answer),
      reactions: Object.fromEntries(
        ids.map((id) => {
          const ok = Number(id) === quiz.answer;
          return [id, `${r.pick(ok ? T.common.QUIZ_CORRECT : T.common.QUIZ_WRONG) ?? ""}\n${r.pick(ok ? quiz.correct : quiz.wrong)}`.trim()];
        }),
      ),
      roast: roastMap(ids.map((id) => [id, quizRoast(Number(id) === quiz.answer)])),
      scoreKey: Object.fromEntries(ids.map((id) => [id, Number(id) === quiz.answer ? "right" : "wrong"])),
      photos: [],
    };
  }
  if (q.id === "band_quiz") {
    const found = findBand(a);
    if (!found) return null;
    const { band } = found;
    const v = { band: band.name, wrong: band.wrong, wrongBy: band.wrongBy };
    const labels = [...band.songs, band.wrong];
    const ids = labels.map((_, i) => String(i));
    const answer = String(labels.length - 1);
    const bandPhotos = photoIds(a, found.items.map((i) => i.id)).slice(0, 3);
    const photoAt = tx.lead.findIndex((l) => l.includes("{band"));
    return {
      ...base,
      lead: tx.lead.map((l) => fill(l, v)),
      leadPhotos: bandPhotos.length && photoAt >= 0 ? { [photoAt]: bandPhotos } : undefined,
      text: fill(tx.text, v),
      options: r.shuffle(ids).map((id) => ({ id, label: labels[Number(id)] })),
      answer,
      reactions: Object.fromEntries(ids.map((id) => [id, fill(r.pick(tx.react[id === answer ? "right" : "wrong"]), v)])),
      roast: roastMap(ids.map((id) => [id, roastOf(id === answer ? "right" : "wrong", v)])),
      scoreKey: Object.fromEntries(ids.map((id) => [id, id === answer ? "right" : "wrong"])),
      photos: [],
    };
  }
  if (q.id === "drop_item") {
    const top3 = pricedClothes(a).sort((x, y) => y.price! - x.price!).slice(0, 3);
    if (top3.length < 3) return null;
    const kinds = ["most", "mid", "least"];
    const options = top3.map((i) => ({ id: i.id, label: `${i.brandLabel} ${i.g.productName}`.trim(), photoId: i.hasPhoto ? i.id : undefined, amount: amountLabel(i.price!) }));
    const reactions = Object.fromEntries(top3.map((i, k) => [i.id, f(r.pick(tx.react[kinds[k]]), { priceWon: won(i.price!) })]));
    // 강제로 고르게 한 질문이라 결과 글에는 이 답의 문장을 넣지 않는다(즉석 반응만).
    return { ...base, options: r.shuffle(options), reactions, roast: {}, scoreKey: Object.fromEntries(top3.map((i, k) => [i.id, kinds[k]])) };
  }
  if (q.id === "brand_best") {
    const trio = brandTrio(a);
    if (!trio) return null;
    // 브랜드마다 그 브랜드 옷 사진을 칸에 들어가는 만큼(여덟 장까지) 붙이고, 고른 뒤에는 그 브랜드에 쓴 돈을 보여 준다.
    const options = trio.map((b) => ({
      id: b.label,
      label: b.label,
      photoIds: photoIds(a, b.ids).slice(0, 8),
      ...(b.amount > 0 ? { amount: amountLabel(b.amount) } : {}),
    }));
    const reactions = Object.fromEntries(trio.map((b) => [b.label, f(r.pick(tx.react[b.kind]), { count: b.count })]));
    // 좋아하는 브랜드를 고른 답은 결과 글에 넣지 않는다(즉석 반응만).
    return { ...base, options: r.shuffle(options), reactions, roast: {}, scoreKey: Object.fromEntries(trio.map((b) => [b.label, b.kind])) };
  }
  const options = q.options.map((id) => ({ id, label: tx.options[id] ?? id }));
  const reactKey = (id: string) => {
    if (q.id === "fashionable_q") return `${vars.tier ?? "mid"}_${id}`;
    if (q.id !== "max_budget") return id;
    if (id === "nolimit") return "nolimit";
    return BUDGET[id] < Number(vars.max) ? "below" : "within";
  };
  // "~에 쓴 돈이 얼마라는 거, 알고 있었나요?"는 답한 뒤 그 옷들 사진과 가격을 보여 준다.
  const reveal = q.id === "brand_spend_q" || q.id === "subcat_spend_q" ? pricedPhotos(a, pat(a, q.pattern!)?.garmentIds ?? []) : [];
  // 반응마다 붙인 조건(관리자 문장 편집)이 맞으면 그 반응을 쓰고, 그 반응에 결과 글이 있으면 결과 글도 그것으로 바꾼다.
  const answered = options.map((o) => {
    const key = reactKey(o.id);
    const list = tx.react[key] ?? [];
    const { pool, matched } = reactPool(list.length, tx.when?.[key], a);
    const i = pool.length ? r.pick(pool) : -1;
    const own = matched ? tx.result?.[key]?.[i]?.trim() : "";
    const roast = own ? fillAll([own], vars) : [];
    return { id: o.id, reaction: f(i >= 0 ? list[i] : r.pick(list)), roast: roast.length ? roast : roastOf(key) };
  });
  return {
    ...base,
    options,
    reactions: Object.fromEntries(answered.map((x) => [x.id, x.reaction])),
    roast: roastMap(answered.map((x) => [x.id, x.roast])),
    ...(q.id === "fashionable_q" ? { scoreKey: Object.fromEntries(options.map((o) => [o.id, reactKey(o.id)])) } : {}),
    ...(reveal.length ? { reveal } : {}),
  };
}

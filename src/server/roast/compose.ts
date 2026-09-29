import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { RoastParagraph, RoastQuestion, RoastScript, RoastStep } from "@/lib/roast/types";
import type { CategoryId } from "@/lib/types/domain";
import type { Analysis, Pattern } from "./analyze";
import { familyName, type FamilyId } from "./keywords";
import { LINE_SECTION, type Section } from "./lines";
import { pickQuestions, QUESTIONS, type AskedQuestion } from "./questions";
import { fill, MissingVar, rng, won, type Rng, type Vars } from "./text";
import { DEFAULT_TEXTS, type RoastTexts } from "./texts";

/**
 * 분석 결과 → 대화 순서(script)와 결과 글. 같은 seed면 같은 문장·질문이 나온다(시작과 끝에서 서버가 같은 분석을 다시 만든다).
 * 숫자와 이름은 모두 패턴의 근거 값에서 채운다.
 */

const SECTION_ORDER: Section[] = ["size", "acc", "color", "brand", "repeat", "season", "timing", "money", "odd"];
/** 관련 패턴이 없는 질문이 들어갈 자리 */
const QUESTION_SECTION: Record<string, Section> = { quiz: "brand", brand_best: "brand", drop_item: "money", count_guess: "size", max_budget: "money", food_vs_clothes: "money", golden_spoon: "money" };

/** 튀는 옷의 드문 특성 이름 */
const TRAIT_WORD: Record<string, string> = { color: "색", group: "브랜드 결", sub: "종류", fit: "핏", season: "계절", family: "디자인" };

/** 패턴 근거 값 + 문장에 쓰는 파생 값(이름·금액 문자열) */
export function varsOf(p: Pattern): Vars {
  const v: Vars = { ...p.stats };
  if (typeof v.cat === "string") v.catName = CATEGORY_NAME[v.cat as CategoryId] ?? v.cat;
  if (typeof v.family === "string") v.familyName = familyName(v.family as FamilyId);
  if (typeof v.avg === "number" && p.id === "avg_price") v.avgWon = won(v.avg);
  if (typeof v.price === "number") v.priceWon = won(v.price);
  if (typeof v.amount === "number") v.amountWon = won(v.amount);
  if (p.id === "odd_one" && typeof v.traits === "string") {
    const words = v.traits.split(",").map((t) => TRAIT_WORD[t]).filter(Boolean);
    v.traitText = words.length > 1 ? `${words.slice(0, -1).join(", ")}, ${words[words.length - 1]}` : (words[0] ?? "");
  }
  if (p.id === "combo_repeat") v.fitPhrase = v.fit ? `${v.fit} 핏 ` : "";
  return v;
}

/** 틀 중 채울 수 있는 것 하나(자리가 비면 다른 틀) */
function tryFill(r: Rng, templates: readonly string[], vars: Vars): string | null {
  for (const t of r.shuffle(templates)) {
    try {
      return fill(t, vars);
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  }
  return null;
}

/** 흥미도·강도 순. 같은 섹션은 두 개까지. */
function rank(a: Analysis, r: Rng, max: number, T: RoastTexts): Pattern[] {
  const scored = a.patterns
    .filter((p) => T.lines[p.id] && LINE_SECTION[p.id])
    .map((p) => ({ p, s: p.strength * p.interest + r.next() * 0.12 }))
    .sort((x, y) => y.s - x.s);
  const per = new Map<Section, number>();
  const out: Pattern[] = [];
  for (const { p } of scored) {
    const sec = LINE_SECTION[p.id];
    if ((per.get(sec) ?? 0) >= 2) continue;
    per.set(sec, (per.get(sec) ?? 0) + 1);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

const photosOf = (a: Analysis, r: Rng, p: Pattern, max: number) =>
  r.shuffle(p.garmentIds.filter((id) => a.items.find((i) => i.id === id)?.hasPhoto)).slice(0, max);

const NO_PHOTO = new Set(["subcategory_spend", "count_small", "count_many", "count_huge", "avg_price", "trait_hype", "trait_trendy", "trait_timeless", "trait_functional", "trait_niche", "trait_mainstream", "trait_formal", "trait_casual", "trait_heritage", "trait_pricey", "country_bias", "season_bias"]);

export interface Plan {
  script: RoastScript;
  /** 결과 글을 만들 때 다시 쓰는 질문(반응·결과 문장 포함) */
  asked: AskedQuestion[];
  convo: Pattern[];
}

export function buildScript(a: Analysis, seed: number, name: string | null, T: RoastTexts = DEFAULT_TEXTS): Plan {
  const r = rng(seed);
  const C = T.common;
  const convo = rank(a, r, 6, T);
  const asked = pickQuestions(a, r, fill, T);
  const steps: RoastStep[] = [];
  const say = (text: string, photos?: string[]) => steps.push(photos?.length ? { t: "say", text, photos } : { t: "say", text });

  // 이름은 가끔만 부른다: 인사에서 부르거나, 대화 중에 한 번.
  const greet = Boolean(name) && r.next() < 0.5;
  if (greet) say(fill(r.pick(C.NAME_GREETING), { name: name! }));
  say(fill(r.pick(C.SCAN_OPEN), { n: a.clothes.length }));

  // 질문이 들어갈 자리: 관련 패턴 바로 뒤, 없으면 그 섹션 끝
  const questionFor = (p: Pattern) =>
    asked.map((q, i) => ({ q, i })).filter(({ q }) => QUESTIONS.find((d) => d.id === q.id)?.pattern === p.id);
  const placed = new Set<number>();
  const ask = (i: number) => {
    if (placed.has(i)) return;
    placed.add(i);
    steps.push({ t: "think" });
    steps.push({ t: "ask", q: i });
  };

  let nameUsed = greet;
  let sections = 0;
  for (const sec of SECTION_ORDER) {
    const inSec = convo.filter((p) => LINE_SECTION[p.id] === sec);
    const secQuestions = asked.map((q, i) => ({ q, i })).filter(({ q, i }) => !placed.has(i) && QUESTION_SECTION[q.id] === sec);
    if (!inSec.length && !secQuestions.length) continue;
    // 섹션 사이에 가끔 혼잣말을 끼운다.
    if (sections++ > 0 && r.next() < 0.3) say(r.pick(C.MID_REMARKS));
    steps.push({ t: "status", text: r.pick(C.SECTION_STATUS[sec]) });
    for (const p of inSec) {
      let text = tryFill(r, T.lines[p.id].say, varsOf(p));
      if (!text) continue;
      // 이름은 가끔만 부른다.
      if (name && !nameUsed && r.next() < 0.3) {
        text = `${name}님, ${text}`;
        nameUsed = true;
      }
      if (r.next() < 0.4) steps.push({ t: "say", text: r.pick(C.THINKING) });
      say(text, NO_PHOTO.has(p.id) ? undefined : photosOf(a, r, p, 3));
      for (const { i } of questionFor(p)) ask(i);
    }
    for (const { i } of secQuestions) ask(i);
  }
  // 관련 패턴이 대화에 안 나온 질문은 끝에서 묻는다.
  asked.forEach((_, i) => ask(i));

  if (convo.length < 2) say(r.pick(C.FEW_PATTERNS));
  steps.push({ t: "think" });
  say(r.pick(C.WRAP_UP));

  const questions: RoastQuestion[] = asked.map((q) => ({ id: q.id, lead: q.lead, text: q.text, options: q.options, reactions: q.reactions, photos: q.photos }));
  return { script: { seed, steps, questions }, asked, convo };
}

export interface Composed {
  headline: string;
  paragraphs: RoastParagraph[];
  closing: string[];
  used: Pattern[];
}

/**
 * 템플릿 결과 글. 대화에서 받은 답은 되풀이하지 않고(사용자 요청), 가장 뚜렷한 패턴 3개까지만 짧게 쓴다.
 * answers는 지금은 쓰지 않지만 AI 입력과 결과 저장에 함께 넘긴다.
 */
export function composeResult(a: Analysis, name: string | null, seed: number, T: RoastTexts = DEFAULT_TEXTS): Composed {
  // 대화와 다른 순서로 뽑히지 않게 결과용 난수는 따로 만든다.
  const r = rng(seed ^ 0x5bd1e995);
  const C = T.common;
  const used = rank(a, r, 3, T);

  let headline: string;
  if (used.length >= 2) {
    const [h1] = r.shuffle(T.lines[used[0].id].head);
    const [h2] = r.shuffle(T.lines[used[1].id].head);
    const first = tryFill(r, [h1[0]], varsOf(used[0]));
    const second = tryFill(r, [h2[1]], varsOf(used[1]));
    headline = first && second ? `${first} ${second}` : (second ?? first ?? r.pick(C.PLAIN_HEADLINE));
  } else if (used.length === 1) {
    const pre = r.pick(C.HEAD_SINGLE_PREFIX);
    headline = (pre && !pre.endsWith(" ") ? `${pre} ` : pre) + (tryFill(r, [r.pick(T.lines[used[0].id].head)[1]], varsOf(used[0])) ?? r.pick(C.PLAIN_HEADLINE));
  } else headline = r.pick(C.PLAIN_HEADLINE);

  const paragraphs: RoastParagraph[] = [];
  used.forEach((p, idx) => {
    let text = tryFill(r, T.lines[p.id].para, varsOf(p));
    if (!text) return;
    // 첫 문단은 "그리고"로 시작하지 않게 한다(튀는 옷 문단).
    if (idx === 0) text = text.replace(/^그리고 /, "");
    if (idx === 0 && name) text = `${name}님, ${text}`;
    paragraphs.push({ text, photos: NO_PHOTO.has(p.id) ? [] : photosOf(a, r, p, 2) });
  });
  if (!paragraphs.length) paragraphs.push({ text: fill(r.pick(C.PLAIN_PARA), { n: a.clothes.length }), photos: [] });
  if (used.length < 2) paragraphs.push({ text: r.pick(C.FEW_PATTERNS), photos: [] });

  const closing = r.shuffle(C.CLOSING).slice(0, 2 + Math.floor(r.next() * 2));
  return { headline, paragraphs, closing, used };
}

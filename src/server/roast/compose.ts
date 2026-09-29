import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { RoastParagraph, RoastQuestion, RoastScript, RoastStep } from "@/lib/roast/types";
import type { CategoryId } from "@/lib/types/domain";
import type { Analysis, Pattern } from "./analyze";
import { familyName, type FamilyId } from "./keywords";
import {
  CLOSING,
  FEW_PATTERNS,
  HEAD_SINGLE_PREFIX,
  LINES,
  NAME_GREETING,
  PLAIN_HEADLINE,
  PLAIN_PARA,
  SCAN_OPEN,
  SECTION_STATUS,
  THINKING,
  WRAP_UP,
  type Section,
} from "./lines";
import { pickQuestions, QUESTIONS, type AskedQuestion } from "./questions";
import { fill, MissingVar, rng, won, type Rng, type Vars } from "./text";

/**
 * 분석 결과 → 대화 순서(script)와 결과 글. 같은 seed면 같은 문장·질문이 나온다(시작과 끝에서 서버가 같은 분석을 다시 만든다).
 * 숫자와 이름은 모두 패턴의 근거 값에서 채운다.
 */

const SECTION_ORDER: Section[] = ["size", "color", "brand", "repeat", "season", "timing", "money", "odd"];
/** 관련 패턴이 없는 질문이 들어갈 자리 */
const QUESTION_SECTION: Record<string, Section> = { quiz: "brand", drop_brand: "money", count_guess: "size", max_budget: "money" };

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
function rank(a: Analysis, r: Rng, max: number): Pattern[] {
  const scored = a.patterns
    .filter((p) => LINES[p.id])
    .map((p) => ({ p, s: p.strength * p.interest + r.next() * 0.12 }))
    .sort((x, y) => y.s - x.s);
  const per = new Map<Section, number>();
  const out: Pattern[] = [];
  for (const { p } of scored) {
    const sec = LINES[p.id].section;
    if ((per.get(sec) ?? 0) >= 2) continue;
    per.set(sec, (per.get(sec) ?? 0) + 1);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

const photosOf = (a: Analysis, r: Rng, p: Pattern, max: number) =>
  r.shuffle(p.garmentIds.filter((id) => a.items.find((i) => i.id === id)?.hasPhoto)).slice(0, max);

const NO_PHOTO = new Set(["count_small", "count_many", "count_huge", "avg_price", "trait_hype", "trait_trendy", "trait_timeless", "trait_functional", "trait_niche", "trait_mainstream", "trait_formal", "trait_casual", "trait_heritage", "trait_pricey", "country_bias", "season_bias"]);

export interface Plan {
  script: RoastScript;
  /** 결과 글을 만들 때 다시 쓰는 질문(반응·결과 문장 포함) */
  asked: AskedQuestion[];
  convo: Pattern[];
}

export function buildScript(a: Analysis, seed: number, name: string | null): Plan {
  const r = rng(seed);
  const convo = rank(a, r, 6);
  const asked = pickQuestions(a, r, fill);
  const steps: RoastStep[] = [];
  const say = (text: string, photos?: string[]) => steps.push(photos?.length ? { t: "say", text, photos } : { t: "say", text });

  if (name) say(fill(r.pick(NAME_GREETING), { name }));
  say(fill(r.pick(SCAN_OPEN), { n: a.clothes.length }));

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

  let nameUsed = false;
  for (const sec of SECTION_ORDER) {
    const inSec = convo.filter((p) => LINES[p.id].section === sec);
    const secQuestions = asked.map((q, i) => ({ q, i })).filter(({ q, i }) => !placed.has(i) && QUESTION_SECTION[q.id] === sec);
    if (!inSec.length && !secQuestions.length) continue;
    steps.push({ t: "status", text: r.pick(SECTION_STATUS[sec]) });
    for (const p of inSec) {
      let text = tryFill(r, LINES[p.id].say, varsOf(p));
      if (!text) continue;
      // 이름은 가끔만 부른다.
      if (name && !nameUsed && r.next() < 0.3) {
        text = `${name}님, ${text}`;
        nameUsed = true;
      }
      if (r.next() < 0.35) steps.push({ t: "say", text: r.pick(THINKING) });
      say(text, NO_PHOTO.has(p.id) ? undefined : photosOf(a, r, p, 3));
      for (const { i } of questionFor(p)) ask(i);
    }
    for (const { i } of secQuestions) ask(i);
  }
  // 관련 패턴이 대화에 안 나온 질문은 끝에서 묻는다.
  asked.forEach((_, i) => ask(i));

  if (convo.length < 2) say(r.pick(FEW_PATTERNS));
  steps.push({ t: "think" });
  say(r.pick(WRAP_UP));

  const questions: RoastQuestion[] = asked.map((q) => ({ id: q.id, lead: q.lead, text: q.text, options: q.options, reactions: q.reactions, photos: q.photos }));
  return { script: { seed, steps, questions }, asked, convo };
}

export interface Composed {
  headline: string;
  paragraphs: RoastParagraph[];
  closing: string[];
  used: Pattern[];
}

/** 답을 반영한 템플릿 결과 글. answers: 질문 id → 고른 선택지 id */
export function composeResult(a: Analysis, plan: Plan, answers: Record<string, string>, name: string | null, seed: number): Composed {
  // 대화와 다른 순서로 뽑히지 않게 결과용 난수는 따로 만든다.
  const r = rng(seed ^ 0x5bd1e995);
  const used = rank(a, r, 5);

  let headline: string;
  if (used.length >= 2) {
    const [h1] = r.shuffle(LINES[used[0].id].head);
    const [h2] = r.shuffle(LINES[used[1].id].head);
    const first = tryFill(r, [h1[0]], varsOf(used[0]));
    const second = tryFill(r, [h2[1]], varsOf(used[1]));
    headline = first && second ? `${first} ${second}` : (second ?? first ?? r.pick(PLAIN_HEADLINE));
  } else if (used.length === 1) {
    headline = r.pick(HEAD_SINGLE_PREFIX) + (tryFill(r, [r.pick(LINES[used[0].id].head)[1]], varsOf(used[0])) ?? r.pick(PLAIN_HEADLINE));
  } else headline = r.pick(PLAIN_HEADLINE);

  const recallFor = (p: Pattern) =>
    plan.asked
      .filter((q) => QUESTIONS.find((d) => d.id === q.id)?.pattern === p.id && answers[q.id] && q.recalls[answers[q.id]])
      .map((q) => q.recalls[answers[q.id]]);
  const usedRecalls = new Set<string>();

  const paragraphs: RoastParagraph[] = [];
  used.forEach((p, idx) => {
    let text = tryFill(r, LINES[p.id].para, varsOf(p));
    if (!text) return;
    if (idx === 0 && name) text = `${name}님, ${text}`;
    for (const rc of recallFor(p)) {
      text += ` ${rc}`;
      usedRecalls.add(rc);
    }
    paragraphs.push({ text, photos: NO_PHOTO.has(p.id) ? [] : photosOf(a, r, p, 2) });
  });
  // 관련 패턴이 결과에 안 들어간 답(퀴즈·브랜드 버리기 등)은 따로 한 문단으로 모은다.
  const rest = plan.asked
    .map((q) => (answers[q.id] ? q.recalls[answers[q.id]] : null))
    .filter((t): t is string => Boolean(t) && !usedRecalls.has(t!));
  if (rest.length) paragraphs.push({ text: rest.join(" "), photos: [] });
  if (!paragraphs.length) paragraphs.push({ text: fill(r.pick(PLAIN_PARA), { n: a.clothes.length }), photos: [] });
  if (used.length < 2) paragraphs.push({ text: r.pick(FEW_PATTERNS), photos: [] });

  const closing = r.shuffle(CLOSING).slice(0, 2 + Math.floor(r.next() * 2));
  return { headline, paragraphs, closing, used };
}

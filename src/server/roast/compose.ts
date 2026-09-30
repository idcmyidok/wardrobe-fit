import "server-only";
import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { RoastParagraph, RoastQuestion, RoastScript, RoastStep } from "@/lib/roast/types";
import type { CategoryId } from "@/lib/types/domain";
import type { Analysis, Pattern } from "./analyze";
import { familyName, type FamilyId } from "./keywords";
import { LINE_SECTION, type Section } from "./lines";
import { pickQuestions, QUESTIONS, type AskedQuestion } from "./questions";
import { scoreWardrobe, tierOf } from "./score";
import type { ScoreRules } from "./score-deltas";
import { fill, MissingVar, rng, won, type Rng, type Vars } from "./text";
import { DEFAULT_TEXTS, type RoastTexts } from "./texts";

/**
 * 분석 결과 → 대화 순서(script)와 결과 글. 같은 seed면 같은 문장·질문이 나온다(시작과 끝에서 서버가 같은 분석을 다시 만든다).
 * 숫자와 이름은 모두 패턴의 근거 값에서 채운다.
 */

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

/** 흥미도·강도 순. 같은 섹션은 perSection개까지. */
function rank(a: Analysis, r: Rng, max: number, T: RoastTexts, perSection = 2): Pattern[] {
  const scored = a.patterns
    .filter((p) => T.lines[p.id] && LINE_SECTION[p.id])
    .map((p) => ({ p, s: p.strength * p.interest + r.next() * 0.12 }))
    .sort((x, y) => y.s - x.s);
  const per = new Map<Section, number>();
  const out: Pattern[] = [];
  for (const { p } of scored) {
    const sec = LINE_SECTION[p.id];
    if ((per.get(sec) ?? 0) >= perSection) continue;
    per.set(sec, (per.get(sec) ?? 0) + 1);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

/** 패턴에 해당하는 옷 사진 전부(말한 벌 수와 사진 수가 같게). 너무 많으면 화면이 가로로 넘겨 본다. */
const MAX_PHOTOS = 40;
const photosOf = (a: Analysis, p: Pattern) => p.garmentIds.filter((id) => a.items.find((i) => i.id === id)?.hasPhoto).slice(0, MAX_PHOTOS);

const NO_PHOTO = new Set(["subcategory_spend", "count_small", "count_many", "count_huge", "avg_price", "trait_hype", "trait_trendy", "trait_timeless", "trait_functional", "trait_niche", "trait_mainstream", "trait_formal", "trait_casual", "trait_heritage", "trait_pricey", "country_bias", "season_bias", "musinsa_kr", "taste_shift", "price_shift"]);

/** 대화의 이야기 한 묶음: 분석 문장 하나 또는 질문 하나 */
type Block = { kind: "say"; p: Pattern; sec: Section } | { kind: "ask"; i: number; sec: Section | null };

/** 관련 패턴이 있는 질문은 그 패턴의 섹션 */
function sectionOfQuestion(id: string): Section | null {
  const pattern = QUESTIONS.find((d) => d.id === id)?.pattern;
  return pattern ? (LINE_SECTION[pattern] ?? null) : null;
}

/** 대화에서 섹션(보는 곳)이 나오는 순서 */
const SECTION_ORDER: Section[] = ["size", "category", "acc", "color", "brand", "group", "trait", "style", "shop", "repeat", "season", "timing", "money", "spend", "odd"];

/** 관련 패턴이 없는 질문이 들어갈 섹션(QUESTION_SECTION에 없는 것) */
const EXTRA_QUESTION_SECTION: Record<string, Section> = { band_quiz: "brand", rationalize: "spend", three_500: "money", fit_choice: "repeat", fruits_q: "shop", bunjang_q: "shop", vintage_q: "style", influencer_q: "style" };

/** 대화의 끝에 늘 붙는 질문(무신사 링크 → 패셔너블 순서. 패셔너블은 무조건 마지막) */
const LAST_QUESTIONS = ["musinsa_link_q", "fashionable_q"];

/**
 * 분석 문장과 질문을 관련 있는 것끼리 묶어 섹션 순서대로 늘어놓는다.
 * 관련 패턴이 있는 질문은 그 문장 바로 뒤, 문장이 대화에 없으면 그 섹션 끝에 둔다.
 * 그래서 질문이 뒤쪽에만 몰리지 않고 대화 전체에 퍼진다. 무신사 링크·패셔너블 질문만 맨 끝에 붙인다(패셔너블이 마지막).
 */
export function arrangeBlocks(says: Extract<Block, { kind: "say" }>[], asks: (Extract<Block, { kind: "ask" }> & { id: string; pattern?: string })[]): Block[] {
  const out: Block[] = [];
  const placed = new Set<number>();
  const push = (q: (typeof asks)[number]) => {
    if (placed.has(q.i)) return;
    placed.add(q.i);
    out.push(q);
  };
  const tail = asks.filter((q) => LAST_QUESTIONS.includes(q.id));
  const body = asks.filter((q) => !LAST_QUESTIONS.includes(q.id));
  for (const sec of SECTION_ORDER) {
    for (const b of says.filter((x) => x.sec === sec)) {
      out.push(b);
      for (const q of body) if (q.pattern === b.p.id) push(q);
    }
    for (const q of body) if (q.sec === sec) push(q);
  }
  for (const q of body) push(q);
  for (const id of LAST_QUESTIONS) for (const q of tail) if (q.id === id) push(q);
  return out;
}

export interface Plan {
  script: RoastScript;
  /** 결과 글을 만들 때 다시 쓰는 질문(반응·결과 문장 포함) */
  asked: AskedQuestion[];
  convo: Pattern[];
}

/** 첫 문장이 사용자의 답을 옮겨 말하는 틀("~라고 하셨죠.", "~고르셨습니다.")인지 */
export function quotesAnswer(text: string): boolean {
  const first = text.split(/(?<=[.?!])\s/)[0] ?? "";
  return /셨(습니다|죠|네요)[.?!]?$/.test(first.trim());
}

/** 질문 문장이 관련 패턴 문장과 같은 사실(숫자·달·금액)을 되풀이하는 질문. 이 질문을 하면 패턴 문장은 대화에서 뺀다. */
const RESTATES = new Set(["recent_reason", "binge_month", "shoes_q", "shoe_sub_q", "hats_q", "hat_sub_q", "subcat_spend_q", "brand_spend_q", "hype_alarm"]);

export function buildScript(a: Analysis, seed: number, name: string | null, T: RoastTexts = DEFAULT_TEXTS, age: number | null = null): Plan {
  const r = rng(seed);
  const C = T.common;
  const convo = rank(a, r, 15, T, 3);
  // "스스로 패셔너블한가요?"는 지금까지의 옷장 점수 구간에 따라 반응이 달라진다(질문 답 전 점수)
  const rules = T.score.rules as unknown as ScoreRules;
  const base = scoreWardrobe(a, { age, rules, ageRules: T.score.age as unknown as Record<string, Record<string, number>> });
  const asked = pickQuestions(a, r, fill, T, tierOf(base.score, rules));
  const steps: RoastStep[] = [];
  const say = (text: string, photos?: string[]) => steps.push(photos?.length ? { t: "say", text, photos } : { t: "say", text });

  // 이름은 가끔만 부른다: 인사에서 부르거나, 대화 중에 한 번.
  const greet = Boolean(name) && r.next() < 0.5;
  if (greet) say(fill(r.pick(C.NAME_GREETING), { name: name! }));
  say(fill(r.pick(C.SCAN_OPEN), { n: a.clothesTotal }));

  // 낯선 옷 고르기 질문은 그 사진을 질문에서만 보여 준다. 다른 문장은 해당 옷 사진을 빠짐없이 다 보여 주고,
  // 같은 사진이 바로 뒤 질문에 또 나오지 않게 질문 쪽에서 뺀다(sayShown).
  const askedPhotos = new Set(asked.filter((q) => q.id === "odd_photo").flatMap((q) => q.photos));
  const sayShown = new Map<string, Set<string>>();
  // 질문은 화면이 늘 새 이야기로 띄운다(앞 문장과 간격을 둔다).
  const ask = (i: number) => {
    steps.push({ t: "think" });
    steps.push({ t: "ask", q: i });
  };

  // 혼잣말·추임새·진행 문구는 한 번의 분석에서 같은 문장을 두 번 쓰지 않는다(다 쓰면 더 끼우지 않는다).
  const usedLines = new Set<string>();
  const fresh = (list: string[]) => {
    const left = list.filter((x) => !usedLines.has(x));
    if (!left.length) return null;
    const t = r.pick(left);
    usedLines.add(t);
    return t;
  };

  // 질문이 같은 사실(숫자·달·금액)을 다시 말하면 그 패턴 문장은 빼고 질문만 한다.
  const restated = new Set(asked.filter((q) => RESTATES.has(q.id)).map((q) => QUESTIONS.find((d) => d.id === q.id)?.pattern).filter(Boolean));
  const sayBlocks = convo.filter((p) => !restated.has(p.id)).map((p) => ({ kind: "say" as const, p, sec: LINE_SECTION[p.id] }));
  const askBlocks = asked.map((q, i) => ({
    kind: "ask" as const,
    i,
    id: q.id,
    pattern: QUESTIONS.find((d) => d.id === q.id)?.pattern,
    sec: QUESTION_SECTION[q.id] ?? EXTRA_QUESTION_SECTION[q.id] ?? sectionOfQuestion(q.id),
  }));
  const blocks = arrangeBlocks(sayBlocks, askBlocks);

  let nameUsed = greet;
  let prevSec: Section | null = null;
  blocks.forEach((b, idx) => {
    // 이야기 사이에 가끔 혼잣말을 끼운다.
    if (idx > 0 && r.next() < 0.2) {
      const text = fresh(C.MID_REMARKS);
      if (text) steps.push({ t: "say", text, gap: true });
    }
    if (b.kind === "ask") {
      ask(b.i);
      prevSec = b.sec ?? prevSec;
      return;
    }
    const p = b.p;
    let text = tryFill(r, T.lines[p.id].say, varsOf(p));
    if (!text) return;
    // 이름은 가끔만 부른다.
    if (name && !nameUsed && r.next() < 0.3) {
      text = `${name}님, ${text}`;
      nameUsed = true;
    }
    // 보는 곳이 바뀌면 진행 문구("~를 보겠습니다")로 새 이야기를 연다. 같은 곳이면 첫 말에 간격만 둔다.
    let gap = true;
    if (b.sec !== prevSec) {
      const status = fresh(C.SECTION_STATUS[b.sec]) ?? r.pick(C.SECTION_STATUS[b.sec]);
      steps.push({ t: "status", text: status, gap: true });
      gap = false;
    }
    prevSec = b.sec;
    if (r.next() < 0.4) {
      const t = fresh(C.THINKING);
      if (t) {
        steps.push(gap ? { t: "say", text: t, gap: true } : { t: "say", text: t });
        gap = false;
      }
    }
    const photos = NO_PHOTO.has(p.id) ? [] : photosOf(a, p).filter((id) => !askedPhotos.has(id));
    if (photos.length) sayShown.set(p.id, new Set(photos));
    steps.push({ t: "say", text, ...(photos.length ? { photos } : {}), ...(gap ? { gap: true } : {}) });
  });

  if (convo.length < 2) say(r.pick(C.FEW_PATTERNS));
  steps.push({ t: "think" });
  say(r.pick(C.WRAP_UP));

  const questions: RoastQuestion[] = asked.map((q) => ({
    id: q.id,
    lead: q.lead,
    text: q.text,
    options: q.options,
    reactions: q.reactions,
    photos: q.id === "odd_photo" ? q.photos : q.photos.filter((id) => !sayShown.get(QUESTIONS.find((d) => d.id === q.id)?.pattern ?? "")?.has(id)),
    ...(q.leadPhotos ? { leadPhotos: q.leadPhotos } : {}),
    ...(q.answer != null ? { answer: q.answer } : {}),
    ...(q.reveal?.length ? { reveal: q.reveal } : {}),
  }));
  return { script: { seed, steps, questions }, asked, convo };
}

/** 코디 조합 수: 기본(상의×하의×신발) × (1+아우터) × (1+모자). 아우터만·모자만·둘 다 얹은 경우를 기본에 더한 것과 같다. */
export function outfitCounts(a: Analysis) {
  // 코디 조합은 실제 벌 수로 센다(분석에서 뺀 무지 티 포함).
  const n = (c: CategoryId) => a.allItems.filter((i) => i.cat === c).length;
  const top = n("top"), bottom = n("bottom"), shoes = n("shoes"), outer = n("outer"), hat = n("hat");
  const base = top * bottom * shoes;
  return { top, bottom, shoes, outer, hat, base, combos: base * (1 + outer) * (1 + hat) };
}

function outfitText(a: Analysis, r: Rng, T: RoastTexts): string | null {
  if (!a.allItems.length) return null;
  const c = outfitCounts(a);
  const num = (x: number) => x.toLocaleString("ko-KR");
  if (!c.base) {
    const missing = (["top", "bottom", "shoes"] as const).filter((k) => !c[k]).map((k) => CATEGORY_NAME[k]).join("·");
    return tryFill(r, T.common.OUTFIT_NONE, { missing });
  }
  return tryFill(r, T.common.OUTFIT_COMBOS, { top: num(c.top), bottom: num(c.bottom), shoes: num(c.shoes), outer: num(c.outer), hat: num(c.hat), base: num(c.base), combos: num(c.combos) });
}

export interface Composed {
  headline: string;
  paragraphs: RoastParagraph[];
  closing: string[];
  used: Pattern[];
  /** 코디 조합 문단(AI가 글을 써도 이 문단은 그대로 넣는다) */
  outfit: string | null;
}

/**
 * 템플릿 결과 글. 뚜렷한 패턴 5개까지 문단으로 쓰고, 대화에서 받은 답은 숫자를 되풀이하지 않고
 * 답을 골랐다는 사실을 두고 한 번 더 비꼬는 문단(roast)으로 쓴다.
 */
export function composeResult(
  a: Analysis,
  name: string | null,
  seed: number,
  T: RoastTexts = DEFAULT_TEXTS,
  asked: AskedQuestion[] = [],
  answers: Record<string, string> = {},
): Composed {
  // 대화와 다른 순서로 뽑히지 않게 결과용 난수는 따로 만든다.
  const r = rng(seed ^ 0x5bd1e995);
  const C = T.common;
  const used = rank(a, r, 5, T);

  let headline: string;
  if (used.length >= 2) {
    const [h1] = r.shuffle(T.lines[used[0].id].head);
    const [h2] = r.shuffle(T.lines[used[1].id].head);
    const first = tryFill(r, [h1[0]], varsOf(used[0]));
    const second = tryFill(r, [h2[1]], varsOf(used[1]));
    headline = first && second ? `${first} ${second}` : (second ?? first ?? r.pick(C.PLAIN_HEADLINE));
  } else if (used.length === 1) {
    const pre = r.pick(C.HEAD_SINGLE_PREFIX) ?? "";
    headline = (pre && !pre.endsWith(" ") ? `${pre} ` : pre) + (tryFill(r, [r.pick(T.lines[used[0].id].head)[1]], varsOf(used[0])) ?? r.pick(C.PLAIN_HEADLINE));
  } else headline = r.pick(C.PLAIN_HEADLINE);

  const paragraphs: RoastParagraph[] = [];
  used.forEach((p, idx) => {
    let text = tryFill(r, T.lines[p.id].para, varsOf(p));
    if (!text) return;
    // 첫 문단은 "그리고"로 시작하지 않게 한다(튀는 옷 문단).
    if (idx === 0) text = text.replace(/^그리고 /, "");
    if (idx === 0 && name) text = `${name}님, ${text}`;
    paragraphs.push({ text, photos: NO_PHOTO.has(p.id) ? [] : photosOf(a, p) });
  });
  if (!paragraphs.length) paragraphs.push({ text: fill(r.pick(C.PLAIN_PARA), { n: a.clothesTotal }), photos: [] });
  if (used.length < 2) paragraphs.push({ text: r.pick(C.FEW_PATTERNS), photos: [] });

  const outfit = outfitText(a, r, T);
  if (outfit) paragraphs.push({ text: outfit, photos: [] });

  // 답을 두고 한 번 더(질문 순서대로, 네 개까지). "~라고 하셨죠."처럼 답을 옮겨 말하며 시작하는 문단은 한 번만 쓴다.
  let roasts = 0;
  let quoted = false;
  for (const q of asked) {
    if (roasts >= 4) break;
    const picked = answers[q.id];
    const list = picked ? (q.roast[picked] ?? []) : [];
    if (!list.length) continue;
    const plain = list.filter((t) => !quotesAnswer(t));
    const text = r.pick(quoted && plain.length ? plain : list);
    if (quotesAnswer(text)) quoted = true;
    paragraphs.push({ text, photos: [] });
    roasts++;
  }

  const closing = r.shuffle(C.CLOSING).slice(0, 2 + Math.floor(r.next() * 2));
  return { headline, paragraphs, closing, used, outfit };
}

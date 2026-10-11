import "server-only";
import { findBrand } from "../brands";
import type { QuizEntry } from "../quiz";
import type { AskText } from "./asks";
import { BRAND_KINDS, MIX_KEYS } from "./brand-talk";
import { AGE_VERDICTS, SHIFT_VERDICTS } from "./life";
import { DEFAULT_CONFIG, REPORT_BLOCKS, TALK_BLOCKS, type Block, type FlConfig, type TypeConf } from "./config";
import { AXIS_KEYS, RULES, TYPE_DEFS, type AxisKey, type Grade, type RuleId } from "./types";

/**
 * 훈수 설계 저장·불러오기 규칙. 고친 값은 roast_text_edits에 "fl.<구역>" 키의 JSON으로 저장한다.
 * 한 행은 1000자까지라 긴 JSON은 "fl.<구역>~0", "~1"…로 나눠 저장한다. 행을 지우면 기본값으로 돌아간다.
 * 구역: type.<유형id> / tune / axisLines / bands / talk / report / common
 */

export const BODY_MAX = 1000;
export const SENTENCE_MAX = 400;

/** 문장에 쓸 수 있는 자리({이름}) */
export const VARS = {
  common: ["n", "name", "type", "score", "grade", "points", "brand", "orders", "events"],
  type: [
    "n", "brand", "brandPct", "brandN", "brandCount", "achroPct", "chromaPct", "overPct", "slimPct", "regularPct", "widePct", "outerPct", "shoesPct", "hatPct",
    "spaPct", "massPct", "lowPct", "midPct", "highPct", "designerPct", "cultPct", "usedPct", "heritagePct", "popularPct", "sportsPct", "streetPct", "domesticPct",
    "minimalPct", "logoPct", "workPct", "denimPct", "outdoorPct", "preppyPct", "y2kPct", "femPct", "recentPct", "salePct", "seasonName", "seasonPct", "orders", "events", "topTag", "spaBrand", "spaN", "stdPct",
  ],
  axis: ["axis", "score"],
  special: ["n", "name", "color", "brand", "band", "wrong", "wrongBy", "priceWon", "count", "tier"],
  quiz: ["brand"],
  band: ["score"],
  brand: ["brand", "n", "pct", "level", "kind", "count"],
  ask: ["n", "brand", "brandN", "hues", "logoPct", "tops", "bottoms", "popularPct", "tag", "tag2", "decoy", "age", "styleAge", "youngPct", "oldPct", "then", "now", "what", "before", "after"],
  life: ["age", "styleAge", "youngPct", "oldPct", "then", "now", "what", "before", "after"],
} as const;
export type VarArea = keyof typeof VARS;

const allowedIn = (area: VarArea) => new Set<string>(VARS[area]);

/** 문장 하나 검사. 통과하면 null */
export function checkSentence(s: unknown, area: VarArea): string | null {
  if (typeof s !== "string") return "문장이 아닙니다.";
  const t = s.trim();
  if (!t) return "비워 둘 수 없습니다.";
  if (t.length > SENTENCE_MAX) return `${SENTENCE_MAX}자 이하로 써 주세요.`;
  const ok = allowedIn(area);
  for (const m of t.matchAll(/\{(\w+)(?:\|[^}]+)?\}/g)) if (!ok.has(m[1])) return `이 칸에서 쓸 수 없는 자리입니다: {${m[1]}}`;
  if (/[{}]/.test(t.replace(/\{\w+(\|[^{}]+)?\}/g, ""))) return "중괄호 { }는 자리 표시에만 쓸 수 있습니다.";
  return null;
}

function list(v: unknown, area: VarArea, min = 1, max = 30): string[] | string {
  if (!Array.isArray(v)) return "목록이 아닙니다.";
  if (v.length < min) return `${min}개 이상 있어야 합니다.`;
  if (v.length > max) return `${max}개까지만 넣을 수 있습니다.`;
  for (const s of v) {
    const e = checkSentence(s, area);
    if (e) return e;
  }
  return v.map((s: string) => s.trim());
}

const num = (v: unknown, lo: number, hi: number, int = false): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return int ? (Number.isInteger(n) ? n : null) : n;
};

type R<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function sanitizeType(id: string, v: unknown): R<TypeConf> {
  const base = DEFAULT_CONFIG.types[id];
  if (!base) return fail("없는 유형입니다.");
  const x = (v ?? {}) as Partial<TypeConf>;
  const text = (t: unknown, label: string, max = 300): string | { error: string } => {
    if (typeof t !== "string" || !t.trim()) return { error: `${label}을(를) 비워 둘 수 없습니다.` };
    if (t.trim().length > max) return { error: `${label}은(는) ${max}자 이하로 써 주세요.` };
    return t.trim();
  };
  const name = text(x.name ?? base.name, "이름", 30);
  if (typeof name !== "string") return fail(name.error);
  const who = text(x.who ?? base.who, "이런 사람");
  if (typeof who !== "string") return fail(who.error);
  const how = text(x.how ?? base.how, "이렇게 평가", 500);
  if (typeof how !== "string") return fail(how.error);
  const grade = (x.grade ?? base.grade) as Grade;
  if (!["A", "B", "-"].includes(grade)) return fail("등급은 A, B, -만 쓸 수 있습니다.");
  const th = x.threshold == null ? null : num(x.threshold, 0.3, 0.95);
  if (x.threshold != null && th == null) return fail("판정 문턱은 0.3~0.95 사이로 써 주세요.");
  const w: Partial<Record<AxisKey, number>> = {};
  for (const k of AXIS_KEYS) {
    const raw = x.w?.[k];
    if (raw == null || raw === 0) continue;
    const n = num(raw, -30, 30, true);
    if (n == null) return fail("비중 변화는 -30~30 정수로 써 주세요.");
    w[k] = n;
  }
  const rules = (x.rules ?? base.rules) as RuleId[];
  if (!Array.isArray(rules) || rules.some((r) => !(r in RULES))) return fail("모르는 평가 기준이 있습니다.");
  const lines = { say: [] as string[], praise: [] as string[], tip: [] as string[] };
  for (const k of ["say", "praise", "tip"] as const) {
    const l = list(x.lines?.[k] ?? base.lines[k], "type", 1, 12);
    if (typeof l === "string") return fail(l);
    lines[k] = l;
  }
  return { ok: true, value: { name, who, how, grade, enabled: x.enabled !== false, threshold: th, w, rules: [...new Set(rules)], lines } };
}

export function sanitizeTune(v: unknown): R<FlConfig["tune"]> {
  const b = DEFAULT_CONFIG.tune;
  const x = (v ?? {}) as Partial<FlConfig["tune"]>;
  const out = structuredClone(b);
  const set = <K extends keyof FlConfig["tune"]>(k: K, n: number | null, label: string) => {
    if (n == null) return label;
    (out as Record<string, unknown>)[k] = n;
    return null;
  };
  const checks: (string | null)[] = [];
  const pick = (k: keyof FlConfig["tune"], lo: number, hi: number, label: string, int = false) => {
    if (x[k] === undefined) return;
    checks.push(set(k, num(x[k], lo, hi, int), label));
  };
  pick("threshold", 0.3, 0.95, "판정 문턱(0.3~0.95)");
  pick("maxTypes", 1, 6, "유형 최대 수(1~6)", true);
  pick("floor", 0, 60, "최저 점수(0~60)", true);
  pick("scale", 0.3, 1, "환산 계수(0.3~1)");
  pick("curve", 1, 2.5, "곡선(1~2.5)");
  pick("knownMin", 0, 1, "브랜드 자료 비율(0~1)");
  pick("ordersMin", 1, 100, "주문내역 최소 구매 수(1~100)", true);
  pick("talkTypes", 0, 4, "대화 유형 수(0~4)", true);
  pick("talkLines", 1, 4, "유형당 문장 수(1~4)", true);
  pick("tierHigh", 40, 100, "높음 경계(40~100)", true);
  pick("tierLow", 31, 100, "낮음 경계(31~100)", true);
  pick("quizRight", -5, 10, "퀴즈 정답 점수(-5~10)", true);
  pick("quizWrong", -10, 5, "퀴즈 오답 점수(-10~5)", true);
  pick("maxAsks", 0, 8, "점수 질문 수(0~8)", true);
  pick("shift", 0, 10, "구매 흐름 가감점(0~10)", true);
  const bad = checks.find(Boolean);
  if (bad) return fail(`${bad} 범위를 확인해 주세요.`);
  if (x.blend !== undefined) {
    if (!Array.isArray(x.blend) || x.blend.length < 1 || x.blend.length > 6) return fail("섞는 비율은 1~6개의 숫자입니다.");
    const bl = x.blend.map((n) => num(n, 1, 100, true));
    if (bl.some((n) => n == null)) return fail("섞는 비율은 1~100 정수입니다.");
    out.blend = bl as number[];
  }
  if (x.penalty !== undefined) {
    const c = num(x.penalty?.common, 0, 30, true);
    const f = num(x.penalty?.fit, 0, 30, true);
    const a = x.penalty?.age === undefined ? out.penalty.age : num(x.penalty.age, 0, 30, true);
    if (c == null || f == null || a == null) return fail("감점은 0~30 정수입니다.");
    out.penalty = { common: c, fit: f, age: a };
  }
  for (const mode of ["closet", "orders"] as const) {
    const xb = x.bonus?.[mode];
    if (xb) {
      const A = num(xb.A, 0, 50, true);
      const B = num(xb.B, 0, 50, true);
      if (A == null || B == null) return fail("보너스는 0~50 정수입니다.");
      out.bonus[mode] = { A, B };
    }
    const xw = x.weights?.[mode];
    if (xw) {
      const wt = {} as Record<AxisKey, number>;
      for (const k of AXIS_KEYS) {
        const n = num(xw[k], 0, 60, true);
        if (n == null) return fail("항목 비중은 0~60 정수입니다.");
        wt[k] = n;
      }
      if (Object.values(wt).reduce((a, b) => a + b, 0) === 0) return fail("항목 비중의 합이 0일 수 없습니다.");
      out.weights[mode] = wt;
    }
  }
  return { ok: true, value: out };
}

export function sanitizeAxisLines(v: unknown): R<FlConfig["axisLines"]> {
  const out = structuredClone(DEFAULT_CONFIG.axisLines);
  const x = (v ?? {}) as Partial<FlConfig["axisLines"]>;
  for (const k of AXIS_KEYS)
    for (const g of ["low", "mid", "high", "tip", "praise"] as const) {
      if (x[k]?.[g] === undefined) continue;
      const l = list(x[k]![g], "axis", 1, 12);
      if (typeof l === "string") return fail(l);
      out[k][g] = l;
    }
  return { ok: true, value: out };
}

export function sanitizeBands(v: unknown): R<FlConfig["bands"]> {
  if (!Array.isArray(v) || v.length < 2 || v.length > 10) return fail("등급은 2~10개여야 합니다.");
  const out: FlConfig["bands"] = [];
  let prev = 30;
  for (const b of v) {
    const max = num(b?.max, 31, 100, true);
    if (max == null || max <= prev) return fail("등급 경계는 31~100에서 커지는 순서여야 합니다.");
    if (typeof b?.name !== "string" || !b.name.trim() || b.name.length > 20) return fail("등급 이름은 1~20자입니다.");
    const say = list(b.say, "band", 1, 10);
    if (typeof say === "string") return fail(say);
    out.push({ max, name: b.name.trim(), say });
    prev = max;
  }
  if (out[out.length - 1].max !== 100) return fail("마지막 등급은 100점까지여야 합니다.");
  return { ok: true, value: out };
}

/** 설계를 저장한 뒤에 새로 생긴 대화 블록 */
const LATER_BLOCKS = ["age", "timeline"];

function sanitizeBlocks(v: unknown, known: Record<string, unknown>): R<Block[]> {
  if (!Array.isArray(v)) return fail("목록이 아닙니다.");
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const b of v) {
    if (!b || typeof b.id !== "string" || !(b.id in known) || seen.has(b.id)) return fail("모르는 블록이 있습니다.");
    seen.add(b.id);
    out.push({ id: b.id, on: b.on !== false });
  }
  // 나중에 생긴 블록이 빠져 있으면 기본 자리(앞 블록 바로 뒤)에 켜서 넣는다
  const ids = Object.keys(known);
  for (const id of LATER_BLOCKS) {
    if (seen.has(id) || !(id in known)) continue;
    const prev = ids[ids.indexOf(id) - 1];
    const at = out.findIndex((b) => b.id === prev);
    out.splice(at < 0 ? out.length : at + 1, 0, { id, on: true });
    seen.add(id);
  }
  // 그 밖에 빠진 블록은 끝에 꺼진 채로 붙인다(구조에서 지운 것을 되살릴 수 있게)
  for (const id of ids) if (!seen.has(id)) out.push({ id, on: false });
  return { ok: true, value: out };
}
export const sanitizeTalk = (v: unknown) => sanitizeBlocks(v, TALK_BLOCKS);
export const sanitizeReport = (v: unknown) => sanitizeBlocks(v, REPORT_BLOCKS);

export function sanitizeCommon(v: unknown): R<FlConfig["common"]> {
  const out = structuredClone(DEFAULT_CONFIG.common);
  const x = (v ?? {}) as Partial<FlConfig["common"]>;
  for (const k of Object.keys(out) as (keyof FlConfig["common"])[]) {
    if (x[k] === undefined) continue;
    const l = list(x[k], "common", 1, 20);
    if (typeof l === "string") return fail(l);
    out[k] = l;
  }
  return { ok: true, value: out };
}


export const CUSTOM_QUIZ_ID = /^c-[a-z0-9]{4,24}$/;
const isQuizId = (id: string) => id in DEFAULT_CONFIG.quiz || CUSTOM_QUIZ_ID.test(id);

/** 특수 질문 문구: 기본에 있는 질문·칸만, 목록은 문장 검사 */
export function sanitizeSpecial(v: unknown): R<FlConfig["special"]> {
  const out = structuredClone(DEFAULT_CONFIG.special);
  const x = (v ?? {}) as Record<string, Partial<FlConfig["special"][string]>>;
  for (const [id, q] of Object.entries(x)) {
    const base = out[id];
    if (!base || !q) continue;
    if (q.lead !== undefined) {
      const l = list(q.lead, "special", 0, 6);
      if (typeof l === "string") return fail(l);
      base.lead = l;
    }
    if (q.text !== undefined) {
      if (typeof q.text !== "string" || q.text.length > SENTENCE_MAX) return fail("질문 문장을 확인해 주세요.");
      if (q.text.trim()) {
        const e = checkSentence(q.text, "special");
        if (e) return fail(e);
      }
      base.text = q.text.trim();
    }
    for (const g of ["options", "react", "roast"] as const) {
      const src = q[g] as Record<string, unknown> | undefined;
      if (!src) continue;
      for (const k of Object.keys(base[g])) {
        if (src[k] === undefined) continue;
        if (g === "options") {
          const e = checkSentence(src[k], "special");
          if (e) return fail(e);
          (base.options as Record<string, string>)[k] = (src[k] as string).trim();
        } else {
          const l = list(src[k], "special", 1, 12);
          if (typeof l === "string") return fail(l);
          (base[g] as Record<string, string[]>)[k] = l;
        }
      }
    }
  }
  return { ok: true, value: out };
}

/** 화면 문구: 기본에 있는 칸만, 글자/목록 모양 유지 */
function sanitizeScreen(v: unknown, base: Record<string, string | string[]>): R<Record<string, string | string[]>> {
  const out = structuredClone(base);
  for (const [k, val] of Object.entries((v ?? {}) as Record<string, unknown>)) {
    const b = base[k];
    if (b === undefined) continue;
    if (Array.isArray(b)) {
      if (!Array.isArray(val) || val.length < 1 || val.length > 40 || val.some((s) => typeof s !== "string" || !s.trim() || s.length > 400)) return fail(`${k}: 문장 목록을 확인해 주세요.`);
      out[k] = val.map((s: string) => s.trim());
    } else {
      if (typeof val !== "string" || !val.trim() || val.length > 600) return fail(`${k}: 문장을 확인해 주세요(600자 이하).`);
      out[k] = val.trim();
    }
  }
  return { ok: true, value: out };
}
export const sanitizeScreenCopy = (v: unknown) => sanitizeScreen(v, DEFAULT_CONFIG.screen);
export const sanitizeOrderScreen = (v: unknown) => sanitizeScreen(v, DEFAULT_CONFIG.orderScreen);

/** 브랜드 분석 문장: 계열별·구성별 목록 */
export function sanitizeBrands(v: unknown): R<FlConfig["brands"]> {
  const out = structuredClone(DEFAULT_CONFIG.brands);
  const x = (v ?? {}) as Partial<FlConfig["brands"]>;
  if (x.title !== undefined) {
    if (typeof x.title !== "string" || !x.title.trim() || x.title.length > 30) return fail("제목은 1~30자입니다.");
    out.title = x.title.trim();
  }
  if (x.status !== undefined) {
    const l = list(x.status, "brand", 0, 10);
    if (typeof l === "string") return fail(l);
    out.status = l;
  }
  for (const k of BRAND_KINDS) {
    if (x.kind?.[k] === undefined) continue;
    const l = list(x.kind[k], "brand", 1, 12);
    if (typeof l === "string") return fail(l);
    out.kind[k] = l;
  }
  for (const k of MIX_KEYS) {
    if (x.mix?.[k] === undefined) continue;
    const l = list(x.mix[k], "brand", 1, 12);
    if (typeof l === "string") return fail(l);
    out.mix[k] = l;
  }
  return { ok: true, value: out };
}

/** 나이·구매 시기 문장 */
export function sanitizeLife(v: unknown): R<FlConfig["life"]> {
  const out = structuredClone(DEFAULT_CONFIG.life);
  const x = (v ?? {}) as Partial<FlConfig["life"]>;
  for (const k of ["ageStatus", "shiftStatus"] as const) {
    if (x[k] === undefined) continue;
    const l = list(x[k], "life", 0, 10);
    if (typeof l === "string") return fail(l);
    out[k] = l;
  }
  for (const k of AGE_VERDICTS) {
    if (x.age?.[k] === undefined) continue;
    const l = list(x.age[k], "life", 1, 12);
    if (typeof l === "string") return fail(l);
    out.age[k] = l;
  }
  for (const k of SHIFT_VERDICTS) {
    if (x.shift?.[k] === undefined) continue;
    const l = list(x.shift[k], "life", 1, 12);
    if (typeof l === "string") return fail(l);
    out.shift[k] = l;
  }
  return { ok: true, value: out };
}

/** 점수 질문: 기본에 있는 질문·선택지만, 점수는 -10~10 정수 */
export function sanitizeAsks(v: unknown): R<FlConfig["asks"]> {
  const out = structuredClone(DEFAULT_CONFIG.asks);
  for (const [id, q] of Object.entries((v ?? {}) as Record<string, Partial<AskText>>)) {
    const base = out[id];
    if (!base || !q) continue;
    if (q.on !== undefined) base.on = q.on !== false;
    if (q.lead !== undefined) {
      const l = list(q.lead, "ask", 0, 6);
      if (typeof l === "string") return fail(l);
      base.lead = l;
    }
    if (q.text !== undefined) {
      const e = checkSentence(q.text, "ask");
      if (e) return fail(e);
      base.text = (q.text as string).trim();
    }
    for (const [k, o] of Object.entries(q.options ?? {})) {
      const bo = base.options[k];
      if (!bo || !o) continue;
      if (o.label !== undefined) {
        const e = checkSentence(o.label, "ask");
        if (e) return fail(e);
        bo.label = o.label.trim();
      }
      if (o.points !== undefined) {
        const n = num(o.points, -10, 10, true);
        if (n == null) return fail("질문 점수는 -10~10 정수입니다.");
        bo.points = n;
      }
      for (const g of ["react", "roast"] as const) {
        if (o[g] === undefined) continue;
        const l = list(o[g], "ask", 1, 12);
        if (typeof l === "string") return fail(l);
        bo[g] = l;
      }
    }
  }
  return { ok: true, value: out };
}

/** 퀴즈 하나: 값이 {deleted:true}이면 빼는 표시 */
export function sanitizeQuiz(id: string, v: unknown): R<QuizEntry | { deleted: true }> {
  if (!isQuizId(id)) return fail("없는 퀴즈입니다.");
  if ((v as { deleted?: boolean })?.deleted === true) return { ok: true, value: { deleted: true } };
  const q = v as Partial<QuizEntry>;
  const brand = typeof q?.brand === "string" ? findBrand(q.brand)?.name : null;
  if (!brand) return fail("브랜드 자료에 없는 브랜드입니다.");
  if (typeof q.question !== "string" || !q.question.trim() || q.question.length > 200) return fail("문제를 200자 이하로 써 주세요.");
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some((o) => typeof o !== "string" || !o.trim() || o.length > 80)) return fail("선택지는 2~6개(80자 이하)입니다.");
  if (!Number.isInteger(q.answer) || q.options[q.answer as number] == null) return fail("정답을 골라 주세요.");
  const side = (l: unknown) => {
    if (!Array.isArray(l) || l.length < 1 || l.length > 6 || l.some((s) => typeof s !== "string" || !s.trim() || s.length > 300)) return null;
    return l.map((s: string) => s.trim());
  };
  const correct = side(q.correct);
  const wrong = side(q.wrong);
  if (!correct || !wrong) return fail("정답·오답 반응을 1~6개(300자 이하) 써 주세요.");
  return { ok: true, value: { brand, question: q.question.trim(), options: q.options.map((o) => o.trim()), answer: q.answer as number, correct, wrong } };
}

/** 구역 키 → 검사 후 값 */
export function sanitizeSection(section: string, value: unknown): R<unknown> {
  if (section.startsWith("type.")) return sanitizeType(section.slice(5), value);
  if (section.startsWith("quiz.")) return sanitizeQuiz(section.slice(5), value);
  switch (section) {
    case "special": return sanitizeSpecial(value);
    case "screen": return sanitizeScreenCopy(value);
    case "orderScreen": return sanitizeOrderScreen(value);
    case "tune": return sanitizeTune(value);
    case "axisLines": return sanitizeAxisLines(value);
    case "bands": return sanitizeBands(value);
    case "talk": return sanitizeTalk(value);
    case "report": return sanitizeReport(value);
    case "common": return sanitizeCommon(value);
    case "brands": return sanitizeBrands(value);
    case "asks": return sanitizeAsks(value);
    case "life": return sanitizeLife(value);
    default: return fail("없는 구역입니다.");
  }
}

export const isSection = (s: string) =>
  s.startsWith("type.") ? TYPE_DEFS.some((t) => `type.${t.id}` === s) : s.startsWith("quiz.") ? isQuizId(s.slice(5)) : ["tune", "axisLines", "bands", "talk", "report", "common", "special", "screen", "orderScreen", "brands", "asks", "life"].includes(s);

/** 값 → 저장 행들(fl.<구역>, 길면 ~0, ~1 …) */
export function toRows(section: string, value: unknown): Record<string, string> {
  const key = `fl.${section}`;
  const json = JSON.stringify(value);
  const rows: Record<string, string> = {};
  // 한 글자가 JSON에서 여러 글자가 되지 않으므로 글자 수로 나눈다(서러게이트 쌍을 자르지 않게 배열로).
  const chars = [...json];
  for (let i = 0, n = 0; i < chars.length; i += BODY_MAX, n++) rows[`${key}~${n}`] = chars.slice(i, i + BODY_MAX).join("");
  return rows;
}

/** 저장 행들 → 구역별 값. 읽을 수 없는 구역은 뺀다. */
export function fromRows(rows: Record<string, string>): Record<string, unknown> {
  const parts = new Map<string, { n: number; s: string }[]>();
  for (const [k, body] of Object.entries(rows)) {
    const m = k.match(/^fl\.(.+)~(\d+)$/);
    if (!m) continue;
    parts.set(m[1], [...(parts.get(m[1]) ?? []), { n: Number(m[2]), s: body }]);
  }
  const out: Record<string, unknown> = {};
  for (const [section, list] of parts) {
    try {
      out[section] = JSON.parse(list.sort((a, b) => a.n - b.n).map((p) => p.s).join(""));
    } catch {}
  }
  return out;
}

/**
 * 예전 문장 편집 화면(main)에서 고친 퀴즈: "quiz.<id>.<칸>" 행(목록은 JSON 배열, 길면 "~1"…), "quiz.<id>.deleted".
 * 새 설계로 저장한 적 없는 퀴즈는 이 값을 그대로 쓴다.
 */
export function legacyQuiz(rows: Record<string, string>): Record<string, QuizEntry | { deleted: true }> {
  const fields = new Map<string, Partial<QuizEntry>>();
  const lists = new Map<string, { n: number; items: unknown[] }[]>();
  const deleted = new Set<string>();
  for (const [k, body] of Object.entries(rows)) {
    const m = k.match(/^quiz\.([^.]+)\.(brand|answer|question|options|correct|wrong|deleted)(?:~(\d+))?$/);
    if (!m || !isQuizId(m[1])) continue;
    const [, id, f, n] = m;
    if (f === "deleted") deleted.add(id);
    else if (f === "brand" || f === "question") fields.set(id, { ...fields.get(id), [f]: body });
    else if (f === "answer") fields.set(id, { ...fields.get(id), answer: Number(body) });
    else {
      try {
        const items = JSON.parse(body);
        if (Array.isArray(items)) lists.set(`${id}.${f}`, [...(lists.get(`${id}.${f}`) ?? []), { n: Number(n ?? 0), items }]);
      } catch {}
    }
  }
  for (const [key, parts] of lists) {
    const [id, f] = key.split(".");
    fields.set(id, { ...fields.get(id), [f]: parts.sort((a, b) => a.n - b.n).flatMap((x) => x.items) });
  }
  const out: Record<string, QuizEntry | { deleted: true }> = {};
  for (const id of deleted) out[id] = { deleted: true };
  for (const [id, f] of fields) {
    if (deleted.has(id)) continue;
    const r = sanitizeQuiz(id, { ...DEFAULT_CONFIG.quiz[id], ...f });
    if (r.ok) out[id] = r.value;
  }
  return out;
}

/** 기본값 위에 고친 값을 덮은 설계. 검사에 걸리는 구역은 무시한다. */
export function applyEdits(rows: Record<string, string>): FlConfig {
  const edits = fromRows(rows);
  const legacy = legacyQuiz(rows);
  if (!Object.keys(edits).length && !Object.keys(legacy).length) return DEFAULT_CONFIG;
  const out = structuredClone(DEFAULT_CONFIG);
  // 예전 화면에서 고친 퀴즈 먼저, 새 설계에서 저장한 퀴즈가 있으면 그것으로 덮는다
  for (const [id, q] of Object.entries(legacy)) {
    if ("deleted" in q) delete out.quiz[id];
    else out.quiz[id] = q;
  }
  for (const [section, value] of Object.entries(edits)) {
    if (!isSection(section)) continue;
    const r = sanitizeSection(section, value);
    if (!r.ok) continue;
    if (section.startsWith("type.")) out.types[section.slice(5)] = r.value as TypeConf;
    else if (section.startsWith("quiz.")) {
      const id = section.slice(5);
      if ((r.value as { deleted?: boolean }).deleted) delete out.quiz[id];
      else out.quiz[id] = r.value as QuizEntry;
    } else if (section === "special") out.special = r.value as FlConfig["special"];
    else if (section === "screen") out.screen = r.value as FlConfig["screen"];
    else if (section === "orderScreen") out.orderScreen = r.value as FlConfig["orderScreen"];
    else if (section === "tune") out.tune = r.value as FlConfig["tune"];
    else if (section === "axisLines") out.axisLines = r.value as FlConfig["axisLines"];
    else if (section === "bands") out.bands = r.value as FlConfig["bands"];
    else if (section === "talk") out.talk = r.value as Block[];
    else if (section === "report") out.report = r.value as Block[];
    else if (section === "common") out.common = r.value as FlConfig["common"];
    else if (section === "brands") out.brands = r.value as FlConfig["brands"];
    else if (section === "asks") out.asks = r.value as FlConfig["asks"];
    else if (section === "life") out.life = r.value as FlConfig["life"];
  }
  return out;
}


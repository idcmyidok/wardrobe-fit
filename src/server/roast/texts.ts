import "server-only";
import { isBubbleKey, splitSentences } from "@/lib/roast/bubbles";
import { ROAST_COPY } from "@/lib/roast/copy";
import { findBrand } from "./brands";
import { COMMON, LINE_SECTION, LINE_TEXT } from "./lines";
import { NO_REACT_WHEN, Q_TEXT, type QuestionText } from "./questions";
import { checkWhen } from "./react-when";
import { QUIZ, type QuizEntry } from "./quiz";
import { REPORT_TEXT } from "./report-text";
import { AGE_RULES, SCORE_DELTAS, SCORE_RULES } from "./score-deltas";
import { varsOf } from "./text";
import { ORDER_AGE_RULES, ORDER_DELTAS, ORDER_RULES } from "./orders/rules";
import { ORDER_COMMON, ORDER_MIRROR_QUESTIONS, ORDER_MIRROR_REPORT_SKIP, ORDER_MIRROR_SCREEN, ORDER_REPORT_TEXT, ORDER_SCREEN, ORDER_SKIP_PATTERNS } from "./orders/texts";

/**
 * 내 옷장 훈수의 모든 문장(관리자 화면에서 고칠 수 있는 것). 조건·선택지 id는 코드에만 있다.
 * 고친 값은 roast_text_edits(key → body)에 저장하고, 분석할 때 기본값 위에 덮어쓴다.
 *
 * 고치는 단위(unit)는 셋이다.
 * - 문장 하나: key는 문장 위치(예: "questions.odd_photo.text"), body는 문장
 * - 문장 목록: key는 목록 위치(예: "lines.black_bias.say"), body는 JSON 배열. 항목을 더하거나 뺄 수 있다.
 *   DB 한 칸(1000자)을 넘으면 "key~1", "key~2"로 나눠 저장한다.
 * - 퀴즈 정답 번호: "quiz.<id>.answer"
 * 퀴즈는 새로 만들 수 있고(id가 "c-"로 시작), "quiz.<id>.deleted"가 있으면 뺀다.
 * 예전 방식(목록 안 항목 하나, 예: "lines.black_bias.say.0")으로 저장된 값은 쓰지 않는다.
 */

/** 대화 말풍선 문장은 기본값에서 문장마다 줄을 바꿔 둔다(한 문장씩 말풍선으로 나온다). */
function splitChat<T>(node: T, path = ""): T {
  if (typeof node === "string") return (isBubbleKey(path.split(".").slice(0, -1).join(".")) || isBubbleKey(path) ? splitSentences(node) : node) as T;
  if (Array.isArray(node)) return node.map((x, i) => splitChat(x, `${path}.${i}`)) as T;
  if (node && typeof node === "object")
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, splitChat(v, path ? `${path}.${k}` : k)])) as T;
  return node;
}

/** 반응마다 붙이는 조건·결과 글 칸(react-when.ts). 코드에 없으면 빈 목록으로 둔다. */
function withReactWhen(texts: Record<string, QuestionText>): Record<string, QuestionText> {
  return Object.fromEntries(
    Object.entries(texts).map(([id, tx]) => {
      if (NO_REACT_WHEN.has(id) || !Object.keys(tx.react).length) return [id, tx];
      const fill = (m: Record<string, string[]> | undefined) => Object.fromEntries(Object.keys(tx.react).map((k) => [k, m?.[k] ?? []]));
      return [id, { ...tx, when: fill(tx.when), result: fill(tx.result) }];
    }),
  );
}

/** 주문내역 훈수는 옷장 훈수 문장을 그대로 복사해 전용 칸(orders.*)으로 따로 둔다. 문장 속 "옷장"은 "주문내역"으로 바꿔 둔다. */
const toOrders = <T,>(node: T): T => {
  if (typeof node === "string") return node.replace(/옷장/g, "주문내역") as T;
  if (Array.isArray(node)) return node.map(toOrders) as T;
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, toOrders(v)])) as T;
  return node;
};
const pick = <T,>(o: Record<string, T>, keys: readonly string[]): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));
const omit = <T,>(o: Record<string, T>, keys: Iterable<string>): Record<string, T> => {
  const gone = new Set(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !gone.has(k)));
};

/**
 * 주문내역 전용으로 복사해 둔 칸(처음 값 = 옷장 훈수 문장). DB에 전용 값이 없으면 옷장 쪽 값을 따라가고(applyTextEdits),
 * 전용 칸을 고치면 그 값이 우선한다. 주문내역에서만 쓰는 문장(ORDER_COMMON·ORDER_REPORT_TEXT 등)은 여기 없다.
 */
const ORDER_MIRROR = toOrders({
  screen: pick<unknown>(ROAST_COPY, ORDER_MIRROR_SCREEN),
  common: omit<unknown>(COMMON, Object.keys(ORDER_COMMON)),
  lines: omit<unknown>(LINE_TEXT, ORDER_SKIP_PATTERNS),
  questions: withReactWhen(pick(Q_TEXT, ORDER_MIRROR_QUESTIONS)),
  report: {
    ...omit<unknown>(REPORT_TEXT, ORDER_MIRROR_REPORT_SKIP),
    diag: omit<unknown>(REPORT_TEXT.diag, ["shop"]),
    // 주문내역에는 핏·빈티지 문단이 나올 수 없어 순서·켜기 칸에서 뺀다.
    layout: {
      ...REPORT_TEXT.layout,
      point_order: omit<unknown>(REPORT_TEXT.layout.point_order, ["fit", "vintage"]),
      point_show: omit<unknown>(REPORT_TEXT.layout.point_show, ["fit", "vintage"]),
    },
  },
});

/**
 * 주문내역 훈수: 질문 문구는 questions(o_*), 답별 증감은 score(o_*), 점수 기준은 score.orules·score.oage,
 * 화면·대화·결과 문장은 orders.screen·orders.common·orders.report에 있다(관리자 "주문내역 훈수" 탭).
 */
export const DEFAULT_TEXTS = splitChat({
  screen: ROAST_COPY,
  common: COMMON,
  lines: LINE_TEXT,
  questions: withReactWhen(Q_TEXT),
  quiz: QUIZ,
  report: REPORT_TEXT,
  score: { ...SCORE_DELTAS, ...ORDER_DELTAS, rules: SCORE_RULES, age: AGE_RULES, orules: ORDER_RULES, oage: ORDER_AGE_RULES },
  orders: {
    screen: { ...ORDER_MIRROR.screen, ...ORDER_SCREEN },
    common: { ...ORDER_MIRROR.common, ...ORDER_COMMON },
    report: { ...ORDER_MIRROR.report, ...ORDER_REPORT_TEXT },
    lines: ORDER_MIRROR.lines,
    questions: ORDER_MIRROR.questions,
  },
});
export type RoastTexts = typeof DEFAULT_TEXTS;

let mirrorKeys: Set<string> | null = null;
/** 주문내역 전용으로 복사해 둔 칸의 key("orders.…"). 값이 없으면 옷장 쪽 key(앞의 "orders." 뗀 것)를 따라간다. */
export function orderMirrorKeys(): Set<string> {
  mirrorKeys ??= new Set(unitsOf(ORDER_MIRROR, "orders").map((u) => u.key));
  return mirrorKeys;
}

/**
 * 주문내역 훈수가 쓰는 문장: 옷장 훈수 문장 위에 주문내역 전용 칸(orders.lines·questions·common·report)을 덮는다.
 * 결과 본문·대화·마무리 모두 이 사본으로 만든다.
 */
export function forOrders(T: RoastTexts): RoastTexts {
  const m = ORDER_MIRROR as unknown as Record<"lines" | "questions" | "common" | "report", Record<string, unknown>>;
  const O = T.orders as unknown as Record<"lines" | "questions" | "common" | "report", Record<string, unknown>>;
  const own = (g: "lines" | "questions" | "common" | "report") => pick<unknown>(O[g], Object.keys(m[g]));
  return {
    ...T,
    lines: { ...T.lines, ...own("lines") } as RoastTexts["lines"],
    questions: { ...T.questions, ...own("questions") } as RoastTexts["questions"],
    common: { ...T.common, ...own("common") } as RoastTexts["common"],
    report: { ...T.report, ...own("report") } as RoastTexts["report"],
  };
}

export const ROAST_TEXT_MAX = 500;
/** DB body 한 칸 최대 글자 수(마이그레이션 20) */
const BODY_MAX = 1000;
export const CUSTOM_QUIZ_ID = /^c-[a-z0-9]{4,24}$/;

export type UnitKind = "text" | "list" | "number";
export type UnitValue = string | string[] | number;

export interface TextUnit {
  key: string;
  kind: UnitKind;
  value: UnitValue;
}

/** 모든 고치는 단위를 편다. */
export function unitsOf(root: unknown = DEFAULT_TEXTS, prefix = ""): TextUnit[] {
  if (typeof root === "string") return [{ key: prefix, kind: "text", value: root }];
  if (typeof root === "number") return [{ key: prefix, kind: "number", value: root }];
  if (Array.isArray(root)) return [{ key: prefix, kind: "list", value: root as UnitValue }];
  if (root && typeof root === "object")
    return Object.entries(root).flatMap(([k, v]) => unitsOf(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

let defaults: Map<string, TextUnit> | null = null;
function defaultUnits() {
  defaults ??= new Map(unitsOf().map((u) => [u.key, u]));
  return defaults;
}

/** 새로 만든 퀴즈의 칸 */
const QUIZ_FIELDS: Record<keyof QuizEntry, UnitKind> = {
  brand: "text",
  answer: "number",
  question: "text",
  options: "list",
  correct: "list",
  wrong: "list",
};

/** key가 가리키는 단위와 기본값. 모르는 key(예전 방식 포함)면 null. */
export function unitAt(key: string): { kind: UnitKind; base: UnitValue | undefined } | null {
  const u = defaultUnits().get(key);
  if (u) return { kind: u.kind, base: u.value };
  const p = key.split(".");
  if (p.length === 3 && p[0] === "quiz" && CUSTOM_QUIZ_ID.test(p[1]) && p[2] in QUIZ_FIELDS)
    return { kind: QUIZ_FIELDS[p[2] as keyof QuizEntry], base: undefined };
  return null;
}

/** 문장이 속한 묶음(같은 패턴·질문·퀴즈·공통 항목). 예: "lines.black_bias" */
export function groupOf(key: string): string {
  // 결과 페이지의 진단·점수는 항목마다 따로 묶는다(예: "report.diag.color").
  if (/^report\.(diag|layout)\./.test(key)) return key.split(".").slice(0, 3).join(".");
  // 주문내역 훈수의 화면·대화·결과 문장은 항목마다 따로 묶는다(예: "orders.report.shift").
  if (/^orders\.report\.(diag|layout)\./.test(key)) return key.split(".").slice(0, 4).join(".");
  if (key.startsWith("orders.")) return key.split(".").slice(0, 3).join(".");
  return key.split(".").slice(0, 2).join(".");
}

const allowedCache = new Map<string, string[]>();
/** 묶음 안 기본 문장에 나오는 자리만 쓸 수 있다. */
export function allowedVars(key: string): string[] {
  const g = groupOf(key);
  if (!allowedCache.has(g)) {
    const set = new Set<string>();
    for (const u of defaultUnits().values()) {
      if (groupOf(u.key) !== g) continue;
      for (const s of [u.value].flat(2)) if (typeof s === "string") for (const v of varsOf(s)) set.add(v);
    }
    allowedCache.set(g, [...set]);
  }
  return allowedCache.get(g)!;
}

/** 문장 하나 검사. 통과하면 null, 아니면 이유. */
function checkSentence(key: string, value: string): string | null {
  const v = value.trim();
  if (!v) return "비워 둘 수 없습니다.";
  if (v.length > ROAST_TEXT_MAX) return `${ROAST_TEXT_MAX}자 이하로 써 주세요.`;
  const allowed = new Set(allowedVars(key));
  const bad = varsOf(v).filter((x) => !allowed.has(x));
  if (bad.length) return `이 문장에서는 쓸 수 없는 자리입니다: ${bad.map((b) => `{${b}}`).join(", ")}`;
  if (/[{}]/.test(v.replace(/\{\w+(\|[^{}]+)?\}/g, ""))) return "중괄호 { }는 자리 표시에만 쓸 수 있습니다.";
  return null;
}

/** 목록의 최소 항목 수 */
function minItems(key: string, base: UnitValue | undefined): number {
  if (key.startsWith("quiz.") && key.endsWith(".options")) return 2;
  if (key.startsWith("quiz.")) return 1;
  return Array.isArray(base) && base.length === 0 ? 0 : 1;
}

/** 고친 값 검사 후 정리한 값. 문제가 있으면 error. */
export function checkUnit(key: string, value: unknown): { value: UnitValue } | { error: string } {
  const unit = unitAt(key);
  if (!unit) return { error: "없는 문장입니다." };
  if (unit.kind === "number" && /^(orders\.)?report\.layout\./.test(key)) {
    // 결과 구성: 순서 1~20, 켜기 0·1, 개수 0~40
    const n = typeof value === "number" ? value : Number(value);
    const [min, max] = /\.(show|point_show)\./.test(key) ? [0, 1] : /\.(order|point_order)\./.test(key) ? [1, 20] : [0, 40];
    const hint = max === 1 ? "1(보임) 또는 0(뺌)으로 써 주세요." : `${min}부터 ${max}까지 정수로 써 주세요.`;
    return Number.isInteger(n) && n >= min && n <= max ? { value: n } : { error: hint };
  }
  if (unit.kind === "number" && /^score\.(o?rules|o?age)\./.test(key)) {
    const n = typeof value === "number" ? value : Number(value);
    const max = key.endsWith("_year") ? 2100 : 100;
    return Number.isInteger(n) && n >= 0 && n <= max ? { value: n } : { error: `0부터 ${max}까지 정수로 써 주세요.` };
  }
  if (unit.kind === "number" && key.startsWith("score.")) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n >= -20 && n <= 20 ? { value: n } : { error: "-20부터 20까지 정수로 써 주세요." };
  }
  if (unit.kind === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n >= 0 && n < 20 ? { value: n } : { error: "정답 번호가 올바르지 않습니다." };
  }
  if (unit.kind === "text") {
    if (typeof value !== "string") return { error: "문장이 아닙니다." };
    if (key.startsWith("quiz.") && key.endsWith(".brand")) {
      const b = findBrand(value);
      return b ? { value: b.name } : { error: "브랜드 자료에 없는 브랜드입니다." };
    }
    const problem = checkSentence(key, value);
    return problem ? { error: problem } : { value: value.trim() };
  }
  if (!Array.isArray(value)) return { error: "목록이 아닙니다." };
  const cond = key.match(/^(?:orders\.)?questions\.[^.]+\.(when|result)\./)?.[1];
  if (cond) return checkReactWhen(key, cond, value);
  if (value.length < minItems(key, unit.base)) return { error: `${minItems(key, unit.base)}개 이상 남겨 주세요.` };
  if (value.length > 40) return { error: "40개까지만 넣을 수 있습니다." };
  const out: string[] = [];
  for (const s of value) {
    if (typeof s !== "string") return { error: "문장이 아닙니다." };
    const problem = checkSentence(key, s);
    if (problem) return { error: problem };
    out.push(s.trim());
  }
  return { value: out };
}

/** 반응별 조건·결과 글 목록: 빈 칸을 허용하고, 끝의 빈 칸은 지운다. */
function checkReactWhen(key: string, kind: string, value: unknown[]): { value: UnitValue } | { error: string } {
  if (value.length > 40) return { error: "40개까지만 넣을 수 있습니다." };
  const out: string[] = [];
  for (const s of value) {
    if (typeof s !== "string") return { error: "문장이 아닙니다." };
    const v = s.trim();
    if (kind === "when" && !checkWhen(v, PATTERN_IDS)) return { error: "모르는 조건이 있습니다." };
    if (kind === "result" && v) {
      const problem = checkSentence(key, v);
      if (problem) return { error: problem };
    }
    out.push(v);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return { value: out };
}
const PATTERN_IDS = new Set(Object.keys(LINE_SECTION));

export const sameValue = (a: UnitValue | undefined, b: UnitValue | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** 저장할 행들(key → body). 목록은 JSON, 길면 나눈다. */
export function toRows(key: string, value: UnitValue): Record<string, string> {
  if (!Array.isArray(value)) return { [key]: String(value) };
  const rows: Record<string, string> = {};
  let chunk: unknown[] = [];
  let n = 0;
  const flush = () => {
    rows[n ? `${key}~${n}` : key] = JSON.stringify(chunk);
    n++;
    chunk = [];
  };
  for (const item of value) {
    if (chunk.length && JSON.stringify([...chunk, item]).length > BODY_MAX) flush();
    chunk.push(item);
  }
  flush();
  return rows;
}

/** 행들 → key별 값(나눈 목록은 합친다). 읽을 수 없는 행은 뺀다. */
export function fromRows(rows: Record<string, string>): Record<string, UnitValue> {
  const out: Record<string, UnitValue> = {};
  const parts = new Map<string, { n: number; items: unknown[] }[]>();
  for (const [rowKey, body] of Object.entries(rows)) {
    const m = rowKey.match(/^(.*)~(\d+)$/);
    const key = m ? m[1] : rowKey;
    const unit = unitAt(key);
    if (!unit) continue;
    if (unit.kind === "text") out[key] = body;
    else if (unit.kind === "number") out[key] = Number(body);
    else {
      try {
        const items = JSON.parse(body);
        if (Array.isArray(items)) parts.set(key, [...(parts.get(key) ?? []), { n: m ? Number(m[2]) : 0, items }]);
      } catch {}
    }
  }
  for (const [key, list] of parts) out[key] = list.sort((a, b) => a.n - b.n).flatMap((x) => x.items) as UnitValue;
  return out;
}

/** 기본 문장에 고친 값을 덮어쓴 사본. 검사에 걸리는 것은 무시한다. */
export function applyTextEdits(rows: Record<string, string>): RoastTexts {
  const edits = fromRows(rows);
  const keys = Object.keys(edits);
  const deleted = Object.keys(rows)
    .map((k) => k.match(/^quiz\.([^.]+)\.deleted$/)?.[1])
    .filter((x): x is string => Boolean(x));
  if (!keys.length && !deleted.length) return DEFAULT_TEXTS;
  const out = structuredClone(DEFAULT_TEXTS) as RoastTexts;
  for (const key of keys) {
    const checked = checkUnit(key, edits[key]);
    if ("error" in checked) continue;
    const path = key.split(".");
    let node: Record<string, unknown> = out as unknown as Record<string, unknown>;
    for (const p of path.slice(0, -1)) {
      node[p] ??= {};
      node = node[p] as Record<string, unknown>;
    }
    node[path[path.length - 1]] = checked.value;
  }
  // 주문내역 전용 칸에 DB 값이 없으면 옷장 쪽(고친 값 포함)을 따라간다.
  for (const key of orderMirrorKeys()) {
    if (key in edits) continue;
    const from = key.slice("orders.".length).split(".");
    let src: unknown = out;
    for (const p of from) src = (src as Record<string, unknown> | undefined)?.[p];
    if (src === undefined) continue;
    const path = key.split(".");
    let node = out as unknown as Record<string, unknown>;
    for (const p of path.slice(0, -1)) node = (node[p] ??= {}) as Record<string, unknown>;
    node[path[path.length - 1]] = toOrders(structuredClone(src));
  }
  for (const id of deleted) delete out.quiz[id];
  // 새 퀴즈는 칸이 다 있어야 쓴다. 정답 번호가 선택지 밖이면 뺀다.
  for (const [id, q] of Object.entries(out.quiz)) {
    const ok = q.brand && q.question && q.options?.length >= 2 && q.correct?.length && q.wrong?.length && q.options[q.answer] != null;
    if (!ok) delete out.quiz[id];
  }
  return out;
}

/** 고친 적 없는 기본값 하나(테스트·검토용) */
export function defaultValue(key: string): UnitValue | undefined {
  return defaultUnits().get(key)?.value;
}

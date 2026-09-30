import "server-only";
import { isBubbleKey, splitSentences } from "@/lib/roast/bubbles";
import { ROAST_COPY } from "@/lib/roast/copy";
import { findBrand } from "./brands";
import { COMMON, LINE_TEXT } from "./lines";
import { Q_TEXT } from "./questions";
import { QUIZ, type QuizEntry } from "./quiz";
import { REPORT_TEXT } from "./report-text";
import { SCORE_DELTAS, SCORE_RULES } from "./score-deltas";
import { varsOf } from "./text";

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

export const DEFAULT_TEXTS = splitChat({ screen: ROAST_COPY, common: COMMON, lines: LINE_TEXT, questions: Q_TEXT, quiz: QUIZ, report: REPORT_TEXT, score: { ...SCORE_DELTAS, rules: SCORE_RULES } });
export type RoastTexts = typeof DEFAULT_TEXTS;

export const ROAST_TEXT_MAX = 500;
/** DB body 한 칸 최대 글자 수(마이그레이션 20) */
const BODY_MAX = 1000;
export const CUSTOM_QUIZ_ID = /^c-[a-z0-9]{4,24}$/;

export type UnitKind = "text" | "list" | "pairs" | "number";
export type UnitValue = string | string[] | [string, string][] | number;

export interface TextUnit {
  key: string;
  kind: UnitKind;
  value: UnitValue;
}

const isPairs = (v: unknown[]) => v.length > 0 && v.every((x) => Array.isArray(x));

/** 모든 고치는 단위를 편다. */
export function unitsOf(root: unknown = DEFAULT_TEXTS, prefix = ""): TextUnit[] {
  if (typeof root === "string") return [{ key: prefix, kind: "text", value: root }];
  if (typeof root === "number") return [{ key: prefix, kind: "number", value: root }];
  if (Array.isArray(root)) return [{ key: prefix, kind: isPairs(root) ? "pairs" : "list", value: root as UnitValue }];
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
  // 결과 페이지의 진단·점수·캐릭터는 항목마다 따로 묶는다(예: "report.diag.color").
  if (/^report\.(diag|character)\./.test(key)) return key.split(".").slice(0, 3).join(".");
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

/** 빈 문장이 되어도 되는 곳 */
const mayBeEmpty = (key: string) => key === "common.HEAD_SINGLE_PREFIX";

/** 문장 하나 검사. 통과하면 null, 아니면 이유. */
function checkSentence(key: string, value: string): string | null {
  const v = value.trim();
  if (!v && !mayBeEmpty(key)) return "비워 둘 수 없습니다.";
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
  if (unit.kind === "number" && key.startsWith("score.rules.")) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 100 ? { value: n } : { error: "0부터 100까지 정수로 써 주세요." };
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
  if (value.length < minItems(key, unit.base)) return { error: `${minItems(key, unit.base)}개 이상 남겨 주세요.` };
  if (value.length > 40) return { error: "40개까지만 넣을 수 있습니다." };
  if (unit.kind === "pairs") {
    const out: [string, string][] = [];
    for (const pair of value) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some((s) => typeof s !== "string")) return { error: "앞절·뒷절을 모두 써 주세요." };
      for (const s of pair) {
        const problem = checkSentence(key, s);
        if (problem) return { error: problem };
      }
      out.push([pair[0].trim(), pair[1].trim()]);
    }
    return { value: out };
  }
  const out: string[] = [];
  for (const s of value) {
    if (typeof s !== "string") return { error: "문장이 아닙니다." };
    const problem = checkSentence(key, s);
    if (problem) return { error: problem };
    out.push(mayBeEmpty(key) ? s : s.trim());
  }
  return { value: out };
}

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

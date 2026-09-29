import "server-only";
import { COMMON, LINE_TEXT } from "./lines";
import { Q_TEXT } from "./questions";
import { QUIZ_TEXT } from "./quiz";
import { varsOf } from "./text";

/**
 * 내 옷장 훈수의 모든 문장(관리자 화면에서 고칠 수 있는 것). 조건·선택지 id·정답 번호는 코드에만 있다.
 * 고친 문장은 roast_text_edits(key → body)에 저장하고, 분석할 때 기본 문장 위에 덮어쓴다.
 * key는 문장 위치를 점으로 이은 것이다. 예: "lines.black_bias.say.0", "questions.odd_photo.react.mine.1", "quiz.cdg-meaning.options.2"
 */

export const DEFAULT_TEXTS = { common: COMMON, lines: LINE_TEXT, questions: Q_TEXT, quiz: QUIZ_TEXT };
export type RoastTexts = typeof DEFAULT_TEXTS;

export const ROAST_TEXT_MAX = 500;

/** 문장 하나: 위치(key)와 기본 문장 */
export interface TextEntry {
  key: string;
  value: string;
}

/** 모든 문장을 [key, 기본 문장] 목록으로 편다. */
export function flattenTexts(root: unknown = DEFAULT_TEXTS, prefix = ""): TextEntry[] {
  if (typeof root === "string") return [{ key: prefix, value: root }];
  if (Array.isArray(root)) return root.flatMap((v, i) => flattenTexts(v, `${prefix}.${i}`));
  if (root && typeof root === "object")
    return Object.entries(root).flatMap(([k, v]) => flattenTexts(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

let defaults: Map<string, string> | null = null;
export function defaultText(key: string): string | undefined {
  defaults ??= new Map(flattenTexts().map((e) => [e.key, e.value]));
  return defaults.get(key);
}

/** 문장이 속한 묶음(같은 패턴·질문·퀴즈·공통 항목). 예: "lines.black_bias" */
export function groupOf(key: string): string {
  return key.split(".").slice(0, 2).join(".");
}

/** 묶음 안 기본 문장에 나오는 자리만 쓸 수 있다. */
export function allowedVars(key: string): string[] {
  const g = groupOf(key);
  const set = new Set<string>();
  for (const e of flattenTexts()) if (groupOf(e.key) === g) for (const v of varsOf(e.value)) set.add(v);
  return [...set];
}

/** 고친 문장 검사. 통과하면 null, 아니면 이유. */
export function checkText(key: string, value: string): string | null {
  if (defaultText(key) === undefined) return "없는 문장입니다.";
  const v = value.trim();
  if (!v && !key.endsWith("HEAD_SINGLE_PREFIX.2")) return "비워 둘 수 없습니다.";
  if (v.length > ROAST_TEXT_MAX) return `${ROAST_TEXT_MAX}자 이하로 써 주세요.`;
  const allowed = new Set(allowedVars(key));
  const bad = varsOf(v).filter((x) => !allowed.has(x));
  if (bad.length) return `이 문장에서는 쓸 수 없는 자리입니다: ${bad.map((b) => `{${b}}`).join(", ")}`;
  if (/[{}]/.test(v.replace(/\{\w+(\|[^{}]+)?\}/g, ""))) return "중괄호 { }는 자리 표시에만 쓸 수 있습니다.";
  return null;
}

/** 기본 문장에 고친 문장을 덮어쓴 사본. 검사에 걸리는 것은 무시한다. */
export function applyTextEdits(edits: Record<string, string>): RoastTexts {
  const keys = Object.keys(edits);
  if (!keys.length) return DEFAULT_TEXTS;
  const out = structuredClone(DEFAULT_TEXTS) as RoastTexts;
  for (const key of keys) {
    if (checkText(key, edits[key])) continue;
    const path = key.split(".");
    let node: Record<string, unknown> = out as unknown as Record<string, unknown>;
    for (const p of path.slice(0, -1)) node = node[p] as Record<string, unknown>;
    node[path[path.length - 1]] = edits[key].trim();
  }
  return out;
}

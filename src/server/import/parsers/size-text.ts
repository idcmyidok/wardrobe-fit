import { load } from "cheerio";
import { mapHeader } from "../normalize/size-chart";
import type { RawSizeChart } from "../types";
import { findSizeTable } from "./helpers";

/**
 * 표(<table>)가 아니라 글로 적힌 사이즈 정보를 사이즈표로 읽는다. 상세 설명에 흔한 모양:
 * ① 한 줄에 사이즈 하나: "M : 총장 70 / 어깨 50 / 가슴 55 / 소매 61"
 * ② 사이즈 줄 아래 항목 줄: "[M]" 다음 줄 "총장 70cm" "어깨 50cm" …
 * ③ 글자로 된 표: "사이즈 총장 어깨 가슴" 다음 줄 "M 70 50 55"
 * ④ 사이즈가 열인 표: "사이즈 S M L" 다음 줄 "총장 68 70 72"
 * ⑤ 사이즈 없이 항목만(원사이즈): "총장 70 어깨 50 가슴 55" → FREE
 * 헤더를 옷장 실측으로 바꾸고 버리는 일은 normalizeSizeChart가 한다.
 */

const SIZE = String.raw`(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|[2-5]X|F|FREE|ONE\s?SIZE|OS|프리|\d{1,3}(?:\s?(?:사이즈|호))?)`;
const SIZE_ONLY = new RegExp(String.raw`^[\[(<]?\s*(?:size|사이즈)?\s*[:：]?\s*(${SIZE})\s*(?:size|사이즈)?\s*[\])>]?\s*[:：]?$`, "i");
const SIZE_PREFIX = new RegExp(String.raw`^[\[(<]?\s*(?:size|사이즈)?\s*[:：]?\s*(${SIZE})\s*(?:size|사이즈)?\s*(?:[\])>:：\-–|/]+|\s)\s*(.+)$`, "i");
const SIZE_TOKEN = new RegExp(String.raw`^${SIZE}$`, "i");
/** "총장 70", "가슴단면: 55.5cm", "허리 38~40" */
const PAIR = /([가-힣A-Za-z][가-힣A-Za-z() ]{0,14}?)\s*[:：=]?\s*(\d{1,3}(?:\.\d)?(?:\s*[~\-–]\s*\d{1,3}(?:\.\d)?)?)\s*(?:cm|CM|㎝)?/g;
/** 헤더 칸에 따로 떨어져 적히는 꼬리말 */
const SUFFIX = /^(너비|단면|길이|폭|둘레|기장|\(cm\)|cm|\(단위:cm\)|단위:cm)$/i;
const NUM = /^\d{1,3}(?:\.\d)?(?:[~\-–]\d{1,3}(?:\.\d)?)?$/;

/** 모델 착용 정보 줄("모델 180cm 70kg, 허리 30 L 착용")은 옷 실측이 아니다. */
const MODEL_LINE = /모델|model|착용|몸무게|키\s*\d|\d\s*kg/i;

const tokens = (line: string) => line.split(/[\s|/,·]+/).filter(Boolean);

function pairsOf(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of text.matchAll(PAIR)) {
    const label = m[1].trim();
    if (mapHeader(label)) out.push([label, m[2].replace(/\s+/g, "")]);
  }
  return out;
}

function toChart(sizes: Array<{ size: string; pairs: Array<[string, string]> }>): RawSizeChart | undefined {
  const usable = sizes.filter((s) => s.pairs.length >= 2);
  if (!usable.length) return undefined;
  const headers: string[] = [];
  for (const s of usable) for (const [label] of s.pairs) if (!headers.includes(label)) headers.push(label);
  return {
    headers: ["사이즈", ...headers],
    rows: usable.map((s) => [s.size, ...headers.map((h) => s.pairs.find(([l]) => l === h)?.[1] ?? "")]),
  };
}

/** ①② 사이즈별 줄 */
function bySizeLines(lines: string[]): RawSizeChart | undefined {
  const sizes: Array<{ size: string; pairs: Array<[string, string]> }> = [];
  let current: { size: string; pairs: Array<[string, string]> } | undefined;
  for (const line of lines) {
    const only = line.match(SIZE_ONLY);
    if (only) {
      current = { size: only[1].trim().toUpperCase(), pairs: [] };
      sizes.push(current);
      continue;
    }
    const prefixed = line.match(SIZE_PREFIX);
    if (prefixed) {
      const pairs = pairsOf(prefixed[2]);
      if (pairs.length >= 2) {
        sizes.push({ size: prefixed[1].trim().toUpperCase(), pairs });
        current = undefined;
        continue;
      }
    }
    if (current) {
      const pairs = pairsOf(line);
      if (pairs.length) current.pairs.push(...pairs.filter(([l]) => !current!.pairs.some(([c]) => c === l)));
      else if (current.pairs.length) current = undefined;
    }
  }
  return toChart(sizes);
}

/** ③④ 글자로 된 표 */
function textTable(lines: string[]): RawSizeChart | undefined {
  for (let i = 0; i < lines.length - 1; i++) {
    const head = tokens(lines[i]).filter((t) => !SUFFIX.test(t));
    if (head.length < 3) continue;
    const first = /^(사이즈|size|구분|옵션|호수)$/i.test(head[0]) ? head.slice(1) : head;

    // ③ 헤더가 실측 항목
    if (first.filter((t) => mapHeader(t)).length >= 2 && first.every((t) => mapHeader(t) || !NUM.test(t))) {
      const rows: string[][] = [];
      for (const line of lines.slice(i + 1, i + 15)) {
        const cells = tokens(line);
        if (cells.length === first.length + 1 && SIZE_TOKEN.test(cells[0]) && cells.slice(1).every((c) => NUM.test(c))) rows.push(cells);
        else if (rows.length) break;
      }
      if (rows.length) return { headers: ["사이즈", ...first], rows };
    }

    // ④ 헤더가 사이즈
    if (first.length >= 2 && first.every((t) => SIZE_TOKEN.test(t)) && head.length > first.length) {
      const rows: string[][] = [];
      for (const line of lines.slice(i + 1, i + 15)) {
        const m = line.match(/^([가-힣A-Za-z() ]{1,16}?)\s*[:：]?\s+(\d[\d.\s~\-–]*)$/);
        const values = m ? tokens(m[2]) : [];
        if (m && mapHeader(m[1].trim()) && values.length === first.length && values.every((v) => NUM.test(v))) rows.push([m[1].trim(), ...values]);
        else if (rows.length) break;
      }
      if (rows.length >= 2) return { headers: ["사이즈", ...first], rows };
    }
  }
  return undefined;
}

/** ⑤ 사이즈 표시 없이 항목만 적힌 원사이즈 */
function singleSize(lines: string[]): RawSizeChart | undefined {
  for (let i = 0; i < lines.length; i++) {
    const pairs: Array<[string, string]> = [];
    for (const line of lines.slice(i, i + 8)) {
      const found = pairsOf(line).filter(([l]) => !pairs.some(([p]) => p === l));
      if (!found.length) break;
      pairs.push(...found);
    }
    if (pairs.length >= 3) return toChart([{ size: "FREE", pairs }]);
  }
  return undefined;
}

const cellCount = (c: RawSizeChart) => c.rows.reduce((n, r) => n + r.slice(1).filter(Boolean).length, 0);

/** 본문 텍스트에서 사이즈표를 찾는다. 여러 모양 중 값이 가장 많은 것. */
export function sizeChartFromText(text: string): RawSizeChart | undefined {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !MODEL_LINE.test(l));
  const found = [textTable(lines), bySizeLines(lines)].filter((c): c is RawSizeChart => Boolean(c));
  if (found.length) return found.sort((a, b) => cellCount(b) - cellCount(a))[0];
  return singleSize(lines);
}

/**
 * "더보기"를 눌러야 보이는 사이즈표가 스크립트 문자열이나 <template>, <textarea> 안에 HTML로 들어 있는 경우.
 * 그 HTML을 다시 읽어 표를 찾는다.
 */
export function sizeTableInEmbeddedHtml(html: string): RawSizeChart | undefined {
  const chunks: string[] = [];
  const unescape = (s: string) =>
    s
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/\\u002F/gi, "/")
      .replace(/\\"/g, '"')
      .replace(/\\\//g, "/")
      .replace(/\\n/g, "\n");
  for (const m of html.matchAll(/<(template|textarea|script)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const body = unescape(m[2]);
    if (/<table/i.test(body)) chunks.push(body);
  }
  for (const chunk of chunks) {
    const chart = findSizeTable(load(chunk));
    if (chart) return chart;
  }
  return undefined;
}

/** 사이즈 정보가 있을 법한 줄과 앞뒤 몇 줄(AI에 보낼 부분). 실측 항목 이름이 두 가지 이상 나와야 보낸다. */
export function sizeSnippet(text: string, max = 3000): string | undefined {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const hit = (l: string) => /\d/.test(l) && /총장|기장|어깨|가슴|소매|허리|엉덩이|힙|허벅지|밑위|밑단|length|shoulder|chest|sleeve|waist|hip|thigh|rise/i.test(l);
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (!hit(l) && !/사이즈|size|실측|단위/i.test(l)) return;
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 3); j++) keep.add(j);
  });
  const kinds = new Set(lines.flatMap((l) => (hit(l) ? tokens(l).map((t) => mapHeader(t)).filter(Boolean) : [])));
  if (kinds.size < 2) return undefined;
  const out = [...keep].sort((a, b) => a - b).map((i) => lines[i]).join("\n");
  return out.slice(0, max) || undefined;
}

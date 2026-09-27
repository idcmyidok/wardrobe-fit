import type { Extracted, RawProduct } from "../types";
import { cleanText } from "./text";

/** 제품명·상세에서 컬러를 찾을 때 쓰는 사전. 표시 제안용이고 원문을 기본값으로 둔다. */
const COLOR_WORDS = [
  "BLACK", "WHITE", "IVORY", "CREAM", "BEIGE", "SAND", "KHAKI", "OLIVE", "GREEN", "NAVY", "BLUE", "SKY BLUE", "INDIGO",
  "GREY", "GRAY", "CHARCOAL", "BROWN", "CAMEL", "TAN", "RED", "BURGUNDY", "WINE", "PINK", "PURPLE", "YELLOW", "ORANGE", "MINT", "ECRU", "OATMEAL",
  "블랙", "검정", "화이트", "흰색", "아이보리", "크림", "베이지", "카키", "올리브", "그린", "네이비", "블루", "인디고", "그레이", "회색", "차콜",
  "브라운", "카멜", "레드", "버건디", "와인", "핑크", "퍼플", "옐로우", "오렌지", "민트", "오트밀", "멜란지",
];
const COLOR_RE = new RegExp(`(?:^|[\\s\\[(/_-])((?:다크|라이트|딥|DARK|LIGHT|DEEP)\\s*)?(${COLOR_WORDS.join("|")})(?=$|[\\s\\])/_,-])`, "i");

/** 옵션 문자열에서 사이즈 부분을 떼어 낸다: "BLACK / M" → "BLACK", "네이비-L(품절)" → "네이비" */
export function splitColorOption(option: string): string {
  const text = cleanText(option, 80).replace(/\s*[([]?\s*(품절|일시품절|sold\s*out|재입고.*)\s*[)\]]?\s*$/i, "");
  const parts = text.split(/\s*[/|]\s*|\s+-\s+/);
  const sizeLike = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3}|FREE|F|OS|ONE\s*SIZE)$/i;
  const color = parts.find((p) => p && !sizeLike.test(p));
  return color ?? text;
}

export function cleanOptions(options: string[] | undefined, split?: (s: string) => string): string[] {
  const out: string[] = [];
  for (const o of options ?? []) {
    const v = (split ? split(o) : cleanText(o, 50)).replace(/\s*[([]?\s*(품절|일시품절|sold\s*out)\s*[)\]]?\s*$/i, "").trim();
    if (v && !/^(선택|옵션|-+|\[?필수\]?.*선택.*)$/i.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** 컬러 우선순위(PROJECT_SPEC.md 14.3): 옵션이 1개 → 제품명 속 컬러 → 상세 컬러 필드. 여러 옵션이면 사용자가 고른다. */
export function pickColor(raw: RawProduct, colorOptions: string[]): Extracted<string> | null {
  if (colorOptions.length === 1) return { value: colorOptions[0], source: "heuristic", confidence: "high" };
  const fromName = cleanText(raw.productName).match(COLOR_RE);
  if (fromName) return { value: `${fromName[1] ?? ""}${fromName[2]}`.trim(), source: "heuristic", confidence: "medium" };
  const detail = cleanText(raw.colorFromDetail, 50);
  if (detail) return { value: detail, source: "heuristic", confidence: "medium" };
  return null;
}

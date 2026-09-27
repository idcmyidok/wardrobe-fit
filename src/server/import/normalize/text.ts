import { decodeHTML } from "entities";

/** HTML entity 디코딩, 제어문자 제거, 공백 정리, 길이 제한 */
export function cleanText(input: string | null | undefined, max = 500): string {
  if (!input) return "";
  return decodeHTML(String(input))
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** 빈 문자열이면 undefined(RawProduct 필드 채우기용) */
export const textOrUndefined = (input: string | null | undefined, max?: number) => cleanText(input, max) || undefined;

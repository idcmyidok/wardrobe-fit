import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { mapHeader } from "../normalize/size-chart";
import { cleanText } from "../normalize/text";
import type { RawSizeChart } from "../types";

/** 상대 주소를 페이지 기준 절대 주소로. //cdn... 도 https로 바꾼다. 이상한 값은 버린다. */
export function absoluteUrl(value: unknown, base: URL): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** 표 하나를 헤더 + 행으로. 첫 행(thead 또는 첫 tr)을 헤더로 본다. */
export function tableToRaw($: CheerioAPI, table: AnyNode): RawSizeChart | null {
  const rows = $(table)
    .find("tr")
    .toArray()
    .map((tr) =>
      $(tr)
        .find("th, td")
        .toArray()
        .map((cell) => cleanText($(cell).text(), 60)),
    )
    .filter((r) => r.some(Boolean));
  if (rows.length < 2) return null;
  const [headers, ...body] = rows;
  const text = $(table).text();
  return { headers, rows: body, unitHint: /inch|인치/i.test(text) && !/cm/i.test(text) ? "inch" : undefined };
}

/** 표가 사이즈표처럼 보이는 정도: 실측 헤더(가로 또는 세로) 개수 */
function sizeTableScore(raw: RawSizeChart): number {
  const across = raw.headers.filter((h) => mapHeader(h)).length;
  const down = raw.rows.filter((r) => mapHeader(r[0] ?? "")).length;
  return Math.max(across, down);
}

/** 페이지의 표 중 사이즈표로 가장 그럴듯한 것. 실측 항목이 2개 이상이어야 인정한다. */
export function findSizeTable($: CheerioAPI, scope?: string): RawSizeChart | undefined {
  let best: { raw: RawSizeChart; score: number } | undefined;
  $(scope ? `${scope} table` : "table").each((_, el) => {
    const raw = tableToRaw($, el);
    if (!raw) return;
    const score = sizeTableScore(raw);
    if (score >= 2 && (!best || score > best.score)) best = { raw, score };
  });
  return best?.raw;
}

const COLOR_LABEL = /색상|컬러|color|colour/i;
const SIZE_LABEL = /사이즈|size|치수/i;

/** <select> 옵션에서 컬러·사이즈 후보. 이름·id·앞 라벨로 어느 쪽인지 가린다. */
export function selectOptions($: CheerioAPI): { colors: string[]; sizes: string[] } {
  const colors: string[] = [];
  const sizes: string[] = [];
  $("select").each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id");
    const label = [
      $el.attr("name"),
      id,
      $el.attr("aria-label"),
      $el.attr("option_title"),
      id ? $(`label[for="${id}"]`).text() : "",
      $el.closest("tr").find("th").first().text(),
      $el.prev().text(),
    ].join(" ");
    const options = $el
      .find("option")
      .toArray()
      .filter((o) => $(o).attr("value") && !/^\*+$|^-+$/.test($(o).attr("value") ?? ""))
      .map((o) => cleanText($(o).text(), 60))
      .filter(Boolean);
    if (COLOR_LABEL.test(label)) colors.push(...options);
    else if (SIZE_LABEL.test(label)) sizes.push(...options);
  });
  return { colors, sizes };
}

/** AI fallback용 본문 텍스트(스크립트·스타일 제외, 약 15,000자) */
export function detailText($: CheerioAPI): string {
  const body = $("body").clone();
  body.find("script, style, noscript, svg, iframe, header, footer, nav").remove();
  return cleanText(body.text(), 15_000);
}

export const meta = ($: CheerioAPI, key: string) =>
  $(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`).first().attr("content")?.trim() || undefined;

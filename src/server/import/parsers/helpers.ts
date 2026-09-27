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

/** 지연 로딩 사진은 src 대신 이 속성에 진짜 주소를 둔다(Cafe24 ec-data-src 등). */
const IMAGE_ATTRS = ["ec-data-src", "data-src", "data-original", "data-lazy-src", "data-lazy", "data-zoom-image", "data-large", "src"];
/** 상품 사진이 아닌 것(아이콘, 로고, 버튼, 배너 등) */
const JUNK_IMAGE = /icon|logo|btn_|button|banner|sprite|blank|spacer|loading|placeholder|badge|arrow|sns|kakao|naver|facebook|instagram|youtube|\.(gif|svg)(\?|$)|^data:/i;

/** 다른 상품 추천·목록, 머리글·바닥글 영역 */
const NOT_THIS_PRODUCT = '[class*="relat" i], [class*="recommend" i], [class*="together" i], [class*="similar" i], [class*="best" i], [class*="review" i], header, footer, nav';

/** 범위 안 <img>의 사진 주소(지연 로딩 속성 포함). 작게 그려지는 아이콘과 흔한 장식 이미지는 뺀다. */
export function imagesIn($: CheerioAPI, scope: string, base: URL, max = 40): string[] {
  const out: string[] = [];
  $(scope)
    .find("img")
    .add($(scope).filter("img"))
    .each((_, el) => {
      if (out.length >= max) return false;
      const $el = $(el);
      if ($el.closest(NOT_THIS_PRODUCT).length) return;
      const size = Math.max(Number($el.attr("width")) || 0, Number($el.attr("height")) || 0);
      if (size > 0 && size < 120) return;
      const raw = IMAGE_ATTRS.map((a) => $el.attr(a)).find((v) => v && !/^data:/i.test(v.trim()));
      const url = absoluteUrl(raw, base);
      if (url && !JUNK_IMAGE.test(url) && !out.includes(url)) out.push(url);
    });
  return out;
}

/** 줄바꿈을 살린 본문 텍스트(블록 요소·<br>마다 줄을 나눈다). 사이즈를 글로 적은 상세 설명 읽기용. */
export function blockText($: CheerioAPI, scope = "body"): string {
  const root = $(scope).first().clone();
  if (!root.length) return "";
  root.find("script, style, noscript, svg, iframe, select, button, header, footer, nav").remove();
  root.find("br").replaceWith("\n");
  root.find("p, div, li, tr, h1, h2, h3, h4, h5, h6, dt, dd, table, section, article, pre").each((_, el) => {
    $(el).append("\n");
  });
  root.find("td, th").each((_, el) => {
    $(el).append(" \t ");
  });
  return root
    .text()
    .split(/\n+/)
    .map((line) => cleanText(line, 400))
    .filter(Boolean)
    .join("\n")
    .slice(0, 30_000);
}

export const meta = ($: CheerioAPI, key: string) =>
  $(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`).first().attr("content")?.trim() || undefined;

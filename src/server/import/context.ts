import { load } from "cheerio";
import type { ParseContext } from "./types";

/** HTML에서 JSON-LD 블록을 모두 꺼낸다. 배열과 @graph는 펼치고, 깨진 블록은 건너뛴다. */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = load(html);
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      out.push(obj);
      if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(visit);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text().trim();
    if (!text) return;
    try {
      visit(JSON.parse(text));
    } catch {
      // 일부 쇼핑몰은 끝에 쉼표가 남은 JSON을 넣는다. 흔한 경우만 고쳐 다시 읽는다.
      try {
        visit(JSON.parse(text.replace(/,\s*([}\]])/g, "$1")));
      } catch {
        /* 무시 */
      }
    }
  });
  return out;
}

export function createParseContext(url: URL, html: string, fetchJson: ParseContext["fetchJson"]): ParseContext {
  return { url, html, $: load(html), jsonLd: extractJsonLd(html), fetchJson };
}

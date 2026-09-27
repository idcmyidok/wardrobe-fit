import type { FieldSources } from "./normalize";
import { cafe24Parser } from "./parsers/cafe24";
import { genericParser } from "./parsers/generic";
import { musinsaParser } from "./parsers/musinsa";
import { shopifyParser } from "./parsers/shopify";
import type { ExtractedSource, ParseContext, ProductParser, RawField, RawProduct } from "./types";

/**
 * Parser 실행 순서(PROJECT_SPEC.md 13.2): 쇼핑몰 전용 → 플랫폼(Shopify, Cafe24) → generic.
 * 앞 단계가 채운 필드는 뒤 단계가 덮지 않는다.
 * 쇼핑몰 전용 parser는 siteParsers에 더한다.
 */
export const siteParsers: ProductParser[] = [musinsaParser];
export const platformParsers: ProductParser[] = [shopifyParser, cafe24Parser];

export function selectParsers(url: URL, html: string): ProductParser[] {
  return [
    ...siteParsers.filter((p) => p.matches(url)),
    ...platformParsers.filter((p) => p.matches(url, html)),
    genericParser,
  ];
}

const KIND_SOURCE: Record<ProductParser["kind"], ExtractedSource> = {
  site: "site",
  platform: "platform",
  generic: "heuristic",
  ai: "ai",
};

export interface ParserRun {
  product: RawProduct;
  sources: FieldSources;
  /** parser id별 진단 정보 */
  diagnostics: Record<string, unknown>;
  /** 값을 하나라도 채운 parser들. 첫 번째가 대표 parser */
  used: Array<{ id: string; version: string }>;
  failed: string[];
}

const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

export async function runParsers(ctx: ParseContext, parsers = selectParsers(ctx.url, ctx.html)): Promise<ParserRun> {
  const product: RawProduct = {};
  const sources: FieldSources = {};
  const used: ParserRun["used"] = [];
  const failed: string[] = [];
  const diagnostics: Record<string, unknown> = {};

  for (const parser of parsers) {
    let result: RawProduct;
    try {
      result = await parser.parse(ctx);
    } catch {
      failed.push(parser.id);
      continue;
    }
    const { fieldSources, diagnostics: parserDiagnostics, ...fields } = result;
    if (parserDiagnostics) diagnostics[parser.id] = parserDiagnostics;
    let filled = false;
    for (const [key, value] of Object.entries(fields) as [RawField, RawProduct[RawField]][]) {
      if (isEmpty(value) || !isEmpty(product[key])) continue;
      (product as Record<RawField, unknown>)[key] = value;
      if (key !== "detailText") {
        sources[key] = fieldSources?.[key] ?? KIND_SOURCE[parser.kind];
        filled = true;
      }
    }
    if (filled) used.push({ id: parser.id, version: parser.version });
  }
  return { product, sources, diagnostics, used, failed };
}

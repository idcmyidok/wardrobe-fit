import { createParseContext } from "./context";
import { safeFetch, type FetchOptions } from "./fetcher";
import { normalizeProduct, type NormalizeOptions } from "./normalize";
import { sizeSnippet } from "./parsers/size-text";
import { runParsers } from "./registry";
import { ImportError, type NormalizedProduct, type RawSizeChart } from "./types";
import { normalizeProductUrl } from "./url";

/**
 * 상품 URL 하나를 분석한다(PROJECT_SPEC.md 12.1의 [1]~[5]).
 * 저장(product_imports)과 화면 연결은 9단계의 /api/imports가 맡는다.
 */

/** 화면의 진행 단계: 페이지 불러오는 중 → 상품 정보 읽는 중 → 사이즈표·컬러 정리 중 */
export type AnalyzeStage = "fetching" | "parsing" | "normalizing";

export interface AnalyzeResult {
  sourceUrl: string;
  /** 추적 파라미터를 지운 주소 */
  normalizedUrl: string;
  /** redirect를 따라간 최종 주소 */
  finalUrl: string;
  domain: string;
  parserId: string;
  parserVersion: string;
  status: "succeeded" | "partial";
  product: NormalizedProduct;
  durationMs: number;
}

/** 등록 가능한 도메인(www.musinsa.com → musinsa.com, shop.example.co.kr → example.co.kr) */
export function siteOf(hostname: string): string {
  const labels = hostname.toLowerCase().split(".");
  const twoLevel = labels.length >= 3 && /^(co|or|ne|go|ac|re|pe|com|net|org)$/.test(labels.at(-2)!) && labels.at(-1)!.length === 2;
  return labels.slice(twoLevel ? -3 : -2).join(".");
}

/** 브랜드·제품명·사이즈표가 모두 있으면 성공, 하나라도 없으면 부분 성공 */
function statusOf(p: NormalizedProduct): AnalyzeResult["status"] {
  return p.productName && p.brand && p.sizeChart ? "succeeded" : "partial";
}

export async function analyzeProductUrl(
  input: string,
  options: {
    fetch?: FetchOptions;
    normalize?: NormalizeOptions;
    onStage?: (stage: AnalyzeStage) => void;
    /** 규칙으로 사이즈표를 못 찾았을 때 본문의 사이즈 관련 글을 표로(AI). 없거나 실패하면 건너뛴다. */
    extractSizeChart?: (snippet: string) => Promise<RawSizeChart | undefined>;
  } = {},
): Promise<AnalyzeResult> {
  const started = Date.now();
  const url = normalizeProductUrl(input);
  options.onStage?.("fetching");
  const page = await safeFetch(url, { ...options.fetch, accept: "html" });
  options.onStage?.("parsing");

  // 같은 사이트(하위 도메인 포함)의 공개 JSON만 부를 수 있다(Shopify 상품 JSON, 무신사 실측 등). SSRF 방어는 safeFetch가 다시 한다.
  const fetchJson = async (target: string) => {
    const t = new URL(target, page.url);
    if (siteOf(t.hostname) !== siteOf(page.url.hostname)) throw new ImportError("blocked_host", t.hostname);
    const res = await safeFetch(t, { ...options.fetch, accept: "json" });
    return JSON.parse(res.body) as unknown;
  };

  const ctx = createParseContext(page.url, page.body, fetchJson);
  const run = await runParsers(ctx);
  options.onStage?.("normalizing");
  const snippet = !run.product.sizeChart && options.extractSizeChart && run.product.detailText ? sizeSnippet(run.product.detailText) : undefined;
  if (snippet) {
    try {
      const chart = await options.extractSizeChart!(snippet);
      run.diagnostics.ai = { sizeChart: Boolean(chart), snippet: snippet.length };
      if (chart) {
        run.product.sizeChart = chart;
        run.sources.sizeChart = "ai";
      }
    } catch (e) {
      run.diagnostics.ai = { error: e instanceof Error ? e.message.slice(0, 120) : "error" };
    }
  }
  const siteName = ctx.$('meta[property="og:site_name"]').attr("content");
  const product = normalizeProduct(run.product, run.sources, { siteName, ...options.normalize });
  if (Object.keys(run.diagnostics).length) product.diagnostics = run.diagnostics;
  if (run.failed.length) product.warnings.push({ code: "parser_failed", message: `일부 분석 단계가 실패했습니다: ${run.failed.join(", ")}` });

  const main = run.used[0] ?? { id: "generic", version: "v1" };
  return {
    sourceUrl: input.trim(),
    normalizedUrl: url.toString(),
    finalUrl: page.url.toString(),
    domain: page.url.hostname,
    parserId: main.id,
    parserVersion: main.version,
    status: statusOf(product),
    product,
    durationMs: Date.now() - started,
  };
}

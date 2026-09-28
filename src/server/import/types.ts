import type { CheerioAPI } from "cheerio";
import type { CategoryId, Measurements } from "@/lib/types/domain";

/**
 * 상품 URL 분석 타입(PROJECT_SPEC.md 13~14장).
 * Parser는 DB·인증·UI를 모르고, ParseContext를 받아 RawProduct를 돌려준다.
 */

export interface ParseContext {
  url: URL;
  html: string;
  $: CheerioAPI;
  /** 페이지에서 미리 뽑은 JSON-LD 객체(@graph·배열은 펼침) */
  jsonLd: Record<string, unknown>[];
  /** 같은 사이트의 공개 JSON 호출용. SSRF 방어가 적용된다. */
  fetchJson: (url: string) => Promise<unknown>;
}

export interface RawSizeChart {
  unitHint?: "cm" | "inch";
  /** ["사이즈", "총장", "어깨너비", ...] */
  headers: string[];
  /** [["M", "70", "46"], ...] */
  rows: string[][];
}

export interface RawProduct {
  brand?: string;
  productName?: string;
  imageUrls?: string[];
  /** breadcrumb, 카테고리 텍스트 */
  categoryHints?: string[];
  price?: { amount: number; currency?: string };
  colorOptions?: string[];
  colorFromDetail?: string;
  sizeOptions?: string[];
  sizeChart?: RawSizeChart;
  /** AI 추출 fallback용 정제 텍스트 */
  detailText?: string;
  /** 필드별 출처(generic parser처럼 한 parser 안에서 출처가 섞일 때). 없으면 parser 종류를 쓴다. */
  fieldSources?: Partial<Record<RawField, ExtractedSource>>;
  /** 어떤 경로로 값을 얻었는지(화면에는 안 보이고 product_imports.result에만 남는다) */
  diagnostics?: Record<string, unknown>;
}

export type RawField = Exclude<keyof RawProduct, "fieldSources" | "diagnostics">;

export interface ProductParser {
  id: string;
  /** 구조가 바뀌어 고치면 올린다. product_imports에 기록한다. */
  version: string;
  kind: "site" | "platform" | "generic" | "ai";
  matches(url: URL, html?: string): boolean;
  /** 실패해도 예외 대신 얻은 만큼 돌려준다. */
  parse(ctx: ParseContext): Promise<RawProduct>;
}

export type ImportWarningCode =
  | "size_chart_unit_converted"
  | "circumference_converted"
  | "range_value_averaged"
  | "invalid_measurement_dropped"
  | "size_chart_unmapped_columns"
  | "price_currency_not_krw"
  | "parser_failed";

export interface ImportWarning {
  code: ImportWarningCode;
  /** 사용자에게 보여줄 한 줄 */
  message: string;
}

export type ExtractedSource = "site" | "platform" | "json_ld" | "open_graph" | "meta" | "heuristic" | "ai";

/** 자동으로 채운 값과 그 출처(분석 기록용) */
export interface Extracted<T> {
  value: T;
  source: ExtractedSource;
  confidence: "high" | "medium" | "low";
}

export type MeasurementGroup = "top" | "bottom" | "hat";

export interface NormalizedSizeChart {
  measurementGroup: MeasurementGroup;
  rows: Array<{ sizeLabel: string; measurements: Measurements }>;
  /** 매핑하지 못한 헤더(암홀 등). 사용자에게 버렸다고 알린다. */
  unmappedColumns: string[];
}

export interface NormalizedProduct {
  brand: Extracted<string> | null;
  productName: Extracted<string> | null;
  categoryId: Extracted<CategoryId> | null;
  subcategoryId: Extracted<string> | null;
  imageUrls: string[];
  /** KRW 정수 */
  price: Extracted<number> | null;
  colorOptions: string[];
  colorCandidate: Extracted<string> | null;
  sizeOptions: string[];
  sizeChart: NormalizedSizeChart | null;
  /** 쇼핑몰이 붙인 카테고리 경로(넓은 것 → 좁은 것). 주문내역 가져오기에서 옷이 아닌 상품을 거를 때 쓴다. */
  categoryPath?: string[];
  warnings: ImportWarning[];
  /** parser 진단 정보(화면에 안 보임) */
  diagnostics?: Record<string, unknown>;
}

/** 분석 실패 원인. 화면의 "자세히"와 product_imports.error_code에 남긴다. */
export type ImportErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "blocked_port"
  | "dns_failed"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "unsupported_content"
  | "http_error"
  | "network_error";

export class ImportError extends Error {
  constructor(
    public code: ImportErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

import type { Extracted, ExtractedSource, ImportWarning, NormalizedProduct, RawField, RawProduct } from "../types";
import { mapCategory } from "./category";
import { cleanOptions, pickColor, splitColorOption } from "./color";
import { normalizeSizeChart } from "./size-chart";
import { cleanText } from "./text";

/** RawProduct의 필드마다 어느 단계에서 얻었는지 */
export type FieldSources = Partial<Record<RawField, ExtractedSource>>;

const CONFIDENCE: Record<ExtractedSource, Extracted<unknown>["confidence"]> = {
  site: "high",
  platform: "high",
  json_ld: "high",
  open_graph: "medium",
  meta: "medium",
  heuristic: "low",
  ai: "low",
};

const extracted = <T,>(value: T, source: ExtractedSource | undefined, confidence?: Extracted<T>["confidence"]): Extracted<T> => ({
  value,
  source: source ?? "heuristic",
  confidence: confidence ?? CONFIDENCE[source ?? "heuristic"],
});

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 제품명 앞 브랜드와 뒤 쇼핑몰 이름을 뗀다. "[ARKET] 오버셔츠 - 무신사 스토어" → "오버셔츠" */
export function cleanProductName(name: string, brand: string | null, siteName?: string): string {
  let n = cleanText(name, 200);
  n = n.replace(/\s+[-|–—:]\s+[^-|–—]{1,40}$/, (tail) => {
    const t = tail.replace(/^\s+[-|–—:]\s+/, "");
    const shop = /스토어|store|shop|몰|mall|공식|official|online|29cm|musinsa|무신사|w\s*concept/i.test(t);
    return shop || (siteName && t.toLowerCase().includes(siteName.toLowerCase())) ? "" : tail;
  });
  if (brand) n = n.replace(new RegExp(`^\\s*[\\[(]?${escapeRe(brand)}[\\])]?\\s*[-|:·]?\\s*`, "i"), "");
  n = n.replace(/^\s*\[[^\]]{1,40}\]\s*/, (m) => (brand ? "" : m));
  return n.trim() || cleanText(name, 200);
}

export interface NormalizeOptions {
  /** 사용자가 이미 쓰는 브랜드 표기. 대소문자만 다르면 이 표기로 맞춘다. */
  knownBrands?: string[];
  siteName?: string;
}

export function normalizeProduct(raw: RawProduct, sources: FieldSources, options: NormalizeOptions = {}): NormalizedProduct {
  const warnings: ImportWarning[] = [];

  // 브랜드: 파서 값 → 제품명 앞 [브랜드]
  let brandText = cleanText(raw.brand, 100);
  let brandSource = sources.brand;
  if (!brandText) {
    const bracket = cleanText(raw.productName).match(/^\[([^\]]{1,40})\]/);
    if (bracket) {
      brandText = bracket[1].trim();
      brandSource = "heuristic";
    }
  }
  const known = options.knownBrands?.find((b) => b.toLowerCase() === brandText.toLowerCase());
  if (known) brandText = known;
  const brand = brandText ? extracted(brandText, brandSource) : null;

  const nameText = raw.productName ? cleanProductName(raw.productName, brandText || null, options.siteName) : "";
  const productName = nameText ? extracted(nameText, sources.productName) : null;

  const category = mapCategory(raw.categoryHints ?? [], nameText);
  const categorySource: ExtractedSource | undefined = category?.fromName ? "heuristic" : (sources.categoryHints ?? "heuristic");

  let price: Extracted<number> | null = null;
  if (raw.price && Number.isFinite(raw.price.amount) && raw.price.amount > 0) {
    const currency = (raw.price.currency ?? "KRW").toUpperCase();
    if (currency === "KRW") price = extracted(Math.round(raw.price.amount), sources.price);
    else warnings.push({ code: "price_currency_not_krw", message: `가격이 ${currency}로 적혀 있어 비워 두었습니다.` });
  }

  const material = cleanText(raw.material, 300);
  const colorOptions = cleanOptions(raw.colorOptions, splitColorOption);
  const colorCandidate = pickColor(raw, colorOptions);

  let sizeChart: NormalizedProduct["sizeChart"] = null;
  if (raw.sizeChart) {
    const group = category ? (category.categoryId === "bottom" ? "bottom" : "top") : null;
    const result = normalizeSizeChart(raw.sizeChart, group);
    sizeChart = result.chart;
    warnings.push(...result.warnings);
  }
  const sizeOptions = cleanOptions(raw.sizeOptions);
  if (!sizeOptions.length && sizeChart) sizeOptions.push(...sizeChart.rows.map((r) => r.sizeLabel));

  const imageUrls = [...new Set((raw.imageUrls ?? []).filter((u) => /^https?:\/\//i.test(u)))].slice(0, 12);

  return {
    brand,
    productName,
    categoryId: category ? extracted(category.categoryId, categorySource, category.fromName ? "low" : undefined) : null,
    subcategoryId: category ? extracted(category.subcategoryId, categorySource, category.fromName ? "low" : "medium") : null,
    imageUrls,
    price,
    material: material ? extracted(material, sources.material) : null,
    colorOptions,
    colorCandidate,
    sizeOptions,
    sizeChart,
    warnings,
  };
}

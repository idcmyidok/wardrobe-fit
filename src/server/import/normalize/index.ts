import type { CategoryId } from "@/lib/types/domain";
import type { Extracted, ExtractedSource, ImportWarning, MeasurementGroup, NormalizedProduct, RawField, RawProduct } from "../types";
import { normalizeColorName } from "@/lib/constants/colors";
import { mapCategory } from "./category";
import { cleanOptions, pickColor, splitColorOption } from "./color";
import { normalizeSizeChart } from "./size-chart";
import { cleanText } from "./text";

const MEASUREMENT_GROUP: Record<Exclude<CategoryId, "shoes">, MeasurementGroup> = { outer: "top", top: "top", bottom: "bottom", hat: "hat" };

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

/** 검토 화면에서 고를 수 있는 페이지 사진 수 */
export const MAX_IMAGES = 20;

/** 같은 사진의 크기별 주소(Cafe24 big/medium, 무신사 _500/_big, 쿼리 문자열)는 앞의 것 하나만 */
export function dedupeImages(urls: string[]): string[] {
  const key = (u: string) =>
    u
      .replace(/^https?:/i, "")
      .replace(/[?#].*$/, "")
      .replace(/\/web\/product\/(extra\/)?(big|medium|small|tiny)\//, "/web/product/$1_/")
      .replace("/thumbnails/images/", "/images/")
      .replace(/_(\d{2,4}|big|small|org|tiny)(?=\.\w+$)/i, "");
  const seen = new Set<string>();
  return urls.filter((u) => {
    if (!/^https?:\/\//i.test(u)) return false;
    const k = key(u);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

  // 가져온 컬러도 한글 표기로 보여 준다("BLACK / M" → "블랙").
  const colorOptions = [...new Set(cleanOptions(raw.colorOptions, splitColorOption).map((c) => normalizeColorName(c) ?? c))];
  const picked = pickColor(raw, colorOptions);
  const colorCandidate = picked && { ...picked, value: normalizeColorName(picked.value) ?? picked.value };

  let sizeChart: NormalizedProduct["sizeChart"] = null;
  // 신발은 실측을 저장하지 않는다(발길이 표가 총장으로 잡히지 않게 사이즈표를 읽지 않는다).
  if (raw.sizeChart && category?.categoryId !== "shoes") {
    const group = category ? MEASUREMENT_GROUP[category.categoryId] : null;
    const result = normalizeSizeChart(raw.sizeChart, group);
    sizeChart = result.chart;
    warnings.push(...result.warnings);
  }
  const sizeOptions = cleanOptions(raw.sizeOptions);
  if (!sizeOptions.length && sizeChart) sizeOptions.push(...sizeChart.rows.map((r) => r.sizeLabel));

  const imageUrls = dedupeImages(raw.imageUrls ?? []).slice(0, MAX_IMAGES);

  return {
    brand,
    productName,
    categoryId: category ? extracted(category.categoryId, categorySource, category.fromName ? "low" : undefined) : null,
    subcategoryId: category ? extracted(category.subcategoryId, categorySource, category.fromName ? "low" : "medium") : null,
    imageUrls,
    price,
    colorOptions,
    colorCandidate,
    sizeOptions,
    sizeChart,
    warnings,
  };
}

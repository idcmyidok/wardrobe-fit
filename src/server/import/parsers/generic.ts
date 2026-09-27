import { cleanText, textOrUndefined } from "../normalize/text";
import type { ExtractedSource, ParseContext, ProductParser, RawField, RawProduct } from "../types";
import { absoluteUrl, detailText, findSizeTable, meta, selectOptions } from "./helpers";

/**
 * 어느 쇼핑몰이든 시도하는 parser(PROJECT_SPEC.md 13.3).
 * ① JSON-LD Product ② OpenGraph ③ meta/microdata ④ 옵션 select·사이즈표 휴리스틱. 앞에서 얻은 값을 뒤에서 덮지 않는다.
 */

type Obj = Record<string, unknown>;

const isType = (node: Obj, type: string) => {
  const t = node["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
};
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
/** "59,000" · "₩59,000" 같은 가격 문자열 → 숫자 */
const amountOf = (v: unknown) => Number(String(v ?? "").replace(/[^\d.]/g, "")) || NaN;
const nameOf = (v: unknown): string | undefined =>
  typeof v === "string" ? v : v && typeof v === "object" ? str((v as Obj).name) : Array.isArray(v) ? nameOf(v[0]) : undefined;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

function imageUrls(v: unknown, base: URL): string[] {
  return list(v)
    .map((img) => absoluteUrl(typeof img === "object" && img ? (img as Obj).url ?? (img as Obj).contentUrl : img, base))
    .filter((u): u is string => Boolean(u));
}

function offerPrice(offers: unknown): RawProduct["price"] | undefined {
  for (const offer of list(offers)) {
    if (!offer || typeof offer !== "object") continue;
    const o = offer as Obj;
    const spec = list(o.priceSpecification)[0] as Obj | undefined;
    const amount = amountOf(str(o.price) ?? str(o.lowPrice) ?? str(spec?.price));
    if (Number.isFinite(amount) && amount > 0) return { amount, currency: str(o.priceCurrency) ?? str(spec?.priceCurrency) };
  }
  return undefined;
}

export const genericParser: ProductParser = {
  id: "generic",
  version: "v1",
  kind: "generic",
  matches: () => true,
  async parse(ctx: ParseContext): Promise<RawProduct> {
    const { $, url } = ctx;
    const out: RawProduct = {};
    const sources: Partial<Record<RawField, ExtractedSource>> = {};
    const set = <K extends RawField>(key: K, value: RawProduct[K] | undefined, source: ExtractedSource) => {
      const empty = value == null || (Array.isArray(value) && value.length === 0) || value === "";
      if (empty || out[key] != null) return;
      out[key] = value;
      sources[key] = source;
    };

    // ① JSON-LD
    const product = (ctx.jsonLd.find((n) => isType(n, "Product")) ?? ctx.jsonLd.find((n) => isType(n, "ProductGroup"))) as Obj | undefined;
    if (product) {
      const variants = list(product.hasVariant).filter((v): v is Obj => Boolean(v) && typeof v === "object");
      set("productName", textOrUndefined(str(product.name), 200), "json_ld");
      set("brand", textOrUndefined(nameOf(product.brand) ?? nameOf(product.manufacturer), 100), "json_ld");
      set("imageUrls", imageUrls(product.image, url), "json_ld");
      set("price", offerPrice(product.offers) ?? offerPrice(variants[0]?.offers), "json_ld");
      set("material", textOrUndefined(str(product.material), 300), "json_ld");
      set("colorFromDetail", textOrUndefined(str(product.color), 50), "json_ld");
      set("categoryHints", list(product.category).map(str).filter((c): c is string => Boolean(c)), "json_ld");
      set("colorOptions", [...new Set(variants.map((v) => str(v.color)).filter((c): c is string => Boolean(c)))], "json_ld");
      set("sizeOptions", [...new Set(variants.map((v) => str(v.size)).filter((c): c is string => Boolean(c)))], "json_ld");
    }
    const breadcrumb = ctx.jsonLd.find((n) => isType(n, "BreadcrumbList"));
    if (breadcrumb) {
      const names = list(breadcrumb.itemListElement)
        .map((e) => (e && typeof e === "object" ? nameOf((e as Obj).name) ?? nameOf((e as Obj).item) : undefined))
        .filter((n): n is string => Boolean(n));
      set("categoryHints", names, "json_ld");
    }

    // ② OpenGraph / 상품 meta
    set("productName", textOrUndefined(meta($, "og:title"), 200), "open_graph");
    set(
      "imageUrls",
      $('meta[property="og:image"], meta[property="og:image:secure_url"]')
        .toArray()
        .map((m) => absoluteUrl($(m).attr("content"), url))
        .filter((u): u is string => Boolean(u)),
      "open_graph",
    );
    const ogAmount = amountOf(meta($, "product:price:amount") ?? meta($, "og:price:amount"));
    if (ogAmount > 0) set("price", { amount: ogAmount, currency: meta($, "product:price:currency") ?? meta($, "og:price:currency") }, "open_graph");
    set("brand", textOrUndefined(meta($, "product:brand") ?? meta($, "og:brand"), 100), "open_graph");
    set("colorFromDetail", textOrUndefined(meta($, "product:color"), 50), "open_graph");
    const ogCategory = meta($, "product:category");
    if (ogCategory) set("categoryHints", [ogCategory], "open_graph");

    // ③ microdata / 일반 meta
    set("productName", textOrUndefined($('[itemprop="name"]').first().attr("content") ?? $('[itemprop="name"]').first().text(), 200), "meta");
    set("brand", textOrUndefined($('[itemprop="brand"]').first().attr("content") ?? $('[itemprop="brand"] [itemprop="name"]').first().text(), 100), "meta");
    const microPrice = amountOf($('[itemprop="price"]').first().attr("content"));
    if (microPrice > 0) set("price", { amount: microPrice, currency: $('[itemprop="priceCurrency"]').first().attr("content") }, "meta");
    set("productName", textOrUndefined($("title").first().text(), 200), "meta");

    // ④ 휴리스틱
    const options = selectOptions($);
    set("colorOptions", options.colors, "heuristic");
    set("sizeOptions", options.sizes, "heuristic");
    set("sizeChart", findSizeTable($), "heuristic");
    set(
      "categoryHints",
      $('[class*="breadcrumb"] a, nav[aria-label*="breadcrumb" i] a, .location a')
        .toArray()
        .map((a) => cleanText($(a).text(), 40))
        .filter(Boolean),
      "heuristic",
    );
    out.detailText = detailText($);

    out.fieldSources = sources;
    return out;
  },
};

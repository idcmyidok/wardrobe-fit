import { load } from "cheerio";
import { cleanText, textOrUndefined } from "../normalize/text";
import type { ParseContext, ProductParser, RawProduct } from "../types";
import { absoluteUrl, findSizeTable, meta } from "./helpers";

/**
 * Shopify로 만든 자사몰. 공개 상품 JSON(/products/{handle}.js)을 쓴다(PROJECT_SPEC.md 13.3).
 * 가격은 통화와 관계없이 최소 단위×100(센트 방식)으로 온다.
 */

interface ShopifyProductJs {
  title?: string;
  vendor?: string;
  type?: string;
  tags?: string[];
  price?: number;
  images?: string[];
  description?: string;
  options?: Array<{ name?: string; values?: string[] } | string>;
  variants?: Array<{ options?: string[]; price?: number }>;
}

const COLOR = /색상|컬러|color|colour/i;
const SIZE = /사이즈|size/i;

export const shopifyParser: ProductParser = {
  id: "shopify",
  version: "v1",
  kind: "platform",
  matches: (_url, html) => Boolean(html && /cdn\.shopify\.com|Shopify\.shop\s*=|shopify-digital-wallet/.test(html)),
  async parse(ctx: ParseContext): Promise<RawProduct> {
    const handle = ctx.url.pathname.match(/\/products\/([^/?#]+)/)?.[1];
    if (!handle) return {};
    let data: ShopifyProductJs;
    try {
      data = (await ctx.fetchJson(`${ctx.url.origin}/products/${handle}.js`)) as ShopifyProductJs;
    } catch {
      return {};
    }
    const options = (data.options ?? []).map((o, i) =>
      typeof o === "string" ? { name: o, index: i, values: [] as string[] } : { name: o.name ?? "", index: i, values: o.values ?? [] },
    );
    const optionValues = (re: RegExp) => {
      const opt = options.find((o) => re.test(o.name));
      if (!opt) return undefined;
      if (opt.values.length) return opt.values;
      return [...new Set((data.variants ?? []).map((v) => v.options?.[opt.index]).filter((v): v is string => Boolean(v)))];
    };
    const currency =
      ctx.html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/)?.[1] ?? meta(ctx.$, "og:price:currency") ?? meta(ctx.$, "product:price:currency");
    const description = data.description ? load(data.description) : null;

    return {
      productName: textOrUndefined(data.title, 200),
      brand: textOrUndefined(data.vendor, 100),
      imageUrls: (data.images ?? []).map((u) => absoluteUrl(u, ctx.url)).filter((u): u is string => Boolean(u)),
      price: typeof data.price === "number" && data.price > 0 ? { amount: data.price / 100, currency } : undefined,
      categoryHints: [data.type, ...(data.tags ?? [])].map((t) => cleanText(t, 40)).filter(Boolean),
      colorOptions: optionValues(COLOR),
      sizeOptions: optionValues(SIZE),
      sizeChart: description ? findSizeTable(description) : undefined,
    };
  },
};

import { textOrUndefined } from "../normalize/text";
import type { ParseContext, ProductParser, RawProduct, RawSizeChart } from "../types";

/**
 * 무신사(www.musinsa.com/products/{번호}) 전용 parser.
 * - 제품명·브랜드·사진: 페이지에 들어 있는 상품 상태 JSON(window.__MSS__ 등)과 msscdn 이미지 주소
 * - 실측: 상품 페이지와 별도로 오는 공개 JSON(goods-detail.musinsa.com)
 * 무신사는 데이터센터 IP를 막아 개발 환경에서 실제 페이지를 받아 볼 수 없었다. 그래서 여러 모양을 받아들이도록 넓게 읽고,
 * 어떤 경로로 값을 얻었는지 diagnostics에 남겨 배포 환경의 결과로 고친다.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined);

const IMAGE_HOST = "https://image.msscdn.net";
const MAX_IMAGES = 12;

/** 상품 번호: /products/123, /app/goods/123, /goods/123 */
export function musinsaGoodsNo(url: URL): string | undefined {
  return url.pathname.match(/\/(?:products|goods)\/(\d{3,})/)?.[1];
}

/** "브랜드 제품명 - 사이즈 & 후기 | 무신사" 같은 제목 꼬리를 뗀다. */
export function cleanMusinsaTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const cleaned = title
    .replace(/\s*[|｜]\s*(무신사|MUSINSA)[^|｜]*$/i, "")
    .replace(/\s*[-–]\s*(사이즈\s*&\s*후기|사이즈|후기|리뷰)\s*$/i, "")
    .trim();
  return cleaned || undefined;
}

/** `name = {...}` 꼴의 스크립트에서 JSON 객체 하나를 괄호 짝을 맞춰 꺼낸다. */
export function extractAssignedJson(html: string, marker: RegExp): unknown {
  const m = marker.exec(html);
  if (!m) return undefined;
  const start = html.indexOf("{", m.index + m[0].length - 1);
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let quote = "";
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === quote) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** 객체 트리에서 조건에 맞는 첫 객체(깊이 제한) */
function findObject(node: unknown, test: (o: Obj) => boolean, depth = 0): Obj | undefined {
  if (depth > 12) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findObject(item, test, depth + 1);
      if (hit) return hit;
    }
  } else if (isObj(node)) {
    if (test(node)) return node;
    for (const value of Object.values(node)) {
      const hit = findObject(value, test, depth + 1);
      if (hit) return hit;
    }
  }
  return undefined;
}

const imageUrl = (v: unknown): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return `${IMAGE_HOST}${s.startsWith("/images/") ? "" : "/images"}${s}`;
  return /^https?:\/\//.test(s) ? s.replace(/^http:/, "https:") : undefined;
};

/** 같은 사진의 크기별 주소(_500, _big 등)는 하나로 */
const imageKey = (u: string) =>
  u
    .replace(/\?.*$/, "")
    .replace("/thumbnails/images/", "/images/")
    .replace(/_(\d{2,4}|big|small|org|tiny)(?=\.\w+$)/i, "");

function dedupeImages(urls: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) continue;
    const key = imageKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/** 페이지 곳곳의 msscdn 상품 사진 주소. 상품 번호가 경로에 든 것만(다른 상품 추천 사진 제외). */
export function scanImageUrls(html: string, goodsNo: string | undefined): string[] {
  const re = /(?:https?:)?\/\/image\.msscdn\.net\/(?:thumbnails\/)?images\/(?:goods_img|prd_img)\/[^"'\s)<>\\]+?\.(?:jpe?g|png|webp)/gi;
  const found = (html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").match(re) ?? []).map((u) => (u.startsWith("//") ? `https:${u}` : u));
  const own = goodsNo ? found.filter((u) => u.includes(`/${goodsNo}/`) || u.includes(`/${goodsNo}_`)) : found;
  // 대표·추가 사진(goods_img)을 상세 이미지(prd_img)보다 앞에
  return [...own.filter((u) => u.includes("/goods_img/")), ...own.filter((u) => u.includes("/prd_img/"))];
}

/** 상품 상태 JSON에서 필요한 값 */
function fromState(state: Obj | undefined) {
  if (!state) return {};
  const brandInfo = isObj(state.brandInfo) ? state.brandInfo : undefined;
  const category = isObj(state.category) ? state.category : undefined;
  const images: Array<string | undefined> = [imageUrl(state.thumbnailImageUrl)];
  for (const key of ["goodsImages", "goodsImageList", "images", "imageList"]) {
    const list = state[key];
    if (Array.isArray(list)) for (const item of list) images.push(imageUrl(isObj(item) ? item.imageUrl ?? item.url ?? item.src : item));
  }
  const categoryHints = category
    ? ["categoryDepth1Name", "categoryDepth2Name", "categoryDepth3Name"].map((k) => str(category[k])).filter((c): c is string => Boolean(c))
    : [];
  return {
    productName: str(state.goodsNm) ?? str(state.goodsName),
    brand: str(brandInfo?.brandName) ?? str(state.brandName),
    images,
    categoryHints,
  };
}

/**
 * 실측 JSON을 표로. 알려진 모양이 확실치 않아 흔한 모양을 모두 받는다.
 * ① { sizes: [{ name: "M", items: [{ name: "총장", value: 70 }] }] }
 * ② { header: ["사이즈","총장",...], rows/list: [["M","70",...]] }
 */
export function actualSizeToChart(json: unknown): RawSizeChart | undefined {
  // ②
  const table = findObject(json, (o) => Array.isArray(o.header ?? o.headers) && Array.isArray(o.rows ?? o.list ?? o.body));
  if (table) {
    const headers = (table.header ?? table.headers) as unknown[];
    const rows = (table.rows ?? table.list ?? table.body) as unknown[];
    const raw = {
      headers: headers.map((h) => str(isObj(h) ? h.name ?? h.title : h) ?? ""),
      rows: rows.filter(Array.isArray).map((r) => (r as unknown[]).map((c) => str(isObj(c) ? c.value ?? c.name : c) ?? "")),
    };
    if (raw.headers.length >= 2 && raw.rows.length) return raw;
  }
  // ①
  const sizeName = (s: Obj) => str(s.name) ?? str(s.sizeName) ?? str(s.optionName) ?? str(s.size);
  const itemsOf = (s: Obj) => [s.items, s.measurements, s.values, s.actualSizeItems, s.sizeItems].find(Array.isArray) as unknown[] | undefined;
  const holder = findObject(json, (o) =>
    Object.values(o).some((v) => Array.isArray(v) && v.length > 0 && v.every((s) => isObj(s) && sizeName(s) && itemsOf(s))),
  );
  if (!holder) return undefined;
  const sizes = Object.values(holder).find((v) => Array.isArray(v) && v.length > 0 && v.every((s) => isObj(s) && sizeName(s) && itemsOf(s))) as Obj[];
  const itemName = (i: Obj) => str(i.name) ?? str(i.itemName) ?? str(i.measurementName) ?? str(i.title);
  const itemValue = (i: Obj) => str(i.value) ?? str(i.size) ?? str(i.measurementValue) ?? str(i.actualSize);
  const headers: string[] = [];
  for (const s of sizes) for (const i of itemsOf(s) ?? []) if (isObj(i) && itemName(i) && !headers.includes(itemName(i)!)) headers.push(itemName(i)!);
  if (!headers.length) return undefined;
  const rows = sizes.map((s) => {
    const byName = new Map((itemsOf(s) ?? []).filter(isObj).map((i) => [itemName(i), itemValue(i) ?? ""]));
    return [sizeName(s)!, ...headers.map((h) => byName.get(h) ?? "")];
  });
  return { headers: ["사이즈", ...headers], rows };
}

const API_HOST = "https://goods-detail.musinsa.com";
const actualSizeUrls = (no: string) => [`${API_HOST}/api2/goods/${no}/actual-size`, `${API_HOST}/api2/goods/${no}/v2/actual-size`];

export const musinsaParser: ProductParser = {
  id: "musinsa",
  version: "v1",
  kind: "site",
  matches: (url) => /(^|\.)musinsa\.com$/i.test(url.hostname),
  async parse(ctx: ParseContext): Promise<RawProduct> {
    const goodsNo = musinsaGoodsNo(ctx.url);
    const diagnostics: Record<string, unknown> = { goodsNo: goodsNo ?? null };

    const stateJson =
      extractAssignedJson(ctx.html, /__MSS__\.product\.state\s*=\s*/) ??
      extractAssignedJson(ctx.html, /__MSS_FE__\.product\.state\s*=\s*/) ??
      (() => {
        const next = ctx.$("script#__NEXT_DATA__").text();
        try {
          return next ? JSON.parse(next) : undefined;
        } catch {
          return undefined;
        }
      })();
    const state = findObject(stateJson, (o) => "goodsNm" in o || ("goodsNo" in o && "brandInfo" in o));
    diagnostics.state = state ? Object.keys(state).slice(0, 40) : stateJson ? "json_without_goods" : "none";
    const s = fromState(state);

    const images = dedupeImages([...(s.images ?? []), ...scanImageUrls(ctx.html, goodsNo)]);
    diagnostics.images = images.length;

    let sizeChart: RawSizeChart | undefined;
    const tried: Array<{ url: string; ok: boolean; keys?: string[]; error?: string }> = [];
    if (goodsNo) {
      for (const target of actualSizeUrls(goodsNo)) {
        try {
          const json = await ctx.fetchJson(target);
          sizeChart = actualSizeToChart(json);
          tried.push({ url: target, ok: Boolean(sizeChart), keys: isObj(json) ? Object.keys(json).slice(0, 20) : undefined });
          if (sizeChart) break;
        } catch (e) {
          tried.push({ url: target, ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "error" });
        }
      }
    }
    diagnostics.actualSize = tried;

    return {
      productName: textOrUndefined(s.productName ?? cleanMusinsaTitle(ctx.$('meta[property="og:title"]').attr("content")), 200),
      brand: textOrUndefined(s.brand, 100),
      imageUrls: images,
      categoryHints: s.categoryHints,
      sizeChart,
      sizeOptions: sizeChart?.rows.map((r) => r[0]).filter(Boolean),
      diagnostics,
    };
  },
};

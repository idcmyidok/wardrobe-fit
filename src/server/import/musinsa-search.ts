import { safeFetch } from "./fetcher";

/**
 * 무신사에서 브랜드+상품명으로 상품번호를 찾는다(주문내역 가져오기 시험용).
 * 검색 API와 검색 페이지 모양은 확인되지 않아 두 곳을 차례로 시도하고, 무엇이 됐는지 diagnostics에 남긴다.
 */

export interface SearchCandidate {
  goodsNo: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  score: number;
}

export interface SearchResult {
  keyword: string;
  best: SearchCandidate | null;
  candidates: SearchCandidate[];
  diagnostics: Array<{ source: string; status: number | string; found: number }>;
}

const SOURCES: Array<{ id: string; url: (kw: string) => string; accept: "json" | "html" }> = [
  {
    id: "plp_api",
    url: (kw) => `https://api.musinsa.com/api2/dp/v1/plp/goods?gf=A&keyword=${encodeURIComponent(kw)}&sortCode=POPULAR&isUsed=false&page=1&size=20&caller=SEARCH`,
    accept: "json",
  },
  { id: "search_page", url: (kw) => `https://www.musinsa.com/search/goods?keyword=${encodeURIComponent(kw)}`, accept: "html" },
];

/** 검색어: 브랜드 + 괄호·태그·색상 표기를 뺀 상품명 */
export function searchKeyword(brand: string, name: string): string {
  const cleaned = name
    .replace(/\[[^\]]*\]|\([^)]*\)+|\{[^}]*\}/g, " ")
    .replace(/\s-\s.*$/, " ")
    .replace(/_[^_]*$/, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${brand} ${cleaned}`.trim().slice(0, 60);
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length >= 2 && !/^(\d+)?(pack|팩|color|컬러)$/.test(t));

/** 주문 상품명 낱말이 후보 이름에 얼마나 들어 있는지(0~1). 브랜드가 같으면 +0.2 */
export function matchScore(order: { brand: string; name: string }, cand: { brand: string; name: string }): number {
  const want = tokens(order.name);
  if (!want.length) return 0;
  const have = norm(cand.name);
  const hit = want.filter((t) => have.includes(t)).length / want.length;
  const sameBrand = norm(order.brand).replace(/\s/g, "") === norm(cand.brand).replace(/\s/g, "");
  return Math.min(1, hit + (sameBrand ? 0.2 : 0));
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

/** JSON 어디에 있든 상품처럼 생긴 객체(번호+이름)를 모은다. */
export function scanGoods(json: unknown, out: Array<Omit<SearchCandidate, "score">> = [], depth = 0): Array<Omit<SearchCandidate, "score">> {
  if (depth > 12 || out.length >= 40) return out;
  if (Array.isArray(json)) {
    for (const v of json) scanGoods(v, out, depth + 1);
    return out;
  }
  if (!isObj(json)) return out;
  const no = json.goodsNo ?? json.goodsNumber ?? json.productId ?? json.goodsId;
  const name = json.goodsName ?? json.goodsNm ?? json.productName ?? json.name;
  if ((typeof no === "number" || (typeof no === "string" && /^\d+$/.test(no))) && typeof name === "string") {
    const brand = json.brandName ?? json.brandNm ?? (isObj(json.brand) ? json.brand.name : json.brand);
    const img = json.thumbnail ?? json.imageUrl ?? json.thumbnailImageUrl ?? json.goodsImage;
    out.push({ goodsNo: String(no), name, brand: typeof brand === "string" ? brand : "", imageUrl: typeof img === "string" ? img : null });
    return out;
  }
  for (const v of Object.values(json)) scanGoods(v, out, depth + 1);
  return out;
}

function goodsFromHtml(html: string) {
  const found = [];
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const text = m[1].trim();
    if (!text.startsWith("{") && !text.includes("goodsNo")) continue;
    try {
      found.push(...scanGoods(JSON.parse(text)));
    } catch {
      // Next.js 조각 스크립트 등 JSON이 아니면 넘어간다.
    }
  }
  if (!found.length)
    for (const m of new Set([...html.matchAll(/\/products\/(\d{4,})/g)].map((x) => x[1]))) found.push({ goodsNo: m, name: "", brand: "", imageUrl: null });
  return found;
}

export async function searchMusinsa(order: { brand: string; name: string }): Promise<SearchResult> {
  const keyword = searchKeyword(order.brand, order.name);
  const diagnostics: SearchResult["diagnostics"] = [];
  let raw: Array<Omit<SearchCandidate, "score">> = [];
  for (const source of SOURCES) {
    try {
      const res = await safeFetch(source.url(keyword), { accept: source.accept, timeoutMs: 6000 });
      raw = source.accept === "json" ? scanGoods(JSON.parse(res.body)) : goodsFromHtml(res.body);
      diagnostics.push({ source: source.id, status: res.status, found: raw.length });
    } catch (e) {
      diagnostics.push({ source: source.id, status: e instanceof Error ? (("code" in e && String(e.code)) || e.message).slice(0, 60) : "error", found: 0 });
    }
    if (raw.length) break;
  }
  const seen = new Set<string>();
  const candidates = raw
    .filter((c) => !seen.has(c.goodsNo) && seen.add(c.goodsNo))
    .map((c) => ({ ...c, imageUrl: c.imageUrl && c.imageUrl.startsWith("/") ? `https://image.msscdn.net${c.imageUrl}` : c.imageUrl, score: matchScore(order, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const best = candidates[0] && candidates[0].score >= 0.6 ? candidates[0] : null;
  return { keyword, best, candidates, diagnostics };
}

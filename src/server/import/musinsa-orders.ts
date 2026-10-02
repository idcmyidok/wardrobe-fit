import type { CategoryId } from "@/lib/types/domain";
import { mapCategory } from "./normalize/category";

/**
 * 무신사 주문내역 글(Ctrl+A 복사 또는 북마크 버튼 결과)을 옷 목록으로 바꾼다.
 * 한 주문은 "상태 → 상품명 → 브랜드 → 상품명 → 옵션(… / N개) → 가격(…원)" 순서로 나온다.
 * 날짜 줄은 같은 날 두 번째 주문부터 생략되고, 반품·취소 건은 옵션 줄이 두 번 나온다.
 * 북마크 버튼은 상품 링크 앞에 "⟦G:상품번호⟧" 줄을 끼워 넣어 복사한다.
 */

/** 아직 구매 확정 전인 주문(상품 준비중·배송중·배송 완료). 띄어쓰기가 다르게 복사될 때도 알아본다. */
const IN_PROGRESS = ["상품 준비중", "상품준비중", "배송 준비중", "배송준비중", "배송중", "배송 중", "배송 완료", "배송완료"] as const;
export const ORDER_STATUSES = ["구매 확정", "오프라인 구매 완료", "반품 완료", "반품 신청", "취소 완료", "교환 요청", "교환 완료", "사용 완료", ...IN_PROGRESS] as const;
const KEEP = new Set(["구매 확정", "오프라인 구매 완료"]);

export interface MusinsaOrder {
  date: string | null;
  status: string;
  name: string;
  brand: string;
  option: string;
  price: number;
  goodsNo: string | null;
}

export interface OrderGarment {
  order: MusinsaOrder;
  /** 팩·셋업을 나눴을 때 "1/2 · 화이트" */
  part: string | null;
  color: string | null;
  size: string | null;
  price: number;
  categoryId: CategoryId | null;
  subcategoryId: string | null;
}

export interface ParsedOrders {
  orders: MusinsaOrder[];
  garments: OrderGarment[];
  /** 상태로 뺀 주문 */
  droppedByStatus: MusinsaOrder[];
  /** 속옷·양말과 옷이 아닌 것(가방·화장품·굿즈 등) */
  droppedByCategory: MusinsaOrder[];
}

const STATUS_RE = new RegExp(`^(${ORDER_STATUSES.join("|")})$`);
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{2})\(.\)$/;
const PRICE_RE = /^([\d,]+)원$/;
const OPTION_RE = /\/\s*\d+개$/;
export const GOODS_MARK_RE = /⟦G:(\d+)⟧/;
/** 옷장 분류가 없는 속옷·양말·이너웨어 */
const UNDERWEAR_RE = /속옷|드로즈|트렁크|팬티|브리프|삭스|양말|타이즈|내의|underwear|boxer|brief|socks?(?![a-z])|tights/i;
/** 옷장에 넣지 않는 것: 화장품·향수·미용기기, 가방·벨트·안경 등 소품, 굿즈. 여기 안 걸리고 분류도 모르면 사용자가 고른다. */
const NOT_GARMENT_RE =
  /향수|퍼퓸|perfume|공병|제모|트리머|모델링\s*팩|마스크\s*팩|스프레이|청결제|립밤|볼륨픽|다운펌|커버스틱|럭키박스|렌즈|블루라이트|안경|glass(es)?(?![a-z])|케이스|키링|keyring|달력|카드|인형|이어폰|헤드폰|headphones?|크로스백|미니백|보스턴백|토트백|숄더백|백팩|에코백|(?<![a-z])bags?(?![a-z])|벨트|(?<![a-z])belt|장갑|gloves?|카라비너|지갑|wallet|목걸이|반지|팔찌|귀걸이|상품권/i;

export function parseMusinsaOrders(text: string): MusinsaOrder[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const orders: MusinsaOrder[] = [];
  let date: string | null = null;
  let goodsNo: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const d = line.match(DATE_RE);
    if (d) date = `20${d[1]}-${d[2]}-${d[3]}`;
    const mark = line.match(GOODS_MARK_RE);
    if (mark) goodsNo ??= mark[1];
    if (!STATUS_RE.test(line)) continue;
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length && !PRICE_RE.test(lines[j]); j++) {
      const m = lines[j].match(GOODS_MARK_RE);
      if (m) goodsNo ??= m[1];
      else if (lines[j] && !STATUS_RE.test(lines[j])) body.push(lines[j]);
      if (STATUS_RE.test(lines[j])) break;
    }
    if (j >= lines.length || !PRICE_RE.test(lines[j])) continue;
    const option = body.find((l) => OPTION_RE.test(l)) ?? "";
    const named = body.filter((l) => !OPTION_RE.test(l));
    // 전체 선택 복사는 [상품명, 브랜드, 상품명], 북마크 버튼(화면에 보이는 글만)은 [브랜드, 상품명]으로 나온다.
    // 두 번 나오는 줄이 상품명이다. 선물한 상품권은 앞에 "…님에게 선물"이 붙는다.
    const start = named.length >= 4 && named[0] !== named[2] && named[1] === named[3] ? 1 : 0;
    const repeated = named[start] === named[start + 2];
    const [name, brand] = repeated || named.length - start !== 2 ? [named[start], named[start + 1]] : [named[start + 1], named[start]];
    orders.push({
      date,
      status: line,
      name: name ?? "",
      brand: brand ?? "",
      option: option.replace(/\s*\/\s*\d+개$/, "").trim(),
      price: Number(lines[j].match(PRICE_RE)![1].replace(/,/g, "")),
      goodsNo,
    });
    goodsNo = null;
    i = j;
  }
  return orders;
}

const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|FREE|F|OS|ONE ?SIZE|SMALL|MEDIUM|LARGE|X-?LARGE|\d{1,3}(\s*\([A-Z0-9]+\))?)$/i;
const GLUED_SIZE_RE = /^(.*[^A-Z\s])(XXS|XS|S|M|L|XL|XXL)$/;

function cleanToken(token: string) {
  return token
    .replace(/^UNISEX\s*-\s*/i, "")
    .replace(/^free\s*\(one size\)$/i, "FREE")
    .replace(/^\(\d+\)/, "")
    .replace(/\(\+[\d,]+원\)$/, "")
    .trim();
}

/** 옵션 글에서 색과 사이즈 쌍을 순서대로 뽑는다. "아쿠아블루·L · 화이트 / XL" → [아쿠아블루 L, 화이트 XL] */
export function optionPairs(option: string): Array<{ color: string | null; size: string | null }> {
  const pairs: Array<{ color: string | null; size: string | null }> = [];
  for (const raw of option.split(/\s*[·/]\s*/)) {
    const token = cleanToken(raw);
    if (!token) continue;
    const last = pairs.at(-1);
    if (SIZE_RE.test(token)) {
      if (last && last.size === null) last.size = token.toUpperCase();
      else pairs.push({ color: null, size: token.toUpperCase() });
      continue;
    }
    const glued = token.match(GLUED_SIZE_RE);
    if (glued) pairs.push({ color: glued[1].trim(), size: glued[2] });
    else pairs.push({ color: token.replace(/^\d+\.\s*/, ""), size: null });
  }
  // 사이즈가 하나만 있으면 나머지 색도 같은 사이즈로 본다(2팩 옵션 "차콜 / 그레이·L").
  const sizes = pairs.map((p) => p.size).filter(Boolean);
  if (sizes.length === 1) for (const p of pairs) p.size ??= sizes[0];
  return pairs;
}

/** 상품명에 적힌 묶음 수. "[2PACK]", "2팩", "3 pack". 없으면 1 */
export function packCount(name: string): number {
  const m = name.match(/(\d)\s*(?:pack|팩|p\b)/i);
  if (m) return Number(m[1]);
  return /세트|set\]|\bset\b/i.test(name) && !/셋업|set\s*-?up|넥타이|타이\s*set|\[타이/i.test(name) ? 2 : 1;
}

const isSetup = (name: string) => /셋업|set\s*-?up|투피스|쓰리피스|two[\s-]*piece|three[\s-]*piece/i.test(name);

function categorize(name: string) {
  const c = mapCategory([], name);
  return { categoryId: c?.categoryId ?? null, subcategoryId: c?.subcategoryId ?? null };
}

/** 한 주문을 옷 여러 벌로 나눈다. 팩은 색·사이즈별로, 셋업은 상의·하의로. 가격은 똑같이 나눈다. */
export function splitOrder(order: MusinsaOrder): OrderGarment[] {
  const pairs = optionPairs(order.option);
  if (isSetup(order.name)) {
    const size = pairs.find((p) => p.size)?.size ?? null;
    const top = categorize(order.name);
    const half = Math.floor(order.price / 2);
    return [
      { order, part: "1/2 · 상의", color: null, size, price: half, ...(top.categoryId && top.categoryId !== "bottom" ? top : { categoryId: "top", subcategoryId: "top.etc" }) },
      { order, part: "2/2 · 하의", color: null, size, price: half, categoryId: "bottom", subcategoryId: "bottom.etc" },
    ];
  }
  const cat = categorize(order.name);
  const count = packCount(order.name);
  if (count > 1) {
    const colored = pairs.filter((p) => p.color);
    const parts = colored.length === count ? colored : Array.from({ length: count }, (_, k) => colored[k] ?? { color: null, size: pairs.find((p) => p.size)?.size ?? null });
    const each = Math.floor(order.price / count);
    return parts.map((p, k) => ({ order, part: `${k + 1}/${count}${p.color ? ` · ${p.color}` : ""}`, color: p.color, size: p.size, price: each, ...cat }));
  }
  const sizes = pairs.map((p) => p.size).filter((s): s is string => Boolean(s));
  const color = pairs.find((p) => p.color)?.color ?? null;
  return [{ order, part: null, color, size: sizes[0] ?? null, price: order.price, ...cat }];
}

export function parseOrdersToGarments(text: string): ParsedOrders {
  const orders = parseMusinsaOrders(text);
  const result: ParsedOrders = { orders, garments: [], droppedByStatus: [], droppedByCategory: [] };
  for (const order of orders) {
    if (!KEEP.has(order.status)) {
      result.droppedByStatus.push(order);
      continue;
    }
    if (UNDERWEAR_RE.test(order.name) || NOT_GARMENT_RE.test(order.name)) {
      result.droppedByCategory.push(order);
      continue;
    }
    result.garments.push(...splitOrder(order));
  }
  return result;
}

/** 옷장 분류가 없는 무신사 카테고리(대분류·중분류 이름) */
const NOT_GARMENT_CATEGORY_RE =
  /가방|백팩|지갑|뷰티|화장품|스킨|메이크업|향수|프래그런스|헤어|바디|액세서리|악세사리|쥬얼리|주얼리|시계|안경|선글라스|벨트|장갑|머플러|스카프|넥타이|양말|속옷|언더웨어|이너웨어|홈웨어|잠옷|디지털|테크|라이프|리빙|생활|인테리어|키친|반려|문구|도서|티켓|컬처|굿즈|완구|장난감|캠핑|골프\s*용품|원피스|스커트/;

/**
 * 상품 페이지의 카테고리 경로로 옷장 분류를 정한다.
 * 경로가 없으면 null(상품명 규칙으로 정한다), 옷장에 없는 카테고리면 "not_garment".
 */
export function garmentFromCategoryPath(path: string[] | undefined): { categoryId: CategoryId; subcategoryId: string } | "not_garment" | null {
  if (!path?.length) return null;
  if (path.some((p) => NOT_GARMENT_CATEGORY_RE.test(p))) return "not_garment";
  const mapped = mapCategory(path);
  return mapped ? { categoryId: mapped.categoryId, subcategoryId: mapped.subcategoryId } : "not_garment";
}

/** 사이즈표에서 주문한 사이즈의 줄을 찾는다. "2 (L)"은 2와 L 둘 다, FREE·F·OS·ONE SIZE는 같은 것으로 본다. */
export function matchSizeRow<T extends { sizeLabel: string }>(rows: T[], size: string | null): T | null {
  if (!rows.length) return null;
  const key = (s: string) => {
    const k = s.toUpperCase().replace(/\s+/g, "");
    return /^(FREE|F|OS|ONESIZE|FREESIZE|프리)$/.test(k) ? "FREE" : k.replace(/^(SMALL)$/, "S").replace(/^(MEDIUM)$/, "M").replace(/^(LARGE)$/, "L").replace(/^X-?LARGE$/, "XL");
  };
  if (!size) return rows.length === 1 ? rows[0] : null;
  const wanted = new Set([key(size), ...size.split(/[()]/).map((s) => s.trim()).filter(Boolean).map(key)]);
  const hit = rows.find((r) => wanted.has(key(r.sizeLabel))) ?? rows.find((r) => r.sizeLabel.split(/[()/\s]+/).some((t) => t && wanted.has(key(t))));
  if (hit) return hit;
  return wanted.has("FREE") && rows.length === 1 ? rows[0] : null;
}

/** 주문내역 훈수에서 쓰는 주문 상태 종류. 교환한 옷은 결국 가졌으니 kept로 두고 exchanged로 따로 센다. */
export type RoastOrderStatus = "kept" | "exchanged" | "returned" | "cancelled";
const ROAST_STATUS: Record<string, RoastOrderStatus> = {
  "구매 확정": "kept",
  "오프라인 구매 완료": "kept",
  "교환 요청": "exchanged",
  "교환 완료": "exchanged",
  "반품 완료": "returned",
  "반품 신청": "returned",
  "취소 완료": "cancelled",
  // 사용자 요청(2026-10-01): 상품 준비중·배송중·배송 완료도 가진 옷으로 보고 분석·20벌 판정에 센다.
  ...Object.fromEntries(IN_PROGRESS.map((s) => [s, "kept" as const])),
};

export interface RoastOrderGarment extends OrderGarment {
  status: RoastOrderStatus;
}

/**
 * 주문내역 훈수용: 반품·취소·교환 건도 버리지 않고 상태를 붙여 돌려준다(사용자 요청: 분석에 쓴다).
 * 속옷·양말과 옷이 아닌 것은 주문 가져오기와 똑같이 뺀다. "사용 완료"(상품권 등)는 뺀다.
 */
export function parseOrdersForRoast(text: string): { orders: MusinsaOrder[]; garments: RoastOrderGarment[] } {
  const orders = parseMusinsaOrders(text);
  const garments: RoastOrderGarment[] = [];
  for (const order of orders) {
    const status = ROAST_STATUS[order.status];
    if (!status || UNDERWEAR_RE.test(order.name) || NOT_GARMENT_RE.test(order.name)) continue;
    // 반품·취소는 한 벌로만 센다(팩을 나누면 반품 건수가 부풀려진다).
    const parts = status === "kept" || status === "exchanged" ? splitOrder(order) : splitOrder(order).slice(0, 1);
    garments.push(...parts.map((g) => ({ ...g, price: status === "returned" || status === "cancelled" ? order.price : g.price, status })));
  }
  return { orders, garments };
}

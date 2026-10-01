import type { OrderItemResult } from "@/app/api/order-imports/item/route";
import type { NormalizedProduct } from "@/server/import/types";

/**
 * 주문내역 훈수가 이미 읽은 상품 정보를 "주문내역으로 추가" 화면에 넘긴다(AI·무신사 재조회 없음).
 * 브라우저 세션 저장소에 잠깐 두고, 넘겨받는 즉시 지운다. 주문 번호는 붙여 넣은 글을 나눈 순서(parsed.orders 인덱스)다.
 */

const KEY = "wardrobe-fit:order-handoff";

/** 주문 한 건의 상품 조회 결과(주문내역으로 추가 화면이 쓰는 만큼만) */
export interface OrderLookup {
  goodsNo: string | null;
  /** 분석 기록 번호. 사진·옷장 등록 연결에 쓴다. 상품을 못 읽었으면 null */
  importId: string | null;
  hasImage: boolean;
  brand: string | null;
  productName: string | null;
  color: string | null;
  verdict: OrderItemResult["verdict"];
  sizeRows: NonNullable<NormalizedProduct["sizeChart"]>["rows"];
}

export interface OrderHandoff {
  text: string;
  /** 주문 순서 → 조회 결과. 없는 주문은 읽지 못한 것으로 본다. */
  lookups: Record<number, OrderLookup>;
}

export function lookupOf(result: OrderItemResult | null): OrderLookup | null {
  if (!result) return null;
  const product = result.outcome?.product ?? null;
  return {
    goodsNo: result.goodsNo,
    importId: result.outcome?.importId ?? null,
    hasImage: (product?.imageUrls.length ?? 0) > 0,
    brand: product?.brand?.value ?? null,
    productName: product?.productName?.value ?? null,
    color: product?.colorCandidate?.value ?? null,
    verdict: product ? result.verdict : null,
    sizeRows: product?.sizeChart?.rows ?? [],
  };
}

export function saveOrderHandoff(handoff: OrderHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {}
}

/** 한 번만 읽힌다 */
export function takeOrderHandoff(): OrderHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as OrderHandoff) : null;
  } catch {
    return null;
  }
}

export function hasOrderHandoff() {
  try {
    return sessionStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

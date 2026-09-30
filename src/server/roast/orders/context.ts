import type { CategoryId } from "@/lib/types/domain";

/**
 * 주문내역 훈수의 옷장 밖 정보. 옷(Item)은 구매 확정·교환한 주문만이고, 반품·취소는 events로 따로 둔다.
 * 주문 원문은 여기에도 서버 어디에도 저장하지 않는다(요청마다 화면이 보낸 목록으로 다시 만든다).
 */
export interface OrderPop {
  /** 상품 하트 수(못 읽으면 null) */
  likes: number | null;
  /** 상품 후기 수(못 읽으면 null) */
  reviews: number | null;
}

export interface OrderEvent {
  brand: string;
  name: string;
  price: number;
  date: string | null;
  status: "returned" | "cancelled";
  categoryId: CategoryId | null;
}

export interface OrderContext {
  /** 옷 주문 건수(반품·취소 포함, 팩·셋업은 한 건) */
  orders: number;
  /** 교환한 옷 벌 수(옷 목록에도 들어 있다) */
  exchanged: number;
  /** 교환한 옷 id */
  exchangedIds: string[];
  /** 반품·취소한 주문 */
  events: OrderEvent[];
  /** 옷 id → 상품 하트·후기 수 */
  pop: Record<string, OrderPop>;
}

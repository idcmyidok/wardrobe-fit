import { MusinsaOrdersTest } from "@/components/admin/musinsa-orders-test";
import { requireAdmin } from "@/server/admin/guard";

export const metadata = { title: "무신사 주문 가져오기 시험 · Wardrobe Fit", robots: { index: false } };

/** 관리자 전용. 주문내역 글로 상품번호 찾기(검색 방식, 북마크 방식)를 시험한다. 옷장에는 저장하지 않는다. */
export default async function MusinsaOrdersTestPage() {
  await requireAdmin();
  return <MusinsaOrdersTest />;
}

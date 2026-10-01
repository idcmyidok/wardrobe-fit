import { RoastView } from "@/components/roast/roast-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { orderRoastUsed } from "@/server/roast/order-actions";
import { getRoastTexts } from "@/server/roast/queries";

/**
 * 무신사 주문내역 훈수. 아직 어느 메뉴에 붙일지 정하지 않아 메뉴에는 없고 이 주소로만 들어온다(사용자 요청).
 * 메뉴에 붙일 때는 src/lib/features.ts의 orderRoastMenu를 켠다(업데이트 노트 문장도 그때 보인다).
 */
export const metadata = { title: "무신사 주문내역 훈수 · Wardrobe Fit", robots: { index: false } };

export default async function OrderRoastPage() {
  const [texts, used] = await Promise.all([getRoastTexts(await createSupabaseServerClient()), orderRoastUsed()]);
  const { LOADING, ...screen } = texts.orders.screen;
  return <RoastView initialResult={null} copy={{ ...texts.screen, ...screen }} orders={{ ...texts.orders.screen, LOADING }} ordersUsed={used} />;
}

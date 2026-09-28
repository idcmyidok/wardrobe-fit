import { getAdminUser } from "@/server/admin/guard";
import { analyzeProductUrl } from "@/server/import/analyze";
import { parseOrdersToGarments, type MusinsaOrder } from "@/server/import/musinsa-orders";
import { searchMusinsa, type SearchResult } from "@/server/import/musinsa-search";

/**
 * POST /api/admin/musinsa-orders { text, offset?, limit?, measure? } (관리자 전용 시험)
 * 무신사 주문내역 글을 옷 목록으로 나누고, offset부터 limit개 주문의 상품번호를 찾는다.
 * 북마크 버튼 글에 상품번호가 있으면 그대로 쓰고, 없으면 상품명으로 검색한다.
 * measure면 찾은 상품 페이지를 읽어 실측이 있는지도 본다. 사용량(product_imports)에는 남기지 않는다.
 */
export const maxDuration = 60;

const MAX_LIMIT = 8;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface OrderProbe {
  index: number;
  goodsNo: string | null;
  via: "bookmark" | "search" | "none";
  search: SearchResult | null;
  measure: { status: string; sizes: string[]; category: string | null; images: number; error?: string } | null;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!(await getAdminUser())) return Response.json({ error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { text?: unknown; offset?: unknown; limit?: unknown; measure?: unknown };
  const text = typeof body.text === "string" ? body.text.slice(0, 500_000) : "";
  const parsed = parseOrdersToGarments(text);

  // 같은 주문(팩·셋업)은 한 번만 찾는다.
  const orders: MusinsaOrder[] = [...new Set(parsed.garments.map((g) => g.order))];
  const offset = Math.max(0, Number(body.offset) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(0, Number(body.limit) || 0));
  const probes: OrderProbe[] = [];
  for (const [k, order] of orders.slice(offset, offset + limit).entries()) {
    if (k > 0) await pause(400); // 무신사에 한꺼번에 요청하지 않는다.
    const search = order.goodsNo ? null : await searchMusinsa(order);
    const goodsNo = order.goodsNo ?? search?.best?.goodsNo ?? null;
    let measure: OrderProbe["measure"] = null;
    if (body.measure === true && goodsNo) {
      try {
        const r = await analyzeProductUrl(`https://www.musinsa.com/products/${goodsNo}`);
        measure = {
          status: r.status,
          sizes: r.product.sizeChart?.rows.map((row) => row.sizeLabel) ?? [],
          category: r.product.subcategoryId?.value ?? null,
          images: r.product.imageUrls.length,
        };
      } catch (e) {
        measure = { status: "failed", sizes: [], category: null, images: 0, error: e instanceof Error ? e.message.slice(0, 80) : "error" };
      }
    }
    probes.push({ index: offset + k, goodsNo, via: order.goodsNo ? "bookmark" : goodsNo ? "search" : "none", search, measure });
  }

  return Response.json({
    counts: {
      orders: parsed.orders.length,
      droppedByStatus: parsed.droppedByStatus.length,
      droppedByCategory: parsed.droppedByCategory.length,
      garments: parsed.garments.length,
      keptOrders: orders.length,
      withGoodsNo: orders.filter((o) => o.goodsNo).length,
    },
    orders,
    garments: parsed.garments.map((g) => ({ ...g, orderIndex: orders.indexOf(g.order), order: undefined })),
    droppedByCategory: parsed.droppedByCategory.map((o) => o.name),
    probes,
  });
}

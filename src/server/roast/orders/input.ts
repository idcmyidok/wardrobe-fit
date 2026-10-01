import "server-only";
import { z } from "zod";
import { normalizeColorName } from "@/lib/constants/colors";
import type { CategoryId, Garment } from "@/lib/types/domain";
import type { OrderContext } from "./context";

/**
 * 화면이 보내는 주문내역 훈수 목록(붙여 넣은 글을 화면에서 나누고 상품 페이지 정보를 붙인 것).
 * 서버는 이 목록을 저장하지 않고, 요청마다 분석용 옷(Garment)으로 바꿔 쓴다.
 */
/** 사진: 본인 분석 기록의 이미지 프록시 주소(무신사 주소는 사이트 CSP에 막혀 화면에서 깨진다) */
const IMAGE_RE = /^\/api\/imports\/[0-9a-f-]{36}\/image\?i=\d{1,2}$/;
/** 상품 페이지에서 브랜드를 못 읽어 들어온 "undefined" 같은 글자는 브랜드 없음으로 본다 */
const NO_BRAND_RE = /^(undefined|null|none|-)$/i;

export const orderItemSchema = z.object({
  /** 같은 주문에서 나온 옷끼리 같은 번호(팩·셋업) */
  order: z.number().int().min(0).max(5000),
  status: z.enum(["kept", "exchanged", "returned", "cancelled"]),
  brand: z.string().max(100).transform((v) => (NO_BRAND_RE.test(v.trim()) ? "" : v.trim())),
  name: z.string().max(200),
  categoryId: z.enum(["outer", "top", "bottom", "hat", "shoes"] satisfies CategoryId[]).nullable(),
  subcategoryId: z.string().max(50).nullable(),
  color: z.string().max(50).nullable(),
  size: z.string().max(50).nullable(),
  price: z.number().int().min(0).max(100_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  goodsNo: z.string().regex(/^\d{1,12}$/).nullable(),
  likes: z.number().int().min(0).max(1e9).nullable(),
  reviews: z.number().int().min(0).max(1e9).nullable(),
  image: z.string().regex(IMAGE_RE).nullable(),
});
export type OrderRoastItem = z.infer<typeof orderItemSchema>;
export const orderListSchema = z.array(orderItemSchema).max(3000);

/** 목록 → 분석용 옷과 주문내역 정보. 옷은 구매 확정·교환한 것 중 분류가 있는 것만. */
export function toGarments(list: OrderRoastItem[]): { garments: Garment[]; ctx: OrderContext } {
  const garments: Garment[] = [];
  const ctx: OrderContext = { orders: new Set(list.map((x) => x.order)).size, exchanged: 0, exchangedIds: [], events: [], pop: {} };
  list.forEach((x, k) => {
    if (x.status === "returned" || x.status === "cancelled") {
      ctx.events.push({ brand: x.brand, name: x.name, price: x.price, date: x.date, status: x.status, categoryId: x.categoryId });
      return;
    }
    if (!x.categoryId) return;
    const id = `o${k}`;
    if (x.status === "exchanged") {
      ctx.exchanged++;
      ctx.exchangedIds.push(id);
    }
    ctx.pop[id] = { likes: x.likes, reviews: x.reviews };
    garments.push({
      id,
      categoryId: x.categoryId,
      subcategoryId: x.subcategoryId,
      brand: x.brand,
      productName: x.name,
      sizeLabel: x.size,
      colorName: normalizeColorName(x.color),
      seasons: [],
      purchasedOn: x.date,
      purchasePrice: x.price || null,
      productUrl: x.goodsNo ? `https://www.musinsa.com/products/${x.goodsNo}` : null,
      imageUrl: x.image,
      measurements: {},
      fitReview: null,
      shoeFit: null,
    });
  });
  return { garments, ctx };
}

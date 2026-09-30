import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { garmentFromCategoryPath } from "@/server/import/musinsa-orders";
import { searchMusinsa } from "@/server/import/musinsa-search";
import { runImport, type ImportOutcome } from "@/server/import/service";

/**
 * POST /api/order-imports/item { brand, name, goodsNo? } → 주문 한 건의 무신사 상품 정보
 * 상품번호가 없으면 브랜드+상품명으로 검색하고, 찾으면 링크 분석(하루 한도에 포함)으로 사진·사이즈표를 읽는다.
 * 실측 AI 추출은 하지 않는다(여러 건을 한꺼번에 돌리므로). 상품 카테고리로 옷인지 다시 판단한다.
 */
export const maxDuration = 30;

export type OrderItemResult = {
  goodsNo: string | null;
  /** search: 검색으로 찾음, bookmark: 주문내역에 번호가 있었음 */
  via: "search" | "bookmark" | null;
  outcome: ImportOutcome | null;
  /** 상품 카테고리 판단. null이면 카테고리를 못 읽었다. */
  verdict: { categoryId: string; subcategoryId: string } | "not_garment" | null;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return Response.json({ error: "signed_out" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { brand?: unknown; name?: unknown; goodsNo?: unknown };
  const brand = typeof body.brand === "string" ? body.brand.slice(0, 100) : "";
  const name = typeof body.name === "string" ? body.name.slice(0, 200) : "";
  const given = typeof body.goodsNo === "string" && /^\d{1,12}$/.test(body.goodsNo) ? body.goodsNo : null;
  if (!name && !given) return Response.json({ error: "invalid" }, { status: 400 });

  const goodsNo = given ?? (await searchMusinsa({ brand, name })).best?.goodsNo ?? null;
  if (!goodsNo) return Response.json({ goodsNo: null, via: null, outcome: null, verdict: null } satisfies OrderItemResult);

  const outcome = await runImport(supabase, user.id, `https://www.musinsa.com/products/${goodsNo}`, "wardrobe", undefined, { photosOnly: true, kind: "order" });
  if (outcome.product) outcome.product = { ...outcome.product, diagnostics: undefined };
  const verdict = outcome.product ? garmentFromCategoryPath(outcome.product.categoryPath) : null;
  return Response.json({ goodsNo, via: given ? "bookmark" : "search", outcome, verdict } satisfies OrderItemResult);
}

import { z } from "zod";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { safeFetchImage } from "@/server/import/fetcher";
import { MAX_IMAGES } from "@/server/import/normalize";
import type { NormalizedProduct } from "@/server/import/types";

/**
 * GET /api/imports/{id}/image?i=0 → 분석 결과의 i번째 상품 이미지(PROJECT_SPEC.md 12.4).
 * 임의 주소가 아니라 본인 분석 기록에 있는 이미지만, 같은 SSRF 방어로 받아서 넘겨준다. 저장하지 않는다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = Number(new URL(request.url).searchParams.get("i") ?? "0");
  if (!z.uuid().safeParse(id).success || !Number.isInteger(index) || index < 0 || index >= MAX_IMAGES) {
    return new Response(null, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return new Response(null, { status: 401 });

  const { data } = await supabase.from("product_imports").select("result").eq("id", id).eq("user_id", user.id).maybeSingle();
  const imageUrl = (data?.result as unknown as NormalizedProduct | null)?.imageUrls?.[index];
  if (!imageUrl) return new Response(null, { status: 404 });

  try {
    const image = await safeFetchImage(imageUrl);
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "content-type": image.contentType.split(";")[0],
        "cache-control": "private, max-age=600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

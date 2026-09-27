import type { SupabaseClient } from "@supabase/supabase-js";
import { GARMENT_IMAGE_BUCKET } from "@/lib/images/upload-garment-image";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Garment } from "@/lib/types/domain";
import { GARMENT_COLUMNS, rowToGarment, type GarmentListRow } from "./mapper";

/** 사진은 비공개 bucket이라 짧게 쓰는 signed URL로 보여준다. 화면을 다시 불러오면 새로 만든다. */
export const SIGNED_URL_SECONDS = 60 * 60;

type Client = SupabaseClient<Database>;

/** 행 목록에 사진 signed URL을 붙여 화면용 옷으로 바꾼다. 한 번의 요청으로 모두 만든다. */
export async function withImageUrls(supabase: Client, rows: GarmentListRow[]): Promise<Garment[]> {
  const paths = rows.flatMap((r) => [r.image_path, r.thumb_path]).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(GARMENT_IMAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  const url = (p: string | null) => (p ? (urls.get(p) ?? null) : null);
  return rows.map((r) => rowToGarment(r, { imageUrl: url(r.image_path), thumbUrl: url(r.thumb_path) }));
}

/** 로그인한 사용자의 옷 목록(삭제한 옷 제외). 등록 순서대로. RLS가 본인 행만 돌려준다. */
export async function listMyGarments(): Promise<Garment[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("garments")
    .select(GARMENT_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`옷 목록을 불러오지 못했습니다: ${error.message}`);
  return withImageUrls(supabase, data);
}

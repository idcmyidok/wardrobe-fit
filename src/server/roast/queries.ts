import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GARMENT_IMAGE_BUCKET } from "@/lib/images/upload-garment-image";
import type { RoastGarmentRef, RoastResult } from "@/lib/roast/types";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";

/**
 * 가장 최근 AI 옷장 분석 결과(사용자당 1개). 없거나 표가 아직 없으면(마이그레이션 20 전) null.
 */
export async function getLatestRoast(): Promise<RoastResult | null> {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return null;
  const { data, error } = await supabase.from("roast_results").select("result").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("[roast] read", error.code, error.message);
    return null;
  }
  if (!data) return null;
  const result = data.result as unknown as RoastResult;
  return { ...result, garments: await signGarments(supabase, result.garments ?? {}) };
}

/** 사진은 비공개 저장소라 보여 줄 때마다 임시 주소를 새로 만든다. 사진 파일이 지워졌으면 그 사진만 빠진다. */
export async function signGarments(
  supabase: SupabaseClient<Database>,
  garments: Record<string, RoastGarmentRef>,
): Promise<Record<string, RoastGarmentRef>> {
  const paths = Object.values(garments)
    .map((g) => g.imagePath)
    .filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(GARMENT_IMAGE_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return Object.fromEntries(Object.entries(garments).map(([id, g]) => [id, { ...g, imageUrl: g.imagePath ? (urls.get(g.imagePath) ?? null) : null }]));
}

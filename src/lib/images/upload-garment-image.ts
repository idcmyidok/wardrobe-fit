import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparedImage } from "./prepare-image";

export const GARMENT_IMAGE_BUCKET = "garment-images";

/** Storage 경로 규칙: {user_id}/{garment_id}/{uuid}.webp. 첫 폴더가 본인 id여야 Storage 정책을 통과한다. */
export function garmentImagePaths(userId: string, garmentId: string, type: PreparedImage["type"], id = crypto.randomUUID()) {
  const ext = type === "image/webp" ? "webp" : "jpg";
  return { imagePath: `${userId}/${garmentId}/${id}.${ext}`, thumbPath: `${userId}/${garmentId}/${id}-thumb.${ext}` };
}

/** 줄인 사진과 썸네일을 올리고 경로를 돌려준다. 하나라도 실패하면 올린 것을 지운다. */
export async function uploadGarmentImages(
  supabase: SupabaseClient,
  userId: string,
  garmentId: string,
  prepared: { image: PreparedImage; thumb: PreparedImage },
) {
  const { imagePath, thumbPath } = garmentImagePaths(userId, garmentId, prepared.image.type);
  const bucket = supabase.storage.from(GARMENT_IMAGE_BUCKET);
  const options = (p: PreparedImage) => ({ contentType: p.type, cacheControl: "3600", upsert: false });

  const main = await bucket.upload(imagePath, prepared.image.blob, options(prepared.image));
  if (main.error) throw main.error;
  const thumb = await bucket.upload(thumbPath, prepared.thumb.blob, options(prepared.thumb));
  if (thumb.error) {
    await bucket.remove([imagePath]);
    throw thumb.error;
  }
  return { imagePath, thumbPath };
}

"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { GARMENT_IMAGE_BUCKET } from "@/lib/images/upload-garment-image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Garment } from "@/lib/types/domain";
import { fieldErrors } from "@/server/auth/schemas";
import { GARMENT_COLUMNS, inputToRow } from "./mapper";
import { withImageUrls } from "./queries";
import { garmentIdSchema, garmentInputSchema } from "./schema";

/**
 * 옷 등록·수정·삭제(soft)·복원·사진 교체. 화면 어디서 부르든 여기서 로그인과 입력을 다시 확인한다.
 * 본인 행만 다룰 수 있는 것은 RLS가 보장하고, 여기서도 user_id 조건을 함께 건다.
 */

export type GarmentActionResult<T = Garment> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const MESSAGES = {
  signedOut: "로그인이 필요합니다. 다시 로그인해 주세요.",
  notFound: "옷을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.",
  invalid: "입력값을 확인해 주세요.",
  failed: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  badImage: "사진 경로가 올바르지 않습니다.",
};

async function session() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

function dbError(error: PostgrestError): GarmentActionResult<never> {
  // 23514(check) / 22P02(형식) / 23503(참조): 서버 검증을 통과했더라도 DB 제약에 걸린 경우
  if (["23514", "22P02", "23503"].includes(error.code)) return { ok: false, error: MESSAGES.invalid };
  if (error.code === "42501") return { ok: false, error: MESSAGES.signedOut };
  console.error("[garments]", error.code, error.message);
  return { ok: false, error: MESSAGES.failed };
}

function parseInput(input: unknown) {
  const parsed = garmentInputSchema.safeParse(input);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const errors = fieldErrors(parsed.error);
  return {
    ok: false as const,
    result: { ok: false, error: Object.values(errors)[0] ?? MESSAGES.invalid, fieldErrors: errors } satisfies GarmentActionResult<never>,
  };
}

type Session = NonNullable<Awaited<ReturnType<typeof session>>>;

async function readGarment(s: Session, id: string): Promise<GarmentActionResult> {
  const { data, error } = await s.supabase
    .from("garments")
    .select(GARMENT_COLUMNS)
    .eq("id", id)
    .eq("user_id", s.userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return { ok: false, error: MESSAGES.notFound };
  const [garment] = await withImageUrls(s.supabase, [data]);
  return { ok: true, data: garment };
}

export async function createGarment(input: unknown): Promise<GarmentActionResult> {
  const s = await session();
  if (!s) return { ok: false, error: MESSAGES.signedOut };
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed.result;

  const { data, error } = await s.supabase
    .from("garments")
    .insert({ ...inputToRow(parsed.data), category_id: parsed.data.categoryId, product_name: parsed.data.productName, user_id: s.userId })
    .select("id")
    .single();
  if (error) return dbError(error);
  return readGarment(s, data.id);
}

/** 수정할 수 있는 모든 필드를 한 번에 바꾼다(빈 값은 null로 저장). */
export async function updateGarment(id: unknown, input: unknown): Promise<GarmentActionResult> {
  const s = await session();
  if (!s) return { ok: false, error: MESSAGES.signedOut };
  const gid = garmentIdSchema.safeParse(id);
  if (!gid.success) return { ok: false, error: MESSAGES.notFound };
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed.result;

  const { data, error } = await s.supabase
    .from("garments")
    .update(inputToRow(parsed.data))
    .eq("id", gid.data)
    .eq("user_id", s.userId)
    .is("deleted_at", null)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: MESSAGES.notFound };
  return readGarment(s, gid.data);
}

/** 삭제는 deleted_at만 채운다(실행 취소로 복원할 수 있게). 사진도 복원을 위해 남겨 둔다. */
export async function deleteGarment(id: unknown): Promise<GarmentActionResult<{ id: string }>> {
  return setDeleted(id, true);
}

export async function restoreGarment(id: unknown): Promise<GarmentActionResult> {
  const s = await session();
  if (!s) return { ok: false, error: MESSAGES.signedOut };
  const result = await setDeleted(id, false, s);
  return result.ok ? readGarment(s, result.data.id) : result;
}

async function setDeleted(id: unknown, deleted: boolean, current?: Session): Promise<GarmentActionResult<{ id: string }>> {
  const s = current ?? (await session());
  if (!s) return { ok: false, error: MESSAGES.signedOut };
  const gid = garmentIdSchema.safeParse(id);
  if (!gid.success) return { ok: false, error: MESSAGES.notFound };

  const query = s.supabase
    .from("garments")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", gid.data)
    .eq("user_id", s.userId);
  const { data, error } = await (deleted ? query.is("deleted_at", null) : query.not("deleted_at", "is", null)).select("id");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: MESSAGES.notFound };
  return { ok: true, data: { id: gid.data } };
}

const imagePathsSchema = z
  .object({ imagePath: z.string().max(512), thumbPath: z.string().max(512) })
  .nullable();

/**
 * 브라우저가 Storage에 올린 사진을 옷에 연결한다(null이면 사진 제거).
 * 경로는 {user_id}/{garment_id}/ 아래여야 하고, 이전 사진 파일은 지운다.
 */
export async function setGarmentImage(id: unknown, paths: unknown): Promise<GarmentActionResult> {
  const s = await session();
  if (!s) return { ok: false, error: MESSAGES.signedOut };
  const gid = garmentIdSchema.safeParse(id);
  if (!gid.success) return { ok: false, error: MESSAGES.notFound };
  const parsed = imagePathsSchema.safeParse(paths);
  if (!parsed.success) return { ok: false, error: MESSAGES.badImage };

  const prefix = `${s.userId}/${gid.data}/`;
  const next = parsed.data;
  const validPath = (p: string) => p.startsWith(prefix) && /^[0-9a-f-]+(-thumb)?\.(webp|jpg)$/.test(p.slice(prefix.length));
  if (next && !(validPath(next.imagePath) && validPath(next.thumbPath))) return { ok: false, error: MESSAGES.badImage };

  const { data: before, error: readError } = await s.supabase
    .from("garments")
    .select("image_path, thumb_path")
    .eq("id", gid.data)
    .eq("user_id", s.userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return dbError(readError);
  if (!before) return { ok: false, error: MESSAGES.notFound };

  const { error } = await s.supabase
    .from("garments")
    .update({ image_path: next?.imagePath ?? null, thumb_path: next?.thumbPath ?? null })
    .eq("id", gid.data)
    .eq("user_id", s.userId);
  if (error) return dbError(error);

  const stale = [before.image_path, before.thumb_path].filter(
    (p): p is string => Boolean(p) && p !== next?.imagePath && p !== next?.thumbPath,
  );
  if (stale.length) {
    const { error: removeError } = await s.supabase.storage.from(GARMENT_IMAGE_BUCKET).remove(stale);
    if (removeError) console.error("[garments] 이전 사진 삭제 실패", removeError.message);
  }
  return readGarment(s, gid.data);
}

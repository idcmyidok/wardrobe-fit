"use server";

import { z } from "zod";
import {
  DATE_RE,
  TIME_RE,
  parseEditBody,
  RELEASE_NOTE_BODY_MAX,
  RELEASE_NOTE_IMAGE_BUCKET,
  RELEASE_NOTES,
  type ReleaseNoteContent,
  type ReleaseNoteEdits,
  type ReleaseNoteImages,
} from "@/lib/release-notes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";

/**
 * 업데이트 노트 수정. 읽기는 누구나 하고, 쓰기는 관리자만 한다.
 * 관리자 확인은 여기서 한 번, DB RLS(admins에 있는 사람만 쓰기)에서 한 번 더 한다.
 * 테이블이 아직 없으면(마이그레이션 전) 고친 노트가 없는 것으로 보고 코드의 노트를 그대로 보여 준다.
 */

export type ReleaseNoteEditResult = { ok: true } | { ok: false; error: string };

const versionSchema = z.string().refine((v) => RELEASE_NOTES.some((n) => n.version === v));
const line = z.string().trim().min(1).max(1000);
const contentSchema = z.object({
  features: z.array(z.object({ title: line, description: z.string().trim().max(2000) })).max(50),
  changes: z.array(line).max(100),
  fixes: z.array(line).max(100),
  date: z.string().regex(DATE_RE).optional(),
  time: z.string().regex(TIME_RE).optional(),
});

export async function getReleaseNoteEdits(): Promise<ReleaseNoteEdits> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return {};
  const { data, error } = await supabase.from("release_note_edits").select("version, body");
  if (error) {
    console.error("[release-notes] read", error.message);
    return {};
  }
  const edits: ReleaseNoteEdits = {};
  for (const row of data) {
    const content = parseEditBody(row.body);
    if (content) edits[row.version] = content;
  }
  return edits;
}

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function prepare(
  version: unknown,
): Promise<{ error: string } | { error?: undefined; supabase: Supabase; adminId: string; version: string }> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 고칠 수 있습니다." };
  const parsed = versionSchema.safeParse(version);
  if (!parsed.success) return { error: "없는 버전입니다." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "저장하지 못했습니다." };
  return { supabase, adminId: admin.id, version: parsed.data };
}

/** 신규 기능·변경 내용·수정사항을 통째로 저장한다(덮어쓰기). */
export async function saveReleaseNoteEdit(version: string, content: ReleaseNoteContent): Promise<ReleaseNoteEditResult> {
  const ready = await prepare(version);
  if (ready.error !== undefined) return { ok: false, error: ready.error };
  const parsed = contentSchema.safeParse(content);
  const body = parsed.success ? JSON.stringify(parsed.data) : "";
  if (!parsed.success || body.length > RELEASE_NOTE_BODY_MAX) return { ok: false, error: "내용이 너무 길거나 형식이 맞지 않습니다." };
  const { error } = await ready.supabase
    .from("release_note_edits")
    .upsert({ version: ready.version, body, updated_by: ready.adminId, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[release-notes] save", error.message);
    return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return { ok: true };
}

/** 고친 글을 지우고 코드의 원래 노트로 돌린다. */
export async function resetReleaseNoteEdit(version: string): Promise<ReleaseNoteEditResult> {
  const ready = await prepare(version);
  if (ready.error !== undefined) return { ok: false, error: ready.error };
  const { error } = await ready.supabase.from("release_note_edits").delete().eq("version", ready.version);
  if (error) {
    console.error("[release-notes] reset", error.message);
    return { ok: false, error: "되돌리지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return { ok: true };
}

/** 버전별 노트 사진의 공개 주소. 테이블이 아직 없으면(마이그레이션 전) 사진이 없는 것으로 본다. */
export async function getReleaseNoteImages(): Promise<ReleaseNoteImages> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return {};
  const { data, error } = await supabase.from("release_note_images").select("version, path");
  if (error) {
    console.error("[release-notes] images read", error.message);
    return {};
  }
  const bucket = supabase.storage.from(RELEASE_NOTE_IMAGE_BUCKET);
  return Object.fromEntries(data.map((row) => [row.version, bucket.getPublicUrl(row.path).data.publicUrl]));
}

export type ReleaseNoteImageResult = { ok: true; url: string | null } | { ok: false; error: string };

/** 브라우저가 올린 사진(경로 {version}/{uuid}.webp)을 그 버전의 사진으로 정하고, 이전 사진은 지운다. */
export async function saveReleaseNoteImage(version: string, path: string): Promise<ReleaseNoteImageResult> {
  const ready = await prepare(version);
  if (ready.error !== undefined) return { ok: false, error: ready.error };
  if (!new RegExp(`^${ready.version.replaceAll(".", "\\.")}/[0-9a-f-]{36}\\.(webp|jpg)$`).test(path)) return { ok: false, error: "사진 경로가 맞지 않습니다." };
  const bucket = ready.supabase.storage.from(RELEASE_NOTE_IMAGE_BUCKET);
  const { data: previous } = await ready.supabase.from("release_note_images").select("path").eq("version", ready.version).maybeSingle();
  const { error } = await ready.supabase
    .from("release_note_images")
    .upsert({ version: ready.version, path, updated_by: ready.adminId, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[release-notes] image save", error.message);
    await bucket.remove([path]);
    return { ok: false, error: "사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (previous?.path && previous.path !== path) await bucket.remove([previous.path]);
  return { ok: true, url: bucket.getPublicUrl(path).data.publicUrl };
}

/** 그 버전의 노트 사진을 지운다. */
export async function removeReleaseNoteImage(version: string): Promise<ReleaseNoteImageResult> {
  const ready = await prepare(version);
  if (ready.error !== undefined) return { ok: false, error: ready.error };
  const { data: previous } = await ready.supabase.from("release_note_images").select("path").eq("version", ready.version).maybeSingle();
  const { error } = await ready.supabase.from("release_note_images").delete().eq("version", ready.version);
  if (error) {
    console.error("[release-notes] image remove", error.message);
    return { ok: false, error: "사진을 지우지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (previous?.path) await ready.supabase.storage.from(RELEASE_NOTE_IMAGE_BUCKET).remove([previous.path]);
  return { ok: true, url: null };
}

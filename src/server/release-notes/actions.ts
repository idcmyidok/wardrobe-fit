"use server";

import { z } from "zod";
import { RELEASE_NOTE_BODY_MAX, RELEASE_NOTES, type ReleaseNoteEdits } from "@/lib/release-notes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";

/**
 * 업데이트 노트 수정. 읽기는 누구나 하고, 쓰기는 관리자만 한다.
 * 관리자 확인은 여기서 한 번, DB RLS(admins에 있는 사람만 쓰기)에서 한 번 더 한다.
 * 테이블이 아직 없으면(마이그레이션 전) 고친 노트가 없는 것으로 보고 코드의 노트를 그대로 보여 준다.
 */

export type ReleaseNoteEditResult = { ok: true } | { ok: false; error: string };

const versionSchema = z.string().refine((v) => RELEASE_NOTES.some((n) => n.version === v));
const bodySchema = z.string().max(RELEASE_NOTE_BODY_MAX);

export async function getReleaseNoteEdits(): Promise<ReleaseNoteEdits> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return {};
  const { data, error } = await supabase.from("release_note_edits").select("version, body");
  if (error) {
    console.error("[release-notes] read", error.message);
    return {};
  }
  return Object.fromEntries(data.map((row) => [row.version, row.body]));
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

/** 글 전체를 저장한다(덮어쓰기). */
export async function saveReleaseNoteEdit(version: string, body: string): Promise<ReleaseNoteEditResult> {
  const ready = await prepare(version);
  if (ready.error !== undefined) return { ok: false, error: ready.error };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: `${RELEASE_NOTE_BODY_MAX.toLocaleString()}자까지 쓸 수 있습니다.` };
  const { error } = await ready.supabase
    .from("release_note_edits")
    .upsert({ version: ready.version, body: parsed.data, updated_by: ready.adminId, updated_at: new Date().toISOString() });
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

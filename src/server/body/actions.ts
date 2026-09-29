"use server";

import { BODY_CONSENT_VERSION, BODY_KEYS, type BodyKey } from "@/lib/constants/body";
import type { BodyProfile } from "@/lib/fit/body-fit";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { clearLegacyColumns, rowToBody } from "./queries";
import { encryptBodyValues } from "./crypto";
import { bodyInputSchema, overridesSchema } from "./schema";

/**
 * 내 치수 저장·추천 치수 수정·삭제(동의 철회). 본인 행만 다루는 것은 RLS가 보장한다.
 * 처음 저장할 때는 동의(consent: true)가 있어야 한다. 동의 시각과 문구 버전을 함께 남긴다.
 */

export type BodyActionResult<T = BodyProfile> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "signed_out" | "consent_required"; fieldErrors?: Record<string, string> };

const MESSAGES = {
  signedOut: "로그인이 필요합니다. 다시 로그인해 주세요.",
  consent: "신체정보 수집·이용에 동의해야 저장할 수 있습니다.",
  invalid: "입력값을 확인해 주세요.",
  failed: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  locked: "지금은 내 치수를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.",
};

async function session() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const user = await getActiveUser(supabase);
  return user ? { supabase, userId: user.id } : null;
}

const signedOut = (): BodyActionResult<never> => ({ ok: false, error: MESSAGES.signedOut, code: "signed_out" });

export async function saveBodyProfile(input: unknown): Promise<BodyActionResult> {
  const s = await session();
  if (!s) return signedOut();
  const parsed = bodyInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.map(String).join(".")] ??= issue.message;
    return { ok: false, error: Object.values(fieldErrors)[0] ?? MESSAGES.invalid, fieldErrors };
  }
  const { values, uncertain, consent } = parsed.data;
  // 치수는 서버에서 암호화해 한 칸(values_enc)에만 저장한다. 키가 없으면 평문으로 남기지 않고 저장을 멈춘다.
  let valuesEnc: string;
  try {
    valuesEnc = encryptBodyValues(values);
  } catch (e) {
    console.error("[body] encrypt", e instanceof Error ? e.message : e);
    return { ok: false, error: MESSAGES.locked };
  }

  const { data: existing, error: readError } = await s.supabase.from("body_profiles").select("*").maybeSingle();
  if (readError) return fail(readError.message);
  // 예전 평문 칸이 남아 있으면 함께 비운다(마이그레이션 19 전).
  const row = { uncertain, values_enc: valuesEnc, ...(existing ? clearLegacyColumns(existing) : {}) } as Database["public"]["Tables"]["body_profiles"]["Update"];
  if (!existing && !consent) return { ok: false, error: MESSAGES.consent, code: "consent_required" };

  const query = existing
    ? s.supabase.from("body_profiles").update(row).eq("user_id", s.userId)
    : s.supabase
        .from("body_profiles")
        .insert({ ...row, user_id: s.userId, consent_version: BODY_CONSENT_VERSION, consented_at: new Date().toISOString() });
  const { data, error } = await query.select("*").single();
  if (error) return fail(error.message, error.code);
  return { ok: true, data: { ...rowToBody(data), values: pickValues(values) } };
}

/** 저장한 값(빈 칸 제외). 방금 암호화한 값을 다시 풀지 않고 돌려준다. */
function pickValues(values: Partial<Record<BodyKey, number | null>>): BodyProfile["values"] {
  const out: BodyProfile["values"] = {};
  for (const k of BODY_KEYS) if (values[k] != null) out[k] = values[k]!;
  return out;
}

/** 추천 치수 표에서 고친 값 저장(전체를 한 번에 바꾼다. 되돌리기 = 그 칸을 빼고 저장). */
export async function saveFitOverrides(input: unknown): Promise<BodyActionResult> {
  const s = await session();
  if (!s) return signedOut();
  const parsed = overridesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: MESSAGES.invalid };
  const { data, error } = await s.supabase
    .from("body_profiles")
    .update({ fit_overrides: parsed.data as Database["public"]["Tables"]["body_profiles"]["Update"]["fit_overrides"] })
    .eq("user_id", s.userId)
    .select("*")
    .maybeSingle();
  if (error) return fail(error.message, error.code);
  if (!data) return { ok: false, error: MESSAGES.consent, code: "consent_required" };
  try {
    return { ok: true, data: rowToBody(data) };
  } catch (e) {
    console.error("[body] decrypt", e instanceof Error ? e.message : e);
    return { ok: false, error: MESSAGES.locked };
  }
}

/** 내 치수와 동의 기록을 모두 지운다(동의 철회). */
export async function deleteBodyProfile(): Promise<BodyActionResult<null>> {
  const s = await session();
  if (!s) return signedOut();
  const { error } = await s.supabase.from("body_profiles").delete().eq("user_id", s.userId);
  if (error) return fail(error.message, error.code);
  return { ok: true, data: null };
}

function fail(message: string, code?: string): BodyActionResult<never> {
  if (code === "42501") return signedOut();
  if (code === "23514") return { ok: false, error: MESSAGES.invalid };
  console.error("[body]", code, message);
  return { ok: false, error: MESSAGES.failed };
}

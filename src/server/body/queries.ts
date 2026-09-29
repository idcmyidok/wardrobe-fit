import "server-only";
import { BODY_KEYS, type BodyKey } from "@/lib/constants/body";
import type { BodyProfile, FitOverrides } from "@/lib/fit/body-fit";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { overridesSchema } from "./schema";
import { decryptBodyValues, type BodyValues } from "./crypto";

export type BodyRow = Database["public"]["Tables"]["body_profiles"]["Row"];

/**
 * 예전(암호화 전) 평문 칸. 마이그레이션 19 전까지 남아 있는 행을 읽고, 저장·변환할 때 비운다.
 * 19를 적용한 뒤에는 이 칸들이 없다(select *에 나오지 않는다).
 */
export const LEGACY_BODY_COLUMN: Record<BodyKey, string> = {
  height: "height_cm",
  shoulder: "shoulder_cm",
  chest: "chest_cm",
  waist: "waist_cm",
  hip: "hip_cm",
  thigh: "thigh_cm",
};
/** 평문 칸을 비우는 값(행에 그 칸이 있을 때만). 몸무게 칸도 함께 비운다. */
export function clearLegacyColumns(row: object): Record<string, null> {
  const out: Record<string, null> = {};
  for (const col of [...Object.values(LEGACY_BODY_COLUMN), "weight_kg"]) if (col in row) out[col] = null;
  return out;
}
/** 평문으로 남은 치수 */
export function legacyValues(row: object): BodyValues {
  const values: BodyValues = {};
  for (const k of BODY_KEYS) {
    const v = (row as Record<string, unknown>)[LEGACY_BODY_COLUMN[k]];
    if (v != null && Number.isFinite(Number(v))) values[k] = Number(v);
  }
  return values;
}

/** DB 행 → 화면 값. 암호화한 값이 있으면 풀어서 쓰고(키가 없으면 오류), 없으면 예전 평문 칸을 읽는다. */
export function rowToBody(row: BodyRow): BodyProfile {
  const values: BodyProfile["values"] = row.values_enc ? decryptBodyValues(row.values_enc) : legacyValues(row);
  const overrides = overridesSchema.safeParse(row.fit_overrides);
  return {
    values,
    uncertain: row.uncertain.filter((u): u is BodyKey => (BODY_KEYS as readonly string[]).includes(u)),
    overrides: overrides.success ? overrides.data : ({} as FitOverrides),
    updatedAt: row.updated_at,
  };
}

/**
 * 로그인한 사용자의 내 치수. 동의 전(행 없음)이면 null.
 * 운영 DB에 migration 14가 아직 없으면 오류 대신 null을 돌려 다른 화면이 그대로 뜨게 한다.
 */
export async function getMyBodyProfile(): Promise<BodyProfile | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("body_profiles").select("*").maybeSingle();
  if (error) {
    console.error("[body] read", error.code, error.message);
    return null;
  }
  if (!data) return null;
  try {
    return rowToBody(data);
  } catch (e) {
    // 암호화 키가 없거나 달라 풀지 못함. 다른 화면은 그대로 뜨게 내 치수 없이 보여 준다.
    console.error("[body] decrypt", e instanceof Error ? e.message : e);
    return null;
  }
}

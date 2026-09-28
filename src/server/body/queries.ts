import "server-only";
import { BODY_KEYS, type BodyKey } from "@/lib/constants/body";
import type { BodyProfile, FitOverrides } from "@/lib/fit/body-fit";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { overridesSchema } from "./schema";

export type BodyRow = Database["public"]["Tables"]["body_profiles"]["Row"];

/** 내 치수 키 → DB 열 */
export const BODY_COLUMN: Record<BodyKey, keyof BodyRow> = {
  height: "height_cm",
  weight: "weight_kg",
  shoulder: "shoulder_cm",
  chest: "chest_cm",
  waist: "waist_cm",
  hip: "hip_cm",
  thigh: "thigh_cm",
};

export function rowToBody(row: BodyRow): BodyProfile {
  const values: BodyProfile["values"] = {};
  for (const k of BODY_KEYS) {
    const v = row[BODY_COLUMN[k]];
    if (v != null) values[k] = Number(v);
  }
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
  return data ? rowToBody(data) : null;
}

import "server-only";
import { DEFAULT_USD_KRW } from "@/lib/format/price";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 달러 환율(1달러 = N원). 관리자가 관리자 화면에서 바꾼다(app_settings, 마이그레이션 18).
 * 표가 아직 없거나 읽지 못하면 기본값(1,360원)을 쓴다.
 */
export async function getUsdRate(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEFAULT_USD_KRW;
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "usd_krw").maybeSingle();
  if (error) {
    console.error("[settings] usd_krw", error.code, error.message);
    return DEFAULT_USD_KRW;
  }
  const value = Number(data?.value);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_KRW;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteAccountAndData } from "@/server/account/delete";
import { logAdminAction } from "./audit";
import { encryptBodyValues } from "@/server/body/crypto";
import { clearLegacyColumns, legacyValues } from "@/server/body/queries";
import { getAdminUser } from "./guard";

/**
 * 관리자 사용자 관리(정지·삭제·테스터 지정). 모든 action이 관리자 여부를 다시 확인한다(화면의 버튼은 보호가 아니다).
 * 자기 자신과 다른 관리자는 정지·삭제할 수 없다. 관리자를 빼려면 SQL Editor에서 admins 행을 먼저 지운다.
 */

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/** 정지 기간. Supabase는 기간으로만 정지하므로 사실상 무기한(100년)으로 둔다. */
const BAN_FOREVER = "876000h";

const userIdSchema = z.uuid();

const fail = (error: string): AdminActionResult => ({ ok: false, error });

async function prepare(targetId: unknown) {
  const admin = await getAdminUser();
  if (!admin) return { error: fail("관리자만 할 수 있습니다.") };
  const parsed = userIdSchema.safeParse(targetId);
  if (!parsed.success) return { error: fail("잘못된 요청입니다.") };
  if (parsed.data === admin.id) return { error: fail("내 계정에는 할 수 없습니다.") };
  const db = createSupabaseAdminClient();
  if (!db) return { error: fail("서버에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.") };
  const { data: targetAdmin } = await db.from("admins").select("user_id").eq("user_id", parsed.data).maybeSingle();
  if (targetAdmin) return { error: fail("다른 관리자 계정에는 할 수 없습니다.") };
  return { db, adminId: admin.id, targetId: parsed.data };
}

export async function setUserBanned(targetId: string, banned: boolean): Promise<AdminActionResult> {
  const ready = await prepare(targetId);
  if ("error" in ready) return ready.error!;
  const { error } = await ready.db.auth.admin.updateUserById(ready.targetId, {
    ban_duration: banned ? BAN_FOREVER : "none",
  });
  if (error) {
    console.error("[admin] ban", error.message);
    return fail(banned ? "정지하지 못했습니다." : "정지를 풀지 못했습니다.");
  }
  await logAdminAction(ready.db, ready.adminId, banned ? "ban_user" : "unban_user", ready.targetId);
  revalidatePath("/admin");
  return { ok: true };
}

/** 테스터 지정·해제. 테스터는 관리자처럼 링크 분석·구매 판단 하루 한도를 받지 않는다(testers, 마이그레이션 17). */
export async function setUserTester(targetId: string, tester: boolean): Promise<AdminActionResult> {
  const ready = await prepare(targetId);
  if ("error" in ready) return ready.error!;
  const { db, adminId, targetId: id } = ready;
  const { error } = tester
    ? await db.from("testers").upsert({ user_id: id, granted_by: adminId }, { onConflict: "user_id", ignoreDuplicates: true })
    : await db.from("testers").delete().eq("user_id", id);
  if (error) {
    console.error("[admin] tester", error.code ?? error.message);
    return fail(tester ? "테스터로 지정하지 못했습니다." : "테스터 지정을 해제하지 못했습니다.");
  }
  await logAdminAction(db, adminId, tester ? "grant_tester" : "revoke_tester", id);
  revalidatePath("/admin");
  return { ok: true };
}

/** 계정과 옷·기록·사진을 모두 지운다. 테이블은 FK cascade로 지워지고, 사진은 먼저 Storage에서 지운다. */
export async function deleteUserAccount(targetId: string): Promise<AdminActionResult> {
  const ready = await prepare(targetId);
  if ("error" in ready) return ready.error!;
  const { db, adminId, targetId: id } = ready;
  const error = await deleteAccountAndData(db, id);
  if (error) return fail(error);
  await logAdminAction(db, adminId, "delete_user", id);
  revalidatePath("/admin");
  return { ok: true };
}

const usdRateSchema = z.number().gt(0).lt(100000);

/** 달러 환율(1달러 = N원) 바꾸기. 달러로 기록한 옷의 가격 정렬·합계가 이 값으로 계산된다(app_settings, 마이그레이션 18). */
export async function setUsdRate(value: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser();
  if (!admin) return fail("관리자만 할 수 있습니다.");
  const parsed = usdRateSchema.safeParse(value);
  if (!parsed.success) return fail("환율은 0보다 큰 숫자로 입력해 주세요.");
  const db = createSupabaseAdminClient();
  if (!db) return fail("서버에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  const rate = Math.round(parsed.data * 100) / 100;
  const { error } = await db
    .from("app_settings")
    .upsert({ key: "usd_krw", value: rate, updated_by: admin.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("[admin] usd rate", error.code ?? error.message);
    return fail("환율을 저장하지 못했습니다.");
  }
  await logAdminAction(db, admin.id, "set_usd_rate");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 암호화 전에 평문으로 저장된 신체치수를 모두 암호화 칸(values_enc)으로 옮기고 평문 칸을 비운다(1.2.6, 한 번만).
 * 끝나면 마이그레이션 19로 평문 칸을 지운다. 관리자가 치수 값을 보는 일은 없다(서버 안에서만 옮긴다).
 */
export async function encryptLegacyBodyProfiles(): Promise<AdminActionResult & { converted?: number }> {
  const admin = await getAdminUser();
  if (!admin) return fail("관리자만 할 수 있습니다.");
  const db = createSupabaseAdminClient();
  if (!db) return fail("서버에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  const { data: rows, error } = await db.from("body_profiles").select("*").is("values_enc", null);
  if (error) {
    console.error("[admin] body legacy read", error.code ?? error.message);
    return fail("내 치수 기록을 읽지 못했습니다.");
  }
  let converted = 0;
  for (const row of rows) {
    let valuesEnc: string;
    try {
      valuesEnc = encryptBodyValues(legacyValues(row));
    } catch {
      return fail("서버에 BODY_ENCRYPTION_KEY가 설정되지 않았습니다.");
    }
    const { error: updateError } = await db
      .from("body_profiles")
      .update({ values_enc: valuesEnc, ...clearLegacyColumns(row) })
      .eq("user_id", row.user_id)
      .is("values_enc", null);
    if (updateError) {
      console.error("[admin] body encrypt", updateError.code ?? updateError.message);
      return fail(`${converted}건을 바꾼 뒤 멈췄습니다. 다시 눌러 주세요.`);
    }
    converted++;
  }
  await logAdminAction(db, admin.id, "encrypt_body");
  revalidatePath("/admin");
  return { ok: true, converted };
}

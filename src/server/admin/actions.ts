"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteAccountAndData } from "@/server/account/delete";
import { logAdminAction } from "./audit";
import { getAdminUser } from "./guard";

/**
 * 관리자 사용자 관리. 모든 action이 관리자 여부를 다시 확인한다(화면의 버튼은 보호가 아니다).
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

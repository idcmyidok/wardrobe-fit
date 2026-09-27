import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GARMENT_IMAGE_BUCKET } from "@/lib/images/upload-garment-image";
import type { Database } from "@/lib/supabase/database.types";

/**
 * 계정과 옷·기록·사진을 모두 지운다(service role 클라이언트). 테이블은 FK cascade로 지워지고,
 * 사진은 먼저 Storage에서 지운다. 실패하면 사용자에게 보여 줄 문장을, 성공하면 null을 돌려준다.
 * 관리자 삭제와 본인 탈퇴가 함께 쓴다.
 */
export async function deleteAccountAndData(db: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const storage = db.storage.from(GARMENT_IMAGE_BUCKET);
  const { data: dirs, error: listError } = await storage.list(userId, { limit: 1000 });
  if (listError) {
    console.error("[account] list photos", listError.message);
    return "사진을 지우지 못해 삭제를 멈췄습니다.";
  }
  for (const dir of dirs ?? []) {
    const { data: files } = await storage.list(`${userId}/${dir.name}`, { limit: 1000 });
    if (!files?.length) continue;
    const { error } = await storage.remove(files.map((f) => `${userId}/${dir.name}/${f.name}`));
    if (error) {
      console.error("[account] remove photos", error.message);
      return "사진을 지우지 못해 삭제를 멈췄습니다.";
    }
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[account] delete user", error.message);
    return "계정을 지우지 못했습니다.";
  }
  return null;
}

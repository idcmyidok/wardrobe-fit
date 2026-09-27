"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv, type SupabasePublicEnv } from "./config";

/**
 * 브라우저용 Supabase client. 사진 업로드처럼 브라우저에서 바로 해야 하는 일에만 쓴다. 미리보기 모드면 null.
 * `serverEnv`는 서버가 실행 중에 읽어 넘겨준 값이다(빌드 때 값이 박히지 않은 배포 대비).
 */
export function createSupabaseBrowserClient(serverEnv?: SupabasePublicEnv | null) {
  const env = getSupabaseEnv() ?? serverEnv ?? null;
  return env ? createBrowserClient<Database>(env.url, env.key) : null;
}

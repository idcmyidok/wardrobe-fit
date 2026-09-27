"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./config";

/** 브라우저용 Supabase client. 사진 업로드처럼 브라우저에서 바로 해야 하는 일에만 쓴다. 미리보기 모드면 null. */
export function createSupabaseBrowserClient() {
  const env = getSupabaseEnv();
  return env ? createBrowserClient<Database>(env.url, env.key) : null;
}

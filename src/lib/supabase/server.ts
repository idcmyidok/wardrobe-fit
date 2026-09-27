import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv, readRemember, REMEMBER_COOKIE, withRemember } from "./config";

/**
 * Server Component / Server Action / Route Handler용 Supabase client. 요청마다 새로 만든다.
 * 키가 없으면 null을 돌려준다(미리보기 모드).
 */
export async function createSupabaseServerClient(options: { remember?: boolean } = {}) {
  const env = getSupabaseEnv();
  if (!env) return null;

  const store = await cookies();
  const remember = options.remember ?? readRemember(store.get(REMEMBER_COOKIE)?.value);

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            store.set(name, value, withRemember(cookieOptions, remember));
          }
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡는다.
        }
      },
    },
  });
}

/**
 * 현재 로그인한 사용자. Supabase Auth 서버에 토큰을 확인하므로 권한 판단에 쓸 수 있다.
 * 미리보기 모드이거나 로그인하지 않았으면 null.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

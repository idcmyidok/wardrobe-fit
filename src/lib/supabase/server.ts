import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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
  return getActiveUser(supabase);
}

/**
 * 토큰을 확인한 사용자. 관리자가 정지한 계정이면 null로 본다.
 * 정지하면 새 로그인과 토큰 갱신은 Supabase가 막지만, 이미 받은 토큰은 만료(최대 1시간)까지 남기 때문이다.
 */
export async function getActiveUser(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.auth.getUser();
  return data.user && !isBanned(data.user) ? data.user : null;
}

export function isBanned(user: Pick<User, "banned_until">, now = Date.now()) {
  return Boolean(user.banned_until && Date.parse(user.banned_until) > now);
}

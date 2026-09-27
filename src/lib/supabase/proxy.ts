import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isProtectedPath, readRemember, REMEMBER_COOKIE, withRemember } from "./config";

/**
 * 요청마다 세션을 갱신하고, 로그인 여부에 따라 이동시킨다.
 * UX용 보호일 뿐 보안 경계가 아니다. 서버 코드는 getUser()로 다시 확인하고 최종 권한은 RLS가 판단한다.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  const remember = readRemember(request.cookies.get(REMEMBER_COOKIE)?.value);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, withRemember(options, remember));
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // 이 호출 전에 다른 코드를 넣지 않는다. 토큰 갱신이 여기서 일어난다.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  if (signedIn && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/wardrobe";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** 갱신된 세션 쿠키를 잃지 않도록 redirect 응답에 옮겨 담는다. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}

import type { CookieOptions } from "@supabase/ssr";

/**
 * Supabase 연결 값. 두 값이 모두 있어야 인증이 켜진다.
 * 값이 없으면(키를 넣기 전 미리보기 배포) 인증 없이 목업 화면만 둘러볼 수 있다.
 * NEXT_PUBLIC_* 값은 빌드 때 번들에 들어가므로 반드시 속성 이름을 그대로 적는다.
 */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/**
 * 대시보드에서 "https://xxx.supabase.co/rest/v1/"처럼 경로까지 복사해 넣어도 동작하도록
 * 프로젝트 주소(origin)만 남긴다. 주소 형식이 아니면 그대로 둔다.
 */
export function normalizeSupabaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

export function isAuthConfigured() {
  return getSupabaseEnv() !== null;
}

/** "로그인 상태 유지" 선택값. 1이면 30일 유지, 0이면 브라우저를 닫을 때 로그아웃. */
export const REMEMBER_COOKIE = "wf_remember";
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

/** 쿠키가 없으면(가입 인증 링크로 들어온 경우 등) 상태 유지로 본다. 로그인 폼의 기본값과 같다. */
export function readRemember(value: string | undefined) {
  return value !== "0";
}

/**
 * Supabase가 쓰는 세션 쿠키 옵션을 "상태 유지" 선택에 맞춘다.
 * 삭제용 쿠키(maxAge 0)는 그대로 둬야 로그아웃이 된다.
 */
export function withRemember(options: CookieOptions, remember: boolean): CookieOptions {
  if (options.maxAge === 0) return options;
  if (remember) return { ...options, maxAge: REMEMBER_MAX_AGE };
  // maxAge와 expires를 모두 빼면 브라우저 세션 쿠키가 된다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...rest } = options;
  return rest;
}

/** 로그인 후 돌아갈 경로. 같은 사이트 안의 경로만 허용해 open redirect를 막는다. */
export function safeNextPath(value: unknown, fallback = "/wardrobe"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

/** 로그인해야 들어갈 수 있는 경로. `(app)` 그룹과 비밀번호 변경 화면. */
const PROTECTED_PREFIXES = ["/wardrobe", "/fit-check", "/analysis", "/settings", "/auth/update-password"];

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

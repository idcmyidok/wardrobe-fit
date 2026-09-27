import { NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // API는 자체 헤더(이미지 프록시의 sandbox CSP 등)를 쓴다.
  if (request.nextUrl.pathname.startsWith("/api/")) return updateSession(request);

  // 페이지: nonce를 만들어 요청 헤더로 넘기면 Next.js가 자기 스크립트에 붙이고, 응답에도 같은 CSP를 건다.
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    supabaseOrigin: getSupabaseEnv()?.url ?? null,
    isDev: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = await updateSession(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // 정적 파일과 이미지는 세션 확인이 필요 없다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)"],
};

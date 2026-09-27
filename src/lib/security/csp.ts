/**
 * Content-Security-Policy(PROJECT_SPEC.md 19장 XSS). 스크립트는 요청마다 만든 nonce가 붙은 것만 실행한다.
 * 이미지·연결은 자기 자신과 Supabase(사진 signed URL, 브라우저의 Storage 업로드·인증)만 허용한다.
 * 스타일은 style 속성(색 칩, 진행 막대 폭)을 쓰므로 inline을 허용한다. 스크립트보다 위험이 작다.
 */
export function buildCsp({ nonce, supabaseOrigin, isDev }: { nonce: string; supabaseOrigin: string | null; isDev: boolean }) {
  const supabase = supabaseOrigin ?? "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabase}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (supabaseOrigin?.startsWith("https:")) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function createNonce() {
  return btoa(crypto.randomUUID());
}

"use client";

/** 최상위 레이아웃까지 실패한 경우. 전역 스타일이 없으므로 최소한의 인라인 스타일만 쓴다. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "64px 16px", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
        <title>오류 · Wardrobe Fit</title>
        <h1 style={{ fontSize: 20 }}>화면을 불러오지 못했습니다</h1>
        <p>잠시 뒤 다시 시도해 주세요.</p>
        <button type="button" onClick={retry} style={{ padding: "8px 16px", border: "1px solid currentColor", background: "none", cursor: "pointer" }}>
          다시 시도
        </button>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>오류 번호 {error.digest}</p>}
      </body>
    </html>
  );
}

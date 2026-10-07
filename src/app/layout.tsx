import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@/styles/globals.css";

/** 아이폰 노치·다이내믹 아일랜드·홈 바 자리를 화면에서 직접 비켜 가려고 화면 전체를 쓰고 safe-area로 여백을 둔다. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // 주소창·상태 표시줄 색을 화면 배경과 맞춘다(라이트 #f5f5f7, 다크 #000).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  title: "Wardrobe Fit",
  description: "입어본 옷의 실측과 후기로 새 옷의 핏을 미리 가늠합니다.",
  // Google Search Console 소유 확인(wardrobe-fit-self.vercel.app). 공개 값이다.
  verification: { google: "XK2bc7uiJdurI4mSAsZ4ODid3FRRSZG0B1VIx1GrV-g" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // proxy가 만든 CSP nonce. 테마 스크립트도 이 nonce가 있어야 실행된다.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // data-theme은 아래 스크립트가 hydration 전에 채운다.
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

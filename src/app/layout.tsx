import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@/styles/globals.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

/** 서비스 이름, 옷장 개수 같은 디스플레이 숫자·제목 전용 */
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-serif",
});

/** 표 헤더, 실측·가격·날짜 같은 숫자 데이터 전용 */
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Wardrobe Fit",
  description: "입어본 옷의 실측과 후기로 새 옷의 핏을 미리 가늠합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme은 아래 스크립트가 hydration 전에 채운다.
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${pretendard.variable} ${instrumentSerif.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

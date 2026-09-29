import localFont from "next/font/local";

/** AI 옷장 분석 전용 글꼴(D2Coding, OFL). 이 메뉴에 들어올 때만 불러온다. 한글 서브셋에 없는 글자는 Pretendard로 보인다. */
const d2coding = localFont({
  src: [
    { path: "./fonts/d2coding-subset.woff2", weight: "400" },
    { path: "./fonts/d2coding-bold-subset.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--font-d2coding",
  preload: false,
});

export default function RoastLayout({ children }: { children: React.ReactNode }) {
  return <div className={`roast ${d2coding.variable}`}>{children}</div>;
}

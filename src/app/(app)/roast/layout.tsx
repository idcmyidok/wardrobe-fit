/** 훈수 화면 묶음. 글꼴은 사이트 기본(Pretendard)이고, 대화 모양은 roast.css의 .roast 아래에만 건다. */
export default function RoastLayout({ children }: { children: React.ReactNode }) {
  return <div className="roast">{children}</div>;
}

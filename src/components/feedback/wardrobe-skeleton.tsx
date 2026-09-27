/** 옷장 로딩: 표 머리는 그대로 두고 행 8개 자리만 보여 준다(PROJECT_SPEC.md 20장). */
export function WardrobeSkeleton() {
  return (
    <main aria-busy="true" aria-label="옷장을 불러오는 중" className="mx-auto max-w-400 px-[clamp(16px,3vw,32px)] pt-7 pb-12">
      <div className="flex items-end justify-between gap-4 border-b border-text pb-4">
        <div className="skeleton h-10 w-40 rounded-sm" />
        <div className="skeleton h-10 w-28 rounded-sm" />
      </div>
      <div className="mt-6 border-t border-text">
        <div className="grid grid-cols-[80px_1fr_1fr_120px] gap-4 border-b border-neutral-300 py-2 text-xs text-neutral-700">
          <span>사진</span>
          <span>브랜드</span>
          <span>제품명</span>
          <span>사이즈</span>
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="grid grid-cols-[80px_1fr_1fr_120px] items-center gap-4 border-b border-neutral-300 py-3">
            <div className="skeleton h-16 w-16" />
            <div className="skeleton h-4 w-3/5 rounded-sm" />
            <div className="skeleton h-4 w-4/5 rounded-sm" />
            <div className="skeleton h-4 w-10 rounded-sm" />
          </div>
        ))}
      </div>
    </main>
  );
}

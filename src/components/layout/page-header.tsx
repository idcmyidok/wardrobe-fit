/**
 * 페이지 제목 줄. count가 있으면 시안처럼 세리프 숫자를 제목 앞에 크게 둔다.
 * 아래는 잉크색 1px 선으로 본문과 구분한다.
 */
export function PageHeader({
  title,
  count,
  meta,
  actions,
}: {
  title: string;
  count?: number;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-text pb-4">
      <div className="flex items-end gap-3">
        {count != null && (
          <span aria-hidden className="font-display text-count text-text tabular-nums">
            {count}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl text-text">{title}</h1>
          {meta && <span className="font-mono text-xs text-text-muted tabular-nums">{meta}</span>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

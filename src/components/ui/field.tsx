/** 라벨(위) + 입력 + 도움말/오류(아래) 묶음. 라벨 오른쪽에 링크나 출처 태그를 둘 수 있다. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  action,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  help?: string;
  error?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `field ${className}` : "field"}>
      <label htmlFor={htmlFor} className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {action}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-negative">{error}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-neutral-700">{help}</p>
      ) : null}
    </div>
  );
}

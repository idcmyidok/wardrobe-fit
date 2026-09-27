/** 라벨(위) + 입력 + 도움말/오류(아래) 묶음 */
export function Field({
  label,
  htmlFor,
  help,
  error,
  action,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-text">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-negative">{error}</p>
      ) : help ? (
        <p className="text-xs text-text-muted">{help}</p>
      ) : null}
    </div>
  );
}

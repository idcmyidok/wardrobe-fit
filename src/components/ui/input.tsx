import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn("input", className)} {...props} />;
}

/** 입력칸 오른쪽 안에 단위(cm, 원)를 붙인다. 숫자는 오른쪽 정렬 + 고정폭 글꼴 */
export function UnitInput({ unit, className, ...props }: InputProps & { unit: string }) {
  return (
    <div className="relative">
      <input className={cn("input pr-9 text-right font-mono tabular-nums", className)} {...props} />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-neutral-700">
        {unit}
      </span>
    </div>
  );
}

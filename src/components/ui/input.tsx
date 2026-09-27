import { cn } from "@/lib/cn";

type ControlSize = "sm" | "md";

const controlSizes: Record<ControlSize, string> = {
  sm: "h-8 text-sm",
  md: "h-10 text-base",
};

/** active: 값이 선택된 필터처럼 강조가 필요한 상태 */
export function inputClassName(size: ControlSize = "md", active = false) {
  return cn(
    "w-full rounded-sm border bg-surface px-3 transition-colors focus:border-accent focus:outline-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/25",
    active ? "border-accent text-accent" : "border-border text-text hover:border-text-subtle",
    controlSizes[size],
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: ControlSize };

export function Input({ className, size, ...props }: InputProps) {
  return <input className={cn(inputClassName(size), className)} {...props} />;
}

import { cn } from "@/lib/cn";

type ControlSize = "sm" | "md";

const controlSizes: Record<ControlSize, string> = {
  sm: "h-8 text-sm",
  md: "h-9 text-base",
};

/** active: 값이 선택된 필터처럼 강조가 필요한 상태 */
export function inputClassName(size: ControlSize = "md", active = false) {
  return cn(
    "w-full rounded-md border bg-surface px-3 transition-colors focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-focus-ring",
    active ? "border-accent text-accent" : "border-border-strong text-text hover:border-text-subtle",
    controlSizes[size],
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: ControlSize };

export function Input({ className, size, ...props }: InputProps) {
  return <input className={cn(inputClassName(size), className)} {...props} />;
}

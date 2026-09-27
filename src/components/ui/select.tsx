import { cn } from "@/lib/cn";
import { inputClassName } from "./input";

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: "sm" | "md";
  active?: boolean;
  /** 폭 등 바깥 wrapper에 줄 class */
  containerClassName?: string;
};

/**
 * 네이티브 select 기반. 다중 선택·검색이 필요한 필터는 6단계에서 Popover 기반으로 교체한다.
 */
export function Select({ className, containerClassName, size, active, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <select className={cn(inputClassName(size, active), "appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-text-muted"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm bg-surface-muted px-1.5 text-xs text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

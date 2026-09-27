import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

/** Primary는 잉크(본문색) 배경. 페이지당 1개만 쓴다. */
const variants: Record<Variant, string> = {
  primary: "bg-text text-bg hover:bg-text/85 active:bg-text/75",
  secondary: "border border-border-strong bg-transparent text-text hover:border-text-subtle hover:bg-surface-muted",
  ghost:
    "text-text underline decoration-border-strong underline-offset-4 hover:bg-surface-muted hover:decoration-text",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-11 px-4 text-base",
};

export function buttonClassName({ variant = "secondary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cn(base, variants[variant], sizes[size]);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClassName({ variant, size }), className)} {...props} />;
}

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "plain";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  plain: "",
};

/** 시안 기준 높이: sm 32 / md 40 / lg 44. Primary는 페이지당 1개. */
const sizes: Record<Size, string> = {
  sm: "min-h-8 px-3 text-sm",
  md: "min-h-10",
  lg: "min-h-11",
};

export function buttonClassName({ variant = "secondary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cn("btn", variants[variant], sizes[size]);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClassName({ variant, size }), className)} {...props} />;
}

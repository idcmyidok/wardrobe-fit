import { cn } from "@/lib/cn";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: React.ReactNode };

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-center gap-2 text-base text-text", className)}>
      <input id={id} type="checkbox" className="size-4 rounded-sm accent-accent" {...props} />
      {label}
    </label>
  );
}

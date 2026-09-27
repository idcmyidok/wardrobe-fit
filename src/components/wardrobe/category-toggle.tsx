import { CATEGORIES } from "@/lib/constants/categories";
import { cn } from "@/lib/cn";
import type { CategoryId } from "@/lib/types/domain";

/** 대분류 다중 선택 토글. 최소 1개는 선택된 상태를 유지한다. */
export function CategoryToggle({
  value,
  onChange,
}: {
  value: CategoryId[];
  onChange: (next: CategoryId[]) => void;
}) {
  return (
    <div role="group" aria-label="대분류" className="inline-flex h-9 rounded-md border border-border-strong bg-surface">
      {CATEGORIES.map((category, index) => {
        const selected = value.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (selected && value.length === 1) return;
              onChange(selected ? value.filter((id) => id !== category.id) : [...value, category.id]);
            }}
            className={cn(
              "px-3.5 text-base transition-colors",
              index > 0 && "border-l border-border-strong",
              index === 0 && "rounded-l-md",
              index === CATEGORIES.length - 1 && "rounded-r-md",
              selected ? "bg-accent-subtle font-medium text-accent" : "text-text-muted hover:bg-surface-muted",
            )}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

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
    <div role="group" aria-label="대분류" className="inline-flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
      {CATEGORIES.map((category) => {
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
              "h-9 cursor-pointer rounded-sm px-4 text-base transition-colors",
              selected ? "bg-text font-medium text-bg" : "text-text-muted hover:bg-surface-muted hover:text-text",
            )}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

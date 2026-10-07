"use client";

import { cn } from "@/lib/cn";
import type { Currency } from "@/lib/format/price";
import { UnitInput } from "./input";

/**
 * 가격 입력 + 통화 전환(원 | $). 기본은 원이고, $를 누르면 달러(센트까지)로 적는다.
 * 값은 입력 칸 문자열 그대로 다루고, 저장할 때 parsePriceInput으로 바꾼다.
 */
export function PriceInput({
  id,
  value,
  currency,
  onChange,
  onCurrencyChange,
  className,
  ...aria
}: {
  id: string;
  value: string;
  currency: Currency;
  onChange: (value: string) => void;
  onCurrencyChange: (currency: Currency) => void;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="min-w-0 flex-1">
        <UnitInput
          id={id}
          unit={currency === "USD" ? "$" : "원"}
          inputMode={currency === "USD" ? "decimal" : "numeric"}
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      </div>
      <div className="inline-flex shrink-0 border border-border" role="group" aria-label="통화">
        {(["KRW", "USD"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={currency === c}
            onClick={() => onCurrencyChange(c)}
            className={cn(
              "min-w-9 cursor-pointer px-2 text-sm",
              currency === c ? "bg-text text-bg" : "text-neutral-700 hover:bg-neutral-100 hover:text-text",
            )}
          >
            {c === "USD" ? "$" : "원"}
          </button>
        ))}
      </div>
    </div>
  );
}

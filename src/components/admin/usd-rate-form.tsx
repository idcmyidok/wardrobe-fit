"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { UnitInput } from "@/components/ui/input";
import { setUsdRate } from "@/server/admin/actions";

/** 달러 환율 바꾸기. 달러로 기록한 옷의 가격 정렬·옷장 분석 금액이 이 값으로 계산된다. */
export function UsdRateForm({ current }: { current: number }) {
  const [value, setValue] = useState(String(current));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed = Number(value.replace(/,/g, ""));
  const changed = Number.isFinite(parsed) && parsed !== current;

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await setUsdRate(parsed);
      setMessage(result.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: result.error });
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="field">
          <label htmlFor="admin-usd-rate" className="text-sm">
            1달러
          </label>
          <UnitInput id="admin-usd-rate" unit="원" inputMode="decimal" className="w-36" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button size="sm" disabled={pending || !changed} onClick={save}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
      <p className="text-sm text-neutral-700">달러로 기록한 옷의 가격 정렬, 원 환산 표시, 옷장 분석 금액에 쓰입니다. 자동으로 바뀌지 않습니다.</p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-neutral-700" : "text-sm text-negative"}>
          {message.text}
        </p>
      )}
    </div>
  );
}

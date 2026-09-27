"use client";

import { useEffect, useState } from "react";
import { USAGE_CHANGED_EVENT, type Usage } from "@/lib/usage";

/**
 * 하루(최근 24시간) 한도와 지금까지 쓴 횟수. 로그인하지 않은 미리보기에서는 보이지 않는다.
 * kind="import": 링크 분석, kind="fit": 링크 분석 + 구매 판단 + AI 요약.
 */
export function UsageNote({ kind, className }: { kind: "import" | "fit"; className?: string }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        if (res.ok && alive) setUsage((await res.json()) as Usage);
      } catch {
        // 안내일 뿐이라 실패해도 조용히 넘어간다.
      }
    };
    void load();
    window.addEventListener(USAGE_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(USAGE_CHANGED_EVENT, load);
    };
  }, []);

  if (!usage) return null;
  const line = (label: string, u: { used: number; limit: number }) => (
    <span className={u.used >= u.limit ? "text-accent-700" : undefined}>
      {label} <span className="font-mono tabular-nums">{Math.min(u.used, u.limit)}/{u.limit}</span>회
    </span>
  );
  return (
    <p className={`flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-700 ${className ?? ""}`}>
      <span>오늘 사용량(24시간 기준)</span>
      {line("링크 분석", usage.imports)}
      {kind === "fit" && line("구매 판단", usage.fits)}
      {kind === "fit" && line("AI 요약", usage.ai)}
    </p>
  );
}

"use client";

import { useEffect, useState } from "react";
import { resetHint, USAGE_CHANGED_EVENT, type Usage, type UsageCounter } from "@/lib/usage";

/**
 * 하루(최근 24시간) 한도와 지금까지 쓴 횟수, 다시 쓸 수 있게 되는 때. 로그인하지 않은 미리보기에서는 보이지 않는다.
 * kind="import": 링크 분석, kind="fit": 링크 분석 + 구매 판단 + AI 요약. 관리자·테스터 계정은 "한도 없음"만 보인다.
 */
export function UsageNote({ kind, className }: { kind: "import" | "fit"; className?: string }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        if (res.ok && alive) {
          setUsage((await res.json()) as Usage);
          setNow(Date.now());
        }
      } catch {
        // 안내일 뿐이라 실패해도 조용히 넘어간다.
      }
    };
    void load();
    // 남은 시간은 1분마다 다시 계산한다.
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener(USAGE_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(USAGE_CHANGED_EVENT, load);
    };
  }, []);

  if (!usage) return null;
  const base = `flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-700 ${className ?? ""}`;
  if (usage.unlimited)
    return <p className={base}>{usage.unlimitedReason === "tester" ? "테스터 계정이라 사용 한도가 없습니다." : "관리자 계정이라 사용 한도가 없습니다."}</p>;

  const line = (label: string, u: UsageCounter) => {
    const hint = resetHint(u, now);
    return (
      <span className={u.used >= u.limit ? "text-accent-700" : undefined}>
        {label}{" "}
        <span className="font-mono tabular-nums">
          {Math.min(u.used, u.limit)}/{u.limit}
        </span>
        회{hint && <span className="text-neutral-600"> ({hint})</span>}
      </span>
    );
  };
  return (
    <p className={base}>
      <span>오늘 사용량(24시간 기준)</span>
      {line("링크 분석", usage.imports)}
      {kind === "fit" && line("구매 판단", usage.fits)}
      {kind === "fit" && line("AI 요약", usage.ai)}
    </p>
  );
}

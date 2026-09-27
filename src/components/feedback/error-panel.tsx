"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";

/** 화면을 그리다 실패했을 때의 안내. 기술 상세는 "자세히"로 접는다(PROJECT_SPEC.md 20장 원칙). */
export function ErrorPanel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [open, setOpen] = useState(false);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <main className="mx-auto flex max-w-140 flex-col items-start gap-3 px-4 py-16">
      <span className="tag tag-accent">오류</span>
      <h1 className="text-lg font-semibold">{offline ? "연결이 불안정합니다" : "화면을 불러오지 못했습니다"}</h1>
      <p className="text-base text-pretty text-neutral-700">
        {offline ? "인터넷 연결을 확인한 뒤 다시 시도해 주세요." : "잠시 뒤 다시 시도해 주세요. 계속되면 내 옷장으로 돌아가 주세요."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClassName({ variant: "primary" })} onClick={retry}>
          다시 시도
        </button>
        <Link href="/wardrobe" className={buttonClassName({ variant: "secondary" })}>
          내 옷장으로
        </Link>
        {error.digest && (
          <button type="button" className={buttonClassName({ variant: "ghost" })} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "자세히 닫기" : "자세히"}
          </button>
        )}
      </div>
      {open && <div className="font-mono text-xs text-neutral-700">오류 번호 {error.digest}</div>}
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** 사용자 메뉴. 3단계(인증)에서 실제 계정 정보와 로그아웃을 연결한다. */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-secondary font-normal"
      >
        minjun.k
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="elev-md absolute top-[calc(100%+6px)] right-0 z-40 flex w-55 flex-col border border-text bg-bg">
          <div className="border-b border-neutral-300 px-3.5 py-3 text-sm text-neutral-700">minjun.k@gmail.com</div>
          <button type="button" role="menuitem" className="btn justify-start rounded-none px-3.5 py-2.5 font-normal hover:bg-neutral-200">
            계정 설정
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/")}
            className="btn justify-start rounded-none border-t border-t-divider px-3.5 py-2.5 font-normal hover:bg-neutral-200"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

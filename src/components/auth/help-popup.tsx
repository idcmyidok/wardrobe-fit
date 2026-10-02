"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** 제목 위 작은 빨간 밑줄 안내 글씨. 누르면 X 달린 작은 팝업이 열린다. */
export function HelpPopup({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-negative underline underline-offset-2"
      >
        {label}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className="m-auto w-[min(92vw,22rem)] border border-text bg-surface p-5 text-text backdrop:bg-black/40"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="닫기"
          className="absolute right-3 top-2 text-xl leading-none"
        >
          ×
        </button>
        <div className="flex flex-col gap-3 pt-3 text-body text-pretty">{children}</div>
      </dialog>
    </>
  );
}

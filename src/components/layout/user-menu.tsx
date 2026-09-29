"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENT_VERSION, type ReleaseNoteEdits } from "@/lib/release-notes";
import { signOut } from "@/server/auth/actions";
import { ReleaseNotesDialog } from "./release-notes-dialog";
import { ThemeToggle } from "./theme-toggle";

/** 사용자 메뉴. email이 null이면 미리보기 모드라 로그아웃 대신 첫 화면으로 돌아간다. */
export function UserMenu({
  email,
  admin = false,
  releaseNoteEdits = {},
}: {
  email: string | null;
  admin?: boolean;
  releaseNoteEdits?: ReleaseNoteEdits;
}) {
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // 관리자가 저장·되돌린 결과가 창을 닫았다 열어도 남도록 여기서 들고 있는다.
  const [edits, setEdits] = useState(releaseNoteEdits);
  const closeNotes = useCallback(() => setNotesOpen(false), []);
  const ref = useRef<HTMLDivElement>(null);

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

  const itemClass = "btn w-full justify-start rounded-none border-t border-t-divider px-3.5 py-2.5 font-normal hover:bg-neutral-200";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-secondary max-w-40 font-normal"
      >
        <span className="truncate">{email ? email.split("@")[0] : "미리보기"}</span>
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="elev-md absolute top-[calc(100%+6px)] right-0 z-40 flex w-55 flex-col border border-text bg-bg">
          <div className="truncate px-3.5 py-3 text-sm text-neutral-700">{email ?? "로그인하지 않은 미리보기"}</div>
          {/* 좁은 화면에서는 머리글 대신 여기서 화면 모드를 고른다. */}
          <div className="flex items-center justify-between border-t border-t-divider px-3.5 py-2 sm:hidden">
            <span className="text-sm">화면 모드</span>
            <ThemeToggle />
          </div>
          {admin && (
            <Link href="/admin" role="menuitem" className={`${itemClass} no-underline`} onClick={() => setOpen(false)}>
              관리자 페이지
            </Link>
          )}
          {email && (
            <Link href="/settings" role="menuitem" className={`${itemClass} no-underline`} onClick={() => setOpen(false)}>
              계정 설정
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} justify-between`}
            onClick={() => {
              setOpen(false);
              setNotesOpen(true);
            }}
          >
            업데이트 노트
            <span className="font-mono text-xs text-neutral-600 tabular-nums">v{CURRENT_VERSION}</span>
          </button>
          {email ? (
            <form action={signOut}>
              <button type="submit" role="menuitem" className={itemClass}>
                로그아웃
              </button>
            </form>
          ) : (
            <Link href="/" role="menuitem" className={`${itemClass} no-underline`}>
              첫 화면으로
            </Link>
          )}
        </div>
      )}
      {notesOpen && <ReleaseNotesDialog onClose={closeNotes} admin={admin} edits={edits} onEditsChange={setEdits} />}
    </div>
  );
}

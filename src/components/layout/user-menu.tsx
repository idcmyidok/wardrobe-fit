"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CURRENT_VERSION, type ReleaseNoteEdits, type ReleaseNoteImages } from "@/lib/release-notes";
import { signOut } from "@/server/auth/actions";
import { ReleaseNotesDialog } from "./release-notes-dialog";
import { ThemeToggle } from "./theme-toggle";

/** 사용자 메뉴. email이 null이면 미리보기 모드라 로그아웃 대신 첫 화면으로 돌아간다. */
const ITEM_CLASS = "btn w-full justify-start rounded-none border-t border-t-divider px-3.5 py-2.5 font-normal hover:bg-neutral-200/70";

/** 계정 메뉴 안쪽 목록. 컴퓨터 드롭다운과 모바일 펼침 창이 같이 쓴다. */
function MenuBody({
  email,
  admin,
  onClose,
  onNotes,
}: {
  email: string | null;
  admin: boolean;
  onClose: () => void;
  onNotes: () => void;
}) {
  return (
    <>
      <div className="truncate px-3.5 py-3 text-sm text-neutral-700">{email ?? "로그인하지 않은 미리보기"}</div>
      {/* 화면 모드(라이트/다크/기기 설정)는 여기서 고른다. */}
      <div className="flex items-center justify-between border-t border-t-divider px-3.5 py-2">
        <span className="text-sm">화면 모드</span>
        <ThemeToggle />
      </div>
      {admin && (
        <Link href="/admin" role="menuitem" className={`${ITEM_CLASS} no-underline`} onClick={onClose}>
          관리자 페이지
        </Link>
      )}
      {email && (
        <Link href="/settings" role="menuitem" className={`${ITEM_CLASS} no-underline`} onClick={onClose}>
          계정 설정
        </Link>
      )}
      <button
        type="button"
        role="menuitem"
        className={`${ITEM_CLASS} justify-between`}
        onClick={() => {
          onClose();
          onNotes();
        }}
      >
        업데이트 노트
        <span className="font-mono text-xs text-neutral-600 tabular-nums">v{CURRENT_VERSION}</span>
      </button>
      {email ? (
        <form action={signOut}>
          <button type="submit" role="menuitem" className={ITEM_CLASS}>
            로그아웃
          </button>
        </form>
      ) : (
        <Link href="/" role="menuitem" className={`${ITEM_CLASS} no-underline`} onClick={onClose}>
          첫 화면으로
        </Link>
      )}
    </>
  );
}

/**
 * 모바일 동그란 버튼이 보일지 정한다. 아래로 스크롤하면 숨기고, 위로 스크롤하거나 3초 멈추면 다시 보인다.
 * 스크롤마다 화면을 다시 그리지 않게 값이 바뀔 때만 상태를 바꾼다.
 */
function useFabHidden(paused: boolean) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (paused) return;
    let last = window.scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      last = y;
      if (dy > 6 && y > 40) setHidden(true);
      else if (dy < -4) setHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setHidden(false), 3000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [paused]);
  return hidden;
}

/** 모바일: 오른쪽 아래 동그란 버튼이 눌리면 작은 메뉴 창으로 바뀐다. 바깥이나 X를 누르면 닫힌다. */
function MobileAccountButton({
  email,
  admin,
  onNotes,
}: {
  email: string | null;
  admin: boolean;
  onNotes: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // 서버 화면에는 없고 브라우저에서만 그린다(body로 내보내는 창이라서).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const hidden = useFabHidden(open);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!mounted) return null;
  // 머리글의 흐림 효과 안에 있으면 fixed 위치가 틀어지므로 body로 뺀다.
  return createPortal(
    <div className="md:hidden">
      {open && <div className="fab-scrim fixed inset-0 z-50" aria-hidden onClick={close} />}
      <div
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60]"
      >
        {!open && (
          <button
            type="button"
            aria-label="계정 메뉴 열기"
            aria-haspopup="menu"
            data-hidden={hidden}
            onClick={() => setOpen(true)}
            className="fab glass flex size-13 items-center justify-center rounded-full text-text"
          >
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.5 20c1.2-3.6 4-5.2 7.5-5.2s6.3 1.6 7.5 5.2" />
            </svg>
          </button>
        )}
        {open && (
          <div
            role="menu"
            data-closing={closing}
            className="fab-panel menu-pop flex w-[min(17rem,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-lg"
          >
            <div className="flex items-center justify-between pr-1.5">
              <div className="min-w-0 flex-1 truncate px-3.5 py-3 text-sm text-neutral-700">
                {email ?? "로그인하지 않은 미리보기"}
              </div>
              <button type="button" aria-label="닫기" onClick={close} className="btn btn-icon shrink-0">
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <MenuBodyNoHeader email={email} admin={admin} onClose={close} onNotes={onNotes} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** MenuBody에서 첫 줄(이메일)만 뺀 목록. 모바일 창은 이메일 줄에 X 버튼이 같이 있다. */
function MenuBodyNoHeader(props: { email: string | null; admin: boolean; onClose: () => void; onNotes: () => void }) {
  return (
    <div className="contents [&>div:first-child]:hidden">
      <MenuBody {...props} />
    </div>
  );
}

/** 사용자 메뉴. email이 null이면 미리보기 모드라 로그아웃 대신 첫 화면으로 돌아간다. */
export function UserMenu({
  email,
  admin = false,
  releaseNoteEdits = {},
  releaseNoteImages = {},
}: {
  email: string | null;
  admin?: boolean;
  releaseNoteEdits?: ReleaseNoteEdits;
  releaseNoteImages?: ReleaseNoteImages;
}) {
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // 관리자가 저장·되돌린 결과가 창을 닫았다 열어도 남도록 여기서 들고 있는다.
  const [edits, setEdits] = useState(releaseNoteEdits);
  const [images, setImages] = useState(releaseNoteImages);
  const closeNotes = useCallback(() => setNotesOpen(false), []);
  const openNotes = useCallback(() => setNotesOpen(true), []);
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

  return (
    <>
      <div ref={ref} className="relative hidden md:block">
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
          <div role="menu" className="glass menu-pop absolute top-[calc(100%+8px)] right-0 z-40 flex w-60 flex-col overflow-hidden rounded-lg">
            <MenuBody email={email} admin={admin} onClose={() => setOpen(false)} onNotes={openNotes} />
          </div>
        )}
      </div>
      <MobileAccountButton email={email} admin={admin} onNotes={openNotes} />
      {notesOpen && <ReleaseNotesDialog onClose={closeNotes} admin={admin} edits={edits} onEditsChange={setEdits} images={images} onImagesChange={setImages} />}
    </>
  );
}

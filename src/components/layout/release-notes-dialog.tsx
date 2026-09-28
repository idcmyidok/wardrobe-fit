"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { groupByMajor, type ReleaseFeature, type ReleaseNote } from "@/lib/release-notes";

/**
 * 업데이트 노트 창. 최신 버전이 맨 위, 아래는 스크롤해서 본다.
 * 첫째 자리 버전(1.x, 2.x)이 둘 이상이면 탭으로 나누고 최신 탭을 먼저 연다. Esc·배경·X로 닫는다.
 */
export function ReleaseNotesDialog({ onClose }: { onClose: () => void }) {
  const groups = groupByMajor();
  const [major, setMajor] = useState(groups[0]?.major ?? "");
  const notes = groups.find((g) => g.major === major)?.notes ?? [];
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  const pick = (m: string) => {
    setMajor(m);
    scroller.current?.scrollTo({ top: 0 });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-[var(--overlay)]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notes-title"
        tabIndex={-1}
        className="relative flex max-h-[min(640px,85dvh)] w-[min(480px,100%)] flex-col border border-text bg-bg outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-text px-5 py-3">
          <h2 id="release-notes-title" className="text-body font-semibold">
            업데이트 노트
          </h2>
          <button type="button" className="btn btn-icon" aria-label="닫기" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {groups.length > 1 && (
          <div role="tablist" aria-label="버전" className="flex gap-1.5 border-b border-neutral-300 px-5 py-2">
            {groups.map((g) => (
              <button
                key={g.major}
                type="button"
                role="tab"
                aria-selected={g.major === major}
                onClick={() => pick(g.major)}
                className={cn("btn min-h-8 px-3 py-1 text-sm", g.major === major ? "btn-primary" : "btn-secondary")}
              >
                {g.major}.x
              </button>
            ))}
          </div>
        )}

        <div ref={scroller} className="flex flex-col overflow-y-auto overscroll-contain px-5" data-testid="release-notes">
          {notes.map((note) => (
            <NoteItem key={note.version} note={note} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NoteItem({ note }: { note: ReleaseNote }) {
  const empty = !note.features.length && !note.changes.length && !note.fixes.length;
  return (
    <article className="flex flex-col gap-4 border-b border-neutral-300 py-5 last:border-b-0">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{note.version} 패치노트</h3>
        <time dateTime={note.date} className="font-mono text-sm text-neutral-700 tabular-nums">
          {formatDate(note.date)}
        </time>
      </header>
      {empty && <p className="text-sm text-neutral-700">내용을 준비하고 있어요.</p>}
      <FeatureSection items={note.features} />
      <NoteSection title="변경 내용" items={note.changes} />
      {note.fixes.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">수정사항</h4>
          <ul className="flex flex-col gap-1 text-sm text-neutral-800">
            {note.fixes.map((fix) => (
              <li key={fix}>· {fix}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** 신규 기능: 무엇이 생겼는지 한 줄 + 자세한 설명 */
function FeatureSection({ items }: { items: ReleaseFeature[] }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">신규 기능</h4>
      <ul className="flex flex-col gap-2.5">
        {items.map((f) => (
          <li key={f.title} className="flex flex-col gap-0.5 border-l-2 border-accent pl-3">
            <span className="text-base font-semibold">{f.title}</span>
            <span className="text-sm text-pretty text-neutral-800">{f.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

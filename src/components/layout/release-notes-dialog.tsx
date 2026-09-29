"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import {
  groupByMajor,
  noteToText,
  parseNoteText,
  RELEASE_NOTE_BODY_MAX,
  type ReleaseFeature,
  type ReleaseNote,
  type NoteBlock,
  type ReleaseNoteEdits,
} from "@/lib/release-notes";

const FIXES_TITLE = "수정사항";
import { getReleaseNoteEdits, resetReleaseNoteEdit, saveReleaseNoteEdit } from "@/server/release-notes/actions";

/**
 * 업데이트 노트 창. 최신 버전이 맨 위, 아래는 스크롤해서 본다.
 * 첫째 자리 버전(1.x, 2.x)이 둘 이상이면 탭으로 나누고 최신 탭을 먼저 연다. Esc·배경·X로 닫는다.
 * 관리자에게는 버전마다 "수정" 버튼이 보이고, 자유 글로 고쳐 저장하면 그 글이 코드의 노트 대신 보인다.
 */
export function ReleaseNotesDialog({ onClose, admin = false }: { onClose: () => void; admin?: boolean }) {
  const groups = groupByMajor();
  const [major, setMajor] = useState(groups[0]?.major ?? "");
  const notes = groups.find((g) => g.major === major)?.notes ?? [];
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // 고친 노트를 읽기 전에는 코드의 노트를 먼저 보여 준다.
  const [edits, setEdits] = useState<ReleaseNoteEdits>({});

  useEffect(() => {
    let alive = true;
    getReleaseNoteEdits()
      .then((data) => alive && setEdits(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const applyEdit = (version: string, body: string | null) =>
    setEdits((prev) => {
      const next = { ...prev };
      if (body === null) delete next[version];
      else next[version] = body;
      return next;
    });

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
            <NoteItem key={note.version} note={note} edited={edits[note.version]} admin={admin} onSaved={applyEdit} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NoteItem({
  note,
  edited,
  admin,
  onSaved,
}: {
  note: ReleaseNote;
  edited: string | undefined;
  admin: boolean;
  onSaved: (version: string, body: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = draft !== null;
  const blocks = edited === undefined ? null : parseNoteText(edited);
  const empty = blocks ? !blocks.length : !note.features.length && !note.changes.length && !note.fixes.length;

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, body: string | null) =>
    startTransition(async () => {
      setError(null);
      const result = await action().catch(() => ({ ok: false as const, error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }));
      if (!result.ok) return setError(result.error);
      onSaved(note.version, body);
      setDraft(null);
    });

  return (
    <article className="flex flex-col gap-4 border-b border-neutral-300 py-5 last:border-b-0">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{note.version} 패치노트</h3>
        <div className="flex items-baseline gap-3">
          <time dateTime={note.date} className="font-mono text-sm text-neutral-700 tabular-nums">
            {formatDate(note.date)}
          </time>
          {admin && !editing && (
            <button
              type="button"
              className="btn btn-secondary min-h-8 px-3 py-1 text-sm"
              onClick={() => {
                setError(null);
                setDraft(edited ?? noteToText(note));
              }}
            >
              수정
            </button>
          )}
        </div>
      </header>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="input text-sm leading-relaxed"
            rows={12}
            aria-label={`${note.version} 패치노트 내용`}
            value={draft}
            maxLength={RELEASE_NOTE_BODY_MAX}
            disabled={pending}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Esc는 창을 닫지 않고 수정만 취소한다.
              if (e.key === "Escape") {
                e.stopPropagation();
                setDraft(null);
              }
            }}
          />
          <p className="text-xs text-neutral-700">
            &quot;신규 기능&quot;·&quot;변경 내용&quot;·&quot;수정사항&quot;이나 &quot;# &quot;로 시작하는 줄은 소제목, &quot;- &quot;로 시작하는 줄은 목록이 됩니다.
          </p>
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => saveReleaseNoteEdit(note.version, draft), draft)}>
              {pending ? "저장 중…" : "완료"}
            </button>
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setDraft(null)}>
              취소
            </button>
            {edited !== undefined && (
              <button
                type="button"
                className="btn btn-ghost ml-auto"
                disabled={pending}
                onClick={() => run(() => resetReleaseNoteEdit(note.version), null)}
              >
                원래 노트로 되돌리기
              </button>
            )}
          </div>
        </div>
      ) : blocks ? (
        <>
          {empty && <p className="text-sm text-neutral-700">내용을 준비하고 있어요.</p>}
          <EditedBody blocks={blocks} />
        </>
      ) : (
        <>
          {empty && <p className="text-sm text-neutral-700">내용을 준비하고 있어요.</p>}
          <CodeNoteBody note={note} />
        </>
      )}
    </article>
  );
}

/** 관리자가 고친 글. 소제목마다 묶어 코드 노트와 같은 모양으로 그린다("수정사항"은 접어 둔다). */
function EditedBody({ blocks }: { blocks: NoteBlock[] }) {
  const sections: { title: string | null; blocks: NoteBlock[] }[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") sections.push({ title: b.text, blocks: [] });
    else if (sections.length) sections[sections.length - 1].blocks.push(b);
    else sections.push({ title: null, blocks: [b] });
  }
  return (
    <>
      {sections.map((sec, i) =>
        sec.title === FIXES_TITLE ? (
          <FixesDetails key={i} count={sec.blocks.filter((b) => b.kind === "item").length || sec.blocks.length}>
            <EditedLines blocks={sec.blocks} small />
          </FixesDetails>
        ) : (
          <section key={i} className="flex flex-col gap-1.5">
            {sec.title && <h4 className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">{sec.title}</h4>}
            <EditedLines blocks={sec.blocks} />
          </section>
        ),
      )}
    </>
  );
}

/** 이어진 목록 줄은 한 목록으로, 나머지는 문단으로 */
function EditedLines({ blocks, small = false }: { blocks: NoteBlock[]; small?: boolean }) {
  const groups: { list: boolean; texts: string[] }[] = [];
  for (const b of blocks) {
    const last = groups.at(-1);
    const list = b.kind === "item";
    if (list && last?.list) last.texts.push(b.text);
    else groups.push({ list, texts: [b.text] });
  }
  const size = small ? "text-sm text-neutral-800" : "text-base";
  return groups.map((g, i) =>
    g.list ? (
      <ul key={i} className={cn("flex list-disc flex-col gap-1 pl-5", size)}>
        {g.texts.map((t, j) => (
          <li key={j}>{t}</li>
        ))}
      </ul>
    ) : (
      <p key={i} className={cn("text-pretty", size)}>
        {g.texts[0]}
      </p>
    ),
  );
}

/** 수정사항은 기본으로 접어 두고 눌러서 펼친다. */
function FixesDetails({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <details className="group flex flex-col">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-mono text-xs font-medium tracking-[0.08em] text-neutral-700 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
          <path d="m9 6 6 6-6 6" />
        </svg>
        {FIXES_TITLE} {count > 0 && <span className="tabular-nums">{count}</span>}
      </summary>
      <div className="mt-1.5 flex flex-col gap-1">{children}</div>
    </details>
  );
}

function CodeNoteBody({ note }: { note: ReleaseNote }) {
  return (
    <>
      <FeatureSection items={note.features} />
      <NoteSection title="변경 내용" items={note.changes} />
      {note.fixes.length > 0 && (
        <FixesDetails count={note.fixes.length}>
          <ul className="flex flex-col gap-1 text-sm text-neutral-800">
            {note.fixes.map((fix) => (
              <li key={fix}>· {fix}</li>
            ))}
          </ul>
        </FixesDetails>
      )}
    </>
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

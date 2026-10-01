"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import {
  draftToContent,
  groupByMajor,
  noteToDraft,
  type ReleaseFeature,
  type ReleaseNote,
  type ReleaseNoteContent,
  type ReleaseNoteDraft,
  type ReleaseNoteEdits,
  type ReleaseNoteImages,
  RELEASE_NOTE_IMAGE_BUCKET,
} from "@/lib/release-notes";
import { ImagePrepareError, prepareGarmentImage } from "@/lib/images/prepare-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FIXES_TITLE = "수정사항";
import { removeReleaseNoteImage, resetReleaseNoteEdit, saveReleaseNoteEdit, saveReleaseNoteImage } from "@/server/release-notes/actions";

/**
 * 업데이트 노트 창. 최신 버전이 맨 위, 아래는 스크롤해서 본다.
 * 첫째 자리 버전(1.x, 2.x)이 둘 이상이면 탭으로 나누고 최신 탭을 먼저 연다. Esc·배경·X로 닫는다.
 * 관리자에게는 버전마다 "수정" 버튼이 보이고, 신규 기능·변경 내용·수정사항 칸을 고쳐 저장하면 코드의 노트 대신 보인다.
 */
export function ReleaseNotesDialog({
  onClose,
  admin = false,
  edits,
  onEditsChange,
  images = {},
  onImagesChange,
}: {
  onClose: () => void;
  admin?: boolean;
  /** 서버가 미리 읽어 온 관리자 수정본. 처음 그릴 때부터 이걸로 보여 준다. */
  edits: ReleaseNoteEdits;
  onEditsChange: (edits: ReleaseNoteEdits) => void;
  /** 버전별 사진 주소 */
  images?: ReleaseNoteImages;
  onImagesChange?: (images: ReleaseNoteImages) => void;
}) {
  const groups = groupByMajor();
  const [major, setMajor] = useState(groups[0]?.major ?? "");
  const notes = groups.find((g) => g.major === major)?.notes ?? [];
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const applyEdit = (version: string, body: ReleaseNoteContent | null) => {
    const next = { ...edits };
    if (body === null) delete next[version];
    else next[version] = body;
    onEditsChange(next);
  };

  const applyImage = (version: string, url: string | null) => {
    const next = { ...images };
    if (url === null) delete next[version];
    else next[version] = url;
    onImagesChange?.(next);
  };

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
            <NoteItem key={note.version} note={note} edited={edits[note.version]} image={images[note.version]} admin={admin} onSaved={applyEdit} onImage={applyImage} />
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
  image,
  admin,
  onSaved,
  onImage,
}: {
  note: ReleaseNote;
  edited: ReleaseNoteContent | undefined;
  image: string | undefined;
  admin: boolean;
  onSaved: (version: string, content: ReleaseNoteContent | null) => void;
  onImage: (version: string, url: string | null) => void;
}) {
  const [draft, setDraft] = useState<ReleaseNoteDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown: ReleaseNote = edited ? { ...note, ...edited } : note;
  const empty = !shown.features.length && !shown.changes.length && !shown.fixes.length;

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, content: ReleaseNoteContent | null) =>
    startTransition(async () => {
      setError(null);
      const result = await action().catch(() => ({ ok: false as const, error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }));
      if (!result.ok) return setError(result.error);
      onSaved(note.version, content);
      setDraft(null);
    });

  const save = () => {
    if (!draft) return;
    const content = draftToContent(draft);
    run(() => saveReleaseNoteEdit(note.version, content), content);
  };

  return (
    <article className="flex flex-col gap-4 border-b border-neutral-300 py-5 last:border-b-0">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{note.version} 패치노트</h3>
        <div className="flex items-baseline gap-3">
          <time dateTime={shown.time ? `${shown.date}T${shown.time}+09:00` : shown.date} className="font-mono text-sm text-neutral-700 tabular-nums">
            {formatDate(shown.date)}
            {shown.time && ` ${shown.time}`}
          </time>
          {admin && !draft && (
            <button
              type="button"
              className="btn btn-secondary min-h-8 px-3 py-1 text-sm"
              onClick={() => {
                setError(null);
                setDraft(noteToDraft(shown));
              }}
            >
              수정
            </button>
          )}
        </div>
      </header>
      {draft ? (
        <div
          className="flex flex-col gap-3"
          onKeyDown={(e) => {
            // Esc는 창을 닫지 않고 수정만 취소한다.
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(null);
            }
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              날짜
              <input type="date" className="input" value={draft.date} disabled={pending} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              시각 (한국시간)
              <input type="time" className="input" value={draft.time} disabled={pending} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            </label>
          </div>
          <PhotoField version={note.version} image={image} disabled={pending} onImage={onImage} />
          <DraftField
            label="신규 기능"
            hint="한 줄에 하나씩, 제목: 설명"
            rows={6}
            value={draft.features}
            disabled={pending}
            autoFocus
            onChange={(features) => setDraft({ ...draft, features })}
          />
          <DraftField label="변경 내용" hint="한 줄에 하나씩" rows={5} value={draft.changes} disabled={pending} onChange={(changes) => setDraft({ ...draft, changes })} />
          <DraftField label="수정사항" hint="한 줄에 하나씩" rows={5} value={draft.fixes} disabled={pending} onChange={(fixes) => setDraft({ ...draft, fixes })} />
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
              {pending ? "저장 중…" : "완료"}
            </button>
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setDraft(null)}>
              취소
            </button>
            {edited && (
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
      ) : (
        <>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- 관리자가 올린 공개 사진(이미 줄여서 올린다)
            <img src={image} alt={`${note.version} 업데이트 사진`} loading="lazy" decoding="async" className="h-auto w-full border border-neutral-300" />
          )}
          {empty && <p className="text-sm text-neutral-700">내용을 준비하고 있어요.</p>}
          <CodeNoteBody note={shown} />
        </>
      )}
    </article>
  );
}

/**
 * 노트 사진 한 장. 고르면 브라우저에서 긴 변 1600px WebP(품질 0.8)로 줄여 바로 올리고, 큰 원본은 올리지 않는다.
 * 글 저장("완료")과 따로 저장·삭제한다.
 */
function PhotoField({
  version,
  image,
  disabled,
  onImage,
}: {
  version: string;
  image: string | undefined;
  disabled: boolean;
  onImage: (version: string, url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("no client");
      const { image: prepared } = await prepareGarmentImage(file);
      const path = `${version}/${crypto.randomUUID()}.${prepared.type === "image/webp" ? "webp" : "jpg"}`;
      const up = await supabase.storage.from(RELEASE_NOTE_IMAGE_BUCKET).upload(path, prepared.blob, { contentType: prepared.type, cacheControl: "31536000", upsert: false });
      if (up.error) throw up.error;
      const saved = await saveReleaseNoteImage(version, path);
      if (!saved.ok) setError(saved.error);
      else onImage(version, saved.url);
    } catch (e) {
      setError(
        e instanceof ImagePrepareError
          ? e.code === "too_large"
            ? "사진이 너무 큽니다. 30MB 이하로 골라 주세요."
            : "사진을 읽지 못했습니다. 다른 사진을 골라 주세요."
          : "사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await removeReleaseNoteImage(version).catch(() => ({ ok: false as const, error: "사진을 지우지 못했습니다." }));
    setBusy(false);
    if (!result.ok) setError(result.error);
    else onImage(version, null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">사진</span>
        <span className="text-xs text-neutral-600">한 장 · 큰 사진은 자동으로 줄여 올립니다</span>
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- 관리자가 올린 공개 사진
        <img src={image} alt="" className="h-auto w-full border border-neutral-300" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn("btn btn-secondary min-h-8 cursor-pointer px-3 py-1 text-sm", (busy || disabled) && "pointer-events-none opacity-60")}>
          {busy ? "올리는 중…" : image ? "사진 바꾸기" : "사진 넣기"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy || disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void pick(file);
            }}
          />
        </label>
        {image && (
          <button type="button" className="btn btn-ghost min-h-8 px-3 py-1 text-sm" disabled={busy || disabled} onClick={remove}>
            사진 지우기
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

function DraftField({
  label,
  hint,
  rows,
  value,
  disabled,
  autoFocus,
  onChange,
}: {
  label: string;
  hint: string;
  rows: number;
  value: string;
  disabled: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">{label}</span>
        <span className="text-xs text-neutral-600">{hint}</span>
      </span>
      <textarea
        className="input text-sm leading-relaxed"
        rows={rows}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
        {items.map((f, i) => (
          <li key={i} className="flex flex-col gap-0.5 border-l-2 border-accent pl-3">
            <span className="text-base font-semibold">{f.title}</span>
            {f.description && <span className="text-sm text-pretty text-neutral-800">{f.description}</span>}
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

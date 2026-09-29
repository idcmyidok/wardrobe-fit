"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { resetRoastText, saveRoastText } from "@/server/roast/admin-actions";

export interface EditorField {
  key: string;
  label: string;
  base: string;
  edited: string | null;
}

export interface EditorGroup {
  id: string;
  kind: "common" | "lines" | "questions" | "quiz";
  title: string;
  when: string;
  vars: { key: string; label: string }[];
  fields: EditorField[];
}

const KINDS: { id: EditorGroup["kind"]; label: string }[] = [
  { id: "lines", label: "패턴별 멘트" },
  { id: "questions", label: "질문·반응" },
  { id: "quiz", label: "패션 퀴즈" },
  { id: "common", label: "공통 문구" },
];

const colLabel = "font-mono text-label font-medium tracking-[0.08em] text-neutral-700";

/**
 * 훈수 문장 편집. 묶음(패턴·질문·퀴즈)을 펼치면 문장마다 입력칸이 나오고, 칸별로 저장·되돌리기 한다.
 * {자리}는 그 묶음에서 쓸 수 있는 것만 받는다(서버에서 한 번 더 확인).
 */
export function RoastTextEditor({ groups }: { groups: EditorGroup[] }) {
  const [kind, setKind] = useState<EditorGroup["kind"]>("lines");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.fields.map((f) => [f.key, f.edited]))),
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter(
      (g) =>
        g.kind === kind &&
        (!q ||
          `${g.title} ${g.when}`.toLowerCase().includes(q) ||
          g.fields.some((f) => (edited[f.key] ?? f.base).toLowerCase().includes(q))),
    );
  }, [groups, kind, query, edited]);
  const editedCount = Object.values(edited).filter((v) => v !== null).length;

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <main className="mx-auto max-w-240 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-col gap-1 border-b border-text pb-4">
        <Link href="/admin" className={cn(colLabel, "w-fit uppercase")}>
          ← Admin
        </Link>
        <h1 className="text-title">내 옷장 훈수 문장</h1>
        <p className="text-sm text-pretty text-neutral-700">
          {"{ }"} 안의 자리는 실제 옷장 값으로 바뀝니다. {"{브랜드|을}"}처럼 조사를 붙이면 받침에 맞춰 을·를이 골라집니다. 한 칸에 여러
          문장이 있으면 매번 그중 하나를 씁니다. 새 패턴·질문은 코드로만 추가할 수 있습니다. 고친 문장 {editedCount}개.
        </p>
      </div>

      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-neutral-300 bg-bg py-3">
        <div role="tablist" aria-label="문장 종류" className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button key={k.id} size="sm" role="tab" aria-selected={kind === k.id} variant={kind === k.id ? "primary" : "secondary"} onClick={() => setKind(k.id)}>
              {k.label}
            </Button>
          ))}
        </div>
        <Input type="search" placeholder="문장·패턴 이름으로 찾기" aria-label="문장 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ul className="flex flex-col">
        {shown.map((g) => {
          const isOpen = open.has(g.id) || Boolean(query.trim());
          const changed = g.fields.filter((f) => edited[f.key] !== null).length;
          return (
            <li key={g.id} className="border-b border-neutral-300">
              <button type="button" className="flex w-full items-start justify-between gap-3 py-3 text-left" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-medium">{g.title}</span>
                  {g.when && <span className="text-sm text-neutral-700">{g.when}</span>}
                </span>
                <span className="shrink-0 text-sm text-neutral-700">
                  {changed ? `고침 ${changed} · ` : ""}
                  {g.fields.length}문장 {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-4 pb-5">
                  {g.vars.length > 0 && (
                    <p className="text-sm text-neutral-700">
                      쓸 수 있는 자리: {g.vars.map((v) => `{${v.key}} ${v.label}`).join(" · ")}
                    </p>
                  )}
                  {g.fields.map((f) => (
                    <Field key={f.key} field={f} edited={edited[f.key]} onSaved={(v) => setEdited((e) => ({ ...e, [f.key]: v }))} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="py-8 text-base text-neutral-700">찾는 문장이 없습니다.</li>}
      </ul>
    </main>
  );
}

function Field({ field, edited, onSaved }: { field: EditorField; edited: string | null | undefined; onSaved: (v: string | null) => void }) {
  const current = edited ?? field.base;
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = value.trim() !== current;
  const id = `rt-${field.key}`;

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await saveRoastText(field.key, value);
      if (r.ok) {
        onSaved(value.trim() === field.base ? null : value.trim());
        setMessage({ ok: true, text: "저장했습니다." });
      } else setMessage({ ok: false, text: r.error });
    });
  const reset = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await resetRoastText(field.key);
      if (r.ok) {
        onSaved(null);
        setValue(field.base);
        setMessage({ ok: true, text: "원래 문장으로 돌렸습니다." });
      } else setMessage({ ok: false, text: r.error });
    });

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {edited != null && <span className="ml-2 font-normal text-neutral-700">고침</span>}
      </label>
      <textarea
        id={id}
        rows={Math.min(4, Math.max(1, Math.ceil(value.length / 48)))}
        className="w-full resize-y border border-neutral-400 bg-surface px-3 py-2 text-base leading-relaxed"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {edited != null && <p className="text-sm text-neutral-700">원래 문장: {field.base}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || !dirty} onClick={save}>
          {pending ? "저장 중…" : "저장"}
        </Button>
        {edited != null && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={reset}>
            원래대로
          </Button>
        )}
        {message && (
          <span role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-neutral-700" : "text-sm text-negative"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

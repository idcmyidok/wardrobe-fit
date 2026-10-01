"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { isBubbleKey, joinBubbles, splitSentences } from "@/lib/roast/bubbles";
import { deleteRoastQuiz, saveRoastQuiz, saveRoastUnits } from "@/server/roast/admin-actions";

type UnitValue = string | string[];

export interface EditorUnit {
  key: string;
  kind: "text" | "list" | "number";
  label: string;
  /** DB에 저장된 값(없으면 코드의 처음 문장) */
  value: UnitValue | number;
  /** 코드의 처음 문장. 저장된 값과 다르면 직접 고친 문장으로 표시한다. */
  base: UnitValue | number;
}

const isEdited = (value: EditorUnit["value"], base: EditorUnit["base"]) => JSON.stringify(value) !== JSON.stringify(base);

export interface EditorGroup {
  id: string;
  kind: "screen" | "common" | "lines" | "questions" | "report" | "score" | "layout" | "orders";
  title: string;
  when: string;
  vars: { key: string; label: string }[];
  units: EditorUnit[];
}

export interface QuizValue {
  brand: string;
  answer: number;
  question: string;
  options: string[];
  correct: string[];
  wrong: string[];
}

export interface EditorQuiz {
  id: string;
  builtIn: boolean;
  value: QuizValue;
  deleted: boolean;
}

type Kind = EditorGroup["kind"] | "quiz";
const KINDS: { id: Kind; label: string }[] = [
  { id: "lines", label: "패턴별 멘트" },
  { id: "questions", label: "질문·반응" },
  { id: "quiz", label: "패션 퀴즈" },
  { id: "common", label: "공통 문구" },
  { id: "screen", label: "화면·결과 안내" },
  { id: "report", label: "결과 페이지" },
  { id: "layout", label: "결과 구성" },
  { id: "score", label: "점수" },
  { id: "orders", label: "주문내역 훈수" },
];

type Vars = EditorGroup["vars"];

/** 저장된 {n}, {brand|을}을 편집용 [개수], [브랜드|을]로 보여 준다. */
function toDisplay(text: string, vars: Vars) {
  return text.replace(/\{(\w+)(\|[^{}]+)?\}/g, (m, key: string, p = "") => {
    const v = vars.find((x) => x.key === key);
    return v ? `[${v.label}${p}]` : m;
  });
}

/** 편집용 [개수]를 저장용 {n}으로 바꾼다. 모르는 이름이면 오류. */
function fromDisplay(text: string, vars: Vars): { text: string } | { error: string } {
  const unknown: string[] = [];
  const out = text.replace(/\[([^\[\]|]+)(\|[^\[\]]+)?\]/g, (m, label: string, p = "") => {
    const v = vars.find((x) => x.label === label.trim() || x.key === label.trim());
    if (!v) unknown.push(m);
    return v ? `{${v.key}${p}}` : m;
  });
  return unknown.length ? { error: `모르는 자리입니다: ${unknown.join(", ")}` } : { text: out };
}

/** 값 전체를 화면용으로(문장·목록 모두) */
function mapText<T extends UnitValue>(v: T, f: (s: string) => string): T {
  if (typeof v === "string") return f(v) as T;
  return (v as string[]).map(f) as T;
}

const colLabel = "font-mono text-label font-medium tracking-[0.08em] text-neutral-700";

/**
 * 훈수 문장 편집. 묶음(패턴·질문·공통 문구·퀴즈)을 펼치면 입력칸이 나오고, 고치면 묶음 단위로 바로 저장된다(저장 버튼·기본값 없음).
 * 문장 목록은 항목을 더하거나 뺄 수 있고, 퀴즈는 새로 만들거나 지울 수 있다.
 * {자리}는 그 묶음에서 쓸 수 있는 것만 받는다(서버에서 한 번 더 확인).
 */
export interface LayoutInfo {
  sections: Record<string, { name: string; how: string }>;
  points: Record<string, { name: string; how: string }>;
}

export function RoastTextEditor({ groups, quizzes, brands, layout }: { groups: EditorGroup[]; quizzes: EditorQuiz[]; brands: string[]; layout: LayoutInfo }) {
  const [kind, setKind] = useState<Kind>("lines");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, EditorUnit["value"]>>(() => Object.fromEntries(groups.flatMap((g) => g.units.map((u) => [u.key, u.value]))));
  const [quizList, setQuizList] = useState(quizzes);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.kind === kind &&
          (!q ||
            `${g.title} ${g.when}`.toLowerCase().includes(q) ||
            g.units.some((u) => JSON.stringify(mapText(saved[u.key] as UnitValue, (s) => toDisplay(s, g.vars))).toLowerCase().includes(q))),
      ),
    [groups, kind, q, saved],
  );
  const shownQuizzes = useMemo(
    () => quizList.filter((z) => !q || `${z.id} ${z.value.brand} ${z.value.question} ${z.value.options.join(" ")}`.toLowerCase().includes(q)),
    [quizList, q],
  );

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addQuiz = () => {
    const id = `c-${Math.random().toString(36).slice(2, 10)}`;
    setQuizList((l) => [
      { id, builtIn: false, value: { brand: "", answer: 0, question: "", options: ["", "", "", ""], correct: [""], wrong: [""] }, deleted: false },
      ...l,
    ]);
    setOpen((s) => new Set(s).add(`quiz.${id}`));
  };

  return (
    <main className="mx-auto max-w-240 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-col gap-1 border-b border-text pb-4">
        <Link href="/admin" className={cn(colLabel, "w-fit uppercase")}>
          ← Admin
        </Link>
        <h1 className="text-title">내 패션 훈수 문장</h1>
        <p className="text-sm text-pretty text-neutral-700">
          [개수], [브랜드]처럼 대괄호 안의 자리는 실제 옷장 값으로 바뀝니다. 새로 쓸 때도 같은 이름으로 [개수]처럼 쓰면 됩니다.
          [브랜드|을]처럼 조사를 붙이면 받침에 맞춰 을·를이 골라집니다. 목록은 &quot;문장 추가&quot;로 늘리고 &quot;빼기&quot;로 줄입니다.
          고치면 잠시 뒤 자동으로 저장되고(별도 저장 버튼 없음), 저장된 값이 그대로 사이트에 나옵니다. 새 패턴·질문은 코드로만 추가할 수 있습니다.
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
        <Input type="search" placeholder="문장·패턴·브랜드 이름으로 찾기" aria-label="문장 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {kind === "quiz" ? (
        <>
          <div className="py-3">
            <Button size="sm" onClick={addQuiz}>
              + 새 퀴즈 만들기
            </Button>
          </div>
          <datalist id="roast-brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <ul className="flex flex-col">
            {shownQuizzes.map((z) => {
              const id = `quiz.${z.id}`;
              const isOpen = open.has(id) || Boolean(q);
              return (
                <li key={z.id} className="border-b border-neutral-300">
                  <button type="button" className="flex w-full items-start justify-between gap-3 py-3 text-left" aria-expanded={isOpen} onClick={() => toggle(id)}>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-base font-medium">{z.value.brand || "새 퀴즈"}</span>
                      <span className="text-sm text-neutral-700">
                        {z.value.question || "문제를 써 주세요"}
                        {z.value.options[z.value.answer] ? ` · 정답: ${z.value.answer + 1}번` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-neutral-700">
                      {z.deleted ? "지움 · " : !z.builtIn ? "새 퀴즈 · " : ""}
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen && (
                    <QuizForm
                      quiz={z}
                      onChange={(next) => setQuizList((l) => (next ? l.map((x) => (x.id === z.id ? next : x)) : l.filter((x) => x.id !== z.id)))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
        {kind === "layout" && !q && <LayoutOverview layout={layout} groups={groups} saved={saved} />}
        <ul className="flex flex-col">
          {shown.map((g) => {
            const isOpen = open.has(g.id) || Boolean(q);
            // 접었다 펴도 저장한 문장이 보이도록 화면의 저장값을 칸에 반영한다.
            const units = g.units.map((u) => ({ ...u, value: saved[u.key] ?? u.value }));
            const editedCount = units.filter((u) => isEdited(u.value, u.base)).length;
            return (
              <li key={g.id} className="border-b border-neutral-300">
                <button type="button" className="flex w-full items-start justify-between gap-3 py-3 text-left" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-base font-medium">
                      {g.title}
                      {editedCount > 0 && (
                        <span className="ml-2 text-sm font-normal text-[#800020]">
                          고친 문장 ({editedCount}/{units.length})
                        </span>
                      )}
                    </span>
                    {g.when && <span className="text-sm text-neutral-700">{g.when}</span>}
                  </span>
                  <span className="shrink-0 text-sm text-neutral-700">
                    {g.units.length}칸 {isOpen ? "▲" : "▼"}
                  </span>
                </button>
                {isOpen && <GroupBlock group={{ ...g, units }} onSaved={(items) => setSaved((m) => ({ ...m, ...items }))} />}
              </li>
            );
          })}
          {!shown.length && <li className="py-8 text-base text-neutral-700">찾는 문장이 없습니다.</li>}
        </ul>
        </>
      )}
    </main>
  );
}

/** 결과 페이지가 지금 설정으로 어떤 순서로 나오는지 한눈에 보여 준다(순서·켜기는 아래 칸에서 고친다). */
function LayoutOverview({ layout, groups, saved }: { layout: LayoutInfo; groups: EditorGroup[]; saved: Record<string, EditorUnit["value"]> }) {
  const valueOf = (key: string) => {
    for (const g of groups) for (const u of g.units) if (u.key === key) return Number(saved[key] ?? u.value);
    return undefined;
  };
  const sorted = (names: Record<string, unknown>, orderKey: string) =>
    Object.keys(names)
      .map((k) => ({ k, n: valueOf(`report.layout.${orderKey}.${k}`) ?? 99 }))
      .sort((a, b) => a.n - b.n)
      .map((x) => x.k);
  const on = (showKey: string, k: string) => valueOf(`report.layout.${showKey}.${k}`) !== 0;
  return (
    <section className="flex flex-col gap-2 border-b border-neutral-300 py-4" aria-label="지금 결과 페이지 구성">
      <p className="text-base font-medium">지금 결과 페이지 구성</p>
      <p className="text-sm text-neutral-700">내용 자체는 옷장 패턴과 질문 답으로 자동으로 정해집니다. 여기서는 순서·켜기·개수와 고정 문구만 고칩니다.</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          <b>첫 줄: 점수 구간 문장</b> <span className="text-neutral-700">총점이 속한 10점 구간의 문장(결과 페이지 탭)</span>
        </li>
        {sorted(layout.sections, "order").map((k) => (
          <li key={k} className={on("show", k) ? "" : "text-neutral-500 line-through"}>
            <b>{layout.sections[k].name}</b> <span className="text-neutral-700">{layout.sections[k].how}</span>
            {k === "points" && (
              <ol className="mt-1 flex list-[lower-alpha] flex-col gap-0.5 pl-5">
                {sorted(layout.points, "point_order").map((p) => (
                  <li key={p} className={on("point_show", p) ? "" : "text-neutral-500 line-through"}>
                    {layout.points[p].name} <span className="text-neutral-700">· {layout.points[p].how}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

type Status = { ok: boolean; text: string } | null;
type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * 입력이 바뀌면 잠시(1초) 뒤, 또는 칸을 벗어나는 즉시 저장한다. sig는 입력 전체를 문자열로 만든 것.
 * 저장하는 동안 더 고치면 끝난 뒤 이어서 다시 저장한다. 검사에 걸리면 이유를 보여 주고 저장하지 않는다.
 */
function useAutosave(sig: string, save: () => Promise<SaveResult>, enabled = true) {
  const [savedSig, setSavedSig] = useState(sig);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const latest = useRef({ sig, save, savedSig, enabled });
  useEffect(() => {
    Object.assign(latest.current, { sig, save, enabled });
  });
  const busy = useRef(false);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (latest.current.enabled && latest.current.sig !== latest.current.savedSig) {
        const { sig: s, save: fn } = latest.current;
        setState("saving");
        const r = await fn();
        if (!r.ok) {
          setError(r.error);
          setState("error");
          return;
        }
        latest.current.savedSig = s;
        setSavedSig(s);
        setState("done");
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || sig === savedSig) return;
    const t = setTimeout(run, 1000);
    return () => clearTimeout(t);
  }, [sig, savedSig, enabled, run]);

  const dirty = sig !== savedSig;
  const status: Status =
    state === "saving" ? { ok: true, text: "저장 중…" } : state === "error" && dirty ? { ok: false, text: `저장 전: ${error}` } : dirty ? { ok: true, text: "고치는 중…" } : state === "done" ? { ok: true, text: "저장됨" } : null;
  return { status, flush: run };
}

function Message({ message }: { message: Status }) {
  if (!message) return null;
  return (
    <span role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-neutral-700" : "text-sm text-negative"}>
      {message.text}
    </span>
  );
}

const areaClass = "w-full resize-y border border-neutral-400 bg-surface px-3 py-2 text-base leading-relaxed";
const rowsFor = (s: string) => Math.min(4, Math.max(1, Math.ceil(s.length / 48) + (s.match(/\n/g)?.length ?? 0)));

/** 한 묶음(패턴·질문·공통 문구 하나)의 칸을 모아 한꺼번에 저장한다. */
function GroupBlock({ group, onSaved }: { group: EditorGroup; onSaved: (items: Record<string, EditorUnit["value"]>) => void }) {
  const vars = group.vars;
  const initial = useMemo(
    () => Object.fromEntries(group.units.map((u) => [u.key, u.kind === "number" ? String(u.value) : mapText(u.value as UnitValue, (s) => toDisplay(s, vars))])),
    [group.units, vars],
  );
  const [values, setValues] = useState<Record<string, UnitValue>>(initial);
  const savedUnits = useRef<Record<string, string>>(Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)])));

  const { status, flush } = useAutosave(JSON.stringify(values), async () => {
    const items: { key: string; value: UnitValue | number }[] = [];
    const sent: Record<string, string> = {};
    for (const u of group.units) {
      const v = values[u.key];
      const sig = JSON.stringify(v);
      if (sig === savedUnits.current[u.key]) continue;
      sent[u.key] = sig;
      if (u.kind === "number") {
        items.push({ key: u.key, value: Number(v) });
        continue;
      }
      let error: string | null = null;
      const converted = mapText(v, (x) => {
        const c = fromDisplay(x, vars);
        if ("error" in c) error ??= c.error;
        return "error" in c ? x : c.text;
      });
      if (error) return { ok: false, error: `${u.label}: ${error}` };
      items.push({ key: u.key, value: converted });
    }
    if (!items.length) return { ok: true };
    const r = await saveRoastUnits(items as { key: string; value: UnitValue }[]);
    if (r.ok) {
      Object.assign(savedUnits.current, sent);
      onSaved(Object.fromEntries(items.map((i) => [i.key, i.value])));
    }
    return r;
  });

  return (
    <div className="flex flex-col gap-5 pb-5" onBlur={() => void flush()}>
      {vars.length > 0 && <p className="text-sm text-neutral-700">쓸 수 있는 자리: {vars.map((v) => `[${v.label}]`).join(" ")}</p>}
      {group.units.map((u) => (
        <UnitField key={u.key} unit={u} value={values[u.key]} edited={isEdited(u.value, u.base)} onChange={(v) => setValues((m) => ({ ...m, [u.key]: v }))} />
      ))}
      <div className="min-h-5">
        <Message message={status} />
      </div>
    </div>
  );
}

function UnitField({ unit, value, edited, onChange }: { unit: EditorUnit; value: UnitValue; edited: boolean; onChange: (v: UnitValue) => void }) {
  if (unit.kind === "number")
    return (
      <label className="flex min-w-48 items-center gap-2 text-sm">
        <span className="flex-1">
          {unit.label}
          {edited && <span className="ml-1 text-[#800020]">(직접 수정함)</span>}
        </span>
        <Input type="number" step={1} className="w-20" value={value as string} onChange={(e) => onChange(e.target.value)} aria-label={unit.key.startsWith("report.layout.") ? unit.label : `${unit.label} 점수`} />
      </label>
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">
        {unit.label}
        {edited && <span className="ml-1 font-normal text-[#800020]">(직접 수정함)</span>}
      </legend>
      {unit.kind === "text" ? (
        <textarea aria-label={unit.label} rows={rowsFor(value as string)} className={areaClass} value={value as string} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <ListRows items={value as string[]} onChange={onChange} label={unit.label} bubbles={isBubbleKey(unit.key)} />
      )}
    </fieldset>
  );
}

function ListRows({
  items,
  onChange,
  label,
  answer,
  onAnswer,
  bubbles,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  label: string;
  answer?: number;
  onAnswer?: (i: number) => void;
  /** 대화 말풍선 문장: 줄을 바꾼 곳마다 말풍선이 나뉜다. 나누기·합치기 버튼을 보여 준다. */
  bubbles?: boolean;
}) {
  const setAt = (i: number, v: string) => onChange(items.map((x, k) => (k === i ? v : x)));
  return (
    <div className="flex flex-col gap-2">
      {bubbles && <p className="text-sm text-neutral-700">줄을 바꾼 곳마다 말풍선이 따로 나옵니다.</p>}
      {items.map((s, i) => (
        <div key={i} className="flex items-start gap-2">
          {onAnswer ? (
            <label className="flex min-h-11 shrink-0 items-center gap-1 text-sm">
              <input type="radio" name={`${label}-answer`} checked={answer === i} onChange={() => onAnswer(i)} />
              정답
            </label>
          ) : (
            <span className="min-w-5 pt-2 text-sm text-neutral-700">{i + 1}</span>
          )}
          <textarea
            aria-label={`${label} ${i + 1}`}
            rows={rowsFor(s)}
            className={areaClass}
            value={s}
            onChange={(e) => setAt(i, e.target.value)}
          />
          {bubbles &&
            (s.includes("\n") ? (
              <Button size="sm" variant="ghost" aria-label={`${label} ${i + 1} 한 말풍선으로 합치기`} onClick={() => setAt(i, joinBubbles(s))}>
                합치기
              </Button>
            ) : (
              <Button size="sm" variant="ghost" aria-label={`${label} ${i + 1} 문장마다 나누기`} disabled={splitSentences(s) === s} onClick={() => setAt(i, splitSentences(s))}>
                나누기
              </Button>
            ))}
          <Button size="sm" variant="ghost" aria-label={`${label} ${i + 1} 빼기`} onClick={() => onChange(items.filter((_, k) => k !== i))}>
            빼기
          </Button>
        </div>
      ))}
      <div>
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, ""])}>
          + 문장 추가
        </Button>
      </div>
    </div>
  );
}

function QuizForm({ quiz, onChange }: { quiz: EditorQuiz; onChange: (next: EditorQuiz | null) => void }) {
  const [v, setV] = useState<QuizValue>(quiz.value);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Status>(null);
  const set = <K extends keyof QuizValue>(k: K, value: QuizValue[K]) => setV((x) => ({ ...x, [k]: value }));

  const { status, flush } = useAutosave(
    JSON.stringify(v),
    async () => {
      const r = await saveRoastQuiz(quiz.id, v);
      if (r.ok) onChange({ ...quiz, value: v, deleted: false });
      return r;
    },
    !quiz.deleted,
  );

  const run = (fn: () => Promise<SaveResult>, done: () => void, ok: string) =>
    startTransition(async () => {
      setMessage(null);
      const r = await fn();
      if (r.ok) {
        done();
        setMessage({ ok: true, text: ok });
      } else setMessage({ ok: false, text: r.error });
    });

  const remove = () => {
    if (!window.confirm("이 퀴즈를 지울까요? 지운 퀴즈도 다시 쓰기를 누르면 되살릴 수 있습니다.")) return;
    run(
      () => deleteRoastQuiz(quiz.id),
      () => onChange(quiz.builtIn ? { ...quiz, deleted: true } : null),
      "지웠습니다.",
    );
  };
  const restore = () =>
    run(
      () => saveRoastQuiz(quiz.id, v),
      () => onChange({ ...quiz, value: v, deleted: false }),
      "다시 쓰도록 저장했습니다.",
    );

  const setOptions = (options: string[]) =>
    setV((x) => ({ ...x, options, answer: Math.min(x.answer, Math.max(0, options.length - 1)) }));

  return (
    <div className="flex flex-col gap-4 pb-5" onBlur={() => void flush()}>
      {quiz.deleted && <p className="text-sm text-negative">지운 퀴즈입니다. &quot;다시 쓰기&quot;를 누르면 지금 내용으로 되살아납니다.</p>}
      <label className="flex flex-col gap-1 text-sm font-medium">
        브랜드(이 브랜드 옷이 있을 때만 나옴)
        <Input list="roast-brands" value={v.brand} onChange={(e) => set("brand", e.target.value)} placeholder="예: Stüssy" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        문제
        <textarea rows={rowsFor(v.question)} className={areaClass} value={v.question} onChange={(e) => set("question", e.target.value)} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">선택지(정답을 골라 주세요. 화면에서는 순서를 섞어 보여 줍니다)</legend>
        <ListRows items={v.options} onChange={setOptions} label={`${quiz.id} 선택지`} answer={v.answer} onAnswer={(i) => set("answer", i)} />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">맞혔을 때(하나 고름)</legend>
        <ListRows items={v.correct} onChange={(x) => set("correct", x)} label={`${quiz.id} 맞혔을 때`} bubbles />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">틀렸을 때(하나 고름)</legend>
        <ListRows items={v.wrong} onChange={(x) => set("wrong", x)} label={`${quiz.id} 틀렸을 때`} bubbles />
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        {quiz.deleted ? (
          <Button size="sm" disabled={pending} onClick={restore}>
            다시 쓰기
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={remove}>
            퀴즈 지우기
          </Button>
        )}
        <Message message={message ?? status} />
      </div>
    </div>
  );
}

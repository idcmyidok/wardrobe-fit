"use client";

/* eslint-disable @next/next/no-img-element -- 비공개 저장소의 임시 주소라 next/image 최적화를 쓰지 않는다(다른 화면과 같음). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { UsageNote } from "@/components/usage/usage-note";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { buttonClassName } from "@/components/ui/button";
import { MIN_CLOTHES, ROAST_COPY, tooFew, type RoastCopy } from "@/lib/roast/copy";
import { bubblesOf } from "@/lib/roast/bubbles";
import { wardrobeHash } from "@/lib/roast/hash";
import type { RoastQuestion, RoastResult, RoastScript } from "@/lib/roast/types";
import { notifyUsageChanged } from "@/lib/usage";
import { finishRoast, startRoast } from "@/server/roast/actions";
import "./roast.css";

/**
 * AI 옷장 분석(계획서 3장). 서버가 만든 대화 순서를 한 글자씩 차례로 재생하고, 질문에 답을 받은 뒤 결과 글을 받는다.
 * 진행 상태는 저장하지 않는다(나가면 처음부터). 결과는 로그인하면 서버에, 미리보기 모드면 브라우저에 가장 최근 1개만 둔다.
 */

const PREVIEW_KEY = "wardrobe-fit:roast-result";
const TYPE_MS = 43;

type Msg =
  | { id: number; kind: "ai"; text: string; photos?: string[]; gap?: boolean }
  | { id: number; kind: "status"; text: string }
  | { id: number; kind: "dots" }
  | { id: number; kind: "choices"; q: RoastQuestion; picked: string | null };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewMsg = DistOmit<Msg, "id">;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 소개 문구가 끝난 뒤 다음 말(버튼·이름 묻기)이 나오기까지 쉬는 시간 */
const INTRO_PAUSE_MS = 1100;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 화면 문구(관리자가 고친 문장 포함). */
const CopyContext = createContext<RoastCopy>(ROAST_COPY);

function readPreview(): RoastResult | null {
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as RoastResult) : null;
  } catch {
    return null;
  }
}
function writePreview(r: RoastResult) {
  try {
    window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(r));
  } catch {}
}

/** 2026년 9월 29일(한국 시간) */
const koreanDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));

export function RoastView({ initialResult, copy = ROAST_COPY }: { initialResult: RoastResult | null; copy?: RoastCopy }) {
  const { garments, signedIn } = useWardrobe();
  const clothes = garments.filter((g) => g.categoryId !== "hat" && g.categoryId !== "shoes").length;
  const [result, setResult] = useState<RoastResult | null>(initialResult);
  const [mode, setMode] = useState<"result" | "intro" | "name" | "chat">(initialResult ? "result" : "intro");
  // 이름은 이번 결과에만 쓰고 다음 분석 때 미리 채우지 않는다.
  const [name, setName] = useState<string | null>(null);
  // 방금 끝난 분석의 결과는 대화 아래에 이어 붙인다(다시 들어오면 결과만 보인다).
  const [fresh, setFresh] = useState<RoastResult | null>(null);
  const [run, setRun] = useState(0);

  // 미리보기 모드: 결과는 브라우저 저장소에 있다.
  useEffect(() => {
    if (signedIn || initialResult) return;
    const saved = readPreview();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 hydration 뒤에만 읽을 수 있다
      setResult(saved);
      setMode("result");
    }
  }, [signedIn, initialResult]);

  const photoOf = useCallback(
    (id: string) => {
      const g = garments.find((x) => x.id === id);
      return result?.garments[id]?.imageUrl ?? g?.thumbUrl ?? g?.imageUrl ?? null;
    },
    [garments, result],
  );

  return (
    <CopyContext.Provider value={copy}>
      <main className="mx-auto max-w-200 px-[clamp(16px,3vw,32px)] pt-6 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-text pb-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-label font-medium tracking-[0.08em] text-neutral-700 uppercase">Wardrobe roast</span>
            <h1 className="text-title">내 옷장 훈수</h1>
          </div>
          {signedIn && <UsageNote kind="roast" />}
        </div>

        {mode === "result" && result ? (
          <ResultView
            result={result}
            changed={wardrobeHash(garments) !== result.wardrobeHash}
            photoOf={photoOf}
            onRetry={() => setMode("name")}
          />
        ) : mode === "chat" ? (
          <>
            <Chat
              key={run}
              name={name}
              preview={signedIn ? undefined : garments}
              photoOf={photoOf}
              onDone={(r) => {
                if (!signedIn) writePreview(r);
                else notifyUsageChanged();
                setResult(r);
                setFresh(r);
              }}
            />
            {fresh && (
              <FreshResult>
                <ResultView
                  result={fresh}
                  changed={false}
                  photoOf={photoOf}
                  onRetry={() => {
                    setFresh(null);
                    setMode("name");
                  }}
                />
              </FreshResult>
            )}
          </>
        ) : (
          <Intro
            clothes={clothes}
            skipIntro={mode === "name"}
            onStart={(n) => {
              setName(n);
              setFresh(null);
              setRun((x) => x + 1);
              setMode("chat");
            }}
          />
        )}
      </main>
    </CopyContext.Provider>
  );
}

/** 대화 아래에 붙는 결과: 구분선을 두고, 나타나면 그 자리로 내려간다. */
function FreshResult({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);
  return (
    <div ref={ref} className="roast-fresh">
      <hr className="roast-divider" aria-hidden />
      {children}
    </div>
  );
}

/** 한 글자씩 출력. 움직임 줄이기 설정이면 바로 전부 보인다. */
function Typed({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (n >= text.length) {
      if (!done.current) {
        done.current = true;
        onDone?.();
      }
      return;
    }
    // 문장 부호 뒤에서 잠깐 멈춘다.
    const ch = text[n - 1];
    const instant = reducedMotion();
    const t = setTimeout(() => setN((x) => (instant ? text.length : x + 1)), instant ? 0 : /[.?!,]/.test(ch ?? "") ? TYPE_MS * 8 : TYPE_MS);
    return () => clearTimeout(t);
  }, [n, text, onDone]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="roast-cursor" aria-hidden />}
    </>
  );
}

function Dots() {
  return (
    <span className="roast-dots" role="status" aria-label="생각하는 중">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} aria-hidden style={{ animationDelay: `${i * 0.12}s` }}>
          .
        </span>
      ))}
    </span>
  );
}

/** 사진이 한 장씩 들어오는 시차(ms) */
const PHOTO_STAGGER_MS = 110;
const PHOTO_IN_MS = 450;

function Photos({ ids, photoOf, animate }: { ids?: string[]; photoOf: (id: string) => string | null; animate?: boolean }) {
  const urls = (ids ?? []).map(photoOf).filter((u): u is string => Boolean(u));
  const drag = useRef<{ x: number; left: number } | null>(null);
  if (!urls.length) return null;
  // 3장 이상이면 한 줄로 늘어놓고 옆으로 넘겨 본다(터치는 스크롤, 마우스는 끌기).
  const strip = urls.length > 2;
  return (
    <div
      className={strip ? "roast-photos roast-photos-strip mt-2" : "roast-photos mt-2"}
      onPointerDown={(e) => {
        if (!strip || e.pointerType !== "mouse") return;
        drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current) e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {urls.map((u, i) => (
        <img
          key={u}
          src={u}
          alt=""
          className={animate ? "roast-photo roast-photo-in" : "roast-photo"}
          style={animate ? { animationDelay: `${i * PHOTO_STAGGER_MS}ms` } : undefined}
          loading="lazy"
          draggable={false}
        />
      ))}
    </div>
  );
}

function Intro({ clothes, skipIntro, onStart }: { clothes: number; skipIntro: boolean; onStart: (name: string | null) => void }) {
  const copy = useContext(CopyContext);
  // 다시 분석할 때도 소개 문구부터 타이핑한다.
  const [typed, setTyped] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);
  const [asking, setAsking] = useState(skipIntro);
  const [name, setName] = useState("");
  const enough = clothes >= MIN_CLOTHES;

  return (
    <div className="roast-mono roast-log mt-8" aria-live="polite">
      <p className="roast-ai"><Typed text={copy.INTRO} onDone={() => setTimeout(() => setTyped(true), reducedMotion() ? 0 : INTRO_PAUSE_MS)} /></p>
      {!skipIntro && copy.CREDIT && <p className="roast-credit">{copy.CREDIT}</p>}
      {typed && !enough && (
        <p className="roast-ai">
          <Typed text={tooFew(copy, clothes)} />
        </p>
      )}
      {typed && enough && !asking && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="roast-choice" onClick={() => setAsking(true)}>
              {copy.START_LABEL}
            </button>
            <button
              type="button"
              className="roast-choice"
              onClick={() => setDeclined(copy.DECLINE[Math.floor(Math.random() * copy.DECLINE.length)])}
              disabled={Boolean(declined)}
            >
              {copy.DECLINE_LABEL}
            </button>
          </div>
          {declined && (
            <p className="roast-ai">
              <Typed key={declined} text={declined} />
            </p>
          )}
        </>
      )}
      {typed && asking && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onStart(name.trim() || null);
          }}
        >
          <p className="roast-ai">
            <Typed text={copy.ASK_NAME} />
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              maxLength={20}
              autoComplete="off"
              aria-label="부를 이름"
              placeholder="예: 세현"
              className="min-h-12 w-56 max-w-full border border-text bg-surface px-3 text-body"
            />
            <button type="submit" className={buttonClassName({ variant: "primary", size: "lg" })}>
              시작하기
            </button>
          </div>
          <span className="text-sm text-neutral-700">{copy.NAME_HINT}</span>
        </form>
      )}
    </div>
  );
}

function Chat({
  name,
  preview,
  photoOf,
  onDone,
}: {
  name: string | null;
  preview: unknown;
  photoOf: (id: string) => string | null;
  onDone: (r: RoastResult) => void;
}) {
  const copy = useContext(CopyContext);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noAi, setNoAi] = useState(false);
  const nextId = useRef(0);
  const typedWaiters = useRef(new Map<number, () => void>());
  const choiceWaiter = useRef<((id: string) => void) | null>(null);
  const started = useRef(false);

  const push = useCallback((m: NewMsg) => {
    const id = nextId.current++;
    setMsgs((list) => [...list, { ...m, id } as Msg]);
    return id;
  }, []);
  const remove = (id: number) => setMsgs((list) => list.filter((m) => m.id !== id));

  // 사진은 글자가 다 찍힌 뒤에 한 장씩 들어오고, 다 들어온 뒤에 다음 말을 한다.
  const [typedIds, setTypedIds] = useState<Set<number>>(() => new Set());
  const say = useCallback(
    async (text: string, photos?: string[], gap?: boolean) => {
      await new Promise<void>((resolve) => {
        const id = nextId.current;
        typedWaiters.current.set(id, resolve);
        push(gap ? { kind: "ai", text, photos, gap } : { kind: "ai", text, photos });
      });
      if (photos?.length && !reducedMotion()) await sleep(Math.min(photos.length, 8) * PHOTO_STAGGER_MS + PHOTO_IN_MS);
    },
    [push],
  );
  const think = useCallback(
    async (ms: number) => {
      const id = push({ kind: "dots" });
      await sleep(reducedMotion() ? 150 : ms);
      remove(id);
    },
    [push],
  );

  // 대화가 길어질 때마다(새 메시지, 타이핑 중 줄바꿈, 사진, 선택지) 바로 맨 아래로 붙인다. 결과가 붙은 뒤에는 멈춘다.
  // 부드러운 스크롤은 글자마다 다시 시작돼 살짝 위에 머물러서 쓰지 않는다.
  const finished = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    // 대화 영역 끝이 아니라 페이지 맨 아래(아래 여백·꼬리말까지)로 보낸다.
    const stick = () => {
      if (finished.current) return;
      const doc = document.scrollingElement ?? document.documentElement;
      window.scrollTo({ top: doc.scrollHeight, behavior: "auto" });
    };
    const ro = new ResizeObserver(stick);
    ro.observe(log);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      // 분석을 준비하는 동안 첫 멘트를 먼저 띄운다.
      const starting = startRoast({ name, preview });
      if (copy.OPENING.length) {
        await think(700);
        await sayBubbles(copy.OPENING[Math.floor(Math.random() * copy.OPENING.length)]);
      }
      await think(900);
      const start = await starting;
      if (!start.ok) {
        setError(start.code === "too_few" ? tooFew(copy, start.count) : start.message);
        return;
      }
      if (start.aiLeft === 0) setNoAi(true);
      const answers = await play(start.script);
      push({ kind: "status", text: copy.WRITING });
      const dots = push({ kind: "dots" });
      const done = await finishRoast({ seed: start.script.seed, name, answers, preview });
      remove(dots);
      if (!done.ok) {
        setError(done.message);
        return;
      }
      await sleep(400);
      finished.current = true;
      onDone(done.result);
    })();

    /** 줄바꿈마다 말풍선을 나눠 띄운다. 사진은 마지막 말풍선에 붙인다. */
    async function sayBubbles(text: string, photos?: string[], gap?: boolean) {
      const parts = bubblesOf(text);
      if (!parts.length) return say(text, photos, gap);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) await sleep(reducedMotion() ? 100 : 380);
        await say(parts[i], i === parts.length - 1 ? photos : undefined, i === 0 ? gap : undefined);
      }
    }

    async function play(script: RoastScript): Promise<Record<string, string>> {
      const answers: Record<string, string> = {};
      let sectionSeen = false;
      for (const step of script.steps) {
        if (step.t === "status") {
          // 섹션이 바뀔 때는 한참 고민하는 것처럼 멈춘다.
          if (sectionSeen) await think(2400 + Math.random() * 1200);
          sectionSeen = true;
          push({ kind: "status", text: step.text });
          await sleep(500);
        } else if (step.t === "think") await think(700 + Math.random() * 700);
        else if (step.t === "say") {
          // 섹션 사이 혼잣말은 앞 이야기와 이어지는 말로 읽히지 않게 한 박자 쉬고 띄워서 보여 준다.
          if (step.gap) await think(1600 + Math.random() * 800);
          await sayBubbles(step.text, step.photos, step.gap);
          await sleep(350 + Math.random() * 500);
        } else {
          const q = script.questions[step.q];
          for (const [i, l] of q.lead.entries()) {
            await sayBubbles(l, q.leadPhotos?.[i]);
            await sleep(450);
          }
          await say(q.text, q.photos);
          const picked = await new Promise<string>((resolve) => {
            choiceWaiter.current = resolve;
            push({ kind: "choices", q, picked: null });
          });
          answers[q.id] = picked;
          await think(600);
          await sayBubbles(q.reactions[picked] ?? "");
          await sleep(600);
        }
      }
      return answers;
    }
  }, [name, preview, onDone, push, say, think, copy]);

  const onTyped = useCallback((id: number) => {
    setTypedIds((s) => new Set(s).add(id));
    typedWaiters.current.get(id)?.();
    typedWaiters.current.delete(id);
  }, []);

  return (
    <div ref={logRef} className="roast-mono roast-log mt-8" aria-live="polite">
      {noAi && <p className="roast-status">{copy.NO_AI_LEFT}</p>}
      {msgs.map((m) =>
        m.kind === "ai" ? (
          <div key={m.id} className="roast-ai" data-gap={m.gap ? "true" : undefined}>
            <Typed text={m.text} onDone={() => onTyped(m.id)} />
            {typedIds.has(m.id) && <Photos ids={m.photos} photoOf={photoOf} animate />}
          </div>
        ) : m.kind === "status" ? (
          <p key={m.id} className="roast-status">
            {m.text}
          </p>
        ) : m.kind === "dots" ? (
          <div key={m.id}>
            <Dots />
          </div>
        ) : (
          <div key={m.id} className="flex flex-col gap-2 sm:max-w-120">
            {m.q.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="roast-choice"
                disabled={m.picked !== null}
                data-picked={m.picked === o.id}
                // 퀴즈를 틀리면 정답 선택지를 따로 표시한다.
                data-wrong={m.q.answer != null && m.picked === o.id && o.id !== m.q.answer ? "true" : undefined}
                data-answer={m.picked !== null && m.q.answer != null && m.picked !== m.q.answer && o.id === m.q.answer ? "true" : undefined}
                aria-label={m.picked !== null && m.q.answer != null && o.id === m.q.answer && m.picked !== o.id ? `${o.label} (정답)` : undefined}
                onClick={() => {
                  setMsgs((list) => list.map((x) => (x.id === m.id ? { ...x, picked: o.id } : x)));
                  choiceWaiter.current?.(o.id);
                  choiceWaiter.current = null;
                }}
              >
                {o.photoId && photoOf(o.photoId) && <img src={photoOf(o.photoId)!} alt="" />}
                {o.label}
              </button>
            ))}
          </div>
        ),
      )}
      {error && (
        <p className="roast-ai" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ResultView({
  result,
  changed,
  photoOf,
  onRetry,
}: {
  result: RoastResult;
  changed: boolean;
  photoOf: (id: string) => string | null;
  onRetry: () => void;
}) {
  const copy = useContext(CopyContext);
  const date = useMemo(() => koreanDate(result.createdAt), [result.createdAt]);
  return (
    <article className="roast-mono roast-result mt-8 flex flex-col gap-6">
      {changed && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-text bg-surface px-4 py-3">
          <span className="text-body">{copy.CHANGED}</span>
          <button type="button" className={buttonClassName({ size: "sm" })} onClick={onRetry}>
            {copy.RETRY_LABEL}
          </button>
        </div>
      )}
      <header className="flex flex-col gap-2">
        {result.name && <span className="text-md">{result.name}님의 옷장</span>}
        <span className="text-sm text-neutral-700">
          {date} · 옷 {result.garmentCount}벌 기준
        </span>
        <h2 className="roast-headline">{result.headline}</h2>
      </header>
      {result.paragraphs.map((p, i) => (
        <section key={i} className="flex flex-col gap-2">
          <p>{p.text}</p>
          <Photos ids={p.photos} photoOf={photoOf} />
        </section>
      ))}
      <div className="flex flex-col gap-1 border-t border-divider pt-5">
        {result.closing.map((c, i) => (
          <p key={i}>{c}</p>
        ))}
      </div>
      <p className="text-sm text-neutral-700">{result.disclaimer}</p>
      <div>
        <button type="button" className={buttonClassName({ variant: "primary", size: "lg" })} onClick={onRetry}>
          {copy.RETRY_LABEL}
        </button>
      </div>
    </article>
  );
}

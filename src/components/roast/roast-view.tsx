"use client";

/* eslint-disable @next/next/no-img-element -- 비공개 저장소의 임시 주소라 next/image 최적화를 쓰지 않는다(다른 화면과 같음). */
import { useRouter } from "next/navigation";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UsageNote } from "@/components/usage/usage-note";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { buttonClassName } from "@/components/ui/button";
import { MIN_CLOTHES, ROAST_COPY, tooFew, type RoastCopy } from "@/lib/roast/copy";
import { bubblesOf } from "@/lib/roast/bubbles";
import { wardrobeHash } from "@/lib/roast/hash";
import type { RoastFinish, RoastQuestion, RoastReport, RoastResult, RoastScript, RoastStart } from "@/lib/roast/types";
import { notifyUsageChanged } from "@/lib/usage";
import { finishRoast, startRoast } from "@/server/roast/actions";
import { finishOrderRoast, startOrderRoast } from "@/server/roast/order-actions";
import type { OrderRoastItem } from "@/server/roast/orders/input";
import { OrderPaste, type OrderCopy } from "./order-roast";
import "./roast.css";

/**
 * AI 옷장 분석(계획서 3장). 서버가 만든 대화 순서를 한 글자씩 차례로 재생하고, 질문에 답을 받은 뒤 결과 글을 받는다.
 * 진행 상태는 저장하지 않는다(나가면 처음부터). 결과는 로그인하면 서버에, 미리보기 모드면 브라우저에 가장 최근 1개만 둔다.
 */

const PREVIEW_KEY = "wardrobe-fit:roast-result";
const TYPE_MS = 43;

type Msg =
  | { id: number; kind: "ai"; text: string; photos?: string[]; gap?: boolean; captions?: Record<string, string> }
  | { id: number; kind: "status"; text: string; gap?: boolean }
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

/**
 * orders가 있으면 무신사 주문내역 훈수(숨은 주소 /roast/orders): 이름·나이 → 주문내역 붙여넣기·상품 읽기 → 대화 → 결과.
 * 주문내역 훈수는 옷장을 보지 않고, 결과도 저장하지 않는다(새로고침하면 처음부터).
 */
export function RoastView({ initialResult, copy = ROAST_COPY, orders }: { initialResult: RoastResult | null; copy?: RoastCopy; orders?: OrderCopy }) {
  const { garments, signedIn } = useWardrobe();
  const clothes = orders ? MIN_CLOTHES : garments.filter((g) => g.categoryId !== "hat" && g.categoryId !== "shoes").length;
  const [result, setResult] = useState<RoastResult | null>(initialResult);
  const [mode, setMode] = useState<"result" | "intro" | "name" | "paste" | "chat">(initialResult ? "result" : "intro");
  // 주문내역 훈수: 붙여 넣은 주문과 상품 정보(화면에만 둔다)
  const [orderItems, setOrderItems] = useState<OrderRoastItem[]>([]);
  const [orderNote, setOrderNote] = useState<string | null>(null);
  // 이름은 이번 결과에만 쓰고 다음 분석 때 미리 채우지 않는다.
  const [name, setName] = useState<string | null>(null);
  // 나이도 이번 계산에만 쓰고 결과·저장소 어디에도 남기지 않는다.
  const [age, setAge] = useState<number | null>(null);
  // 방금 끝난 분석의 결과는 대화 아래에 이어 붙인다(다시 들어오면 결과만 보인다).
  const [fresh, setFresh] = useState<RoastResult | null>(null);
  const [run, setRun] = useState(0);

  // 미리보기 모드: 결과는 브라우저 저장소에 있다.
  useEffect(() => {
    if (signedIn || initialResult || orders) return;
    const saved = readPreview();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 hydration 뒤에만 읽을 수 있다
      setResult(saved);
      setMode("result");
    }
  }, [signedIn, initialResult, orders]);

  const photoOf = useCallback(
    (id: string) => {
      // 주문내역 훈수의 옷 id는 "o{목록 번호}"
      if (orders) return result?.garments[id]?.imageUrl ?? orderItems[Number(id.slice(1))]?.image ?? null;
      const g = garments.find((x) => x.id === id);
      return result?.garments[id]?.imageUrl ?? g?.thumbUrl ?? g?.imageUrl ?? null;
    },
    [garments, result, orders, orderItems],
  );
  const runner = useMemo<Runner>(
    () =>
      orders
        ? {
            start: (name, age) => startOrderRoast({ name, age, items: orderItems }),
            finish: (seed, name, age, answers) => finishOrderRoast({ seed, name, age, answers, items: orderItems }),
          }
        : {
            start: (name, age) => startRoast({ name, age, preview: signedIn ? undefined : garments }),
            finish: (seed, name, age, answers) => finishRoast({ seed, name, age, answers, preview: signedIn ? undefined : garments }),
          },
    [orders, orderItems, signedIn, garments],
  );

  return (
    <CopyContext.Provider value={copy}>
      <main className="mx-auto max-w-200 px-[clamp(16px,3vw,32px)] pt-6 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-text pb-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-label font-medium tracking-[0.08em] text-neutral-700 uppercase">{orders ? "Order roast" : "Wardrobe roast"}</span>
            <h1 className="text-title">{orders ? "무신사 주문내역 훈수" : "내 패션 훈수"}</h1>
          </div>
          {signedIn && !orders && <UsageNote kind="roast" />}
        </div>

        {mode === "result" && result ? (
          <ResultView
            result={result}
            subject={orders ? "주문내역" : "옷장"}
            changed={!orders && wardrobeHash(garments) !== result.wardrobeHash}
            photoOf={photoOf}
            onRetry={() => setMode("name")}
          />
        ) : mode === "paste" && orders ? (
          <div className="roast-mono roast-log mt-8">
            <OrderPaste
              copy={orders}
              onReady={(items, note) => {
                setOrderItems(items);
                setOrderNote(note);
                setRun((x) => x + 1);
                setMode("chat");
              }}
            />
          </div>
        ) : mode === "chat" ? (
          <>
            {orderNote && <p className="mt-6 text-sm text-neutral-700">{orderNote}</p>}
            <Chat
              key={run}
              name={name}
              age={age}
              runner={runner}
              photoOf={photoOf}
              onDone={(r) => {
                if (orders) {
                  // 주문내역 훈수 결과는 저장하지 않는다.
                } else if (!signedIn) writePreview(r);
                else notifyUsageChanged();
                setResult(r);
                setFresh(r);
              }}
            />
            {fresh && (
              <FreshResult>
                <ResultView
                  result={fresh}
                  subject={orders ? "주문내역" : "옷장"}
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
            orders={!!orders}
            onStart={(n, ag) => {
              setName(n);
              setAge(ag);
              setFresh(null);
              if (orders) setMode("paste");
              else {
                setRun((x) => x + 1);
                setMode("chat");
              }
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

/** 선택지 칸의 금액: 자리는 처음부터 잡아 두고(사진 줄이 밀리지 않게), 고른 뒤에 나타난다. */
function Amount({ text, shown }: { text: string; shown: boolean }) {
  return (
    <span className={shown ? "roast-choice-amount roast-photo-in" : "roast-choice-amount"} data-shown={shown} aria-hidden={!shown}>
      {text}
    </span>
  );
}

/** 사진이 한 장씩 들어오는 시차(ms) */
const PHOTO_STAGGER_MS = 110;
const PHOTO_IN_MS = 450;

function Photos({
  ids,
  photoOf,
  animate,
  captions,
}: {
  ids?: string[];
  photoOf: (id: string) => string | null;
  animate?: boolean;
  /** 옷 id → 사진 아래에 적을 글(가격) */
  captions?: Record<string, string>;
}) {
  const shown = (ids ?? []).flatMap((id) => {
    const url = photoOf(id);
    return url ? [{ id, url }] : [];
  });
  const urls = shown.map((x) => x.url);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(update, [urls.length]);
  if (!urls.length) return null;
  // 3장 이상이면 한 줄로 늘어놓고 양옆 화살표로 넘겨 본다(스크롤바는 숨김, 터치는 스크롤, 마우스는 끌기).
  const strip = urls.length > 2;
  const move = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const box = (
    <div
      ref={ref}
      className={strip ? "roast-photos roast-photos-strip" : "roast-photos mt-2"}
      onScroll={strip ? update : undefined}
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
      {shown.map(({ id, url }, i) => {
        const style = animate ? { animationDelay: `${i * PHOTO_STAGGER_MS}ms` } : undefined;
        const img = (
          <img
            src={url}
            alt=""
            className={captions ? "roast-photo" : animate ? "roast-photo roast-photo-in" : "roast-photo"}
            style={captions ? undefined : style}
            loading="lazy"
            draggable={false}
          />
        );
        return captions?.[id] ? (
          <figure key={url} className={animate ? "roast-photo-fig roast-photo-in" : "roast-photo-fig"} style={style}>
            {img}
            <figcaption>{captions[id]}</figcaption>
          </figure>
        ) : (
          <Fragment key={url}>{img}</Fragment>
        );
      })}
    </div>
  );
  if (!strip) return box;
  return (
    <div className="roast-row mt-2">
      {!edge.start && (
        <button type="button" className="roast-row-btn roast-row-prev" aria-label="이전 사진" onClick={() => move(-1)}>
          ‹
        </button>
      )}
      {box}
      {!edge.end && (
        <button type="button" className="roast-row-btn roast-row-next" aria-label="다음 사진" onClick={() => move(1)}>
          ›
        </button>
      )}
    </div>
  );
}

function Intro({ clothes, skipIntro, orders, onStart }: { clothes: number; skipIntro: boolean; orders: boolean; onStart: (name: string | null, age: number | null) => void }) {
  const copy = useContext(CopyContext);
  // 다시 분석할 때도 소개 문구부터 타이핑한다.
  const [typed, setTyped] = useState(false);
  // 처음이든 다시 하기든 시작·평가 기준 버튼부터 보여 준다.
  const [criteria, setCriteria] = useState(false);
  const [criteriaDone, setCriteriaDone] = useState(false);
  const [asking, setAsking] = useState(false);
  // 옷장 훈수에서 시작 버튼을 누르면 바로 아래에서 평가 기준(옷장·주문내역)을 고르게 한다.
  const [picking, setPicking] = useState(false);
  const [pickDone, setPickDone] = useState(false);
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
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
      {typed && enough && criteria && (
        <p className="roast-ai">
          <Typed text={copy.CRITERIA} onDone={() => setCriteriaDone(true)} />
        </p>
      )}
      {typed && enough && !asking && !picking && (!criteria || criteriaDone) && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="roast-choice" onClick={() => (orders ? setAsking(true) : setPicking(true))}>
              {copy.START_LABEL}
            </button>
            {!criteria && (
              <button type="button" className="roast-choice" onClick={() => setCriteria(true)}>
                {copy.CRITERIA_LABEL}
              </button>
            )}
          </div>
        </>
      )}
      {typed && picking && (
        <p className="roast-ai">
          <Typed text={copy.PICK_ASK} onDone={() => setPickDone(true)} />
        </p>
      )}
      {typed && picking && pickDone && !asking && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="roast-choice" onClick={() => setAsking(true)}>
            {copy.PICK_CLOSET}
          </button>
          <button type="button" className="roast-choice" onClick={() => router.push("/roast/orders")}>
            {copy.PICK_ORDERS}
          </button>
        </div>
      )}
      {typed && asking && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(age);
            onStart(name.trim() || null, Number.isInteger(n) && n >= 10 && n <= 99 ? n : null);
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
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              autoComplete="off"
              aria-label="나이"
              placeholder="나이"
              className="min-h-12 w-20 border border-text bg-surface px-3 text-body"
            />
            <button type="submit" className={buttonClassName({ variant: "primary", size: "lg" })}>
              시작하기
            </button>
          </div>
          <span className="text-sm text-neutral-700">{copy.NAME_HINT}</span>
          {copy.AGE_HINT && <span className="text-sm text-neutral-700">{copy.AGE_HINT}</span>}
        </form>
      )}
    </div>
  );
}

/** 대화 시작·결과 서버 액션(옷장 훈수 또는 주문내역 훈수) */
interface Runner {
  start: (name: string | null, age: number | null) => Promise<RoastStart>;
  finish: (seed: number, name: string | null, age: number | null, answers: Record<string, string>) => Promise<RoastFinish>;
}

function Chat({
  name,
  age,
  runner,
  photoOf,
  onDone,
}: {
  name: string | null;
  age: number | null;
  runner: Runner;
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
    async (text: string, photos?: string[], gap?: boolean, captions?: Record<string, string>) => {
      await new Promise<void>((resolve) => {
        const id = nextId.current;
        typedWaiters.current.set(id, resolve);
        push({ kind: "ai", text, photos, ...(gap ? { gap } : {}), ...(captions ? { captions } : {}) });
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
      const starting = runner.start(name, age);
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
      push({ kind: "status", text: copy.WRITING, gap: true });
      const dots = push({ kind: "dots" });
      const done = await runner.finish(start.script.seed, name, age, answers);
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
    async function sayBubbles(text: string, photos?: string[], gap?: boolean, captions?: Record<string, string>) {
      const parts = bubblesOf(text);
      if (!parts.length) return say(text, photos, gap, captions);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) await sleep(reducedMotion() ? 100 : 380);
        const last = i === parts.length - 1;
        await say(parts[i], last ? photos : undefined, i === 0 ? gap : undefined, last ? captions : undefined);
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
          push({ kind: "status", text: step.text, ...(step.gap ? { gap: true } : {}) });
          await sleep(500);
        } else if (step.t === "think") await think(700 + Math.random() * 700);
        else if (step.t === "say") {
          // 섹션 사이 혼잣말은 앞 이야기와 이어지는 말로 읽히지 않게 한 박자 쉬고 띄워서 보여 준다.
          if (step.gap) await think(1600 + Math.random() * 800);
          await sayBubbles(step.text, step.photos, step.gap);
          await sleep(350 + Math.random() * 500);
        } else {
          const q = script.questions[step.q];
          // 질문은 늘 새 이야기로 시작한다(앞 문장과 간격을 둔다).
          for (const [i, l] of q.lead.entries()) {
            await sayBubbles(l, q.leadPhotos?.[i], i === 0);
            await sleep(450);
          }
          await say(q.text, q.photos, !q.lead.length);
          const picked = await new Promise<string>((resolve) => {
            choiceWaiter.current = resolve;
            push({ kind: "choices", q, picked: null });
          });
          answers[q.id] = picked;
          await think(600);
          // "~에 쓴 돈, 알고 있었나요?"는 반응 아래에 그 옷들 사진과 가격을 붙인다.
          const reveal = q.reveal?.length ? q.reveal : undefined;
          await sayBubbles(
            q.reactions[picked] ?? "",
            reveal?.map((x) => x.id),
            undefined,
            reveal && Object.fromEntries(reveal.map((x) => [x.id, x.amount])),
          );
          await sleep(600);
        }
      }
      return answers;
    }
  }, [name, age, runner, onDone, push, say, think, copy]);

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
            {typedIds.has(m.id) && <Photos ids={m.photos} photoOf={photoOf} animate captions={m.captions} />}
          </div>
        ) : m.kind === "status" ? (
          <p key={m.id} className="roast-status" data-gap={m.gap ? "true" : undefined}>
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
                {o.amount == null ? (
                  <>
                    {o.photoId && photoOf(o.photoId) && <img src={photoOf(o.photoId)!} alt="" />}
                    {o.label}
                  </>
                ) : o.photoIds ? (
                  <>
                    {o.label}
                    <span className="roast-choice-line mt-2">
                      <span className="roast-choice-photos" aria-hidden>
                        {o.photoIds
                          .map(photoOf)
                          .filter((u): u is string => Boolean(u))
                          .map((u, i) => (
                            <img key={u} src={u} alt="" className="roast-photo-in" style={{ animationDelay: `${i * PHOTO_STAGGER_MS}ms` }} draggable={false} />
                          ))}
                      </span>
                      <Amount text={o.amount} shown={m.picked !== null} />
                    </span>
                  </>
                ) : (
                  <span className="roast-choice-line">
                    {o.photoId && photoOf(o.photoId) && <img src={photoOf(o.photoId)!} alt="" />}
                    <span className="min-w-0 flex-1">{o.label}</span>
                    <Amount text={o.amount} shown={m.picked !== null} />
                  </span>
                )}
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
  subject = "옷장",
  changed,
  photoOf,
  onRetry,
}: {
  result: RoastResult;
  subject?: string;
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
        {result.name && <span className="text-md">{result.name}님의 {subject}</span>}
        <span className="text-sm text-neutral-700">
          {date} · 옷 {result.garmentCount}벌 기준
        </span>
        {!result.report && <h2 className="roast-headline">{result.headline}</h2>}
      </header>
      {result.report ? (
        <Report report={result.report} photoOf={photoOf} />
      ) : (
        result.paragraphs.map((p, i) => (
          <section key={i} className="flex flex-col gap-2">
            <p>{p.text}</p>
            <Photos ids={p.photos} photoOf={photoOf} />
          </section>
        ))
      )}
      <div className={result.report ? "flex flex-col gap-1" : "flex flex-col gap-1 border-t border-divider pt-5"}>
        {result.closing.map((c, i) => (
          <p key={i} className={result.report && i === result.closing.length - 1 ? "roast-last" : undefined}>
            {c}
          </p>
        ))}
      </div>
      <p className="text-sm text-neutral-700">{result.disclaimer}</p>
      {result.report?.scoreDetail && <ScoreDetail detail={result.report.scoreDetail} />}
      <div>
        <button type="button" className={buttonClassName({ variant: "primary", size: "lg" })} onClick={onRetry}>
          {copy.RETRY_LABEL}
        </button>
      </div>
    </article>
  );
}

/** 결과 페이지: How Bad Is Your Spotify처럼 글 위주(총점 평가 → 요약 한 문장 → "> " 문장 → 목록 → 총점 → 진단 문단·사진 줄) */
const REPORT_ORDER = ["intro", "lists", "total", "points", "dna", "notes"];

function Report({ report, photoOf }: { report: RoastReport; photoOf: (id: string) => string | null }) {
  // 첫 줄은 항상 맨 위, 나머지는 관리자 "결과 구성"의 순서(예전 결과는 기본 순서)
  const order = report.order?.length ? report.order : REPORT_ORDER;
  const sections: Record<string, ReactNode> = {
    intro: report.intro.length > 0 && (
      <div className="flex flex-col gap-1">
        {report.intro.map((t, i) => (
          <p key={i}>
            <span className="roast-prompt">&gt;</span>
            {t}
          </p>
        ))}
      </div>
    ),
    lists: report.lists.map((l) => (
      <div key={l.title}>
        <p>
          <b>{l.title}</b>
        </p>
        <ul className="roast-list">
          {l.items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    )),
    // 점수·총점 문장은 화면에 드러내지 않는다(점수 계산은 내부·관리자 풀이에만 쓴다).
    total: null,
    points: report.points.map((p) => (
      <div key={p.id}>
        <p>
          <b>{p.lead}</b> {p.text}
        </p>
        {p.answer && <p className="roast-answer">{p.answer}</p>}
        <PhotoRow ids={p.photos} photoOf={photoOf} />
      </div>
    )),
    // 예전 결과만 옷장 DNA가 있다(새 결과는 제목 아래 요약 한 문장).
    dna: report.dna && report.dna.length > 0 && (
      <p>
        <b>{report.dnaLead}</b> {report.dna.join(" ")}
      </p>
    ),
    notes: report.notes.map((n) => (
      <p key={n} className="text-sm text-neutral-700">
        {n}
      </p>
    )),
  };
  return (
    <div className="roast-report">
      <h2 className="roast-headline">
        <span className="roast-prompt">&gt;</span>
        {report.headline}
      </h2>
      {report.summary && <p className="roast-summary">{report.summary}</p>}
      {order.map((k) => (
        <Fragment key={k}>{sections[k]}</Fragment>
      ))}
    </div>
  );
}

/** 점수 풀이(관리자에게만 온다): 기본 점수에서 무엇 때문에 얼마나 오르내렸는지 */
function ScoreDetail({ detail }: { detail: NonNullable<RoastReport["scoreDetail"]> }) {
  const sum = detail.base + detail.items.reduce((s, x) => s + x.delta, 0);
  const sign = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 10) / 10)}`;
  return (
    <section className="roast-score border border-divider px-4 py-3 text-sm" data-testid="roast-score-detail">
      <p className="font-semibold">점수 계산 (관리자에게만 보입니다)</p>
      <ul className="mt-2 flex flex-col gap-1">
        <li className="flex justify-between gap-4">
          <span>기본 점수</span>
          <span className="tabular-nums">{detail.base}</span>
        </li>
        {detail.items.map((x, i) => (
          <li key={i} className="flex justify-between gap-4">
            <span>
              {x.label}
              {x.why && <span className="text-neutral-700"> ({x.why})</span>}
              {x.garments && (
                <span className="mt-0.5 block text-xs text-neutral-700" data-testid="roast-score-garments">
                  반영된 옷 {x.garments.length}벌: {x.garments.join(", ")}
                </span>
              )}
            </span>
            <span className="tabular-nums">{sign(x.delta)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 border-t border-divider pt-1 font-semibold">
          <span>{Math.round(sum) !== detail.total ? `총점 (계산 ${Math.round(sum)}점, 0~100으로 맞춤)` : "총점"}</span>
          <span className="tabular-nums">{detail.total}</span>
        </li>
      </ul>
    </section>
  );
}

/** 결과 문단 사진 줄: 양옆 화살표로 넘기고, 손가락으로 밀거나 마우스로 끌어도 된다. */
function PhotoRow({ ids, photoOf }: { ids?: string[]; photoOf: (id: string) => string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const shown = (ids ?? []).flatMap((id) => {
    const url = photoOf(id);
    return url ? [{ id, url }] : [];
  });
  const update = () => {
    const el = ref.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(update, [shown.length]);
  if (!shown.length) return null;
  const move = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="roast-row mt-3">
      {!edge.start && (
        <button type="button" className="roast-row-btn roast-row-prev" aria-label="이전 사진" onClick={() => move(-1)}>
          ‹
        </button>
      )}
      <div
        ref={ref}
        className="roast-row-track"
        onScroll={update}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {shown.map((x) => (
          <img key={x.id} src={x.url} alt="" draggable={false} />
        ))}
      </div>
      {!edge.end && (
        <button type="button" className="roast-row-btn roast-row-next" aria-label="다음 사진" onClick={() => move(1)}>
          ›
        </button>
      )}
    </div>
  );
}

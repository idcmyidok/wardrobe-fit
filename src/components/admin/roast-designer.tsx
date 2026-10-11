"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { resetDesignSection, saveDesignSection } from "@/server/roast/admin-actions";
import type { DesignerData } from "@/server/roast/fl/admin-meta";

/**
 * 관리자 "훈수 설계". 훈수가 만들어지는 순서(구조)를 먼저 보여 주고, 각 단계에서 쓰는 값(유형·점수·문장·퀴즈)으로 바로 넘어가 고친다.
 * 고치는 단위는 "구역"(유형 하나, 숫자 설정, 공통 문장 묶음 등)이고, 구역마다 저장·기본값으로 되돌리기가 있다.
 * 문장 속 {이름}은 실제 값으로 바뀌는 자리이며, 칸마다 쓸 수 있는 자리를 아래에 보여 준다(서버에서 한 번 더 검사).
 */

type Cfg = DesignerData["config"];
type Meta = DesignerData["meta"];
type Var = { key: string; label: string };
type TypeConf = Cfg["types"][string];
type Quiz = Cfg["quiz"][string];

type Tab = "structure" | "types" | "score" | "common" | "special" | "quiz" | "screen";
const TABS: { id: Tab; label: string }[] = [
  { id: "structure", label: "전체 구조" },
  { id: "types", label: "패션 유형" },
  { id: "score", label: "점수 기준" },
  { id: "common", label: "공통 문장" },
  { id: "special", label: "특수 질문" },
  { id: "quiz", label: "패션 퀴즈" },
  { id: "screen", label: "화면 문구" },
];

const colLabel = "font-mono text-label font-medium tracking-[0.08em] text-neutral-700";
const box = "flex flex-col gap-3 border-b border-neutral-300 py-4";
const textareaCls = "input min-h-16 w-full resize-y py-2 leading-relaxed";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const has = (v: unknown, q: string) => !q || JSON.stringify(v).toLowerCase().includes(q);

// ───────────────────────── 저장 단위(구역) ─────────────────────────

interface Ctx {
  edited: Set<string>;
  onSaved: (section: string, value: unknown | undefined) => void;
}

function useSection<T>(section: string, current: T, ctx: Ctx) {
  const [draft, setDraft] = useState<T>(current);
  const [base, setBase] = useState<T>(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // 다른 곳에서 값이 바뀌면(되돌리기 등) 새 값으로 맞춘다
  if (!same(base, current) && same(draft, base)) {
    setBase(current);
    setDraft(current);
  }
  const dirty = !same(draft, base);
  const save = (value: T = draft) =>
    start(async () => {
      const r = await saveDesignSection(section, value);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      const v = (r.value ?? value) as T;
      setBase(v);
      setDraft(v);
      ctx.onSaved(section, v);
      setMsg({ ok: true, text: "저장했습니다. 다음 훈수부터 적용됩니다." });
    });
  const reset = () =>
    start(async () => {
      if (!confirm("이 구역을 처음(코드 기본값)으로 되돌릴까요?")) return;
      const r = await resetDesignSection(section);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      ctx.onSaved(section, undefined);
      setMsg({ ok: true, text: "기본값으로 되돌렸습니다." });
    });
  return { draft, setDraft, dirty, save, reset, pending, msg, edited: ctx.edited.has(section) };
}

type SectionState = ReturnType<typeof useSection<unknown>>;

function SaveBar({ s, sticky, label }: { s: Pick<SectionState, "dirty" | "pending" | "msg" | "edited" | "reset"> & { save: () => void }; sticky?: boolean; label?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", sticky && "sticky top-[7.5rem] z-[5] -mx-1 border-b border-neutral-300 bg-bg px-1 py-2")}>
      {label && <span className="text-sm font-medium">{label}</span>}
      <Button size="sm" variant={s.dirty ? "primary" : "secondary"} disabled={!s.dirty || s.pending} onClick={() => s.save()}>
        {s.pending ? "저장 중…" : s.dirty ? "저장하기" : "저장됨"}
      </Button>
      {s.edited && (
        <Button size="sm" variant="ghost" disabled={s.pending} onClick={s.reset}>
          기본값으로 되돌리기
        </Button>
      )}
      {s.edited && <Badge>직접 고침</Badge>}
      {s.dirty && <span className="text-sm text-neutral-700">저장하지 않은 변경이 있습니다</span>}
      {s.msg && <span className={cn("text-sm", s.msg.ok ? "text-neutral-700" : "text-red-700")}>{s.msg.text}</span>}
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: "muted" }) {
  return <span className={cn("rounded-sm border px-1.5 py-0.5 text-xs", tone === "muted" ? "border-neutral-300 text-neutral-700" : "border-neutral-700")}>{children}</span>;
}

// ───────────────────────── 입력 부품 ─────────────────────────

function Vars({ vars }: { vars: Var[] }) {
  if (!vars.length) return null;
  return (
    <details className="text-xs text-neutral-700">
      <summary className="cursor-pointer">쓸 수 있는 자리 {vars.length}개 보기</summary>
      <div className="mt-1 flex flex-wrap gap-1">
        {vars.map((v) => (
          <code key={v.key} className="rounded-sm bg-neutral-100 px-1">
            {`{${v.key}}`} {v.label}
          </code>
        ))}
      </div>
      <p className="mt-1">{"{brand|을}처럼 조사를 붙이면 받침에 맞춰 을·를이 골라집니다. 자리 값이 없는 문장은 그때 건너뜁니다."}</p>
    </details>
  );
}

function Text({ value, onChange, label, hint, rows = 2 }: { value: string; onChange: (v: string) => void; label?: string; hint?: string; rows?: number }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium">{label}</span>}
      {hint && <span className="text-xs text-neutral-700">{hint}</span>}
      <textarea className={textareaCls} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Num({ value, onChange, label, hint, step = 1, placeholder }: { value: number | null; onChange: (v: number | null) => void; label: string; hint?: string; step?: number; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="number"
        step={step}
        className="w-28 text-right font-mono tabular-nums"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {hint && <span className="text-xs text-neutral-700">{hint}</span>}
    </label>
  );
}

/** 문장 목록: 하나가 골라져 나오는 후보들. 더하기·빼기·순서는 상관없음 */
function List({ value, onChange, label, hint, vars, min = 1 }: { value: string[]; onChange: (v: string[]) => void; label?: string; hint?: string; vars?: Var[]; min?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium">{label}</span>}
      {hint && <span className="text-xs text-neutral-700">{hint}</span>}
      {value.map((s, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <textarea className={textareaCls} rows={Math.min(4, Math.max(1, Math.ceil(s.length / 60)))} value={s} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <Button size="sm" variant="ghost" aria-label="이 문장 빼기" disabled={value.length <= min} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            빼기
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => onChange([...value, ""])}>
          + 문장 추가
        </Button>
        {value.length > 1 && <span className="text-xs text-neutral-700">{value.length}개 중 하나가 골라져 나옵니다</span>}
      </div>
      {vars && <Vars vars={vars} />}
    </div>
  );
}

function Fold({ title, sub, badges, children, open: openInit = false }: { title: ReactNode; sub?: ReactNode; badges?: ReactNode; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(openInit);
  return (
    <li className="border-b border-neutral-300">
      <button type="button" className="flex w-full items-start justify-between gap-3 py-3 text-left" aria-expanded={open || openInit} onClick={() => setOpen(!open)}>
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-base font-medium">
            {title}
            {badges}
          </span>
          {sub && <span className="text-sm text-pretty text-neutral-700">{sub}</span>}
        </span>
        <span className="shrink-0 text-sm text-neutral-700">{open || openInit ? "▲" : "▼"}</span>
      </button>
      {(open || openInit) && <div className="flex flex-col gap-4 pb-5">{children}</div>}
    </li>
  );
}

// ───────────────────────── 화면 ─────────────────────────

export function RoastDesigner({ data }: { data: DesignerData }) {
  const [tab, setTab] = useState<Tab>("structure");
  const [query, setQuery] = useState("");
  const [cfg, setCfg] = useState<Cfg>(data.config);
  const [edited, setEdited] = useState(() => new Set(data.edited));
  const D = data.defaults;
  const M = data.meta;

  const onSaved = (section: string, value: unknown | undefined) => {
    setEdited((s) => {
      const n = new Set(s);
      if (value === undefined) n.delete(section);
      else n.add(section);
      return n;
    });
    setCfg((c) => {
      const next = structuredClone(c);
      const isDel = value === undefined;
      if (section.startsWith("type.")) next.types[section.slice(5)] = (isDel ? D.types[section.slice(5)] : value) as TypeConf;
      else if (section.startsWith("quiz.")) {
        const id = section.slice(5);
        const v = isDel ? D.quiz[id] : (value as Quiz | { deleted: true });
        if (!v || "deleted" in v) delete next.quiz[id];
        else next.quiz[id] = v;
      } else (next as unknown as Record<string, unknown>)[section] = isDel ? structuredClone((D as unknown as Record<string, unknown>)[section]) : value;
      return next;
    });
  };
  const ctx: Ctx = { edited, onSaved };
  const q = query.trim().toLowerCase();
  const go = (t: Tab, find = "") => {
    setTab(t);
    setQuery(find);
    window.scrollTo({ top: 0 });
  };

  // 찾기: 탭마다 걸린 개수
  const counts: Partial<Record<Tab, number>> = q
    ? {
        types: Object.entries(cfg.types).filter(([id, t]) => has({ id, t }, q)).length,
        score: (Object.entries(cfg.axisLines).filter(([k, v]) => has({ k, v, n: M.axes.find((a) => a.key === k) }, q)).length) + cfg.bands.filter((b) => has(b, q)).length,
        common: Object.entries(cfg.common).filter(([k, v]) => has({ k, v, w: M.common[k as keyof typeof M.common] }, q)).length,
        special: Object.entries(cfg.special).filter(([k, v]) => has({ k, v, w: M.special[k] }, q)).length,
        quiz: Object.entries(cfg.quiz).filter(([, v]) => has(v, q)).length,
        screen: [...Object.entries(cfg.screen), ...Object.entries(cfg.orderScreen)].filter(([k, v]) => has({ k, v, w: M.screen[k] }, q)).length,
      }
    : {};

  return (
    <main className="mx-auto max-w-240 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-col gap-1 border-b border-divider pb-4">
        <Link href="/admin" className={cn(colLabel, "w-fit uppercase")}>
          ← Admin
        </Link>
        <h1 className="text-title">내 패션 훈수 설계</h1>
        <p className="text-sm text-pretty text-neutral-700">
          훈수가 어떤 순서로 만들어지는지 &quot;전체 구조&quot;에서 먼저 보고, 단계마다 &quot;고치러 가기&quot;로 해당 값에 바로 갈 수 있습니다. 고친 뒤
          &quot;저장하기&quot;를 누르면 다음 훈수부터 적용되고, &quot;기본값으로 되돌리기&quot;로 언제든 처음 값으로 돌아갑니다. 판정 계산식 자체(어떤 옷이면 어떤 유형인지)는 코드에 있고, 여기서는
          유형의 켜기·문턱·비중·평가 기준·문장과 대화·결과 구성을 고칩니다.
        </p>
      </div>

      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-neutral-300 bg-bg py-3">
        <div role="tablist" aria-label="설계 구역" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t.id} size="sm" role="tab" aria-selected={tab === t.id} variant={tab === t.id ? "primary" : "secondary"} onClick={() => setTab(t.id)}>
              {t.label}
              {q && counts[t.id] != null ? ` (${counts[t.id]})` : ""}
            </Button>
          ))}
        </div>
        <Input type="search" placeholder="문장·유형·브랜드·상황으로 찾기 (탭마다 찾은 개수가 나옵니다)" aria-label="찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {tab === "structure" && <Structure cfg={cfg} M={M} ctx={ctx} go={go} />}
      {tab === "types" && <Types cfg={cfg} M={M} ctx={ctx} q={q} />}
      {tab === "score" && <Score cfg={cfg} M={M} ctx={ctx} q={q} />}
      {tab === "common" && <Common cfg={cfg} M={M} ctx={ctx} q={q} />}
      {tab === "special" && <Special cfg={cfg} M={M} ctx={ctx} q={q} go={go} />}
      {tab === "quiz" && <Quizzes cfg={cfg} D={D} M={M} ctx={ctx} q={q} />}
      {tab === "screen" && <Screen cfg={cfg} M={M} ctx={ctx} q={q} />}
    </main>
  );
}

type P = { cfg: Cfg; M: Meta; ctx: Ctx };

// ───────────────────────── 전체 구조 ─────────────────────────

function Structure({ cfg, M, ctx, go }: P & { go: (t: Tab, q?: string) => void }) {
  const T = cfg.tune;
  const on = Object.values(cfg.types).filter((t) => t.enabled).length;
  const steps: { title: string; body: ReactNode; tab: Tab; find?: string }[] = [
    { title: "옷 읽기", body: "옷마다 브랜드(가격대·계열·인기)·색·핏(체형 대비 예상 핏 포함)·계절·태그·산 곳을 읽습니다. 옷장은 모자·신발 제외 30벌 이상이어야 시작합니다.", tab: "screen", find: "TOO_FEW" },
    {
      title: "패션 유형 판정",
      body: `유형 ${on}개(전체 ${Object.keys(cfg.types).length}개 중 켜진 것)마다 0~1 적합도를 냅니다. ${T.threshold} 이상인 유형 중 최대 ${T.maxTypes}개를 붙이고(같은 묶음은 2개까지), 적합도 순으로 ${T.blend.join("·")} 비율로 섞습니다.`,
      tab: "types",
    },
    {
      title: "항목 비중·평가 기준 조정",
      body: `기본 비중(옷장 ${M.axes.map((a) => `${a.closet} ${T.weights.closet[a.key as "c"]}`).join(", ")})에 붙은 유형의 비중 변화를 섞어 더하고 100으로 맞춥니다. 유형이 켜는 평가 기준(예: 오버핏 인정)은 섞는 비율 합이 0.3 이상일 때 켜집니다.`,
      tab: "types",
    },
    { title: "항목 점수", body: "다섯 항목을 0~1로 매기고 비중을 곱해 더합니다(0~100). 안목은 브랜드 40% + 코디력 60%로, 코디력은 가격과 상관없이 색 조화·하의/아우터 기본색·로고 절제·기본템(기본색 아우터·데님·무지 상의·기본색 신발)·상하의 짝을 봅니다. 그래서 같은 가격대 옷장도 크게 갈립니다. 브랜드 자료가 적으면 안목 비중을 절반으로 줄입니다.", tab: "score" },
    {
      title: "몰입 보너스 · 감점 · 최종 점수",
      body: `A·B 등급 유형이 붙으면 보너스(옷장 A ${T.bonus.closet.A}·B ${T.bonus.closet.B}, 주문내역 A ${T.bonus.orders.A}·B ${T.bonus.orders.B})를 더합니다. 일관성·핏이 낮으면 보너스가 줄거나 0입니다. 감점: 흔한 옷장(SPA·대중·인기 브랜드 쏠림, 코디력이 좋으면 없음) 최대 ${T.penalty.common}점, 핏 실패(너무 크거나 작은 옷) 최대 ${T.penalty.fit}점. 표시 점수 = ${T.floor} + ${Math.round(100 * T.scale)} × (원점수/100)^${T.curve}로, 곡선이 클수록 중간 점수가 내려갑니다. 퀴즈 정답은 +${T.quizRight}.`,
      tab: "score",
    },
    { title: "대화", body: "아래 '대화 순서'대로 말하고, 중간에 특수 질문(브랜드 퀴즈·밴드·언더아머·짱구·침착맨)과 마지막 '스스로 패셔너블한가요?'를 묻습니다.", tab: "special" },
    { title: "결과 페이지", body: "등급 한 줄(점수 구간) → 아래 '결과 순서' 블록 → 마무리 말 순서로 보여 줍니다.", tab: "score", find: "" },
  ];
  return (
    <div className="flex flex-col">
      <section className={box}>
        <h2 className="text-body font-semibold">훈수가 만들어지는 순서</h2>
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="font-mono text-sm text-neutral-700">{i + 1}</span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-medium">{s.title}</span>
                <span className="text-sm text-pretty text-neutral-700">{s.body}</span>
                <button type="button" className="w-fit text-sm underline underline-offset-4" onClick={() => go(s.tab, s.find)}>
                  고치러 가기 → {TABS.find((t) => t.id === s.tab)!.label}
                </button>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Blocks title="대화 순서" section="talk" value={cfg.talk} defs={M.talkBlocks} M={M} ctx={ctx} go={go} />
      <Blocks title="결과 페이지 순서" section="report" value={cfg.report} defs={M.reportBlocks} M={M} ctx={ctx} go={go} />
    </div>
  );
}

function Blocks({ title, section, value, defs, M, ctx, go }: { title: string; section: "talk" | "report"; value: Cfg["talk"]; defs: Record<string, { name: string; hint: string }>; M: Meta; ctx: Ctx; go: (t: Tab, q?: string) => void }) {
  const s = useSection(section, value, ctx);
  const list = s.draft;
  const move = (i: number, d: number) => {
    const n = [...list];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    s.setDraft(n);
  };
  // 블록이 쓰는 문장으로 가는 바로가기
  const uses = (id: string): { label: string; tab: Tab; find?: string }[] => {
    const key = `${section}:${id}`;
    const common = Object.entries(M.common)
      .filter(([, w]) => w.block === key)
      .map(([k]) => ({ label: `공통 ${k}`, tab: "common" as Tab, find: k.toLowerCase() }));
    const extra: Record<string, { label: string; tab: Tab }[]> = {
      "talk:types": [{ label: "유형별 '근거 말'", tab: "types" }],
      "talk:axes": [{ label: "항목 문장(칭찬·조언)", tab: "score" }],
      "talk:questions": [
        { label: "특수 질문", tab: "special" },
        { label: "패션 퀴즈", tab: "quiz" },
      ],
      "report:types": [{ label: "유형 이름", tab: "types" }],
      "report:points": [{ label: "유형별 근거·칭찬·조언", tab: "types" }, { label: "특수 질문 결과 문단", tab: "special" }],
      "report:axes": [{ label: "항목 문장(구간별)", tab: "score" }],
    };
    return [...(extra[key] ?? []), ...common];
  };
  return (
    <section className={box}>
      <h2 className="text-body font-semibold">{title}</h2>
      <p className="text-sm text-neutral-700">
        {section === "talk" ? "위에서부터 차례로 말합니다." : "등급 한 줄 다음에 위에서부터 차례로 보여 줍니다."} 화살표로 순서를 바꾸고, 끈 블록은 건너뜁니다.
      </p>
      <SaveBar s={s} />
      <ol className="flex flex-col">
        {list.map((b, i) => (
          <li key={b.id} className={cn("flex flex-wrap items-start gap-3 border-t border-neutral-200 py-3", !b.on && "opacity-60")}>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </Button>
              <Button size="sm" variant="ghost" aria-label="아래로" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                ↓
              </Button>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-medium">
                {i + 1}. {defs[b.id]?.name ?? b.id}
              </span>
              <span className="text-sm text-neutral-700">{defs[b.id]?.hint}</span>
              <span className="flex flex-wrap gap-2 text-sm">
                {uses(b.id).map((u) => (
                  <button key={u.label} type="button" className="underline underline-offset-4" onClick={() => go(u.tab, u.find)}>
                    {u.label}
                  </button>
                ))}
              </span>
            </span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={b.on} onChange={(e) => s.setDraft(list.map((x) => (x.id === b.id ? { ...x, on: e.target.checked } : x)))} />
              켜기
            </label>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────────────────────── 패션 유형 ─────────────────────────

function Types({ cfg, M, ctx, q }: P & { q: string }) {
  const [group, setGroup] = useState<string>("all");
  const filters = [{ id: "all", name: "전체" }, ...M.groups, { id: "off", name: "꺼진 유형" }, { id: "edited", name: "고친 유형" }, { id: "bonus", name: "보너스 유형(A·B)" }];
  const shown = M.types.filter((t) => {
    const c = cfg.types[t.id];
    if (group === "off" && c.enabled) return false;
    if (group === "edited" && !ctx.edited.has(`type.${t.id}`)) return false;
    if (group === "bonus" && c.grade === "-") return false;
    if (!["all", "off", "edited", "bonus"].includes(group) && t.group !== group) return false;
    return has({ id: t.id, c }, q);
  });
  return (
    <div className="flex flex-col">
      <p className="py-3 text-sm text-pretty text-neutral-700">
        유형은 &quot;이 사람이 어떤 옷을 입는 사람인가&quot;입니다. 붙은 유형이 점수 항목의 비중과 평가 기준을 바꾸고, 대화·결과의 문장을 정합니다. &quot;이런 사람&quot;·&quot;이렇게 평가&quot;는 설명용(관리자·문서)이고, 문장
        세 종류가 실제로 나옵니다.
      </p>
      <div className="flex flex-wrap gap-2 pb-3">
        {filters.map((f) => (
          <Button key={f.id} size="sm" variant={group === f.id ? "primary" : "ghost"} onClick={() => setGroup(f.id)}>
            {f.name}
          </Button>
        ))}
      </div>
      <ul className="flex flex-col border-t border-neutral-300">
        {shown.map((t) => (
          <TypeCard key={t.id} id={t.id} meta={t} value={cfg.types[t.id]} cfg={cfg} M={M} ctx={ctx} open={Boolean(q) && shown.length <= 3} />
        ))}
      </ul>
      {!shown.length && <p className="py-6 text-sm text-neutral-700">맞는 유형이 없습니다.</p>}
    </div>
  );
}

const GRADE_NAME: Record<string, string> = { A: "A · 큰 보너스", B: "B · 중간 보너스", "-": "보너스 없음" };
const MODE_NAME: Record<string, string> = { both: "옷장·주문내역", closet: "옷장만", orders: "주문내역만" };

function TypeCard({ id, meta, value, cfg, M, ctx, open }: { id: string; meta: Meta["types"][number]; value: TypeConf; cfg: Cfg; M: Meta; ctx: Ctx; open: boolean }) {
  const s = useSection(`type.${id}`, value, ctx);
  const d = s.draft;
  const set = (patch: Partial<TypeConf>) => s.setDraft({ ...d, ...patch });
  const groupName = M.groups.find((g) => g.id === meta.group)?.name;
  const v = M.vars.type;
  return (
    <Fold
      open={open}
      title={value.name}
      sub={value.who}
      badges={
        <>
          <Badge tone="muted">{groupName}</Badge>
          {value.grade !== "-" && <Badge>{value.grade}</Badge>}
          {!value.enabled && <Badge>꺼짐</Badge>}
          {s.edited && <Badge>직접 고침</Badge>}
        </>
      }
    >
      <SaveBar s={s} sticky label={value.name} />
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">이름</span>
          <Input value={d.name} onChange={(e) => set({ name: e.target.value })} className="w-48" />
        </label>
        <label className="flex items-center gap-1.5 self-end pb-2 text-sm">
          <input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} />이 유형 쓰기
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">몰입 보너스</span>
          <select className="input w-44" value={d.grade} onChange={(e) => set({ grade: e.target.value as TypeConf["grade"] })}>
            {Object.entries(GRADE_NAME).map(([g, n]) => (
              <option key={g} value={g}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Num label="판정 문턱" step={0.05} value={d.threshold} placeholder={String(cfg.tune.threshold)} onChange={(n) => set({ threshold: n })} hint="비우면 전체 기본값" />
      </div>
      <p className="text-xs text-neutral-700">
        id {id} · {MODE_NAME[meta.mode]} · 같은 적합도일 때 우선순위 {meta.priority}
      </p>
      <Text label="이런 사람" hint="관리자용 설명. 어떤 옷장이 이 유형으로 잡히는지" value={d.who} onChange={(t) => set({ who: t })} />
      <Text label="이렇게 평가" hint="관리자용 설명. 이 유형일 때 무엇을 다르게 보는지" value={d.how} onChange={(t) => set({ how: t })} rows={3} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">항목 비중 변화</span>
        <span className="text-xs text-neutral-700">기본 비중에 더합니다(-30~30). 유형이 여럿이면 섞는 비율만큼만 더하고, 합을 100으로 다시 맞춥니다.</span>
        <div className="flex flex-wrap gap-3">
          {M.axes.map((a) => (
            <Num
              key={a.key}
              label={`${a.closet} (기본 ${a.base.closet})`}
              value={d.w[a.key as keyof TypeConf["w"]] ?? 0}
              onChange={(n) => set({ w: { ...d.w, [a.key]: n ?? 0 } })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">이 유형이 켜는 평가 기준</span>
        <span className="text-xs text-neutral-700">켠 기준은 이 유형이 붙었을 때 항목 점수 계산 방식을 바꿉니다.</span>
        {M.rules.map((r) => (
          <label key={r.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={d.rules.includes(r.id as TypeConf["rules"][number])}
              onChange={(e) => set({ rules: e.target.checked ? [...d.rules, r.id as TypeConf["rules"][number]] : d.rules.filter((x) => x !== r.id) })}
            />
            <span className={cn(!d.rules.includes(r.id as TypeConf["rules"][number]) && "text-neutral-700")}>{r.text}</span>
          </label>
        ))}
      </div>

      <List label="근거를 짚는 말" hint={`대화 '유형 이야기'에서 ${cfg.tune.talkLines}개까지, 결과 '유형별 진단' 문단의 첫 문장으로 나옵니다.`} value={d.lines.say} onChange={(l) => set({ lines: { ...d.lines, say: l } })} vars={v} />
      <List label="칭찬" hint="결과 '유형별 진단' 문단 가운데" value={d.lines.praise} onChange={(l) => set({ lines: { ...d.lines, praise: l } })} vars={v} />
      <List label="이것만 바꾸면" hint="결과 '유형별 진단' 문단 끝 조언" value={d.lines.tip} onChange={(l) => set({ lines: { ...d.lines, tip: l } })} vars={v} />
    </Fold>
  );
}

// ───────────────────────── 점수 기준 ─────────────────────────

function Score({ cfg, M, ctx, q }: P & { q: string }) {
  return (
    <div className="flex flex-col">
      {!q && <Tune value={cfg.tune} M={M} ctx={ctx} />}
      <Bands value={cfg.bands} ctx={ctx} q={q} />
      <AxisLines value={cfg.axisLines} M={M} ctx={ctx} q={q} />
    </div>
  );
}

function Tune({ value, M, ctx }: { value: Cfg["tune"]; M: Meta; ctx: Ctx }) {
  const s = useSection("tune", value, ctx);
  const d = s.draft;
  const set = (patch: Partial<Cfg["tune"]>) => s.setDraft({ ...d, ...patch });
  const n = (k: keyof Cfg["tune"], label: string, hint: string, step = 1) => (
    <Num label={label} hint={hint} step={step} value={d[k] as number} onChange={(v) => set({ [k]: v ?? 0 } as Partial<Cfg["tune"]>)} />
  );
  return (
    <section className={box}>
      <h2 className="text-body font-semibold">숫자 설정</h2>
      <SaveBar s={s} />
      <h3 className="text-sm font-semibold">유형 판정</h3>
      <div className="flex flex-wrap gap-4">
        {n("threshold", "판정 문턱", "적합도가 이 값 이상이면 유형이 붙습니다(0.3~0.95)", 0.05)}
        {n("maxTypes", "유형 최대 수", "한 사람에게 붙는 유형 수(1~6)")}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">섞는 비율(%)</span>
          <Input key={d.blend.join(",")} className="w-40 font-mono" defaultValue={d.blend.join(",")} onBlur={(e) => set({ blend: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).map(Number).filter((x) => !Number.isNaN(x)) })} />
          <span className="text-xs text-neutral-700">적합도 순서대로, 쉼표로 구분</span>
        </label>
      </div>
      <h3 className="text-sm font-semibold">항목 기본 비중</h3>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="pr-3 text-left font-medium">항목</th>
              <th className="pr-3 text-left font-medium">옷장</th>
              <th className="text-left font-medium">주문내역</th>
            </tr>
          </thead>
          <tbody>
            {M.axes.map((a) => (
              <tr key={a.key}>
                <td className="pr-3 py-1">
                  {a.closet} / {a.orders}
                </td>
                {(["closet", "orders"] as const).map((m) => (
                  <td key={m} className="pr-3 py-1">
                    <Input
                      type="number"
                      className="w-20 text-right font-mono"
                      value={d.weights[m][a.key as "c"]}
                      onChange={(e) => set({ weights: { ...d.weights, [m]: { ...d.weights[m], [a.key]: Number(e.target.value) } } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-sm font-semibold">몰입 보너스 · 감점 · 점수 환산</h3>
      <div className="flex flex-wrap gap-4">
        {(["closet", "orders"] as const).flatMap((m) =>
          (["A", "B"] as const).map((g) => (
            <Num
              key={m + g}
              label={`${m === "closet" ? "옷장" : "주문내역"} ${g} 보너스`}
              value={d.bonus[m][g]}
              onChange={(v) => set({ bonus: { ...d.bonus, [m]: { ...d.bonus[m], [g]: v ?? 0 } } })}
            />
          )),
        )}
        {n("floor", "최저 점수", "표시 점수 = 최저 + 100×환산×(원점수/100)^곡선")}
        {n("scale", "환산 계수", "0.3~1", 0.01)}
        {n("curve", "곡선", "1이면 직선, 클수록 중간 점수가 낮아짐(1~2.5)", 0.05)}
        <Num label="감점: 흔한 옷장" hint="SPA·대중·인기 브랜드가 35%를 넘으면 늘어남(코디력이 좋거나 보너스를 받으면 줄어듦)" value={d.penalty.common} onChange={(v) => set({ penalty: { ...d.penalty, common: v ?? 0 } })} />
        <Num label="감점: 핏 실패" hint="너무 크거나 작은 옷 비율(40%면 최대)" value={d.penalty.fit} onChange={(v) => set({ penalty: { ...d.penalty, fit: v ?? 0 } })} />
      </div>
      <h3 className="text-sm font-semibold">자료가 적을 때 · 대화 · 질문</h3>
      <div className="flex flex-wrap gap-4">
        {n("knownMin", "브랜드 자료 비율", "이보다 적으면 안목 비중 절반(0~1)", 0.05)}
        {n("ordersMin", "주문내역 최소 구매 수", "이보다 적으면 구매 규율 비중 절반")}
        {n("talkTypes", "대화에서 말할 유형 수", "0~4")}
        {n("talkLines", "유형당 근거 문장 수", "1~4")}
        {n("tierHigh", "패셔너블 질문: 높음 경계", "이 점수 이상이면 높음 반응")}
        {n("tierLow", "패셔너블 질문: 낮음 경계", "이 점수 미만이면 낮음 반응")}
        {n("quizRight", "퀴즈 정답 점수", "원점수에 더함")}
        {n("quizWrong", "퀴즈 오답 점수", "원점수에 더함(음수면 감점)")}
      </div>
    </section>
  );
}

function Bands({ value, ctx, q }: { value: Cfg["bands"]; ctx: Ctx; q: string }) {
  const s = useSection("bands", value, ctx);
  const d = s.draft;
  if (q && !d.some((b) => has(b, q))) return null;
  const set = (i: number, patch: Partial<Cfg["bands"][number]>) => s.setDraft(d.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <section className={box}>
      <h2 className="text-body font-semibold">점수 구간(등급)</h2>
      <p className="text-sm text-neutral-700">결과 맨 위 한 줄입니다. 표시 점수가 &quot;이하&quot; 값 안에 드는 첫 구간을 씁니다. 마지막 구간은 100이어야 합니다.</p>
      <SaveBar s={s} />
      {d.map((b, i) => (
        <div key={i} className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <Num label="이하" value={b.max} onChange={(n) => set(i, { max: n ?? 0 })} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">등급 이름</span>
              <Input className="w-40" value={b.name} onChange={(e) => set(i, { name: e.target.value })} />
            </label>
            <Button size="sm" variant="ghost" disabled={d.length <= 2} onClick={() => s.setDraft(d.filter((_, j) => j !== i))}>
              이 구간 빼기
            </Button>
          </div>
          <List label="등급 한 줄" value={b.say} onChange={(l) => set(i, { say: l })} vars={[{ key: "score", label: "점수" }]} />
        </div>
      ))}
      <Button size="sm" variant="ghost" className="w-fit" onClick={() => s.setDraft([...d, { max: 100, name: "새 구간", say: ["{score}점입니다."] }])}>
        + 구간 추가
      </Button>
    </section>
  );
}

const LEVEL_NAME = { low: "낮을 때(0.45 미만)", mid: "보통(0.72 미만)", high: "높을 때", praise: "대화: 가장 높은 항목 칭찬", tip: "대화: 가장 낮은 항목 조언" } as const;

function AxisLines({ value, M, ctx, q }: { value: Cfg["axisLines"]; M: Meta; ctx: Ctx; q: string }) {
  const s = useSection("axisLines", value, ctx);
  const d = s.draft;
  return (
    <section className={box}>
      <h2 className="text-body font-semibold">항목 문장</h2>
      <p className="text-sm text-neutral-700">결과 &quot;항목별 점수&quot;에는 점수 구간(낮음·보통·높음)의 문장이, 대화 &quot;항목 칭찬·조언&quot;에는 칭찬·조언 문장이 나옵니다.</p>
      <SaveBar s={s} sticky />
      <ul className="flex flex-col">
        {M.axes
          .filter((a) => has({ a, v: d[a.key as "c"] }, q))
          .map((a) => (
            <Fold key={a.key} title={`${a.closet} / ${a.orders}`} open={Boolean(q)}>
              {(Object.keys(LEVEL_NAME) as (keyof typeof LEVEL_NAME)[]).map((lv) => (
                <List
                  key={lv}
                  label={LEVEL_NAME[lv]}
                  value={d[a.key as "c"][lv]}
                  onChange={(l) => s.setDraft({ ...d, [a.key]: { ...d[a.key as "c"], [lv]: l } })}
                  vars={M.vars.axis}
                />
              ))}
            </Fold>
          ))}
      </ul>
    </section>
  );
}

// ───────────────────────── 공통 문장 ─────────────────────────

function Common({ cfg, M, ctx, q }: P & { q: string }) {
  const s = useSection("common", cfg.common, ctx);
  const d = s.draft;
  const keys = (Object.keys(M.common) as (keyof Cfg["common"])[]).filter((k) => has({ k, v: d[k], w: M.common[k] }, q));
  return (
    <div className="flex flex-col">
      <p className="py-3 text-sm text-neutral-700">대화와 결과 곳곳에서 쓰는 문장입니다. 제목 아래에 언제 나오는지 적혀 있습니다.</p>
      <SaveBar s={s} sticky />
      <ul className="flex flex-col">
        {keys.map((k) => (
          <Fold key={k} title={M.common[k].where} sub={<code>{k}</code>} open={Boolean(q)}>
            <List value={d[k]} onChange={(l) => s.setDraft({ ...d, [k]: l })} vars={M.vars.common} />
          </Fold>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── 특수 질문 ─────────────────────────

const SPECIAL_KEY: Record<string, string> = {
  right: "맞혔을 때",
  wrong: "틀렸을 때",
};
const keyName = (k: string) => {
  const m = k.match(/^(high|mid|low)_(.+)$/);
  if (m) return `${{ high: "점수 높음", mid: "점수 중간", low: "점수 낮음" }[m[1]]} × 답 '${m[2]}'`;
  return SPECIAL_KEY[k] ?? `답 '${k}'`;
};

function Special({ cfg, M, ctx, q, go }: P & { q: string; go: (t: Tab, q?: string) => void }) {
  const s = useSection("special", cfg.special, ctx);
  const d = s.draft;
  const ids = Object.keys(d).filter((id) => has({ id, v: d[id], w: M.special[id] }, q));
  return (
    <div className="flex flex-col">
      <p className="py-3 text-sm text-pretty text-neutral-700">
        조건이 맞으면 대화 &quot;질문·퀴즈&quot; 블록에서 꼭 묻는 재미용 질문입니다. 앞말 → 질문 → 고른 답에 대한 바로 반응(대화) → 결과 페이지 문단 순으로 쓰입니다. 브랜드 퀴즈 문제는{" "}
        <button type="button" className="underline underline-offset-4" onClick={() => go("quiz")}>
          패션 퀴즈
        </button>
        에서 고칩니다.
      </p>
      <SaveBar s={s} sticky />
      <ul className="flex flex-col">
        {ids.map((id) => {
          const x = d[id];
          const set = (patch: Partial<typeof x>) => s.setDraft({ ...d, [id]: { ...x, ...patch } });
          const v = M.vars.special;
          return (
            <Fold key={id} title={M.special[id]?.name ?? id} sub={`언제: ${M.special[id]?.when ?? ""}`} open={Boolean(q)}>
              <List label="앞말" hint="질문 전에 차례로 모두 말합니다(여러 줄 전부 나옴)" value={x.lead} onChange={(l) => set({ lead: l })} min={0} />
              {id !== "quiz" && <Text label="질문" value={x.text} onChange={(t) => set({ text: t })} />}
              {Object.keys(x.options).length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">선택지</span>
                  {Object.entries(x.options).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <code className="w-16 shrink-0">{k}</code>
                      <Input value={label} onChange={(e) => set({ options: { ...x.options, [k]: e.target.value } })} />
                    </label>
                  ))}
                </div>
              )}
              {Object.entries(x.react).map(([k, l]) => (
                <List key={`r${k}`} label={`바로 반응 · ${keyName(k)}`} value={l} onChange={(nl) => set({ react: { ...x.react, [k]: nl } })} />
              ))}
              {Object.entries(x.roast).map(([k, l]) => (
                <List key={`p${k}`} label={`결과 문단 · ${keyName(k)}`} value={l} onChange={(nl) => set({ roast: { ...x.roast, [k]: nl } })} />
              ))}
              <Vars vars={v} />
            </Fold>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── 패션 퀴즈 ─────────────────────────

function Quizzes({ cfg, D, M, ctx, q }: P & { D: Cfg; q: string }) {
  const [fresh, setFresh] = useState<string[]>([]);
  const ids = useMemo(() => {
    const all = new Set([...fresh, ...Object.keys(cfg.quiz), ...Object.keys(D.quiz)]);
    return [...all];
  }, [cfg.quiz, D.quiz, fresh]);
  const add = () => setFresh((f) => [`c-${Math.random().toString(36).slice(2, 10)}`, ...f]);
  const shown = ids.filter((id) => has(cfg.quiz[id] ?? D.quiz[id] ?? id, q));
  return (
    <div className="flex flex-col">
      <p className="py-3 text-sm text-pretty text-neutral-700">
        가진 브랜드 중 퀴즈가 있는 브랜드가 있으면 하나를 골라 냅니다. 정답이면 원점수 +{cfg.tune.quizRight}. 바로 반응 첫마디(정답·오답)와 결과 문단은 &quot;공통 문장&quot;에 있습니다.
      </p>
      <div className="pb-3">
        <Button size="sm" onClick={add}>
          + 새 퀴즈 만들기
        </Button>
      </div>
      <datalist id="roast-brands">
        {M.brands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <ul className="flex flex-col border-t border-neutral-300">
        {shown.map((id) => (
          <QuizCard
            key={id}
            id={id}
            builtIn={id in D.quiz}
            value={cfg.quiz[id] ?? D.quiz[id] ?? { brand: "", answer: 0, question: "", options: ["", "", "", ""], correct: [""], wrong: [""] }}
            deleted={id in D.quiz && !cfg.quiz[id]}
            isNew={!(id in D.quiz) && !cfg.quiz[id]}
            ctx={ctx}
            open={fresh.includes(id) && !cfg.quiz[id]}
            onGone={() => setFresh((f) => f.filter((x) => x !== id))}
          />
        ))}
      </ul>
    </div>
  );
}

function QuizCard({ id, builtIn, value, deleted, isNew, ctx, open, onGone }: { id: string; builtIn: boolean; value: Quiz; deleted: boolean; isNew: boolean; ctx: Ctx; open: boolean; onGone: () => void }) {
  const s = useSection(`quiz.${id}`, value, ctx);
  const d = s.draft;
  const set = (patch: Partial<Quiz>) => s.setDraft({ ...d, ...patch });
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      if (!confirm("이 퀴즈를 지울까요?")) return;
      const r = builtIn ? await saveDesignSection(`quiz.${id}`, { deleted: true }) : await resetDesignSection(`quiz.${id}`);
      if (!r.ok) return alert(r.error);
      ctx.onSaved(`quiz.${id}`, builtIn ? { deleted: true } : undefined);
      if (!builtIn) onGone();
    });
  return (
    <Fold
      open={open}
      title={d.brand || "새 퀴즈"}
      sub={`${d.question || "문제를 써 주세요"}${d.options[d.answer] ? ` · 정답: ${d.answer + 1}번` : ""}`}
      badges={
        <>
          {deleted && <Badge>지움</Badge>}
          {!builtIn && <Badge tone="muted">새 퀴즈</Badge>}
          {builtIn && s.edited && !deleted && <Badge>직접 고침</Badge>}
        </>
      }
    >
      {deleted ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-700">지운 기본 퀴즈입니다. 되살리면 처음 문제로 돌아옵니다.</span>
          <Button size="sm" disabled={s.pending} onClick={s.reset}>
            되살리기
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SaveBar s={{ ...s, dirty: s.dirty || isNew, edited: builtIn && s.edited }} />
            <Button size="sm" variant="ghost" disabled={pending} onClick={remove}>
              퀴즈 지우기
            </Button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">브랜드</span>
            <Input list="roast-brands" className="w-64" value={d.brand} onChange={(e) => set({ brand: e.target.value })} />
            <span className="text-xs text-neutral-700">이 브랜드 옷이 있는 사람에게 나옵니다(브랜드 자료에 있는 이름).</span>
          </label>
          <Text label="문제" value={d.question} onChange={(t) => set({ question: t })} />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">선택지(정답에 표시, 화면에서는 섞여 나옴)</span>
            {d.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name={`ans-${id}`} aria-label={`${i + 1}번 정답`} checked={d.answer === i} onChange={() => set({ answer: i })} />
                <Input value={o} onChange={(e) => set({ options: d.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={d.options.length <= 2}
                  onClick={() => set({ options: d.options.filter((_, j) => j !== i), answer: d.answer > i ? d.answer - 1 : d.answer === i ? 0 : d.answer })}
                >
                  빼기
                </Button>
              </div>
            ))}
            {d.options.length < 6 && (
              <Button size="sm" variant="ghost" className="w-fit" onClick={() => set({ options: [...d.options, ""] })}>
                + 선택지 추가
              </Button>
            )}
          </div>
          <List label="맞혔을 때 설명" value={d.correct} onChange={(l) => set({ correct: l })} />
          <List label="틀렸을 때 설명" value={d.wrong} onChange={(l) => set({ wrong: l })} />
        </>
      )}
    </Fold>
  );
}

// ───────────────────────── 화면 문구 ─────────────────────────

function Screen({ cfg, M, ctx, q }: P & { q: string }) {
  return (
    <div className="flex flex-col">
      <ScreenPart title="옷장 훈수 화면" section="screen" value={cfg.screen} M={M} ctx={ctx} q={q} />
      <ScreenPart title="주문내역 훈수 화면" section="orderScreen" value={cfg.orderScreen} M={M} ctx={ctx} q={q} />
    </div>
  );
}

function ScreenPart({ title, section, value, M, ctx, q }: { title: string; section: "screen" | "orderScreen"; value: Cfg["screen"]; M: Meta; ctx: Ctx; q: string }) {
  const s = useSection(section, value, ctx);
  const d = s.draft;
  const keys = Object.keys(d).filter((k) => has({ k, v: d[k], w: M.screen[k] }, q));
  if (!keys.length) return null;
  return (
    <section className={box}>
      <h2 className="text-body font-semibold">{title}</h2>
      <p className="text-sm text-neutral-700">버튼·안내 등 훈수 화면에 그대로 나오는 글입니다. **굵게**와 {"{n}"} 같은 자리는 원래 쓰던 그대로 둡니다.</p>
      <SaveBar s={s} sticky />
      <ul className="flex flex-col">
        {keys.map((k) => {
          const v = d[k];
          return (
            <Fold key={k} title={M.screen[k] ?? k} sub={<code>{k}</code>} open={Boolean(q)}>
              {Array.isArray(v) ? (
                <List value={v} onChange={(l) => s.setDraft({ ...d, [k]: l })} />
              ) : (
                <Text value={v} onChange={(t) => s.setDraft({ ...d, [k]: t })} rows={Math.min(6, Math.max(2, Math.ceil(v.length / 60)))} />
              )}
            </Fold>
          );
        })}
      </ul>
    </section>
  );
}

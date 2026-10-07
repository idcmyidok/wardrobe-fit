"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWardrobe, type ImageChange } from "@/components/wardrobe/wardrobe-store";
import {
  EMPTY_FORM,
  FIELD_IDS,
  GarmentFields,
  draftToForm,
  formToDraft,
  importedForm,
  itemView,
  newItemState,
  type Imported,
  type ItemState,
} from "./garment-fields";
import { cn } from "@/lib/cn";
import { importImageFile, streamImport, type AnalyzeStage, type ImportOutcome } from "@/lib/import/client";
import { importFailure } from "@/lib/import/messages";
import { takeStashedDraft } from "@/lib/session-expiry";
import { notifyUsageChanged } from "@/lib/usage";
import { UsageNote } from "@/components/usage/usage-note";

type Phase = "url" | "analyzing" | "failed" | "review" | "manual" | "multi";

/** 한 번에 가져올 수 있는 링크 수 */
const MAX_LINKS = 5;

const ANALYZE_STEPS: { stage: AnalyzeStage; label: string }[] = [
  { stage: "fetching", label: "페이지 불러오는 중" },
  { stage: "parsing", label: "상품 정보 읽는 중" },
  { stage: "normalizing", label: "사이즈표·컬러 정리 중" },
];

/** 붙여 넣은 글에서 링크만 뽑는다(공백·줄바꿈·쉼표로 구분, 같은 링크는 한 번만). */
export function extractLinks(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t && !seen.has(t) && seen.add(t));
}

/** 여러 링크 가져오기의 한 벌 */
interface MultiItem {
  key: number;
  url: string;
  status: "waiting" | "analyzing" | "ready" | "failed";
  step: number;
  imported: Imported | null;
  failure: ImportOutcome | null;
  state: ItemState;
  fieldErrors: Record<string, string>;
  error: string | null;
}

const FAILED_OUTCOME = (url: string): ImportOutcome => ({ importId: null, status: "failed", reused: false, domain: null, sourceUrl: url, parserId: null, durationMs: 0, product: null, errorCode: "network_error", errorDetail: null });

/** 새 옷 추가: 상품 링크 분석(분석 중 / 실패) → 검토 폼, 링크 여러 개(최대 5개) → 세로로 나열한 검토 폼, 또는 직접 입력 폼 */
export function NewGarmentView() {
  const router = useRouter();
  const params = useSearchParams();
  const { addGarment, updateGarment, allGarments, garmentHref, showToast, pendingDraft, setPendingDraft } = useWardrobe();
  // 구매 보류 옷 추가(?held=1): 구매일·시즌·내 핏 없이 "가격"만 받는다.
  const [held] = useState(() => params.get("held") === "1" || Boolean(pendingDraft?.held && !pendingDraft.heldId));
  // 구매 보류 옷을 옷장으로 옮기는 중이면 그 옷 id. 저장하면 새로 만들지 않고 그 옷을 옷장 옷으로 바꾼다(사진 그대로).
  const [movingId] = useState(() => pendingDraft?.heldId ?? null);
  const moving = movingId ? allGarments.find((g) => g.id === movingId) : undefined;
  // 구매 판단기에서 넘어온 판단 기록 id(판단 결과 보기 링크)
  const [fitCheckId] = useState(() => pendingDraft?.fitCheckId ?? null);

  const [phase, setPhase] = useState<Phase>(() => (pendingDraft ? "review" : params.get("mode") === "manual" ? "manual" : "url"));
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [item, setItem] = useState<ItemState>(() => newItemState(pendingDraft ? draftToForm(pendingDraft) : EMPTY_FORM));
  const [imported, setImported] = useState<Imported | null>(null);
  const [failure, setFailure] = useState<ImportOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [items, setItems] = useState<MultiItem[]>([]);
  const request = useRef<AbortController | null>(null);
  const form = item.form;

  // 판단기에서 넘어온 값은 한 번만 쓴다.
  useEffect(() => {
    if (pendingDraft) setPendingDraft(null);
  }, [pendingDraft, setPendingDraft]);

  // 로그인이 풀려 다시 로그인하고 돌아온 경우, 작성하던 값을 되살린다.
  useEffect(() => {
    const stashed = takeStashedDraft();
    if (!stashed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage는 hydration 뒤에만 읽을 수 있다
    setItem(newItemState(draftToForm(stashed)));
    setPhase("manual");
  }, []);

  // 분석 경과 시간(초)
  useEffect(() => {
    if (phase !== "analyzing" && phase !== "multi") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  /** 진행 중인 분석을 멈춘다(취소, 화면 이동). */
  const cancelRequest = () => {
    request.current?.abort();
    request.current = null;
  };
  useEffect(() => cancelRequest, []);

  /** 링크 하나를 분석한다. 취소되면 null. */
  const runOne = async (target: string, controller: AbortController, onStage: (stage: AnalyzeStage) => void): Promise<ImportOutcome | null> => {
    let outcome: ImportOutcome;
    try {
      outcome = await streamImport(target, { signal: controller.signal, onStage });
    } catch {
      if (controller.signal.aborted) return null;
      outcome = FAILED_OUTCOME(target);
    }
    if (controller.signal.aborted) return null;
    notifyUsageChanged();
    return outcome;
  };

  const patchItem = (key: number, patch: Partial<MultiItem> | ((m: MultiItem) => Partial<MultiItem>)) =>
    setItems((list) => list.map((m) => (m.key === key ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)));

  const analyzeMany = async (links: string[]) => {
    cancelRequest();
    const controller = new AbortController();
    request.current = controller;
    setStartedAt(Date.now());
    setNow(Date.now());
    setItems(links.map((u, key) => ({ key, url: u, status: "waiting", step: 0, imported: null, failure: null, state: newItemState(EMPTY_FORM), fieldErrors: {}, error: null })));
    setPhase("multi");
    for (const [key, target] of links.entries()) {
      patchItem(key, { status: "analyzing", step: 0 });
      const outcome = await runOne(target, controller, (stage) => patchItem(key, { step: ANALYZE_STEPS.findIndex((s) => s.stage === stage) }));
      if (!outcome) return;
      if (outcome.status !== "failed" && outcome.product && outcome.importId) {
        const result = outcome as Imported;
        patchItem(key, { status: "ready", imported: result, state: newItemState(importedForm(target, result.product)) });
      } else {
        patchItem(key, { status: "failed", failure: outcome });
      }
    }
    request.current = null;
  };

  const analyze = async () => {
    const links = extractLinks(url);
    if (links.length === 0) {
      document.getElementById("new-url")?.focus();
      return;
    }
    if (links.length > MAX_LINKS) {
      setLinkError(`한 번에 ${MAX_LINKS}개까지 가져올 수 있어요. ${links.length - MAX_LINKS}개를 지워 주세요.`);
      return;
    }
    setLinkError(null);
    if (links.length > 1) {
      await analyzeMany(links);
      return;
    }
    const target = links[0];
    cancelRequest();
    const controller = new AbortController();
    request.current = controller;
    setPhase("analyzing");
    setStartedAt(Date.now());
    setNow(Date.now());
    setStep(0);
    setShowDetail(false);
    setFailure(null);
    const outcome = await runOne(target, controller, (stage) => setStep(ANALYZE_STEPS.findIndex((s) => s.stage === stage)));
    if (!outcome) return;
    request.current = null;
    if (outcome.status !== "failed" && outcome.product && outcome.importId) {
      const result = outcome as Imported;
      setImported(result);
      setItem(newItemState(importedForm(target, result.product)));
      setPhase("review");
    } else {
      setFailure(outcome);
      setPhase("failed");
    }
  };

  /** 직접 입력으로. 실패했어도 분석에서 얻은 값(부분 결과)과 링크는 채워 넘긴다. */
  const startManual = (keepUrl = false) => {
    cancelRequest();
    const partial = keepUrl ? failure?.product : null;
    const link = extractLinks(url)[0] ?? "";
    setItem(newItemState(partial ? importedForm(link, partial) : { ...EMPTY_FORM, url: keepUrl ? link : "" }));
    setImported(null);
    setPhase("manual");
  };

  const isReview = phase === "review";
  const showForm = phase === "review" || phase === "manual";
  const { product, chosenUrl } = itemView(item, isReview ? imported : null);
  const partial = imported?.status === "partial";
  // 옷장에서 쓰지 않는 열을 뺐다는 안내는 보이지 않는다(예전 분석 결과에 남아 있을 수 있다).
  const notices = product?.warnings.filter((w) => w.code !== "size_chart_unmapped_columns") ?? [];

  const register = async () => {
    if (saving) return;
    // 제품명은 필수(브랜드는 비워도 된다): 비어 있으면 등록하지 않고 제품명 칸으로 보낸다.
    if (!form.productName.trim()) {
      document.getElementById("f-name")?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const draft = formToDraft(form, held, fitCheckId);
    const pickedImage = item.image === undefined && isReview && chosenUrl ? await importImageFile(chosenUrl) : item.image;
    const result = movingId
      ? await updateGarment(movingId, { ...draft, imageUrl: moving?.imageUrl ?? null, thumbUrl: moving?.thumbUrl ?? null, held: false }, pickedImage)
      : await addGarment(draft, pickedImage, imported?.importId ?? null);
    setSaving(false);
    if (!result.ok) {
      const fields = result.fieldErrors ?? {};
      setError(Object.keys(fields).some((k) => FIELD_IDS[k]) ? "표시한 칸을 확인해 주세요." : result.error);
      setFieldErrors(fields);
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) document.getElementById(FIELD_IDS[first] ?? "")?.focus();
      return;
    }
    if (held) {
      showToast(result.warning ?? "구매 보류 옷에 추가했습니다");
      router.push("/fit-check#held");
      return;
    }
    showToast(result.warning ?? (movingId ? "옷장으로 옮겼습니다" : "옷장에 등록했습니다"));
    router.push(garmentHref(result.garment.id));
  };

  // ---- 여러 링크 ----
  const busy = items.some((m) => m.status === "waiting" || m.status === "analyzing");
  const readyItems = items.filter((m) => m.status === "ready");

  /** 실패한 벌을 직접 입력 폼으로 바꾼다(읽은 값과 링크는 채워 둔다). */
  const fillByHand = (m: MultiItem) => {
    const partialProduct = m.failure?.product;
    patchItem(m.key, { status: "ready", imported: null, state: newItemState(partialProduct ? importedForm(m.url, partialProduct) : { ...EMPTY_FORM, url: m.url }) });
  };

  const registerAll = async () => {
    if (saving || busy || readyItems.length === 0) return;
    const empty = readyItems.find((m) => !m.state.form.productName.trim());
    if (empty) {
      patchItem(empty.key, { error: "제품명은 꼭 입력해야 합니다." });
      document.getElementById(`m${empty.key}-f-name`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    let done = 0;
    let lastWarning: string | undefined;
    for (const m of readyItems) {
      const draft = formToDraft(m.state.form, held, null);
      const v = itemView(m.state, m.imported);
      const picked: ImageChange = m.state.image === undefined && m.imported && v.chosenUrl ? await importImageFile(v.chosenUrl) : m.state.image;
      const result = await addGarment(draft, picked, m.imported?.importId ?? null);
      if (result.ok) {
        done++;
        lastWarning = result.warning ?? lastWarning;
        setItems((list) => list.filter((x) => x.key !== m.key));
      } else {
        const fields = result.fieldErrors ?? {};
        patchItem(m.key, { fieldErrors: fields, error: Object.keys(fields).some((k) => FIELD_IDS[k]) ? "표시한 칸을 확인해 주세요." : result.error });
      }
    }
    setSaving(false);
    if (done === readyItems.length) {
      showToast(lastWarning ?? `${done}벌을 ${held ? "구매 보류 옷에 추가" : "옷장에 등록"}했습니다`);
      router.push(held ? "/fit-check#held" : "/wardrobe");
    } else {
      setError(`${done}벌만 등록했습니다. 남은 옷의 안내를 확인하고 다시 눌러 주세요.`);
    }
  };

  const hint = error
    ? error
    : !form.productName.trim()
      ? "제품명은 꼭 입력해야 합니다."
      : isReview && !form.size
        ? "구매한 사이즈를 선택하세요."
        : held
          ? "추가 전까지 저장되지 않습니다."
          : "등록 전까지 저장되지 않습니다.";

  const failDomain = failure?.domain ?? url.match(/\/\/([^/\s]+)/)?.[1] ?? "";
  const failText = importFailure(failure?.errorCode);
  const failDetail = failure
    ? [failure.errorCode, failure.errorDetail?.replace(`${failure.errorCode}: `, ""), `${(failure.durationMs / 1000).toFixed(1)}초`, failure.parserId && `parser: ${failure.parserId}`].filter(Boolean).join(" · ")
    : "";

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href={held ? "/fit-check#held" : "/wardrobe"} className="btn btn-ghost mb-2 text-sm">
        {held ? "← 구매 판단기" : "← 내 옷장"}
      </Link>
      <div className="rise flex max-w-190 flex-wrap items-end justify-between gap-4 pb-2">
        <h1 className="large-title">{held ? "구매 보류 옷 추가" : movingId ? "옷장으로 옮기기" : "새 옷 추가"}</h1>
        {movingId ? null : <div className="seg" role="radiogroup" aria-label="추가 방법">
          <label className="seg-opt px-4 py-2 text-base">
            <input type="radio" name="addmode" checked={phase !== "manual"} onChange={() => { cancelRequest(); setPhase("url"); }} />
            상품 링크로 추가
          </label>
          <label className="seg-opt px-4 py-2 text-base">
            <input type="radio" name="addmode" checked={phase === "manual"} onChange={() => startManual()} />
            직접 입력
          </label>
        </div>}
      </div>

      {(phase === "url" || phase === "analyzing" || phase === "failed") && (
        <section className="app-card rise mt-5 flex max-w-190 flex-col gap-3 p-5 md:p-8">
          <div className="field">
            <label htmlFor="new-url" className="text-sm">
              상품 URL
            </label>
            <div className="flex items-start gap-2">
              <textarea
                id="new-url"
                className="input min-h-11 text-body"
                rows={3}
                placeholder={"https://\n링크를 여러 개 붙여 넣으면 한 번에 가져와요 (최대 5개, 줄바꿈으로 구분)"}
                value={url}
                disabled={phase === "analyzing"}
                aria-describedby={linkError ? "new-url-error" : undefined}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setLinkError(null);
                }}
              />
              <button type="button" className="btn btn-primary min-h-11 min-w-26" disabled={phase === "analyzing"} onClick={analyze}>
                {phase === "analyzing" ? "분석 중…" : "분석"}
              </button>
            </div>
            {linkError && (
              <span id="new-url-error" role="alert" className="text-sm text-accent-700">
                {linkError}
              </span>
            )}
          </div>
          <div className="text-sm text-neutral-700">
            상품 페이지 주소를 붙여 넣으면 제품명·가격·사진·사이즈표를 읽어 옵니다. 링크는 한 번에 최대 {MAX_LINKS}개까지 넣을 수 있고, 읽지 못한 항목은 직접 채우면 됩니다.
          </div>
          <UsageNote kind="import" />
          {!held && (
            <>
              <Link href="/wardrobe/import-orders" className="btn btn-secondary mt-8 min-h-11 self-start">
                무신사 주문내역으로 여러 벌 한꺼번에 추가
              </Link>
              <p className="max-w-140 text-sm text-neutral-700 text-pretty">
                무신사 로그인 정보나 개인정보는 수집하지 않아요. 붙여 넣은 주문내역
                원문은 서버로 보내거나 저장하지 않고, 이 기기에서 옷 정보만
                골라내요. 옷 정보를 찾을 때는 주문 한 건마다 브랜드와 상품명만
                쓰고, 가격·주문일·주문번호는 보내지 않아요.
              </p>
            </>
          )}

          {phase === "analyzing" && (
            <div className="mt-4 border-t border-divider" aria-live="polite">
              <div className="relative h-0.5 bg-neutral-300">
                <div
                  className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-600 ease-standard"
                  style={{ width: `${Math.round(((step + 0.5) / 3) * 100)}%` }}
                />
              </div>
              {ANALYZE_STEPS.map((s, i) => {
                const state = i < step ? "완료" : i === step ? "진행 중" : "대기";
                return (
                  <div
                    key={s.stage}
                    className={cn(
                      "grid grid-cols-[32px_1fr_auto] items-baseline gap-3 border-b border-neutral-300 py-3.5",
                      state === "대기" ? "text-neutral-600" : "text-text",
                    )}
                  >
                    <span className="font-mono text-sm text-neutral-600 tabular-nums">0{i + 1}</span>
                    <span className="text-body">{s.label}</span>
                    <span className="text-xs">{state}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-neutral-700">
                  <span className="font-mono tabular-nums">{elapsed}초</span> 경과 · 최대 20초 걸립니다.
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => { cancelRequest(); setPhase("url"); }}>
                  취소
                </button>
              </div>
            </div>
          )}

          {phase === "failed" && (
            <div role="alert" className="mt-4 flex flex-col gap-2.5 border border-accent p-5">
              <div className="flex items-center gap-2">
                <span className="tag tag-accent">분석 실패</span>
                <span className="text-sm text-neutral-700">{failDomain}</span>
              </div>
              <div className="text-lg font-semibold">{failText.title}</div>
              <p className="text-base text-pretty text-neutral-800">
                {failText.body} {failure?.product ? "읽은 항목은 직접 입력 화면에 채워 둡니다." : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => startManual(true)}>
                  직접 입력으로 계속
                </button>
                <button type="button" className="btn btn-secondary" onClick={analyze}>
                  다시 시도
                </button>
                <button type="button" className="btn btn-ghost" aria-expanded={showDetail} onClick={() => setShowDetail((v) => !v)}>
                  {showDetail ? "자세히 닫기" : "자세히"}
                </button>
              </div>
              {showDetail && (
                <div className="border-t border-divider pt-2.5 font-mono text-xs text-neutral-700 tabular-nums">{failDetail}</div>
              )}
            </div>
          )}
        </section>
      )}

      {phase === "multi" && (
        <section className="flex flex-col py-6" aria-label="가져온 옷 목록">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
            <span className="text-base" aria-live="polite">
              {busy ? `링크 ${items.length}개를 읽는 중입니다 · ${elapsed}초 경과` : "구매한 사이즈와 컬러를 고른 뒤 아래에서 한꺼번에 등록하세요."}
            </span>
            <button type="button" className="btn btn-secondary" onClick={() => { cancelRequest(); setItems([]); setPhase("url"); }}>
              {busy ? "취소" : "링크 다시 넣기"}
            </button>
          </div>
          {items.map((m, n) => (
            <article key={m.key} className="app-card mb-4 flex flex-col gap-4 p-5 md:p-8" aria-label={`${n + 1}번째 옷`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">
                  <span className="tabular-nums">{n + 1}</span>. {m.status === "ready" && m.state.form.productName ? m.state.form.productName : "링크"}
                </h2>
                <button type="button" className="btn btn-ghost text-sm" onClick={() => setItems((list) => list.filter((x) => x.key !== m.key))}>
                  이 옷 빼기
                </button>
              </div>
              <span className="break-all text-xs text-neutral-700">{m.url}</span>
              {(m.status === "waiting" || m.status === "analyzing") && (
                <div className="text-sm text-neutral-700" aria-live="polite">
                  {m.status === "waiting" ? "앞의 옷을 읽은 뒤 차례로 읽습니다." : `${ANALYZE_STEPS[Math.max(0, m.step)]?.label ?? "읽는 중"}…`}
                </div>
              )}
              {m.status === "failed" && (
                <div role="alert" className="flex flex-col gap-2.5 border border-accent p-5">
                  <div className="flex items-center gap-2">
                    <span className="tag tag-accent">분석 실패</span>
                    <span className="text-sm text-neutral-700">{m.failure?.domain ?? ""}</span>
                  </div>
                  <div className="text-lg font-semibold">{importFailure(m.failure?.errorCode).title}</div>
                  <p className="text-base text-pretty text-neutral-800">
                    {importFailure(m.failure?.errorCode).body} {m.failure?.product ? "읽은 항목은 직접 입력 칸에 채워 둡니다." : ""}
                  </p>
                  <div>
                    <button type="button" className="btn btn-primary" onClick={() => fillByHand(m)}>
                      직접 입력으로 채우기
                    </button>
                  </div>
                </div>
              )}
              {m.status === "ready" && (
                <>
                  {m.imported?.status === "partial" && <span className="text-base">읽지 못한 칸은 직접 채워 주세요.</span>}
                  <div className="flex flex-col">
                    <GarmentFields
                      idp={`m${m.key}`}
                      state={m.state}
                      onChange={(fn) => patchItem(m.key, (cur) => ({ state: fn(cur.state), error: null }))}
                      imported={m.imported}
                      held={held}
                      fieldErrors={m.fieldErrors}
                    />
                  </div>
                  {m.error && (
                    <span role="alert" className="text-sm text-accent-700">
                      {m.error}
                    </span>
                  )}
                </>
              )}
            </article>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <span role={error ? "alert" : undefined} className={cn("text-sm", error ? "text-accent-700" : "text-neutral-700")}>
              {error ?? (held ? "추가 전까지 저장되지 않습니다." : "등록 전까지 저장되지 않습니다.")}
            </span>
            <div className="flex gap-2">
              <Link href={held ? "/fit-check#held" : "/wardrobe"} className="btn btn-secondary min-h-10">
                취소
              </Link>
              <button type="button" className="btn btn-primary min-h-10 min-w-30" disabled={saving || busy || readyItems.length === 0} onClick={registerAll}>
                {saving ? "저장 중…" : `${readyItems.length}벌 ${held ? "보류 목록에 추가" : "옷장에 등록"}`}
              </button>
            </div>
          </div>
        </section>
      )}

      {showForm && (
        <div className="app-card rise mt-5 flex flex-col gap-4 p-5 md:p-8">
          {isReview && (
            <div className="flex flex-col gap-0.5 border-b border-neutral-200 pb-4">
              <span className="text-base">
                {partial ? "읽지 못한 칸은 직접 채워 주세요." : movingId ? "구매일·시즌·실제 구매가를 넣고 등록하세요." : held ? "고민 중인 사이즈와 컬러를 고른 뒤 추가하세요." : "구매한 사이즈와 컬러를 고른 뒤 등록하세요."}
              </span>
              {notices.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
                  {notices.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <GarmentFields
            state={item}
            onChange={(fn) => setItem(fn)}
            imported={isReview ? imported : null}
            held={held}
            fieldErrors={fieldErrors}
            currentImageUrl={moving?.imageUrl}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <span role={error ? "alert" : undefined} className={cn("text-sm", error ? "text-accent-700" : "text-neutral-700")}>
              {hint}
            </span>
            <div className="flex gap-2">
              <Link href={held || movingId ? "/fit-check#held" : "/wardrobe"} className="btn btn-secondary min-h-10">
                취소
              </Link>
              <button type="button" className="btn btn-primary min-h-10 min-w-30" disabled={saving} onClick={register}>
                {saving ? "저장 중…" : held ? "보류 목록에 추가" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

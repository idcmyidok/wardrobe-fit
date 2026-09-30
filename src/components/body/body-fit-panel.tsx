"use client";

import Link from "next/link";
import { useState } from "react";
import { BODY_LABELS, WEARABLE_LEVELS, fitLevelName, type FitLevel } from "@/lib/constants/body";
import { cn } from "@/lib/cn";
import { SILHOUETTE_NAME, bodyFitReasons, fitGroupKind, fitGroupName, fitGroupOf, type BodyFitGarment, type BodyFitResult } from "@/lib/fit/body-fit";
import { LENGTH_GROUP_NAME, LENGTH_LEVELS, LENGTH_LEVEL_NAME, bandLabel, computeLengthFit, lengthLevelLabel } from "@/lib/fit/length-fit";
import { useBody, useBodyFit } from "./body-store";
import { BodyFitCompare } from "./body-fit-compare";
import { FIT_COLOR, FitMeter } from "./fit-meter";
import { LengthSilhouette } from "./length-silhouette";

const MEASURE_NAME = { chest: "가슴", shoulder: "어깨", hip: "엉덩이", thigh: "허벅지" } as const;

/**
 * 내 치수 기준 예상 핏(옷 정보·구매 판단 공용): 6칸 미터기, 네 가지 핏 점수, 안 맞는 치수. 총장·소매는 보지 않는다(옷장 옷과의 길이 비교는 구매 판단 표에서).
 * userFit: 옷에 내가 표기한 핏. 있으면 미터기는 내 표기를 보여 주고, 예상과 다르면 둘 다 보여 준다.
 * collapseReasons: 판단 근거(부위별 비교·길이감 설명)를 접어 두고 눌러서 펼친다(옷 정보 화면).
 * 아래에 총장 길이감(키 기준)을 따로 보여 준다.
 */
export function BodyFitPanel({
  garment,
  userFit = null,
  showScores = true,
  collapseReasons = false,
  silhouette = false,
}: {
  garment: BodyFitGarment;
  userFit?: FitLevel | null;
  showScores?: boolean;
  collapseReasons?: boolean;
  /** 총장 길이감 아래에 키에 맞춘 실루엣 + 같은 총장 반팔 그림을 보여 준다(구매 판단 결과) */
  silhouette?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <BodyFitMain garment={garment} userFit={userFit} showScores={showScores} collapseReasons={collapseReasons} />
      <LengthFitSection garment={garment} collapseReasons={collapseReasons} silhouette={silhouette} />
    </div>
  );
}

function BodyFitMain({ garment, userFit, showScores, collapseReasons }: { garment: BodyFitGarment; userFit: FitLevel | null; showScores: boolean; collapseReasons: boolean }) {
  const { profile } = useBody();
  const result = useBodyFit(garment);
  const groupId = fitGroupOf(garment.categoryId, garment.subcategoryId);
  if (!groupId) return null;
  const kind = fitGroupKind(groupId);

  const empty = (text: React.ReactNode) => (
    <div className="flex flex-col gap-3">
      {userFit && <FitMeter level={userFit} kind={kind} size="lg" mine />}
      <p className="text-sm text-neutral-700">{text}</p>
    </div>
  );

  if (!profile || !result) {
    return empty(
      <>
        <Link href="/body" className="underline underline-offset-2 hover:text-accent-700">
          내 치수
        </Link>
        를 입력하면 이 옷이 어떤 핏일지 계산해 드려요.
      </>,
    );
  }
  if (result.status === "unsupported") return empty("점프슈트·오버올은 예상 핏을 계산하지 않아요.");
  if (result.status === "insufficient") {
    if (result.missingGarment.length && result.missingBody.length === 0)
      return empty(`${result.missingGarment.map((k) => MEASURE_NAME[k]).join("·")} 실측이 없어 예상 핏을 계산하지 않았어요.`);
    return empty(
      <>
        <Link href="/body" className="underline underline-offset-2 hover:text-accent-700">
          내 치수
        </Link>
        에 {result.missingBody.map((k) => BODY_LABELS[k]).join("·")}를 입력하면 예상 핏을 볼 수 있어요.
      </>,
    );
  }

  return <BodyFitDetails result={result} userFit={userFit} showScores={showScores} collapseReasons={collapseReasons} />;
}

/** 접어 둘 수 있는 판단 근거. collapse가 false면 그대로 보여 준다. */
function Reasons({ collapse, label, children }: { collapse: boolean; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!collapse) return <>{children}</>;
  return (
    <div className="flex flex-col gap-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm text-neutral-800 hover:text-text">
        {label}
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform", open && "rotate-180")}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

function BodyFitDetails({
  result: r,
  userFit,
  showScores,
  collapseReasons,
}: {
  result: Extract<BodyFitResult, { status: "ok" }>;
  userFit: FitLevel | null;
  showScores: boolean;
  collapseReasons: boolean;
}) {
  const name = (l: FitLevel) => fitLevelName(l, r.kind);
  const differs = userFit != null && userFit !== r.level;
  const facts = [
    `${fitGroupName(r.group)} 기준`,
    r.silhouette ? `실루엣 ${r.baggy ? "배기(테이퍼드)" : SILHOUETTE_NAME[r.silhouette]}` : null,
    r.confidence === "low" ? "정확하지 않은 치수가 있어 참고용" : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4" data-testid="body-fit">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-semibold" style={{ color: FIT_COLOR[userFit ?? r.level] }}>
            {name(userFit ?? r.level)}
          </span>
          <span className="text-sm text-neutral-700">{userFit ? "내가 표기한 핏" : "예상 핏"}</span>
          {differs && (
            <span className="text-sm text-neutral-700">
              · 치수로 본 예상 핏은 <strong style={{ color: FIT_COLOR[r.level] }}>{name(r.level)}</strong>
            </span>
          )}
        </div>
        <FitMeter level={userFit ?? r.level} kind={r.kind} size="lg" mine={Boolean(userFit)} />
        {differs && (
          <div className="flex items-center gap-2">
            <span className="w-16 flex-none text-2xs text-neutral-600">치수 예상</span>
            <FitMeter level={r.level} kind={r.kind} size="lg" className="flex-1 [&>div:last-child]:hidden" />
          </div>
        )}
        <span className="text-xs text-neutral-600">{facts.join(" · ")}</span>
      </div>

      {showScores && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4" aria-label="핏별 점수">
          {WEARABLE_LEVELS.map((l) => (
            <div key={l} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-1">
                <span className={cn("text-sm", l === r.level ? "font-semibold" : "text-neutral-700")}>{name(l)}</span>
                <span className="font-mono text-sm tabular-nums">{r.scores[l]}점</span>
              </div>
              <div className="h-1.5 bg-neutral-200" aria-hidden>
                <div className="h-full" style={{ width: `${r.scores[l]}%`, background: FIT_COLOR[l], opacity: l === r.level ? 1 : 0.5 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Reasons collapse={collapseReasons} label="판단 근거 보기">
        <BodyFitCompare dimensions={r.dimensions} reasons={bodyFitReasons(r)} kind={r.kind} />
      </Reasons>

      {(r.issues.length > 0 || r.stretch) && (
        <ul className="flex flex-col gap-1 text-sm">
          {r.issues.map((i) => (
            <li key={`i-${i.key}`} className={i.severe ? "text-accent-800" : undefined}>
              {i.severe ? "⚠ " : "· "}
              {i.text}
            </li>
          ))}
          {r.stretch && <li className="text-neutral-700">· 니트·스판처럼 늘어나는 소재로 보여요. 소재 특성상 실제 핏과 다를 수 있어요.</li>}
        </ul>
      )}
      {r.issues.length === 0 && <p className="text-sm text-neutral-700">내 치수와 크게 어긋나는 곳이 없어요.</p>}
    </div>
  );
}

/** 총장 길이감(키 기준). 핏과 따로 본다. 상의·아우터 중 셔츠·블레이저·코트·롱패딩은 보지 않는다. */
function LengthFitSection({ garment, collapseReasons, silhouette }: { garment: BodyFitGarment; collapseReasons: boolean; silhouette: boolean }) {
  const { profile } = useBody();
  if (!profile) return null;
  const r = computeLengthFit(garment, profile.values.height, profile.overrides.length);
  if (r.status === "unsupported") return null;
  return (
    <section className="flex flex-col gap-2 border-t border-neutral-300 pt-4" data-testid="length-fit" aria-label="길이감">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm text-neutral-700">길이감</span>
        {r.status === "ok" ? (
          <>
            <span className="text-lg font-semibold">{lengthLevelLabel(r)}</span>
            <span className="text-sm text-neutral-700">
              총장 {r.length}cm · 키 {r.height}cm 기준 {LENGTH_LEVEL_NAME.regular} {bandLabel(r.bands.regular)}cm
            </span>
          </>
        ) : (
          <span className="text-sm text-neutral-700">
            {r.missingHeight ? (
              <>
                <Link href="/body" className="underline underline-offset-2 hover:text-accent-700">
                  내 치수
                </Link>
                에 키를 입력하면 총장이 내 키에 비해 짧은지 긴지 볼 수 있어요.
              </>
            ) : (
              "총장 실측이 없어 길이감을 보지 않았어요."
            )}
          </span>
        )}
      </div>
      {r.status === "ok" && (
        <>
          <div className="grid grid-cols-5 gap-0.5" aria-hidden>
            {LENGTH_LEVELS.map((l) => (
              <div key={l} className="flex flex-col items-center gap-1">
                <div className={cn("h-2 w-full", l === r.level ? "bg-text" : "bg-neutral-200")} />
                <span className={cn("text-2xs", l === r.level ? "font-semibold text-text" : "text-neutral-600")}>{LENGTH_LEVEL_NAME[l]}</span>
              </div>
            ))}
          </div>
          {silhouette && <LengthSilhouette length={r.length} height={r.height} shoulder={garment.measurements.shoulder} chest={garment.measurements.chest} />}
          <Reasons collapse={collapseReasons} label="길이감 기준 보기">
            <p className="text-sm text-pretty text-neutral-800">
              {LENGTH_GROUP_NAME[r.group]} 총장을 키 {r.height}cm 기준으로 봤어요:{" "}
              {LENGTH_LEVELS.map((l) => `${LENGTH_LEVEL_NAME[l]} ${bandLabel(r.bands[l])}`).join(", ")}cm.
              {r.edited ? " 내가 고친 총장 추천 기준이에요." : ""} 길이감은 핏 판정과 따로 봐요.
            </p>
          </Reasons>
        </>
      )}
    </section>
  );
}

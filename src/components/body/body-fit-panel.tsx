"use client";

import Link from "next/link";
import { BODY_LABELS, WEARABLE_LEVELS, fitLevelName, type FitLevel } from "@/lib/constants/body";
import { cn } from "@/lib/cn";
import { SILHOUETTE_NAME, fitGroupKind, fitGroupName, fitGroupOf, type BodyFitGarment, type BodyFitResult } from "@/lib/fit/body-fit";
import { useBody, useBodyFit } from "./body-store";
import { FIT_COLOR, FitMeter } from "./fit-meter";

const MEASURE_NAME = { chest: "가슴", shoulder: "어깨", waist: "허리", hip: "엉덩이", thigh: "허벅지" } as const;

/**
 * 내 치수 기준 예상 핏(옷 정보·구매 판단 공용): 6칸 미터기, 네 가지 핏 점수, 안 맞는 치수, 총장·소매 안내.
 * userFit: 옷에 내가 표기한 핏. 있으면 미터기는 내 표기를 보여 주고, 예상과 다르면 둘 다 보여 준다.
 */
export function BodyFitPanel({ garment, userFit = null, showScores = true }: { garment: BodyFitGarment; userFit?: FitLevel | null; showScores?: boolean }) {
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

  return <BodyFitDetails result={result} userFit={userFit} showScores={showScores} />;
}

function BodyFitDetails({ result: r, userFit, showScores }: { result: Extract<BodyFitResult, { status: "ok" }>; userFit: FitLevel | null; showScores: boolean }) {
  const name = (l: FitLevel) => fitLevelName(l, r.kind);
  const differs = userFit != null && userFit !== r.level;
  const facts = [
    `${fitGroupName(r.group)} 기준`,
    r.silhouette ? `실루엣 ${r.baggy ? "배기(테이퍼드)" : SILHOUETTE_NAME[r.silhouette]}` : null,
    r.calibrated ? "내 핏 표기로 기준 보정" : null,
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

      {(r.issues.length > 0 || r.notes.length > 0 || r.stretch) && (
        <ul className="flex flex-col gap-1 text-sm">
          {r.issues.map((i) => (
            <li key={`i-${i.key}`} className={i.severe ? "text-accent-800" : undefined}>
              {i.severe ? "⚠ " : "· "}
              {i.text}
            </li>
          ))}
          {r.notes.map((n) => (
            <li key={`n-${n.key}`}>· {n.text}</li>
          ))}
          {r.stretch && <li className="text-neutral-700">· 니트·스판처럼 늘어나는 소재로 보여요. 소재 특성상 실제 핏과 다를 수 있어요.</li>}
        </ul>
      )}
      {r.issues.length === 0 && r.notes.length === 0 && <p className="text-sm text-neutral-700">내 치수와 크게 어긋나는 곳이 없어요.</p>}
    </div>
  );
}

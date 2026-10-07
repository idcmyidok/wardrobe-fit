import { FIT_LEVELS, fitLevelName, type FitKind, type FitLevel } from "@/lib/constants/body";
import { cn } from "@/lib/cn";

/** 칸마다 색(tokens.css --fit-*) */
export const FIT_COLOR: Record<FitLevel, string> = {
  too_small: "var(--fit-too-small)",
  slim: "var(--fit-slim)",
  regular: "var(--fit-regular)",
  semi_over: "var(--fit-semi-over)",
  over: "var(--fit-over)",
  too_big: "var(--fit-too-big)",
};

/**
 * 핏 미터기 6칸: 너무 작음 · 슬림 · 정 · 세미오버 · 오버 · 너무 큼(하의는 슬림 · 레귤러 · 세미와이드 · 와이드).
 * 모든 칸을 제 색으로 옅게 깔고, 해당 칸만 진하게 채운다.
 * sm: 옷장 표 한 칸(작은 막대 + 이름), lg: 옷 정보·구매 판단(칸 아래 이름).
 * mine: 사용자가 직접 표기한 핏이면 true(작은 미터기는 이름 아래 "직접 평가").
 */
export function FitMeter({
  level,
  kind,
  size = "sm",
  mine = false,
  className,
}: {
  level: FitLevel;
  kind: FitKind;
  size?: "sm" | "lg";
  mine?: boolean;
  className?: string;
}) {
  const name = fitLevelName(level, kind);
  const label = `${mine ? "내가 표기한 핏" : "예상 핏"}: ${name} (6단계 중 ${FIT_LEVELS.indexOf(level) + 1})`;

  if (size === "sm") {
    return (
      <span role="img" aria-label={label} className={cn("inline-flex flex-col items-center gap-1", className)}>
        <span className="flex gap-0.5" aria-hidden>
          {FIT_LEVELS.map((l) => (
            <span
              key={l}
              className={cn("block h-2 w-2.5 rounded-xs", l === level ? "h-2.5" : "opacity-25")}
              style={{ background: FIT_COLOR[l] }}
            />
          ))}
        </span>
        <span className="text-2xs leading-none font-semibold whitespace-nowrap" style={{ color: FIT_COLOR[level] }} aria-hidden>
          {name}
        </span>
        {mine && (
          <span className="text-2xs leading-none whitespace-nowrap text-neutral-600" aria-hidden>
            직접 평가
          </span>
        )}
      </span>
    );
  }

  return (
    <div role="img" aria-label={label} className={cn("flex flex-col gap-1.5", className)}>
      <div className="grid grid-cols-6 items-end gap-1" aria-hidden>
        {FIT_LEVELS.map((l) => (
          <div
            key={l}
            className={cn("rounded-sm transition-[height,background-color]", l === level ? "h-4" : "h-2.5 opacity-25")}
            style={{ background: FIT_COLOR[l] }}
          />
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1 text-center" aria-hidden>
        {FIT_LEVELS.map((l) => (
          <span
            key={l}
            className={cn("text-2xs leading-tight break-keep", l === level ? "font-semibold" : "text-neutral-600")}
            style={l === level ? { color: FIT_COLOR[l] } : undefined}
          >
            {fitLevelName(l, kind)}
          </span>
        ))}
      </div>
    </div>
  );
}

import { WEARABLE_LEVELS, fitLevelName, type FitKind, type FitLevel } from "@/lib/constants/body";
import { formatNum } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import { signed, type BodyFitDimension, type BodyFitReason } from "@/lib/fit/body-fit";
import { FIT_COLOR } from "./fit-meter";

/**
 * 예상 핏 판단 근거: 치수마다 내가 입력한 치수와 옷 실측을 나란히 놓고,
 * 핏 구간 막대(옷 실측 단위) 위에 옷과 내 몸 위치를 찍어 비교한다.
 */
export function BodyFitCompare({ dimensions, reasons, kind }: { dimensions: BodyFitDimension[]; reasons: BodyFitReason[]; kind: FitKind }) {
  const overall = reasons.find((x) => x.key === "overall");
  return (
    <section className="flex flex-col gap-3" data-testid="body-fit-reasons" aria-label="예상 핏 판단 근거">
      <h4 className="font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">판단 근거 · 내 치수와 비교</h4>
      <div className="flex flex-col gap-3">
        {dimensions.map((d) => (
          <DimensionCard key={d.key} d={d} kind={kind} verdict={reasons.find((x) => x.key === d.key)?.verdict ?? ""} />
        ))}
      </div>
      {overall && (
        <p className="text-sm text-pretty">
          <strong>종합</strong> {overall.text}
        </p>
      )}
    </section>
  );
}

const bodyName = (d: BodyFitDimension) => (d.key === "shoulder" ? "어깨너비" : `${d.label}둘레`);

function DimensionCard({ d, kind, verdict }: { d: BodyFitDimension; kind: FitKind; verdict: string }) {
  const girth = Math.round(d.garmentValue * 20) / 10;
  const levelName = fitLevelName(d.level, kind);
  return (
    <div className="flex flex-col gap-3 border border-neutral-300 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{d.label}</span>
        <span className="text-sm font-semibold" style={{ color: FIT_COLOR[d.level] }}>
          {levelName}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs text-neutral-600">내 {bodyName(d)}(입력)</dt>
          <dd className="font-mono tabular-nums">{formatNum(d.bodyValue)}cm</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs text-neutral-600">옷 {d.label}{d.half ? " 단면" : ""}</dt>
          <dd className="font-mono tabular-nums">
            {formatNum(d.garmentValue)}cm
            {d.half && <span className="block text-2xs text-neutral-600">×2 = 둘레 {formatNum(girth)}cm</span>}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs text-neutral-600">{d.half ? "여유(둘레 − 몸)" : "차이(옷 − 몸)"}</dt>
          <dd className="font-mono font-semibold tabular-nums">{signed(d.ease)}cm</dd>
        </div>
      </dl>

      <RangeBar d={d} kind={kind} />
      <p className="text-sm text-pretty text-neutral-800">{verdict}</p>
    </div>
  );
}

interface Segment {
  level: FitLevel;
  from: number;
  to: number;
  label: string;
}

/** 여유(ease) 구간을 옷 실측 단위 막대로. 옷 ▼, 내 몸(여유 0) 점선. */
function RangeBar({ d, kind }: { d: BodyFitDimension; kind: FitKind }) {
  const toGarment = (e: number) => (d.half ? Math.round(((e + d.bodyValue) / 2) * 2) / 2 : Math.round((e + d.bodyValue) * 10) / 10);
  const segs: Segment[] = WEARABLE_LEVELS.map((l) => ({ level: l, from: d.bands[l][0], to: d.bands[l][1], label: fitLevelName(l, kind) }));
  const lo0 = Math.min(...segs.map((s) => s.from));
  const hi0 = Math.max(...segs.map((s) => s.to));
  const pad = Math.max((hi0 - lo0) * 0.12, 2);
  const lo = Math.min(lo0, d.ease, 0) - pad;
  const hi = Math.max(hi0, d.ease, 0) + pad;
  const pct = (e: number) => `${((e - lo) / (hi - lo)) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / (hi - lo)) * 100}%`;
  const ticks = [...new Set(segs.flatMap((s) => [s.from, s.to]))].sort((a, b) => a - b);
  const unit = d.half ? "단면" : d.label;

  return (
    <div className="flex flex-col gap-1" role="img" aria-label={`${d.label} 핏 구간과 옷·내 몸 위치`}>
      {/* 옷 위치 라벨 */}
      <div className="relative h-4 text-2xs">
        <span className="absolute -translate-x-1/2 font-semibold whitespace-nowrap" style={{ left: pct(d.ease) }}>
          옷 {formatNum(d.garmentValue)}
        </span>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-y-1 left-0" style={{ width: pct(lo0), background: `color-mix(in srgb, ${FIT_COLOR.too_small} 30%, transparent)` }} />
        <div className="absolute inset-y-1 right-0" style={{ left: pct(hi0), background: `color-mix(in srgb, ${FIT_COLOR.too_big} 30%, transparent)` }} />
        {segs.map((s) => (
          <div
            key={s.level}
            className={cn("absolute inset-y-1 flex items-center justify-center overflow-hidden text-2xs whitespace-nowrap", s.level === d.level ? "font-semibold text-white" : "text-neutral-800")}
            style={{
              left: pct(s.from),
              width: width(s.from, s.to),
              background: s.level === d.level ? FIT_COLOR[s.level] : `color-mix(in srgb, ${FIT_COLOR[s.level]} 35%, transparent)`,
            }}
            title={s.label}
          >
            {(s.to - s.from) / (hi - lo) > 0.14 ? s.label : ""}
          </div>
        ))}
        {/* 내 몸(여유 0) */}
        <div className="absolute inset-y-0 border-l-2 border-dashed border-neutral-900" style={{ left: pct(0) }} />
        {/* 옷 */}
        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-text" style={{ left: pct(d.ease) }} />
      </div>
      {/* 구간 경계(옷 실측) */}
      <div className="relative h-4 font-mono text-2xs text-neutral-600 tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
            {formatNum(toGarment(t))}
          </span>
        ))}
      </div>
      <div className="relative h-4 text-2xs text-neutral-700">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(0) }}>
          내 몸 {formatNum(toGarment(0))}
          {d.half ? ` (${formatNum(d.bodyValue)}÷2)` : ""}
        </span>
      </div>
      <span className="text-2xs text-neutral-600">막대 숫자는 옷 {unit} 기준(cm), 점선은 내 몸 위치</span>
    </div>
  );
}

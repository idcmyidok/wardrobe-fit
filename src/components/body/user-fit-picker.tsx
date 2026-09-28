import { FIT_LEVELS, fitLevelName, type FitKind, type FitLevel } from "@/lib/constants/body";
import { cn } from "@/lib/cn";
import { FIT_COLOR } from "./fit-meter";

/**
 * "내 핏" 표기(6칸). 고른 것을 다시 누르면 지우고, 지우면 화면은 예상 핏으로 돌아간다.
 * 새 옷 추가 폼과 옷 정보에서 같이 쓴다.
 */
export function UserFitPicker({
  value,
  onChange,
  kind,
  labelledBy,
  disabled = false,
}: {
  value: FitLevel | null;
  onChange: (next: FitLevel | null) => void;
  kind: FitKind;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <div className="seg flex-wrap" role="group" aria-labelledby={labelledBy}>
      {FIT_LEVELS.map((level) => (
        <label key={level} className={cn("seg-opt px-3 py-1.75 text-sm", disabled && "pointer-events-none opacity-60")}>
          <input type="checkbox" checked={value === level} disabled={disabled} onChange={() => onChange(value === level ? null : level)} />
          <span aria-hidden className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: FIT_COLOR[level] }} />
          {fitLevelName(level, kind)}
        </label>
      ))}
    </div>
  );
}

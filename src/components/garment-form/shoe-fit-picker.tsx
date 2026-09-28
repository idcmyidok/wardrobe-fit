import { SHOE_FIT_FIELDS, SHOE_FIT_LEVELS, type ShoeFit } from "@/lib/constants/shoe-fit";

/** 신발 착용감(길이감·발볼·발등) 고르기. 고른 것을 다시 누르면 비운다. 추가 폼과 옷 정보 수정에서 같이 쓴다. */
export function ShoeFitPicker({ value, onChange, idPrefix }: { value: ShoeFit; onChange: (next: ShoeFit) => void; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-3">
      {SHOE_FIT_FIELDS.map((f) => (
        <div key={f.key} className="flex flex-wrap items-center gap-3">
          <span id={`${idPrefix}-${f.key}`} className="w-12 text-sm text-neutral-800">
            {f.label}
          </span>
          <div className="seg" role="group" aria-labelledby={`${idPrefix}-${f.key}`}>
            {SHOE_FIT_LEVELS.map((level) => (
              <label key={level} className="seg-opt px-4 py-1.75">
                <input
                  type="checkbox"
                  checked={value[f.key] === level}
                  onChange={() => onChange({ ...value, [f.key]: value[f.key] === level ? null : level })}
                />
                {f.levels[level]}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

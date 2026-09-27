/**
 * 구매 날짜 칸의 이름표. 날짜는 몰라도 되므로 비워 둘 수 있고, 휴대폰 날짜 선택기는 지우기가 어려워
 * 날짜가 들어 있을 때 "모름"으로 비우는 버튼을 둔다. 모양은 .field > label과 같게 맞춘다.
 */
export function DateLabel({ htmlFor, label, filled, onClear }: { htmlFor: string; label: string; filled: boolean; onClear: () => void }) {
  return (
    <div className="mb-[5px] flex items-baseline justify-between gap-2 text-[12px] text-neutral-700">
      <label htmlFor={htmlFor}>{label}</label>
      {filled && (
        <button type="button" className="underline underline-offset-2 hover:text-text" onClick={onClear}>
          모름
        </button>
      )}
    </div>
  );
}

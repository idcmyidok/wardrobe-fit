/**
 * 쌓은 높이 카드의 그림. 미리 그려서 코드에 넣어 두었으므로 내려받지 않고 바로 나온다.
 * 선·면 색은 글자색(currentColor)과 차트 색 토큰만 쓴다.
 */
const C1 = "var(--chart-1)";
const C2 = "var(--chart-2)";
const C3 = "var(--chart-3)";
const SOFT = "color-mix(in oklab, currentColor 14%, transparent)";
const MID = "color-mix(in oklab, currentColor 35%, transparent)";

const ART: Record<string, React.ReactNode> = {
  baseball: (
    <>
      <circle cx="100" cy="92" r="28" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <path d="M82 72c10 8 10 32 0 40M118 72c-10 8-10 32 0 40" fill="none" stroke={C2} strokeWidth="2.5" />
    </>
  ),
  can: (
    <>
      <rect x="82" y="38" width="36" height="82" rx="6" fill={C1} />
      <rect x="82" y="38" width="36" height="8" rx="3" fill={MID} />
      <rect x="82" y="68" width="36" height="22" fill="#fff" opacity=".85" />
    </>
  ),
  bottle: (
    <>
      <rect x="92" y="22" width="16" height="12" rx="3" fill={C1} />
      <path d="M94 34h12l8 20v62a4 4 0 0 1-4 4H90a4 4 0 0 1-4-4V54z" fill={SOFT} stroke="currentColor" strokeWidth="2" />
      <rect x="86" y="66" width="28" height="22" fill={C1} opacity=".6" />
    </>
  ),
  ruler: (
    <>
      <rect x="86" y="10" width="28" height="110" rx="3" fill={SOFT} stroke="currentColor" strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M86 ${18 + i * 9.5}h${i % 5 === 0 ? 12 : 7}`} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </>
  ),
  shiba: (
    <>
      <ellipse cx="96" cy="84" rx="38" ry="22" fill={C2} />
      <circle cx="140" cy="62" r="18" fill={C2} />
      <path d="M130 48l4-14 8 10zM148 48l8-12 2 16z" fill={C2} />
      <ellipse cx="150" cy="68" rx="9" ry="7" fill="#fff" />
      <circle cx="146" cy="60" r="2" fill="currentColor" />
      <path d="M58 76c-14-8-12-26-2-30" fill="none" stroke={C2} strokeWidth="9" strokeLinecap="round" />
      <rect x="68" y="98" width="9" height="22" rx="4" fill={C2} />
      <rect x="116" y="98" width="9" height="22" rx="4" fill={C2} />
    </>
  ),
  baby: (
    <>
      <ellipse cx="100" cy="100" rx="52" ry="18" fill={SOFT} />
      <circle cx="140" cy="92" r="15" fill="#f4cfb0" />
      <rect x="60" y="82" width="68" height="26" rx="13" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <circle cx="144" cy="90" r="1.8" fill="currentColor" />
    </>
  ),
  retriever: (
    <>
      <ellipse cx="96" cy="76" rx="42" ry="26" fill="#e0a64a" />
      <circle cx="142" cy="46" r="20" fill="#e0a64a" />
      <path d="M130 34c-10 6-10 22-4 30" fill="#c98a2c" />
      <ellipse cx="156" cy="52" rx="9" ry="7" fill="#c98a2c" />
      <circle cx="148" cy="42" r="2" fill="currentColor" />
      <path d="M56 66c-16-6-20-24-12-34" fill="none" stroke="#e0a64a" strokeWidth="10" strokeLinecap="round" />
      <rect x="66" y="94" width="10" height="26" rx="4" fill="#e0a64a" />
      <rect x="118" y="94" width="10" height="26" rx="4" fill="#e0a64a" />
    </>
  ),
  desk: (
    <>
      <rect x="40" y="52" width="120" height="8" rx="3" fill={C1} />
      <rect x="48" y="60" width="7" height="60" fill={MID} />
      <rect x="145" y="60" width="7" height="60" fill={MID} />
      <rect x="84" y="36" width="34" height="16" rx="2" fill={SOFT} stroke="currentColor" strokeWidth="2" />
    </>
  ),
  toddler: (
    <>
      <circle cx="100" cy="36" r="16" fill="#f4cfb0" />
      <rect x="82" y="54" width="36" height="34" rx="12" fill={C3} />
      <rect x="86" y="88" width="10" height="32" rx="4" fill="currentColor" opacity=".7" />
      <rect x="104" y="88" width="10" height="32" rx="4" fill="currentColor" opacity=".7" />
    </>
  ),
  kid: (
    <>
      <circle cx="100" cy="24" r="14" fill="#f4cfb0" />
      <rect x="84" y="40" width="32" height="40" rx="12" fill={C2} />
      <rect x="88" y="80" width="9" height="40" rx="4" fill="currentColor" opacity=".7" />
      <rect x="103" y="80" width="9" height="40" rx="4" fill="currentColor" opacity=".7" />
      <rect x="130" y="62" width="18" height="26" rx="5" fill={C1} />
    </>
  ),
  adult: (
    <>
      <circle cx="100" cy="14" r="11" fill="#f4cfb0" />
      <rect x="86" y="27" width="28" height="48" rx="10" fill={C1} />
      <rect x="89" y="75" width="10" height="45" rx="4" fill="currentColor" opacity=".7" />
      <rect x="101" y="75" width="10" height="45" rx="4" fill="currentColor" opacity=".7" />
    </>
  ),
  tall: (
    <>
      <circle cx="100" cy="10" r="9" fill="#f4cfb0" />
      <rect x="89" y="20" width="22" height="52" rx="8" fill={C2} />
      <rect x="91" y="72" width="8" height="48" rx="3" fill="currentColor" opacity=".7" />
      <rect x="101" y="72" width="8" height="48" rx="3" fill="currentColor" opacity=".7" />
      <circle cx="136" cy="64" r="11" fill="#e8873a" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  ceiling: (
    <>
      <rect x="30" y="12" width="140" height="6" fill={MID} />
      <path d="M30 120V18M170 120V18" stroke="currentColor" strokeWidth="2" opacity=".5" />
      <rect x="62" y="64" width="76" height="56" rx="4" fill={C1} opacity=".85" />
      <path d="M100 22v8M92 30h16" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  hoop: (
    <>
      <rect x="96" y="10" width="8" height="110" fill={MID} />
      <rect x="70" y="14" width="60" height="38" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <rect x="88" y="34" width="24" height="16" fill="none" stroke={C2} strokeWidth="2" />
      <ellipse cx="100" cy="58" rx="16" ry="4" fill="none" stroke={C2} strokeWidth="3" />
      <path d="M84 60l8 22M116 60l-8 22M100 62v22" stroke="currentColor" strokeWidth="1" opacity=".6" />
    </>
  ),
  bus: (
    <>
      <rect x="36" y="22" width="128" height="86" rx="10" fill={C2} />
      <rect x="46" y="32" width="26" height="20" rx="3" fill="#fff" />
      <rect x="78" y="32" width="26" height="20" rx="3" fill="#fff" />
      <rect x="110" y="32" width="26" height="20" rx="3" fill="#fff" />
      <rect x="46" y="62" width="26" height="20" rx="3" fill="#fff" />
      <rect x="78" y="62" width="26" height="20" rx="3" fill="#fff" />
      <rect x="110" y="62" width="40" height="40" rx="3" fill="#fff" />
      <circle cx="68" cy="108" r="10" fill="currentColor" />
      <circle cx="136" cy="108" r="10" fill="currentColor" />
    </>
  ),
  giraffe: (
    <>
      <rect x="104" y="30" width="14" height="76" rx="6" fill="#e6b84a" />
      <ellipse cx="96" cy="92" rx="34" ry="20" fill="#e6b84a" />
      <ellipse cx="124" cy="22" rx="18" ry="11" fill="#e6b84a" />
      <path d="M118 12v-6M126 12v-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="130" cy="20" r="2" fill="currentColor" />
      <circle cx="90" cy="86" r="5" fill="#a9742a" />
      <circle cx="108" cy="96" r="4" fill="#a9742a" />
      <circle cx="110" cy="52" r="4" fill="#a9742a" />
      <rect x="72" y="104" width="7" height="16" fill="#e6b84a" />
      <rect x="110" y="104" width="7" height="16" fill="#e6b84a" />
    </>
  ),
  house: (
    <>
      <path d="M40 54l60-40 60 40z" fill={C2} />
      <rect x="52" y="54" width="96" height="66" fill={SOFT} stroke="currentColor" strokeWidth="2" />
      <rect x="64" y="66" width="20" height="18" fill="#fff" stroke="currentColor" />
      <rect x="116" y="66" width="20" height="18" fill="#fff" stroke="currentColor" />
      <rect x="88" y="90" width="24" height="30" fill={C1} />
    </>
  ),
  building: (
    <>
      <rect x="60" y="20" width="80" height="100" fill={SOFT} stroke="currentColor" strokeWidth="2" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={70 + c * 24} y={30 + r * 28} width="14" height="16" fill={C1} opacity=".8" />),
      )}
    </>
  ),
  apartment: (
    <>
      <rect x="44" y="6" width="112" height="114" fill={SOFT} stroke="currentColor" strokeWidth="2" />
      {Array.from({ length: 7 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => <rect key={`${r}${c}`} x={52 + c * 21} y={12 + r * 15} width="12" height="9" fill={C1} opacity=".75" />),
      )}
    </>
  ),
};

export function StackArt({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 200 130" className="h-auto w-full max-w-72 text-neutral-800" role="img" aria-label={name}>
      <path d="M10 120h180" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".35" />
      {ART[name]}
    </svg>
  );
}

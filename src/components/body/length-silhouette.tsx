/**
 * 총장 길이감을 눈으로 대충 보는 그림. 입력한 키에 맞춘 평균 성인 남자 픽토그램(횡단보도 사람 기호처럼 동그란 머리, 굵고 둥근 팔다리)에,
 * 같은 총장의 반팔 티셔츠를 반투명으로 겹쳐 그려 티셔츠 뒤로 몸이 비쳐 보이게 한다.
 * 세로 1cm는 사람 세로 1cm와 같은 비율이고, 어깨·가슴 너비는 실측이 있으면 그 값을, 없으면 키에 비례한 평균값을 쓴다.
 * 소매 길이·핏은 그리지 않는 참고용 그림이다.
 */
const NECK_FROM_TOP = 0.15; // 정수리에서 목 아래(총장을 재는 곳)까지, 키의 비율
/** 그림 칸은 키와 상관없이 같은 눈금(cm)이라, 키가 다르면 사람 크기도 다르게 보인다. */
const CANVAS_H = 212;
const GROUND_Y = 202; // 발이 닿는 바닥선(아래에 여백 10cm)
const CANVAS_W = 128;
const BODY = "#9a9a93";
const SHIRT_FILL = "#3d5a80";
const SHIRT_LINE = "#2a4262";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function LengthSilhouette({
  length,
  height,
  shoulder,
  chest,
}: {
  length: number;
  height: number;
  /** 어깨너비(cm). 없으면 키에 비례한 평균값 */
  shoulder?: number | null;
  /** 가슴단면(cm). 없으면 키에 비례한 평균값 */
  chest?: number | null;
}) {
  const H = height;
  const W = CANVAS_W;
  const cx = W / 2;
  const top = GROUND_Y - H; // 키가 클수록 머리가 위로 올라가고, 작으면 머리 위가 비어 보인다

  // ---- 사람(정면 픽토그램). 모든 값은 키(H)의 비율 ----
  const headR = H * 0.06;
  const headY = H * 0.066;
  const neckY = H * NECK_FROM_TOP;
  const shoulderY = H * 0.185;
  const bodyShoulder = H * 0.115; // 어깨 끝 반폭(팔 중심선)
  const armW = H * 0.05;
  const armEnd = H * 0.58;
  const torsoHalf = H * 0.085;
  const hipY = H * 0.5;
  const legHalfGap = H * 0.008;
  const legW = H * 0.075;

  // ---- 티셔츠 ----
  const shHalf = clamp(shoulder ? shoulder / 2 : H * 0.125, H * 0.105, H * 0.165);
  const chestHalf = clamp(chest ? chest / 2 : H * 0.135, H * 0.105, H * 0.185);
  const bottomY = neckY + length;
  const armpitY = shoulderY + H * 0.085;
  const sleeveEndY = shoulderY + H * 0.15;
  const sleeveOuterX = Math.max(shHalf, chestHalf) + H * 0.055;
  const sleeveInnerX = chestHalf + H * 0.012;
  const collar = H * 0.05;

  const half = (s: 1 | -1) => ({
    shoulder: cx + s * shHalf,
    outer: cx + s * sleeveOuterX,
    inner: cx + s * sleeveInnerX,
    side: cx + s * chestHalf,
  });
  const r = half(1);
  const l = half(-1);
  const shirt = [
    `M${cx - collar} ${neckY}`,
    `Q${cx} ${neckY + H * 0.045} ${cx + collar} ${neckY}`, // 목선
    `L${r.shoulder} ${shoulderY + H * 0.008}`, // 어깨선
    `L${r.outer} ${sleeveEndY}`, // 소매 바깥
    `L${r.inner} ${sleeveEndY - H * 0.035}`, // 소매 끝단
    `L${r.side} ${armpitY}`, // 겨드랑이
    `L${r.side} ${bottomY}`, // 옆선
    `L${l.side} ${bottomY}`, // 밑단
    `L${l.side} ${armpitY}`,
    `L${l.inner} ${sleeveEndY - H * 0.035}`,
    `L${l.outer} ${sleeveEndY}`,
    `L${l.shoulder} ${shoulderY + H * 0.008}`,
    "Z",
  ].join(" ");
  const collarLine = `M${cx - collar} ${neckY} Q${cx} ${neckY + H * 0.045} ${cx + collar} ${neckY}`;
  const cut = bottomY > H;
  const stroke = H * 0.004;

  return (
    <figure className="flex flex-col gap-1.5" data-testid="length-silhouette">
      <div
        className="relative w-full max-w-56 overflow-hidden border border-neutral-300"
        style={{ aspectRatio: `${W} / ${CANVAS_H}`, background: "#f3f3f0" }}
        role="img"
        aria-label={`키 ${height}cm 남성 실루엣에 총장 ${length}cm 반팔을 입힌 그림`}
      >
        <svg viewBox={`0 0 ${W} ${CANVAS_H}`} className="absolute inset-0 size-full" aria-hidden>
          <g transform={`translate(0 ${top})`}>
            {/* 사람: 머리는 원, 몸통·팔·다리는 굵고 둥근 선으로 */}
            <g fill={BODY} stroke={BODY} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={cx} cy={headY} r={headR} stroke="none" />
              <path d={`M${cx - torsoHalf} ${shoulderY} L${cx + torsoHalf} ${shoulderY} L${cx + torsoHalf * 0.95} ${hipY} L${cx - torsoHalf * 0.95} ${hipY} Z`} strokeWidth={H * 0.03} />
              <path d={`M${cx - bodyShoulder} ${shoulderY + armW / 2} L${cx - bodyShoulder - H * 0.012} ${armEnd}`} strokeWidth={armW} fill="none" />
              <path d={`M${cx + bodyShoulder} ${shoulderY + armW / 2} L${cx + bodyShoulder + H * 0.012} ${armEnd}`} strokeWidth={armW} fill="none" />
              <path d={`M${cx - legHalfGap - legW / 2} ${hipY} L${cx - legHalfGap - legW / 2} ${H - legW / 2}`} strokeWidth={legW} fill="none" />
              <path d={`M${cx + legHalfGap + legW / 2} ${hipY} L${cx + legHalfGap + legW / 2} ${H - legW / 2}`} strokeWidth={legW} fill="none" />
            </g>
            {/* 티셔츠: 반투명이라 뒤의 몸이 비친다 */}
            <path d={shirt} fill={SHIRT_FILL} fillOpacity={0.62} stroke={SHIRT_LINE} strokeWidth={stroke} strokeLinejoin="round" />
            <path d={collarLine} fill="none" stroke={SHIRT_LINE} strokeWidth={stroke * 2} strokeLinecap="round" />
            {!cut && <line x1={r.side + H * 0.015} x2={W} y1={bottomY} y2={bottomY} stroke="#111" strokeWidth={stroke} strokeDasharray={`${H * 0.02} ${H * 0.012}`} />}
          </g>
        </svg>
      </div>
      <figcaption className="max-w-56 text-xs text-pretty text-neutral-700">
        키 {height}cm 평균 성인 남자 실루엣에, 이 옷과 같은 총장({length}cm)의 반팔 티셔츠를 입힌 모습이에요. 실제 옷의 모양·핏과는 다를 수 있으니 길이 느낌만 참고하세요.
      </figcaption>
    </figure>
  );
}

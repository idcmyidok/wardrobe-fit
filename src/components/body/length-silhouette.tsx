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
  const shY = shoulderY + H * 0.01; // 어깨 끝
  const collar = H * 0.05;
  const sleeveOut = chestHalf + H * 0.075; // 소매 바깥 끝 x(몸 옆선에서 벌어진 정도)
  const sleeveOutY = shoulderY + H * 0.1;
  const hemInX = chestHalf + H * 0.02; // 소매 끝단 안쪽 x
  const hemInY = sleeveOutY + H * 0.05;
  const armpitY = shoulderY + H * 0.105;
  const at = (s: 1 | -1, x: number) => cx + s * x;

  /** 한쪽(부호 s) 어깨~소매~옆선. 오른쪽은 위에서 아래로, 왼쪽은 아래에서 위로 이어 붙인다. */
  const rightSide = [
    `Q${at(1, shHalf * 0.55)} ${neckY - H * 0.002} ${at(1, shHalf)} ${shY}`, // 어깨선(살짝 처짐)
    `L${at(1, sleeveOut)} ${sleeveOutY}`, // 소매 윗선
    `L${at(1, hemInX)} ${hemInY}`, // 소매 끝단
    `Q${at(1, chestHalf + H * 0.004)} ${hemInY - H * 0.012} ${at(1, chestHalf)} ${armpitY}`, // 겨드랑이
    `L${at(1, chestHalf)} ${bottomY - H * 0.01}`, // 옆선
    `Q${at(1, chestHalf)} ${bottomY} ${at(1, chestHalf - H * 0.012)} ${bottomY}`,
  ];
  const leftSide = [
    `L${at(-1, chestHalf - H * 0.012)} ${bottomY}`, // 밑단
    `Q${at(-1, chestHalf)} ${bottomY} ${at(-1, chestHalf)} ${bottomY - H * 0.01}`,
    `L${at(-1, chestHalf)} ${armpitY}`,
    `Q${at(-1, chestHalf + H * 0.004)} ${hemInY - H * 0.012} ${at(-1, hemInX)} ${hemInY}`,
    `L${at(-1, sleeveOut)} ${sleeveOutY}`,
    `L${at(-1, shHalf)} ${shY}`,
    `Q${at(-1, shHalf * 0.55)} ${neckY - H * 0.002} ${cx - collar} ${neckY}`,
  ];
  const shirt = [`M${cx - collar} ${neckY}`, `Q${cx} ${neckY + H * 0.05} ${cx + collar} ${neckY}`, ...rightSide, ...leftSide, "Z"].join(" ");
  const collarLine = `M${cx - collar} ${neckY} Q${cx} ${neckY + H * 0.05} ${cx + collar} ${neckY}`;
  const collarInner = `M${cx - collar * 0.9} ${neckY + H * 0.008} Q${cx} ${neckY + H * 0.058} ${cx + collar * 0.9} ${neckY + H * 0.008}`;
  // 밑단 박음선(살짝 안쪽 줄)
  const seam = H * 0.012;
  const hemSeams = [`M${cx - chestHalf} ${bottomY - seam * 1.6} L${cx + chestHalf} ${bottomY - seam * 1.6}`];
  const cut = bottomY > H;
  const stroke = H * 0.004;
  const marks = Array.from({ length: 21 }, (_, i) => i * 10); // 0~200cm, 10cm마다

  return (
    <figure className="flex flex-col gap-1.5" data-testid="length-silhouette">
      <div
        className="relative w-full max-w-56 overflow-hidden border border-neutral-300"
        style={{ aspectRatio: `${W} / ${CANVAS_H}`, background: "#f3f3f0" }}
        role="img"
        aria-label={`키 ${height}cm 남성 실루엣에 총장 ${length}cm 반팔을 입힌 그림`}
      >
        <svg viewBox={`0 0 ${W} ${CANVAS_H}`} className="absolute inset-0 size-full" aria-hidden>
          {/* 키 눈금: 발 밑(0cm)에서 10cm마다 연한 가로줄, 눈금 숫자는 왼쪽 */}
          <g stroke="#cfcfc8" strokeWidth={0.25}>
            {marks.map((cm) => (
              <line key={cm} x1={cm % 50 === 0 ? 0 : 9} x2={W} y1={GROUND_Y - cm} y2={GROUND_Y - cm} strokeOpacity={cm % 50 === 0 ? 0.9 : 0.55} />
            ))}
          </g>
          <g fill="#9b9b94" fontSize={4} fontFamily="ui-monospace, monospace">
            {marks.filter((cm) => cm % 10 === 0 && cm > 0).map((cm) => (
              <text key={cm} x={1} y={GROUND_Y - cm + 1.4}>
                {cm}
              </text>
            ))}
          </g>
          <line x1={0} x2={W} y1={top} y2={top} stroke="#8a8a83" strokeWidth={0.3} strokeDasharray="1.5 1.5" />
          <g transform={`translate(0 ${top})`}>
            {/* 사람: 머리는 원, 몸통·팔·다리는 굵고 둥근 선으로 */}
            <g fill={BODY} stroke={BODY} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={cx} cy={headY} r={headR} stroke="none" />
              <path d={`M${cx} ${headY + headR * 0.7} L${cx} ${shoulderY + H * 0.01}`} strokeWidth={H * 0.042} fill="none" />
              <path d={`M${cx - torsoHalf} ${shoulderY} L${cx + torsoHalf} ${shoulderY} L${cx + torsoHalf * 0.95} ${hipY} L${cx - torsoHalf * 0.95} ${hipY} Z`} strokeWidth={H * 0.03} />
              <path d={`M${cx - bodyShoulder} ${shoulderY + armW / 2} L${cx - bodyShoulder - H * 0.012} ${armEnd}`} strokeWidth={armW} fill="none" />
              <path d={`M${cx + bodyShoulder} ${shoulderY + armW / 2} L${cx + bodyShoulder + H * 0.012} ${armEnd}`} strokeWidth={armW} fill="none" />
              <path d={`M${cx - legHalfGap - legW / 2} ${hipY} L${cx - legHalfGap - legW / 2} ${H - legW / 2}`} strokeWidth={legW} fill="none" />
              <path d={`M${cx + legHalfGap + legW / 2} ${hipY} L${cx + legHalfGap + legW / 2} ${H - legW / 2}`} strokeWidth={legW} fill="none" />
            </g>
            {/* 티셔츠: 반투명이라 뒤의 몸이 비친다 */}
            <path d={shirt} fill={SHIRT_FILL} fillOpacity={0.62} stroke={SHIRT_LINE} strokeWidth={stroke} strokeLinejoin="round" />
            <path d={collarLine} fill="none" stroke={SHIRT_LINE} strokeWidth={stroke * 2} strokeLinecap="round" />
            <path d={collarInner} fill="none" stroke={SHIRT_LINE} strokeWidth={stroke * 0.8} strokeOpacity={0.6} strokeLinecap="round" />
            <path d={hemSeams.join(" ")} fill="none" stroke={SHIRT_LINE} strokeWidth={stroke * 0.7} strokeOpacity={0.5} />
            {!cut && <line x1={at(1, chestHalf) + H * 0.015} x2={W} y1={bottomY} y2={bottomY} stroke="#111" strokeWidth={stroke} strokeDasharray={`${H * 0.02} ${H * 0.012}`} />}
          </g>
        </svg>
      </div>
      <figcaption className="max-w-56 text-xs text-pretty text-neutral-700">
        키 {height}cm 평균 성인 남자 실루엣에, 이 옷과 같은 총장({length}cm)의 반팔 티셔츠를 입힌 모습이에요. 실제 옷의 모양·핏과는 다를 수 있으니 길이 느낌만 참고하세요.
      </figcaption>
    </figure>
  );
}

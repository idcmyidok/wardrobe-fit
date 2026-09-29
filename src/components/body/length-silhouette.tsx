/**
 * 총장 길이감을 눈으로 대충 보는 그림. 입력한 키에 맞춘 평균 성인 남자 실루엣 위에, 같은 총장의 반팔 티셔츠를 얹어 그린다.
 * 옷이 덮는 부분은 실루엣이 보이지 않는다. 세로 1cm는 실루엣 세로 1cm와 같은 비율이고, 어깨·가슴 너비는
 * 실측이 있으면 그 값을, 없으면 키에 비례한 평균값을 쓴다. 소매 길이·핏은 그리지 않는 참고용 그림이다.
 */
const NECK_FROM_TOP = 0.15; // 정수리에서 목 아래(총장을 재는 곳)까지, 키의 비율
const CANVAS_WIDTH = 0.62; // 그림 가로 = 키의 비율
const BODY_FILL = "#bdbdb6";
const SHIRT_FILL = "#3d5a80";
const SHIRT_LINE = "#2a4262";

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
  const W = H * CANVAS_WIDTH;
  const cx = W / 2;
  const neckY = H * NECK_FROM_TOP;
  const shoulderY = H * 0.18;
  const bodyHalf = H * 0.125; // 몸 어깨 반폭
  const hipHalf = H * 0.09;
  const crotchY = H * 0.47;
  const armEnd = H * 0.46;

  // 옷: 어깨·가슴 실측이 있으면 반영하되 너무 튀지 않게 범위를 제한
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const shirtShoulderHalf = clamp(shoulder ? shoulder / 2 : H * 0.135, H * 0.11, H * 0.17);
  const shirtChestHalf = clamp(chest ? chest / 2 : H * 0.14, H * 0.11, H * 0.19);
  const bottomY = neckY + length;
  const sleeveEndY = shoulderY + H * 0.12; // 반팔 소매 끝
  const sleeveOut = shirtShoulderHalf + H * 0.05;
  const hemHalf = shirtChestHalf;
  // 어깨선에서 소매 끝, 겨드랑이, 밑단으로 이어지는 반팔 윤곽
  const armpitY = sleeveEndY + H * 0.03;
  const shirt = [
    `M${cx - H * 0.045} ${neckY}`,
    `Q${cx} ${neckY + H * 0.03} ${cx + H * 0.045} ${neckY}`,
    `L${cx + shirtShoulderHalf} ${shoulderY}`,
    `L${cx + sleeveOut} ${sleeveEndY - H * 0.01}`,
    `L${cx + sleeveOut - H * 0.035} ${sleeveEndY + H * 0.025}`,
    `L${cx + hemHalf} ${armpitY}`,
    `L${cx + hemHalf} ${bottomY}`,
    `L${cx - hemHalf} ${bottomY}`,
    `L${cx - hemHalf} ${armpitY}`,
    `L${cx - sleeveOut + H * 0.035} ${sleeveEndY + H * 0.025}`,
    `L${cx - sleeveOut} ${sleeveEndY - H * 0.01}`,
    `L${cx - shirtShoulderHalf} ${shoulderY}`,
    "Z",
  ].join(" ");
  const cut = bottomY > H;

  return (
    <figure className="flex flex-col gap-1.5" data-testid="length-silhouette">
      <div
        className="relative w-full max-w-56 overflow-hidden border border-neutral-300"
        style={{ aspectRatio: `${W} / ${H}`, background: "#f3f3f0" }}
        role="img"
        aria-label={`키 ${height}cm 남성 실루엣에 총장 ${length}cm 반팔을 입힌 그림`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <g fill={BODY_FILL}>
            <circle cx={cx} cy={H * 0.065} r={H * 0.055} />
            <rect x={cx - H * 0.02} y={H * 0.1} width={H * 0.04} height={H * 0.06} />
            <path d={`M${cx - bodyHalf} ${shoulderY} Q${cx} ${H * 0.15} ${cx + bodyHalf} ${shoulderY} L${cx + hipHalf} ${crotchY} L${cx - hipHalf} ${crotchY} Z`} />
            <rect x={cx - bodyHalf - H * 0.035} y={shoulderY - H * 0.01} width={H * 0.045} height={armEnd - shoulderY} rx={H * 0.022} />
            <rect x={cx + bodyHalf - H * 0.01} y={shoulderY - H * 0.01} width={H * 0.045} height={armEnd - shoulderY} rx={H * 0.022} />
            <rect x={cx - hipHalf} y={crotchY - H * 0.01} width={hipHalf - H * 0.008} height={H - crotchY + H * 0.01} rx={H * 0.015} />
            <rect x={cx + H * 0.008} y={crotchY - H * 0.01} width={hipHalf - H * 0.008} height={H - crotchY + H * 0.01} rx={H * 0.015} />
          </g>
          <path d={shirt} fill={SHIRT_FILL} stroke={SHIRT_LINE} strokeWidth={H * 0.004} strokeLinejoin="round" />
          {!cut && <line x1={cx + hemHalf + H * 0.01} x2={W} y1={bottomY} y2={bottomY} stroke="#111" strokeWidth={H * 0.004} strokeDasharray={`${H * 0.02} ${H * 0.012}`} />}
        </svg>
      </div>
      <figcaption className="max-w-56 text-xs text-pretty text-neutral-700">
        키 {height}cm 평균 성인 남자 실루엣에, 이 옷과 같은 총장({length}cm)의 반팔 티셔츠를 입힌 모습이에요. 실제 옷의 모양·핏과는 다를 수 있으니 길이 느낌만 참고하세요.
      </figcaption>
    </figure>
  );
}

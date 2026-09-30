/**
 * 총장 길이감을 눈으로 대충 보는 그림. 입력한 키에 맞춘 평균 성인 남자 실루엣(횡단보도 사람 기호 느낌)에,
 * 같은 총장의 반팔 티셔츠를 반투명으로 겹쳐 그려 티셔츠 뒤로 몸이 비쳐 보이게 한다.
 * 좌표는 cm 기준(세로 1 unit = 실제 1cm)이고, 몸의 위치는 키에 대한 비율(MALE_BODY_RATIO)로,
 * 티셔츠 밑단은 목 옆 어깨점(HPS)에서 실제 총장(cm)만큼 아래로 계산한다. 옷 폭은 어깨·가슴 실측과 상관없이 레귤러핏 평균 폭이다.
 */
export const MALE_BODY_RATIO = {
  chinY: 0.125,
  shoulderY: 0.17,
  armpitY: 0.235,
  waistY: 0.38,
  pantsWaistY: 0.44, // 바지 허리선(밑단 비교 기준). 배꼽 아래, 골반 바로 위
  pelvisY: 0.46,
  crotchY: 0.53,
  kneeY: 0.74,

  headWidth: 0.085,
  shoulderWidth: 0.255,
  chestWidth: 0.22,
  waistWidth: 0.17,
  hipWidth: 0.19,
};

export function getMaleBody(height: number) {
  const r = MALE_BODY_RATIO;
  return {
    chinY: height * r.chinY,
    shoulderY: height * r.shoulderY,
    armpitY: height * r.armpitY,
    waistY: height * r.waistY,
    pantsWaistY: height * r.pantsWaistY,
    pelvisY: height * r.pelvisY,
    crotchY: height * r.crotchY,
    kneeY: height * r.kneeY,
    floorY: height,
    headWidth: height * r.headWidth,
    shoulderWidth: height * r.shoulderWidth,
    chestWidth: height * r.chestWidth,
    waistWidth: height * r.waistWidth,
    hipWidth: height * r.hipWidth,
  };
}

/** 옷깃이 몸 어깨선보다 살짝 위에 걸치도록 옷 전체를 올리는 정도(키 비율). 총장은 그대로라 밑단도 같이 올라간다. */
const SHIRT_LIFT = 0.014;

/** 표준 레귤러핏 반팔 티셔츠. 옷의 어깨·가슴 실측은 쓰지 않고 총장만 반영한다. */
export function getTshirt(height: number, length: number) {
  const body = getMaleBody(height);
  const topY = body.shoulderY - height * SHIRT_LIFT;
  const hemY = topY + length; // 옷 맨 위(목 옆 어깨점)에서 실제 총장만큼 아래
  return {
    topY,
    hemY,
    shoulderWidth: body.shoulderWidth * 1.08,
    chestWidth: body.chestWidth * 1.06,
    sleeveLength: height * 0.12,
    diffFromWaist: hemY - body.pantsWaistY,
  };
}

/** 그림 칸은 키와 상관없이 같은 눈금(cm)이라, 키가 다르면 사람 크기도 다르게 보인다. */
const CANVAS_H = 212;
const GROUND_Y = 202; // 발이 닿는 바닥선(아래에 여백 10cm)
const CANVAS_W = 128;
const BODY = "#9a9a93";
const PANTS_FILL = "#4a4f57";
const SHIRT_FILL = "#3d5a80";
const SHIRT_LINE = "#2a4262";

const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

export function LengthSilhouette({
  length,
  height,
}: {
  length: number;
  height: number;
  /** 호출부 호환용. 옷의 어깨·가슴 실측은 그림에 쓰지 않는다. */
  shoulder?: number | null;
  chest?: number | null;
}) {
  const H = height;
  const W = CANVAS_W;
  const cx = W / 2;
  const top = GROUND_Y - H; // 키가 클수록 머리가 위로 올라가고, 작으면 머리 위가 비어 보인다
  const b = getMaleBody(H);
  const t = getTshirt(H, length);

  // ---- 사람(정면). 어깨 > 가슴 > 허리 < 골반으로 폭이 변한다 ----
  const sw = b.shoulderWidth / 2;
  const ch = b.chestWidth / 2;
  const wh = b.waistWidth / 2;
  const hh = b.hipWidth / 2;
  const neckHalf = H * 0.024;
  const torso = (s: 1 | -1): [number, number][] => [
    [cx + s * neckHalf, b.shoulderY - H * 0.006],
    [cx + s * sw * 0.86, b.shoulderY],
    [cx + s * sw, b.shoulderY + H * 0.014],
    [cx + s * ch, b.armpitY],
    [cx + s * wh, b.waistY],
    [cx + s * hh, b.pelvisY],
    [cx + s * hh * 0.9, b.crotchY],
  ];
  const torsoPoly = [...torso(1), ...torso(-1).reverse()];
  const arm = (s: 1 | -1): [number, number][] => [
    [cx + s * (sw - H * 0.02), b.shoulderY + H * 0.005],
    [cx + s * (sw + H * 0.006), b.shoulderY + H * 0.03],
    [cx + s * (sw + H * 0.016), H * 0.38],
    [cx + s * (sw + H * 0.008), H * 0.53],
    [cx + s * (sw - H * 0.032), H * 0.53],
    [cx + s * (sw - H * 0.03), H * 0.38],
    [cx + s * (sw - H * 0.05), b.armpitY],
  ];
  const leg = (s: 1 | -1): [number, number][] => [
    [cx + s * H * 0.004, b.crotchY],
    [cx + s * hh, b.pelvisY],
    [cx + s * H * 0.078, b.kneeY],
    [cx + s * H * 0.062, H * 0.96],
    [cx + s * H * 0.064, H],
    [cx + s * H * 0.01, H],
    [cx + s * H * 0.012, H * 0.96],
    [cx + s * H * 0.012, b.kneeY],
  ];

  // ---- 티셔츠 ----
  const shHalf = t.shoulderWidth / 2;
  const chestHalf = t.chestWidth / 2;
  const tipY = t.topY + H * 0.022; // 어깨 끝(몸 어깨보다 살짝 위로 띄운다)
  const collar = H * 0.04;
  // 실측 어깨가 가슴보다 좁아도 소매가 몸판 밖으로 충분히 벌어지게 한다
  const sleeveOut = Math.max(shHalf + H * 0.03, chestHalf + H * 0.05); // 소매 바깥 끝 x
  const sleeveOutY = tipY + t.sleeveLength * 0.8;
  const hemInX = Math.max(chestHalf + H * 0.012, sleeveOut - H * 0.075); // 소매 끝단 안쪽 x
  const hemInY = sleeveOutY + H * 0.04;
  const armpitY = b.armpitY + H * 0.01;
  const hemY = t.hemY;
  const neckY = t.topY;
  const rr = H * 0.008;
  const at = (s: 1 | -1, x: number) => cx + s * x;
  const rightSide = [
    `Q${at(1, shHalf * 0.55)} ${neckY - H * 0.008} ${at(1, shHalf)} ${tipY}`,
    `L${at(1, sleeveOut)} ${sleeveOutY}`,
    `L${at(1, hemInX)} ${hemInY}`,
    `Q${at(1, chestHalf + H * 0.004)} ${hemInY - H * 0.012} ${at(1, chestHalf)} ${armpitY}`,
    `L${at(1, chestHalf)} ${hemY - rr}`,
    `Q${at(1, chestHalf)} ${hemY} ${at(1, chestHalf - rr)} ${hemY}`,
  ];
  const leftSide = [
    `L${at(-1, chestHalf - rr)} ${hemY}`,
    `Q${at(-1, chestHalf)} ${hemY} ${at(-1, chestHalf)} ${hemY - rr}`,
    `L${at(-1, chestHalf)} ${armpitY}`,
    `Q${at(-1, chestHalf + H * 0.004)} ${hemInY - H * 0.012} ${at(-1, hemInX)} ${hemInY}`,
    `L${at(-1, sleeveOut)} ${sleeveOutY}`,
    `L${at(-1, shHalf)} ${tipY}`,
    `Q${at(-1, shHalf * 0.55)} ${neckY - H * 0.008} ${cx - collar} ${neckY}`,
  ];
  const shirt = [`M${cx - collar} ${neckY}`, `Q${cx} ${neckY + H * 0.05} ${cx + collar} ${neckY}`, ...rightSide, ...leftSide, "Z"].join(" ");
  const collarLine = `M${cx - collar} ${neckY} Q${cx} ${neckY + H * 0.05} ${cx + collar} ${neckY}`;
  const stroke = H * 0.004;

  // ---- 바지: 일반적인 스트레이트 핏을 고정으로 겹쳐 그려 밑단과 허리선을 비교한다 ----
  const pw = b.pantsWaistY;
  const pantsHemY = H * 0.965; // 발목 위까지
  const pantsCrotchY = b.crotchY + H * 0.02;
  const pants = [
    `M${cx - hh * 1.04} ${pw}`,
    `L${cx + hh * 1.04} ${pw}`,
    `L${cx + hh * 1.08} ${b.pelvisY}`,
    `L${cx + H * 0.088} ${b.kneeY}`,
    `L${cx + H * 0.074} ${pantsHemY}`,
    `L${cx + H * 0.016} ${pantsHemY}`,
    `L${cx + H * 0.02} ${b.kneeY}`,
    `L${cx} ${pantsCrotchY}`,
    `L${cx - H * 0.02} ${b.kneeY}`,
    `L${cx - H * 0.016} ${pantsHemY}`,
    `L${cx - H * 0.074} ${pantsHemY}`,
    `L${cx - H * 0.088} ${b.kneeY}`,
    `L${cx - hh * 1.08} ${b.pelvisY}`,
    "Z",
  ].join(" ");

  const marks = Array.from({ length: 21 }, (_, i) => i * 10); // 0~200cm, 10cm마다
  const guides: [string, number][] = [
    ["어깨", b.shoulderY],
    ["바지 허리선", b.pantsWaistY],
    ["사타구니", b.crotchY],
    ["무릎", b.kneeY],
  ];
  const diff = t.diffFromWaist;
  const diffText =
    Math.abs(diff) < 0.5 ? "바지 허리선과 거의 같은 높이" : `바지 허리선보다 약 ${Math.abs(diff).toFixed(1).replace(/\.0$/, "")}cm ${diff > 0 ? "아래" : "위"}`;

  return (
    <figure className="flex items-start gap-4" data-testid="length-silhouette">
      <div
        className="relative w-[46%] max-w-56 shrink-0 overflow-hidden border border-neutral-300"
        style={{ aspectRatio: `${W} / ${CANVAS_H}`, background: "#f3f3f0" }}
        role="img"
        aria-label={`키 ${height}cm 남성 실루엣에 총장 ${length}cm 반팔을 입힌 그림. ${diffText}`}
      >
        <svg viewBox={`0 0 ${W} ${CANVAS_H}`} className="absolute inset-0 size-full" aria-hidden>
          {/* 키 눈금: 발 밑(0cm)에서 10cm마다 연한 가로줄, 눈금 숫자는 왼쪽 */}
          <g stroke="#cfcfc8" strokeWidth={0.25}>
            {marks.map((cm) => (
              <line key={cm} x1={cm % 50 === 0 ? 0 : 9} x2={W} y1={GROUND_Y - cm} y2={GROUND_Y - cm} strokeOpacity={cm % 50 === 0 ? 0.9 : 0.55} />
            ))}
          </g>
          <g fill="#9b9b94" fontSize={4} fontFamily="ui-monospace, monospace">
            {marks.filter((cm) => cm > 0).map((cm) => (
              <text key={cm} x={1} y={GROUND_Y - cm + 1.4}>
                {cm}
              </text>
            ))}
          </g>
          <line x1={0} x2={W} y1={top} y2={top} stroke="#8a8a83" strokeWidth={0.3} strokeDasharray="1.5 1.5" />
          <g transform={`translate(0 ${top})`}>
            {/* 신체 기준선(어깨·바지 허리선·사타구니·무릎) */}
            <g stroke="#7d8f7a" strokeWidth={0.3} strokeDasharray="0.8 1.2">
              {guides.map(([name, y]) => (
                <line key={name} x1={0} x2={W} y1={y} y2={y} stroke={name === "바지 허리선" ? "#c2410c" : undefined} strokeWidth={name === "바지 허리선" ? 0.5 : undefined} />
              ))}
            </g>
            <g fill="#5f7a5b" fontSize={3.4} textAnchor="end">
              {guides.map(([name, y]) => (
                <text key={name} x={W - 1} y={y - 0.8} fill={name === "바지 허리선" ? "#c2410c" : undefined}>
                  {name}
                </text>
              ))}
            </g>
            {/* 사람 */}
            <g fill={BODY} stroke={BODY} strokeWidth={H * 0.008} strokeLinejoin="round">
              <ellipse cx={cx} cy={b.chinY / 2} rx={b.headWidth / 2} ry={b.chinY / 2} stroke="none" />
              <rect x={cx - neckHalf} y={b.chinY - H * 0.01} width={neckHalf * 2} height={b.shoulderY - b.chinY + H * 0.02} stroke="none" />
              <polygon points={pts(torsoPoly)} />
              <polygon points={pts(arm(1))} />
              <polygon points={pts(arm(-1))} />
              <polygon points={pts(leg(1))} />
              <polygon points={pts(leg(-1))} />
            </g>
            {/* 바지(고정 스트레이트 핏) */}
            <path d={pants} fill={PANTS_FILL} fillOpacity={0.72} stroke={PANTS_FILL} strokeWidth={stroke} strokeLinejoin="round" />
            <line x1={cx - hh * 1.04} x2={cx + hh * 1.04} y1={pw + H * 0.008} y2={pw + H * 0.008} stroke="#2f333a" strokeWidth={stroke * 0.8} />
            {/* 티셔츠: 반투명이라 뒤의 몸이 비친다 */}
            <path d={shirt} fill={SHIRT_FILL} fillOpacity={0.62} stroke={SHIRT_LINE} strokeWidth={stroke} strokeLinejoin="round" />
            <path d={collarLine} fill="none" stroke={SHIRT_LINE} strokeWidth={stroke * 2} strokeLinecap="round" />
            <line x1={cx + chestHalf + H * 0.015} x2={W - 19} y1={hemY} y2={hemY} stroke="#111" strokeWidth={stroke} strokeDasharray={`${H * 0.02} ${H * 0.012}`} />
          </g>
        </svg>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-sm font-medium">{diffText}</p>
      <figcaption className="flex flex-col gap-1.5">
        <span className="text-xs leading-relaxed text-pretty text-neutral-700 md:text-sm">
          키 {height}cm 평균 성인 남자 실루엣에 총장 {length}cm 반팔 티셔츠와 일반적인 스트레이트 바지를 입힌 모습이에요.
        </span>
        <span className="text-2xs leading-relaxed text-pretty text-neutral-500 md:text-xs">
          실제 어깨·가슴·소매 치수에 따라 착용감은 달라질 수 있으니 길이 느낌만 참고하세요.
        </span>
        <span className="text-2xs leading-relaxed text-pretty text-neutral-500 md:text-xs">
          바지를 허리선에 맞춰 입은 경우의 예시예요. 바지를 내려 입거나 새깅하면 바지가 표시된 허리선보다 아래에 있어, 티셔츠 밑단과의 차이도 달라져요.
        </span>
      </figcaption>
      </div>
    </figure>
  );
}

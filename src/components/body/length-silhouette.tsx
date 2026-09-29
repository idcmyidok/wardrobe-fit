"use client";

import { useState } from "react";

/**
 * 총장 길이감을 눈으로 대충 보는 그림. 내 키에 맞춘 사람 실루엣 위에, 제품 사진을 목 아래부터 총장(cm)만큼의 길이로 얹는다.
 * 세로 1cm를 실루엣 세로 1cm와 같은 비율로 그리고, 사진 가로는 사진 비율을 따른다.
 * 사진의 여백·각도 때문에 실제와 다를 수 있어서 어디까지나 참고용이다.
 */
const NECK_FROM_TOP = 0.15; // 정수리에서 목 아래(총장을 재는 곳)까지, 키의 비율
const CANVAS_WIDTH = 0.7; // 그림 가로 = 키의 비율

export function LengthSilhouette({ imageUrl, length, height }: { imageUrl: string; length: number; height: number }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const H = height;
  const W = H * CANVAS_WIDTH;
  const cx = W / 2;
  const neckY = H * NECK_FROM_TOP;
  const shoulderY = H * 0.18;
  const shoulderHalf = H * 0.125;
  const crotchY = H * 0.47;
  const hipHalf = H * 0.09;
  const armEnd = H * 0.46;
  const armX = shoulderHalf + H * 0.02;
  const legGap = H * 0.008;
  const bottomY = neckY + length;
  const cut = bottomY > H;

  return (
    <figure className="flex flex-col gap-1.5" data-testid="length-silhouette">
      <div
        className="relative w-full max-w-56 overflow-hidden border border-neutral-300"
        style={{ aspectRatio: `${W} / ${H}`, background: "#f3f3f0" }}
        role="img"
        aria-label={`키 ${height}cm 사람 위에 총장 ${length}cm 옷 사진을 얹은 그림`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <g fill="#c9c9c3">
            <circle cx={cx} cy={H * 0.065} r={H * 0.055} />
            <rect x={cx - H * 0.02} y={H * 0.1} width={H * 0.04} height={H * 0.06} />
            <path d={`M${cx - shoulderHalf} ${shoulderY} Q${cx} ${H * 0.15} ${cx + shoulderHalf} ${shoulderY} L${cx + hipHalf} ${crotchY} L${cx - hipHalf} ${crotchY} Z`} />
            <rect x={cx - armX - H * 0.03} y={shoulderY} width={H * 0.04} height={armEnd - shoulderY} rx={H * 0.02} />
            <rect x={cx + armX - H * 0.01} y={shoulderY} width={H * 0.04} height={armEnd - shoulderY} rx={H * 0.02} />
            <rect x={cx - hipHalf} y={crotchY - H * 0.01} width={hipHalf - legGap} height={H - crotchY + H * 0.01} rx={H * 0.015} />
            <rect x={cx + legGap} y={crotchY - H * 0.01} width={hipHalf - legGap} height={H - crotchY + H * 0.01} rx={H * 0.015} />
          </g>
          {!cut && <line x1={0} x2={W} y1={bottomY} y2={bottomY} stroke="#111" strokeWidth={H * 0.004} strokeDasharray={`${H * 0.02} ${H * 0.012}`} />}
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element -- 분석 때 받아 둔 제품 사진을 그대로 얹는다 */}
        <img
          src={imageUrl}
          alt=""
          onError={() => setBroken(true)}
          className="absolute max-w-none opacity-90"
          style={{ left: "50%", top: `${(neckY / H) * 100}%`, height: `${(length / H) * 100}%`, width: "auto", transform: "translateX(-50%)", mixBlendMode: "multiply" }}
        />
      </div>
      <figcaption className="max-w-56 text-xs text-pretty text-neutral-700">
        키 {height}cm 기준으로 총장 {length}cm를 목 아래부터 그렸어요. 사진 여백과 각도 때문에 실제와 조금 다를 수 있는 참고용이에요.
      </figcaption>
    </figure>
  );
}

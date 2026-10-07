import type { CSSProperties } from "react";
import { FeatureShowcase } from "./feature-showcase";
import "./landing.css";

/** 처음 열 때 위에서부터 차례로 떠오르게 하는 지연(ms) */
const rise = (ms: number) => ({ "--rise": `${ms}ms` }) as CSSProperties;

/** 첫 화면 왼쪽. 부모가 세로로 늘어놓고 위아래로 벌린다. */
export function ServiceIntro() {
  return (
    <>
      <div className="flex max-w-130 flex-col gap-3">
        <div className="lp-rise font-mono text-xs font-medium tracking-[0.08em] text-accent-700 uppercase">
          Personal fit archive
        </div>
        <h1
          className="lp-rise font-display text-hero font-extrabold tracking-[-0.05em] bg-linear-to-r from-text via-text to-accent bg-clip-text text-transparent"
          style={rise(80)}
        >
          Wardrobe <span className="not-italic">Fit</span>
        </h1>
        <p
          className="lp-rise text-[19px] leading-normal text-pretty text-neutral-800"
          style={rise(160)}
        >
          내 옷장에 있는 옷을 기준으로
          <br />새 옷 사이즈를 고르고, 옷 사는 습관을 돌아봅니다.
        </p>
      </div>

      <FeatureShowcase style={rise(260)} />
    </>
  );
}

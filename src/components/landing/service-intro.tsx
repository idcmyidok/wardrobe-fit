const FEATURES = [
  { title: "옷장 기록", description: "가진 옷의 실측과 착용 후기를 한 곳에 정리합니다." },
  { title: "링크로 등록", description: "상품 URL을 넣으면 브랜드, 사이즈표, 컬러를 자동으로 채웁니다." },
  { title: "구매 판단", description: "사려는 옷의 실측을 내 옷과 치수별로 비교해 핏을 가늠합니다." },
];

/** 첫 화면 소개에 쓰는 예시 비교. 실제 데이터가 아니라 서비스가 무엇을 보여주는지 설명하는 용도다. */
const SAMPLE = {
  columns: ["총장", "어깨", "가슴", "소매"],
  rows: [
    { label: "내 자켓 M", values: ["70.0", "46.0", "58.0", "63.0"], strong: false },
    { label: "새 자켓 48", values: ["72.0", "46.5", "59.0", "64.5"], strong: true },
  ],
  note: "어깨·가슴은 평소 입던 자켓과 비슷하고, 총장은 2cm 길게 느껴질 수 있습니다.",
};

/** 첫 화면 왼쪽. 부모가 세로로 늘어놓고 위아래로 벌린다. */
export function ServiceIntro() {
  return (
    <>
      <div className="flex max-w-130 flex-col gap-3">
        <div className="font-mono text-xs font-medium tracking-[0.08em] text-accent-700 uppercase">
          Personal fit archive
        </div>
        <h1 className="font-display text-hero font-normal tracking-[-0.02em]">
          Wardrobe <em>Fit</em>
        </h1>
        <p className="text-[19px] leading-normal text-pretty text-neutral-800">
          입어본 옷의 실측과 후기로,
          <br />
          새 옷의 핏을 미리 가늠합니다.
        </p>
      </div>

      <ol className="max-w-130 border-t border-text">
        {FEATURES.map((feature, index) => (
          <li key={feature.title} className="grid grid-cols-[40px_1fr] gap-3 border-b border-neutral-300 py-4">
            <span className="font-mono text-sm text-accent-700 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <div className="text-md font-semibold">{feature.title}</div>
              <div className="text-base text-neutral-700">{feature.description}</div>
            </div>
          </li>
        ))}
      </ol>

      <figure
        aria-label="비교 예시"
        className="flex max-w-130 flex-col gap-3.5 rounded-md border border-neutral-300 bg-surface px-5 py-4.5"
      >
        <table className="w-full text-sm tabular-nums">
          <caption className="caption pb-1">
            <span className="flex items-baseline justify-between uppercase">
              <span>Fit check — Sample</span>
              <span>cm</span>
            </span>
          </caption>
          <thead>
            <tr className="border-b border-text font-mono text-label text-neutral-700">
              <th scope="col" className="w-16 py-1.5 text-left font-normal">
                <span className="sr-only">옷</span>
              </th>
              {SAMPLE.columns.map((c) => (
                <th key={c} scope="col" className="py-1.5 text-right font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE.rows.map((row, r) => (
              <tr key={row.label} className={r === 0 ? "border-b border-neutral-300" : undefined}>
                <th scope="row" className={row.strong ? "py-2 text-left font-medium" : "py-2 text-left font-normal"}>
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className={
                      row.strong && i === 0
                        ? "py-2 text-right font-mono font-medium text-accent-700"
                        : "py-2 text-right font-mono"
                    }
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <figcaption className="text-base leading-relaxed text-neutral-800">“{SAMPLE.note}”</figcaption>
      </figure>

      <p className="max-w-110 text-base text-pretty text-neutral-700">
        신체 치수 추정이 아니라, 실제로 입어본 옷을 기준으로 비교합니다. 기록이 쌓일수록 비교가 정확해집니다.
      </p>
    </>
  );
}

const FEATURES = [
  { title: "옷장 기록", description: "가진 옷의 실측과 착용 후기를 한 곳에 정리합니다." },
  { title: "링크로 등록", description: "상품 URL을 넣으면 브랜드, 사이즈표, 컬러를 자동으로 채웁니다." },
  { title: "구매 판단", description: "사려는 옷의 실측을 내 옷과 치수별로 비교해 핏을 가늠합니다." },
];

/** 첫 화면 소개에 쓰는 예시 비교. 실제 데이터가 아니라 서비스가 무엇을 보여주는지 설명하는 용도다. */
const SAMPLE = {
  columns: ["총장", "어깨", "가슴", "소매"],
  mine: { label: "내 자켓 M", values: ["70.0", "46.0", "58.0", "63.0"] },
  next: { label: "새 자켓 48", values: ["72.0", "46.5", "59.0", "64.5"] },
  note: "어깨·가슴은 평소 입던 자켓과 비슷하고, 총장은 2cm 길게 느껴질 수 있습니다.",
};

export function ServiceIntro() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-10">
      <div className="flex flex-col gap-4">
        <p className="font-display text-hero text-text">Wardrobe Fit</p>
        <h1 className="text-lg font-normal text-text-muted">
          입어본 옷의 실측과 후기로,
          <br />
          새 옷의 핏을 미리 가늠합니다.
        </h1>
      </div>

      <ol className="flex flex-col border-t border-text">
        {FEATURES.map((feature, index) => (
          <li key={feature.title} className="grid grid-cols-[40px_1fr] gap-3 border-b border-border py-4">
            <span className="font-mono text-sm text-accent tabular-nums">{String(index + 1).padStart(2, "0")}</span>
            <div className="flex flex-col gap-0.5">
              <p className="text-md font-semibold text-text">{feature.title}</p>
              <p className="text-base text-text-muted">{feature.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <figure aria-label="비교 예시" className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4">
        <table className="w-full text-sm tabular-nums">
          <caption className="pb-1 text-left font-mono text-label text-text-muted">예시 비교 · cm</caption>
          <thead>
            <tr className="border-b border-text font-mono text-label text-text-muted">
              <th scope="col" className="py-1.5 text-left font-medium">
                <span className="sr-only">옷</span>
              </th>
              {SAMPLE.columns.map((c) => (
                <th key={c} scope="col" className="py-1.5 text-right font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr className="border-b border-border">
              <th scope="row" className="py-2 text-left font-sans font-normal">
                {SAMPLE.mine.label}
              </th>
              {SAMPLE.mine.values.map((v, i) => (
                <td key={i} className="py-2 text-right">
                  {v}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="py-2 text-left font-sans font-medium">
                {SAMPLE.next.label}
              </th>
              {SAMPLE.next.values.map((v, i) => (
                <td key={i} className={i === 0 ? "py-2 text-right font-medium text-accent" : "py-2 text-right"}>
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <figcaption className="text-base text-text-muted">“{SAMPLE.note}”</figcaption>
      </figure>

      <p className="max-w-md text-sm text-text-muted">
        신체 치수 추정이 아니라, 실제로 입어본 옷을 기준으로 비교합니다. 기록이 쌓일수록 비교가 정확해집니다.
      </p>
    </div>
  );
}

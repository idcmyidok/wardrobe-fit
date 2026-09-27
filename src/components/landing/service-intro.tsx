const FEATURES = [
  { title: "옷장 기록", description: "가진 옷의 실측과 착용 후기를 한 곳에 정리합니다." },
  { title: "링크로 등록", description: "상품 URL을 넣으면 브랜드, 사이즈표, 컬러를 자동으로 채웁니다." },
  { title: "구매 판단", description: "사려는 옷의 실측을 내 옷과 치수별로 비교해 핏을 가늠합니다." },
];

export function ServiceIntro() {
  return (
    <div className="flex max-w-md flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="text-xl font-semibold tracking-tight text-text">Wardrobe Fit</p>
        <h1 className="text-md font-normal text-text-muted">
          입어본 옷의 실측과 후기로,
          <br />
          새 옷의 핏을 미리 가늠합니다.
        </h1>
      </div>

      <ol className="flex flex-col border-t border-border">
        {FEATURES.map((feature, index) => (
          <li key={feature.title} className="flex gap-4 border-b border-border py-4">
            <span className="w-5 text-sm text-text-subtle tabular-nums">{String(index + 1).padStart(2, "0")}</span>
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-medium text-text">{feature.title}</p>
              <p className="text-sm text-text-muted">{feature.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm text-text-muted">
        신체 치수 추정이 아니라, 실제로 입어본 옷을 기준으로 비교합니다. 기록이 쌓일수록 비교가 정확해집니다.
      </p>
    </div>
  );
}

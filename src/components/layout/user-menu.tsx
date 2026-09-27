/** 사용자 메뉴 placeholder. 3단계(인증)에서 Dropdown(계정 설정, 로그아웃)으로 교체한다. */
export function UserMenu() {
  return (
    <button
      type="button"
      aria-label="계정 메뉴"
      className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-2.5 text-base text-text transition-colors hover:border-text-subtle hover:bg-surface-muted"
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-text-muted md:hidden">
        W
      </span>
      <span className="hidden md:inline">demo@wardrobe.fit</span>
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

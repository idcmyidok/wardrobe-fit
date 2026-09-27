/** 사용자 메뉴 placeholder. 3단계(인증)에서 Dropdown(계정 설정, 로그아웃)으로 교체한다. */
export function UserMenu() {
  return (
    <button
      type="button"
      aria-label="계정 메뉴"
      className="flex items-center gap-2 rounded-md px-2 py-1 text-base text-text-muted hover:bg-surface-muted hover:text-text"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-text-muted">
        W
      </span>
      <span className="hidden md:inline">demo@wardrobe.fit</span>
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

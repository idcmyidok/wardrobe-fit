"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { THEME_STORAGE_KEY as STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(choice: ThemeChoice) {
  const dark =
    choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const OPTIONS: { id: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    id: "light",
    label: "라이트 모드",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </>
    ),
  },
  { id: "dark", label: "다크 모드", icon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /> },
  {
    id: "system",
    label: "기기 설정 따르기",
    icon: (
      <>
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
  },
];

export function ThemeToggle() {
  // 저장된 선택은 브라우저에만 있으므로 서버 렌더에서는 system으로 둔다.
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(readChoice());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const pick = (next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    apply(next);
    listeners.forEach((l) => l());
  };

  return (
    <div role="group" aria-label="화면 모드" className="inline-flex gap-0.5 rounded-md border border-neutral-300 bg-surface p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-label={o.label}
          aria-pressed={choice === o.id}
          title={o.label}
          onClick={() => pick(o.id)}
          className={cn(
            "grid size-7.5 cursor-pointer place-items-center rounded-sm transition-colors",
            choice === o.id ? "bg-text text-bg" : "text-neutral-700 hover:bg-neutral-200",
          )}
        >
          <svg
            aria-hidden
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** 오프라인이면 화면 위에 얇은 안내를 띄운다(PROJECT_SPEC.md 20장 Network 오류). */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="border-b border-accent bg-surface px-4 py-1.5 text-center text-sm text-accent-700">
      인터넷 연결이 끊겼습니다. 입력한 내용은 유지되며, 연결되면 다시 저장할 수 있습니다.
    </div>
  );
}

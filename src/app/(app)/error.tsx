"use client";

import { ErrorPanel } from "@/components/feedback/error-panel";

/** 로그인 후 화면에서 난 오류. 머리글은 그대로 두고 본문만 바꾼다. */
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel {...props} />;
}

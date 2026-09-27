"use client";

import { ErrorPanel } from "@/components/feedback/error-panel";

/** 옷 목록을 읽는 레이아웃 등, 화면 구역 밖에서 난 오류 */
export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel {...props} />;
}

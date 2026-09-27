/** 인증 연결 전(3단계 이전) 폼 제출 시 보여주는 인라인 안내 */
export function NotConnectedNotice() {
  return (
    <p role="status" className="rounded-md bg-surface-muted px-3 py-2 text-sm text-text-muted">
      인증 기능은 아직 연결되지 않았습니다. 현재는 화면 구성만 확인할 수 있습니다.
    </p>
  );
}

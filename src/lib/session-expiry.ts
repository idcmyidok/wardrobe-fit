import type { Garment } from "@/lib/types/domain";

/**
 * 세션 만료 처리(PROJECT_SPEC.md 20장): 로그인 화면으로 보내고 돌아올 경로(next)를 남긴다.
 * 작성 중이던 새 옷 Form은 sessionStorage에 잠시 두었다가 돌아오면 다시 채운다.
 */

const DRAFT_KEY = "wardrobe-fit:new-garment-draft";

export function stashDraft(draft: Omit<Garment, "id">) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 그냥 넘어간다.
  }
}

/** 보관한 Form을 한 번만 꺼낸다. */
export function takeStashedDraft(): Omit<Garment, "id"> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw) as Omit<Garment, "id">;
  } catch {
    return null;
  }
}

export function goToSignIn() {
  const next = `${window.location.pathname}${window.location.search}`;
  // 서버 컴포넌트(옷 목록)까지 새로 읽도록 전체 페이지를 다시 불러온다.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/?next=${encodeURIComponent(next)}`);
}

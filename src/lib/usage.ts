/** 사용자별 24시간 사용량(GET /api/usage). */
export interface Usage {
  imports: { used: number; limit: number };
  fits: { used: number; limit: number };
  ai: { used: number; limit: number };
}

/** 링크 분석·구매 판단을 마친 뒤 부르면 화면의 사용량 안내가 다시 읽는다. */
export const USAGE_CHANGED_EVENT = "wardrobe-fit:usage-changed";
export const notifyUsageChanged = () => window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));

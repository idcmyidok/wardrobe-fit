/**
 * 사용자별 최근 24시간 사용량(GET /api/usage). 한도는 "지난 24시간" 기준이라 한 번 쓴 횟수는 쓴 시각 24시간 뒤에 돌아온다.
 * oldestAt: 지금 세고 있는 기록 중 가장 이른 시각(+24시간이면 1회가 돌아옴)
 * newestAt: 가장 늦은 시각(+24시간이면 모두 돌아옴)
 */
export interface UsageCounter {
  used: number;
  limit: number;
  oldestAt: string | null;
  newestAt: string | null;
}

/** 한도가 없는 이유: 관리자 계정, 또는 관리자가 지정한 테스터 계정. */
export type UnlimitedReason = "admin" | "tester";

export interface Usage {
  /** 관리자·테스터 계정은 한도가 없다. */
  unlimited: boolean;
  unlimitedReason: UnlimitedReason | null;
  imports: UsageCounter;
  fits: UsageCounter;
  ai: UsageCounter;
  /** AI 옷장 분석(/roast)의 AI 글쓰기. 다 쓰면 AI 없이 템플릿 결과로 계속 쓸 수 있다. */
  roast: UsageCounter;
}

export const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 링크 분석·구매 판단을 마친 뒤 부르면 화면의 사용량 안내가 다시 읽는다. */
export const USAGE_CHANGED_EVENT = "wardrobe-fit:usage-changed";
export const notifyUsageChanged = () => window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));

/** "3시간 12분", "8분", "1분 미만" */
export function formatRemaining(ms: number) {
  if (ms < 60_000) return "1분 미만";
  const minutes = Math.ceil(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
}

/**
 * 다시 쓸 수 있게 되는 때 안내. 한도를 다 썼으면 1회가 돌아오는 때, 아니면 전부 초기화되는 때.
 * 쓴 기록이 없으면 null.
 */
export function resetHint(c: UsageCounter, now: number): string | null {
  const at = c.used >= c.limit ? c.oldestAt : c.newestAt;
  if (!c.used || !at) return null;
  const left = formatRemaining(Math.max(0, Date.parse(at) + USAGE_WINDOW_MS - now));
  return c.used >= c.limit ? `${left} 뒤 1회 가능` : `${left} 뒤 초기화`;
}

const krw = new Intl.NumberFormat("ko-KR");

/** 12900 → "12,900원". 값이 없으면 "—" */
export function formatPrice(value: number | null): string {
  return value == null ? "—" : `${krw.format(value)}원`;
}

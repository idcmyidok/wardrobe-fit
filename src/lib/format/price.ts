const krw = new Intl.NumberFormat("ko-KR");
const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 가격 통화. 원은 원 단위, 달러는 센트 단위 정수로 저장한다(49.99달러 → 4999). */
export type Currency = "KRW" | "USD";
export const CURRENCIES: Currency[] = ["KRW", "USD"];
export const isCurrency = (v: unknown): v is Currency => v === "KRW" || v === "USD";

/** 환율 기본값(1달러 = 1,360원). 실제 값은 관리자가 app_settings에서 바꾼다(마이그레이션 18). */
export const DEFAULT_USD_KRW = 1360;

/** 12900 → "12,900원". 값이 없으면 "—". 달러면 4999 → "$49.99" */
export function formatPrice(value: number | null, currency: Currency = "KRW"): string {
  if (value == null) return "—";
  return currency === "USD" ? `$${usd.format(value / 100)}` : `${krw.format(value)}원`;
}

/** 원으로 바꾼 값(정렬·합계용). 달러는 환율로 계산해 원 단위로 반올림한다. */
export function priceInKrw(value: number | null, currency: Currency | undefined, usdRate: number): number | null {
  if (value == null) return null;
  return currency === "USD" ? Math.round((value / 100) * usdRate) : value;
}

/** 달러 가격 옆에 붙이는 원 환산 "약 67,986원". 원 가격이면 null */
export function krwHint(value: number | null, currency: Currency | undefined, usdRate: number): string | null {
  if (value == null || currency !== "USD") return null;
  return `약 ${krw.format(priceInKrw(value, currency, usdRate)!)}원`;
}

/** 입력 칸 문자열 → 저장값. 원은 숫자만, 달러는 소수 둘째 자리까지 받아 센트로 바꾼다. 비었거나 읽지 못하면 null */
export function parsePriceInput(text: string, currency: Currency): number | null {
  if (currency === "KRW") {
    const digits = text.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  }
  const cleaned = text.replace(/[^\d.]/g, "");
  if (!cleaned || !/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === ".") return null;
  return Math.round(Number(cleaned) * 100);
}

/** 저장값 → 입력 칸 문자열 */
export function priceInputText(value: number | null, currency: Currency): string {
  if (value == null) return "";
  if (currency === "KRW") return String(value);
  const cents = value % 100;
  return cents ? (value / 100).toFixed(2) : String(value / 100);
}

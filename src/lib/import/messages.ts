/**
 * 링크 분석 실패 문구(PROJECT_SPEC.md 20장). 서버 오류 코드 → 화면 문구.
 * 화면과 서버가 함께 쓰므로 서버 전용 코드를 import하지 않는다.
 */

export type ImportFailureCode =
  | "invalid_url"
  | "blocked_host"
  | "blocked_port"
  | "dns_failed"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "unsupported_content"
  | "http_error"
  | "network_error"
  | "no_product"
  | "rate_limited"
  | "signed_out"
  | "unknown";

export const IMPORT_FAILURE: Record<ImportFailureCode, { title: string; body: string }> = {
  invalid_url: { title: "지원하지 않는 주소 형식입니다", body: "상품 페이지 주소(https://…)를 그대로 붙여 넣어 주세요." },
  blocked_host: { title: "지원하지 않는 주소 형식입니다", body: "공개된 쇼핑몰 상품 페이지만 분석할 수 있습니다." },
  blocked_port: { title: "지원하지 않는 주소 형식입니다", body: "공개된 쇼핑몰 상품 페이지만 분석할 수 있습니다." },
  dns_failed: { title: "페이지에 접근할 수 없습니다", body: "주소를 찾을 수 없습니다. 주소가 맞는지 확인해 주세요." },
  too_many_redirects: { title: "페이지에 접근할 수 없습니다", body: "다른 주소로 너무 여러 번 이동합니다. 상품 페이지 주소를 직접 붙여 넣어 주세요." },
  timeout: { title: "시간이 초과되었습니다", body: "쇼핑몰이 응답하지 않습니다. 잠시 뒤 다시 시도하거나 직접 입력해 주세요." },
  too_large: { title: "상품 정보를 찾지 못했습니다", body: "페이지가 너무 커서 읽지 못했습니다." },
  unsupported_content: { title: "상품 정보를 찾지 못했습니다", body: "상품 페이지가 아닌 것 같습니다." },
  http_error: {
    title: "페이지에 접근할 수 없습니다(차단 또는 로그인 필요)",
    body: "쇼핑몰이 자동 분석을 막았거나 로그인이 필요한 페이지입니다. 직접 입력하면 링크는 그대로 남습니다.",
  },
  network_error: { title: "페이지에 접근할 수 없습니다", body: "쇼핑몰에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
  no_product: { title: "상품 정보를 찾지 못했습니다", body: "아직 지원하지 않는 쇼핑몰이거나 상품 페이지가 아닐 수 있습니다." },
  rate_limited: { title: "잠시 후 다시 시도해 주세요", body: "링크 분석은 한 시간에 30번까지 할 수 있습니다." },
  signed_out: { title: "로그인이 필요합니다", body: "다시 로그인한 뒤 시도해 주세요." },
  unknown: { title: "상품 정보를 읽지 못했습니다", body: "잠시 뒤 다시 시도하거나 직접 입력해 주세요." },
};

export function importFailure(code: string | null | undefined) {
  return IMPORT_FAILURE[(code ?? "unknown") as ImportFailureCode] ?? IMPORT_FAILURE.unknown;
}

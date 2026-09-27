import { checkUrlShape } from "@/server/security/url-guard";
import { ImportError } from "./types";

/** 광고·추적용 파라미터. 같은 상품 링크를 같은 주소로 보기 위해 지운다. */
const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^dclid$/i, /^msclkid$/i, /^igshid$/i, /^_ga$/i, /^mc_(cid|eid)$/i, /^ref(errer)?$/i, /^n_(media|query|rank|ad_group|ad|keyword_id|keyword|campaign_type|contract|ad_group_type)$/i];

export const MAX_URL_LENGTH = 2048;

/** 사용자가 붙여 넣은 문자열을 검사하고 정리한 URL로 바꾼다. 스킴이 없으면 https를 붙인다. */
export function normalizeProductUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) throw new ImportError("invalid_url");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const shape = checkUrlShape(withScheme);
  if (!shape.ok) throw new ImportError(shape.reason);
  const url = shape.url;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) url.searchParams.delete(key);
  }
  return url;
}

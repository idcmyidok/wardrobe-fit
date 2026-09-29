import "server-only";
import RAW from "./brands.json";

/**
 * AI 옷장 분석용 브랜드 자료(data/brands/brand-master.xlsx → scripts/build-brands.mjs → brands.json).
 * 약 400KB라 화면으로 보내지 않고 서버에서만 읽는다.
 * 숫자 칸: price 1(저가)~6(초고가), 나머지 1~5(계획서 4-3).
 */
export interface BrandInfo {
  name: string;
  aliases: string[];
  country: string;
  founded: number | null;
  positions: string[];
  price: number;
  tags: string[];
  types: string[];
  products: string[];
  /** 유행 성향 1(매우 타임리스)~5(매우 트렌드 지향) */
  trend: number;
  /** 포멀도 1(매우 캐주얼)~5(매우 포멀) */
  formal: number;
  func: number;
  heritage: number;
  /** 대중성 1(컬트)~5(매우 대중적) */
  pop: number;
  /** 접근성: 한국에서 사기 쉬운 정도 */
  access: number;
  hype: number;
}

export const BRANDS = RAW as BrandInfo[];

export type BrandGroup =
  | "luxury"
  | "designer"
  | "contemporary"
  | "premium_casual"
  | "specialist"
  | "jp_denim"
  | "heritage"
  | "street"
  | "sports"
  | "outdoor"
  | "mass";

export const BRAND_GROUPS: BrandGroup[] = [
  "luxury",
  "designer",
  "contemporary",
  "premium_casual",
  "specialist",
  "jp_denim",
  "heritage",
  "street",
  "sports",
  "outdoor",
  "mass",
];

/** 비교용 이름: NFKC → 소문자 → 한글·영문·숫자만 */
export function normalizeBrand(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣ㄱ-ㆎ]/g, "");
}

interface Key {
  key: string;
  brand: BrandInfo;
  /** 세 글자 이하 별칭은 앞부분 일치에 쓰지 않는다(COS가 Cosmic Wonder를 잡지 않게). */
  prefixOk: boolean;
}

const KEYS: Key[] = [];
const EXACT = new Map<string, BrandInfo>();
for (const brand of BRANDS) {
  for (const raw of [brand.name, ...brand.aliases]) {
    const key = normalizeBrand(raw);
    if (!key) continue;
    // 같은 이름이 두 브랜드에 있으면 먼저 나온(엑셀 위쪽) 브랜드를 쓴다.
    if (!EXACT.has(key)) EXACT.set(key, brand);
    KEYS.push({ key, brand, prefixOk: [...raw.trim()].length > 3 });
  }
}
// 긴 이름부터 본다("MISEKI SEOUL MAN"이 "MISEKI SEOUL"보다 먼저).
KEYS.sort((a, b) => b.key.length - a.key.length);

const cache = new Map<string, BrandInfo | null>();

/** 옷의 브랜드 문자열 → 브랜드 자료. 목록에 없으면 null(소규모 브랜드: 분석에서 뺀다). */
export function findBrand(input: string | null | undefined): BrandInfo | null {
  const n = normalizeBrand(input ?? "");
  if (!n) return null;
  if (cache.has(n)) return cache.get(n)!;
  const found = EXACT.get(n) ?? KEYS.find((k) => k.prefixOk && n.startsWith(k.key))?.brand ?? null;
  cache.set(n, found);
  return found;
}

const has = (list: string[], ...values: string[]) => values.some((v) => list.includes(v));

/** 한 브랜드가 여러 그룹에 들 수 있다(계획서 4-5). */
export function brandGroups(b: BrandInfo): BrandGroup[] {
  const out: BrandGroup[] = [];
  if (has(b.positions, "럭셔리", "헤리티지 럭셔리")) out.push("luxury");
  if (has(b.positions, "디자이너", "하이엔드 디자이너")) out.push("designer");
  if (has(b.positions, "컨템포러리", "프리미엄")) out.push("contemporary");
  if (has(b.positions, "프리미엄 캐주얼")) out.push("premium_casual");
  if (has(b.positions, "전문 브랜드")) out.push("specialist");
  if (b.country === "일본" && (has(b.types, "데님 전문", "워크웨어") || has(b.tags, "아메카지", "워크웨어", "데님"))) out.push("jp_denim");
  if (b.heritage >= 4) out.push("heritage");
  if (has(b.positions, "스트릿")) out.push("street");
  if (has(b.positions, "스포츠")) out.push("sports");
  if (has(b.positions, "아웃도어")) out.push("outdoor");
  if (has(b.positions, "SPA", "매스마켓")) out.push("mass");
  return out;
}

/** 트렌드 표시: 하이프 성향 높음 이상 */
export const isTrendBrand = (b: BrandInfo) => b.hype >= 4;

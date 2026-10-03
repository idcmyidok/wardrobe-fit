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
  /** 기타 태그(예: "무신사 인기": 무신사 인기 브랜드 순위에 든 브랜드, 너무 유명한 글로벌 브랜드는 뺐다) */
  labels: string[];
  /** 무신사 좋아요 수. 없으면 null(미입점으로 보고 순위에서 뺀다) */
  likes?: number | null;
}

/** 태그만 있는 브랜드(나머지 칸이 비어 있어 분석에는 쓰지 않는다) */
interface PartialBrand {
  name: string;
  aliases: string[];
  country: string;
  labels: string[];
  partial: true;
}

const ALL = RAW as (BrandInfo | PartialBrand)[];
export const BRANDS = ALL.filter((b): b is BrandInfo => !("partial" in b));

export const MUSINSA_POPULAR = "무신사 인기";

/** 좋아요가 1 이상인 브랜드의 좋아요 수, 큰 순 */
const LIKES_DESC = BRANDS.map((b) => b.likes ?? 0).filter((n) => n > 0).sort((a, b) => b - a);

/** 좋아요 상위 topPct%에 드는 최소 좋아요 수. topPct가 0 이하이면 null(기준 끔) */
export function musinsaLikesCut(topPct: number): number | null {
  if (!(topPct > 0) || !LIKES_DESC.length) return null;
  return LIKES_DESC[Math.min(LIKES_DESC.length, Math.ceil((LIKES_DESC.length * Math.min(topPct, 100)) / 100)) - 1];
}

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
  | "spa"
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
  "spa",
  "mass",
];

/** 브랜드 그룹을 문장에 쓸 때 */
export const GROUP_WORD: Record<BrandGroup, string> = {
  luxury: "명품",
  designer: "디자이너 브랜드",
  contemporary: "컨템포러리 브랜드",
  premium_casual: "프리미엄 캐주얼",
  specialist: "한 제품 전문 브랜드",
  jp_denim: "일본 데님·워크웨어",
  heritage: "헤리티지 브랜드",
  street: "스트릿 브랜드",
  sports: "스포츠 브랜드",
  outdoor: "아웃도어 브랜드",
  spa: "SPA 브랜드",
  mass: "대중 브랜드",
};

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
  if (has(b.positions, "프리미엄 캐주얼", "캐주얼")) out.push("premium_casual");
  if (has(b.positions, "전문 브랜드")) out.push("specialist");
  if (b.country === "일본" && (has(b.types, "데님 전문", "워크웨어") || has(b.tags, "아메카지", "워크웨어", "데님"))) out.push("jp_denim");
  if (b.heritage >= 4) out.push("heritage");
  if (has(b.positions, "스트릿")) out.push("street");
  if (has(b.positions, "스포츠")) out.push("sports");
  if (has(b.positions, "아웃도어")) out.push("outdoor");
  if (has(b.positions, "SPA")) out.push("spa");
  if (has(b.positions, "매스마켓")) out.push("mass");
  return out;
}

const LABELED = new Map<string, string[]>();
for (const b of ALL)
  if (b.labels.length)
    for (const raw of [b.name, ...b.aliases]) {
      const key = normalizeBrand(raw);
      if (key && !LABELED.has(key)) LABELED.set(key, b.labels);
    }

/** 옷의 브랜드 문자열에 붙은 기타 태그. 분석용 자료가 있는 브랜드는 그 브랜드의 태그(앞부분 일치 포함), 없으면 태그만 있는 브랜드에서 찾는다. */
export function brandLabels(input: string | null | undefined): string[] {
  return findBrand(input)?.labels ?? LABELED.get(normalizeBrand(input ?? "")) ?? [];
}

/** 너무 유명해서(또는 명품 하우스라서) 헤리티지 가점에서 뺀 브랜드 */
const NOT_HERITAGE = new Set(
  [
    "adidas", "Nike", "Puma", "New Balance", "Converse", "Vans", "Champion", "Carhartt", "Dickies", "Ben Davis", "Wrangler", "Fred Perry",
    "Clarks", "Hush Puppies", "Keds", "Starter", "Mitchell & Ness", "Onitsuka Tiger", "L.L.Bean", "Stone Island", "Ferragamo",
    "Giorgio Armani", "Max Mara", "Brooks Brothers", "Coach", "Diadora", "Blundstone", "Hunter", "Superga", "Palladium",
    "Chanel", "Hermès", "Louis Vuitton", "Dior", "Gucci",
  ].map(normalizeBrand),
);

/** 진짜 헤리티지: 헤리티지 성향 높음 이상, 1990년 이전 설립, 매우 대중적이지 않고, 너무 유명한 브랜드가 아님(빈티지 분위기만 내는 새 브랜드 제외) */
export const isTrueHeritage = (b: BrandInfo) =>
  b.heritage >= 4 && b.founded != null && b.founded <= 1990 && b.pop < 5 && !NOT_HERITAGE.has(normalizeBrand(b.name));

/** 트렌드 표시: 하이프 성향 높음 이상 */
export const isTrendBrand = (b: BrandInfo) => b.hype >= 4;

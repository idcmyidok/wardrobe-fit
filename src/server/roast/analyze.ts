import "server-only";
import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { findColorFamily } from "@/lib/constants/colors";
import type { FitKind, FitLevel } from "@/lib/constants/body";
import { computeBodyFit, type BodyProfile } from "@/lib/fit/body-fit";
import { priceInKrw } from "@/lib/format/price";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";
import { brandGroups, findBrand, isTrendBrand, type BrandGroup, type BrandInfo } from "./brands";
import { productFamilies, type FamilyId } from "./keywords";

/**
 * 훈수 입력 준비: 옷 → Item(브랜드·색·핏·계절 등). 평가는 fl/ 폴더가 한다.
 */

export const ACHROMATIC = ["블랙", "그레이", "화이트"];
/** 훈수를 받으려면 모자·신발을 뺀 옷이 이만큼 있어야 한다 */
export const MIN_GARMENTS = 30;

/** 핏 이름(상의·하의 공통으로 부를 때) */
export const FIT_WORD: Record<FitLevel, string> = {
  too_small: "작은 핏",
  slim: "슬림",
  regular: "레귤러",
  semi_over: "세미오버",
  over: "오버",
  too_big: "큰 핏",
};

/** 분석용으로 정리한 옷 한 벌 */
export interface Item {
  g: Garment;
  id: string;
  cat: CategoryId;
  sub: string | null;
  subName: string | null;
  /** 옷에 적힌 브랜드(화면에 쓰는 이름) */
  brandLabel: string;
  brand: BrandInfo | null;
  groups: BrandGroup[];
  trend: boolean;
  families: FamilyId[];
  color: string | null;
  achromatic: boolean;
  fit: { level: FitLevel; kind: FitKind } | null;
  seasons: Season[];
  /** 원으로 바꾼 구매가 */
  price: number | null;
  date: string | null;
  hasPhoto: boolean;
  /** 모자·신발 */
  accessory: boolean;
  /** 구매 링크의 쇼핑몰(예: 무신사). 링크가 없으면 null */
  shop: string | null;
  /** 데님(데님 계열 색·데님 팬츠·제품명에 데님/청바지). 색 계산에서는 빼고 본다(청바지를 무채색·유채색으로 세지 않게, 사용자 요청). */
  denim: boolean;
  /**
   * 브랜드 칸의 종류. known: 브랜드 자료에 있음, unknown: 자료에 없는 이름(작은 브랜드일 수 있어 보세로 치지 않음),
   * nobrand: 보세·모름·없음 등, vintage: 빈티지·구제, none: 비어 있음
   */
  brandKind: "known" | "unknown" | "nobrand" | "vintage" | "none";
}

const NO_BRAND = /^(보세|모름|모르겠음|없음|노브랜드|no ?brand|unknown|기타|-+|\?+|x)$/i;
const VINTAGE = /^(빈티지|구제|vintage|빈티지 ?샵|구제 ?샵)$/i;

export function brandKindOf(label: string, known: boolean): Item["brandKind"] {
  const t = label.trim();
  if (!t) return "none";
  if (known) return "known";
  if (NO_BRAND.test(t)) return "nobrand";
  if (VINTAGE.test(t)) return "vintage";
  return "unknown";
}

/** 색 계산에 넣는 옷(색이 있고 데님이 아님) */
export const colorCounted = (i: Item) => Boolean(i.color) && !i.denim;

export function prepare(garments: Garment[], body: BodyProfile | null, usdRate: number): Item[] {
  return garments
    .filter((g) => !g.held)
    .map((g) => {
      const brand = findBrand(g.brand);
      const color = findColorFamily(g.colorName);
      const accessory = g.categoryId === "hat" || g.categoryId === "shoes";
      let fit: Item["fit"] = null;
      if (!accessory) {
        if (g.userFit) fit = { level: g.userFit, kind: g.categoryId === "bottom" ? "bottom" : "top" };
        else if (body) {
          const r = computeBodyFit(g, body);
          if (r.status === "ok") fit = { level: r.level, kind: r.kind };
        }
      }
      return {
        g,
        id: g.id,
        cat: g.categoryId,
        sub: g.subcategoryId,
        subName: g.subcategoryId ? (SUBCATEGORY_NAME[g.subcategoryId] ?? null) : null,
        brandLabel: g.brand.trim(),
        brand,
        groups: brand ? brandGroups(brand) : [],
        trend: brand ? isTrendBrand(brand) : false,
        families: productFamilies(g.productName),
        color,
        achromatic: color != null && ACHROMATIC.includes(color),
        fit,
        seasons: g.seasons,
        price: priceInKrw(g.purchasePrice, g.currency, usdRate),
        date: g.purchasedOn,
        hasPhoto: Boolean(g.thumbUrl || g.imageUrl),
        accessory,
        shop: shopOf(g.productUrl),
        denim: color === "데님" || g.subcategoryId === "bottom.denim" || /데님|청바지|청자켓|진 ?팬츠|jean|denim/i.test(g.productName),
        brandKind: brandKindOf(g.brand, Boolean(brand)),
      };
    });
}

/** 쇼핑몰 주소 → 이름. 목록에 없으면 주소의 이름 부분(예: example.com → example) */
const SHOPS: [RegExp, string][] = [
  [/(^|\.)musinsa\.com$/, "무신사"],
  [/(^|\.)29cm\.co\.kr$/, "29CM"],
  [/(^|\.)wconcept\.co\.kr$/, "W컨셉"],
  [/(^|\.)ssfshop\.com$/, "SSF샵"],
  [/(^|\.)kream\.co\.kr$/, "KREAM"],
  [/(^|\.)ably\.co\.kr$|(^|\.)a-bly\.com$/, "에이블리"],
  [/(^|\.)zigzag\.kr$/, "지그재그"],
  [/(^|\.)coupang\.com$/, "쿠팡"],
  [/(^|\.)hfashionmall\.com$/, "더한섬닷컴"],
  [/(^|\.)lotteon\.com$/, "롯데온"],
  [/(^|\.)ssg\.com$/, "SSG"],
  [/(^|\.)ssense\.com$/, "SSENSE"],
  [/(^|\.)mrporter\.com$/, "MR PORTER"],
  [/(^|\.)farfetch\.com$/, "파페치"],
  [/(^|\.)matchesfashion\.com$|(^|\.)matches\.com$/, "매치스"],
  [/(^|\.)endclothing\.com$/, "END."],
  [/(^|\.)uniqlo\.com$/, "유니클로"],
  [/(^|\.)zara\.com$/, "자라"],
  [/(^|\.)cos\.com$/, "COS"],
  [/(^|\.)nike\.com$/, "나이키"],
  [/(^|\.)fruitsfamily\.com$/, "후르츠패밀리"],
  [/(^|\.)bunjang\.co\.kr$/, "번개장터"],
];

export function shopOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, "");
  } catch {
    return null;
  }
  const hit = SHOPS.find(([re]) => re.test(host));
  if (hit) return hit[1];
  const parts = host.split(".");
  // example.co.kr → example, shop.example.com → example
  const main = parts.length >= 3 && /^(co|or|ac|go)$/.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
  return main || null;
}



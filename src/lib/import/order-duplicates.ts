import { normalizeColorName } from "@/lib/constants/colors";

/**
 * 주문내역 가져오기에서 이미 내 옷장에 있는 옷을 찾는다.
 * 같은 옷의 기준(사이즈가 다르면 다른 옷이다):
 * 1) 무신사 상품번호가 같고, 사이즈·색이 서로 알 때는 같다.
 * 2) 상품번호를 모를 때는 브랜드+제품명이 같고 사이즈·색이 서로 알 때는 같다.
 * 옷장의 한 벌은 주문 한 벌하고만 짝이 된다. 같은 옷을 두 번 산 주문은 옷장에 한 벌만 있으면 한 벌만 제외된다.
 * 삭제한 옷은 옷장 목록에 없으므로 자연히 빠진다.
 */
export interface ExistingGarment {
  id: string;
  brand: string;
  productName: string;
  sizeLabel: string | null;
  colorName: string | null;
  productUrl: string | null;
}

export interface OrderCandidate {
  key: string;
  brand: string;
  productName: string;
  size: string;
  color: string;
  /** 주문내역이나 검색에서 알아낸 무신사 상품 주소(없으면 null) */
  productUrl: string | null;
}

export function goodsNoOf(url: string | null | undefined): string | null {
  return url?.match(/musinsa\.com\/(?:app\/goods|products|goods)\/(\d{4,})/)?.[1] ?? null;
}

const flat = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function sizeKey(size: string | null | undefined): string {
  const s = flat(size);
  if (!s) return "";
  return /^(f|free|os|onesize|프리|프리사이즈)$/.test(s) ? "free" : s;
}

const colorKey = (color: string | null | undefined) => flat(normalizeColorName(color));

/** 값이 둘 다 있을 때만 다르다고 본다. */
const compatible = (a: string, b: string) => !a || !b || a === b;

export function findDuplicates(candidates: OrderCandidate[], existing: ExistingGarment[]): Map<string, string> {
  const used = new Set<string>();
  const found = new Map<string, string>();
  for (const c of candidates) {
    const no = goodsNoOf(c.productUrl);
    const match = existing.find((g) => {
      if (used.has(g.id)) return false;
      const gNo = goodsNoOf(g.productUrl);
      const same = no && gNo ? no === gNo : flat(c.brand) === flat(g.brand) && flat(c.productName) === flat(g.productName) && Boolean(flat(c.productName));
      return same && compatible(sizeKey(c.size), sizeKey(g.sizeLabel)) && compatible(colorKey(c.color), colorKey(g.colorName));
    });
    if (match) {
      used.add(match.id);
      found.set(c.key, match.id);
    }
  }
  return found;
}

import type { Garment } from "@/lib/types/domain";

/**
 * 옷장 요약값. 결과를 만들 때 저장해 두고, 다시 들어왔을 때 지금 옷장과 비교해 "옷장이 바뀌었습니다"를 띄운다.
 * 분석에 쓰는 값만 넣는다(사진 주소는 매번 바뀌어서 뺀다). 보류 옷은 분석에서 빠지므로 뺀다.
 */
export function wardrobeHash(garments: Garment[]): string {
  const rows = garments
    .filter((g) => !g.held)
    .map((g) =>
      JSON.stringify([
        g.id,
        g.categoryId,
        g.subcategoryId,
        g.brand,
        g.productName,
        g.colorName,
        [...g.seasons].sort(),
        g.purchasedOn,
        g.purchasePrice,
        g.currency ?? "KRW",
        Object.entries(g.measurements).filter(([, v]) => v != null).sort(([a], [b]) => a.localeCompare(b)),
        g.userFit ?? null,
        Boolean(g.imageUrl || g.thumbUrl),
      ]),
    )
    .sort();
  // FNV-1a 32비트 두 번(충돌만 피하면 되는 요약값)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const c = row.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
    }
    h1 = Math.imul(h1 ^ 10, 0x01000193) >>> 0;
  }
  return `${rows.length}-${h1.toString(36)}${h2.toString(36)}`;
}

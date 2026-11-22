import "server-only";
import type { Evaluation } from "./engine";
import type { Vars } from "../text";
import { isMusinsaStd } from "./types";

/** 유형 문장에 쓸 수 있는 자리 값(store.ts의 VARS.type과 같은 이름). 값이 없는 자리는 넣지 않아 그 문장은 건너뛴다. */
export function typeVars(ev: Evaluation): Vars {
  const F = ev.F;
  const pct = (v: number) => Math.round(v * 100);
  const v: Vars = {
    n: F.n,
    brandCount: F.brandCount,
    achroPct: pct(F.achro),
    chromaPct: pct(F.chroma),
    overPct: pct(F.fits.over),
    slimPct: pct(F.fits.slim),
    regularPct: pct(F.fits.regular),
    widePct: pct(F.fits.wide),
    outerPct: pct(F.cat.outer),
    shoesPct: pct(F.cat.shoes),
    hatPct: pct(F.cat.hat),
    spaPct: pct(F.group("spa")),
    massPct: pct(Math.max(F.group("mass"), F.kshare((i) => i.brand!.trend >= 4))),
    lowPct: pct(F.level(1, 2)),
    midPct: pct(F.level(3, 4)),
    highPct: pct(F.level(4, 6)),
    designerPct: pct(F.group("designer") + F.group("contemporary") + F.group("luxury")),
    cultPct: pct(F.cult),
    usedPct: pct(F.usedShop),
    heritagePct: pct(F.heritage),
    popularPct: pct(F.popular),
    sportsPct: pct(F.group("sports")),
    streetPct: pct(F.group("street")),
    domesticPct: pct(F.kshare((i) => i.brand!.country === "한국" && i.brand!.price >= 2 && i.brand!.price <= 3)),
    minimalPct: pct(F.tag("미니멀", "베이직", "모던", "조용한 럭셔리")),
    logoPct: pct(F.word(/로고|그래픽|프린트|graphic|logo|print/i)),
    workPct: pct(F.tag("워크웨어", "아메카지", "밀리터리", "유틸리티")),
    denimPct: pct(F.denim),
    outdoorPct: pct(F.group("outdoor")),
    preppyPct: pct(F.tag("프레피", "아이비")),
    y2kPct: pct(F.tag("Y2K", "레트로", "빈티지")),
    femPct: pct(F.tag("페미닌", "로맨틱", "러블리", "우아함")),
    recentPct: pct(F.recent),
  };
  if (F.topBrand) {
    v.brand = F.topBrand.name;
    v.brandPct = pct(F.topBrand.share);
    v.brandN = F.topBrand.count;
  }
  if (F.topTags[0]) v.topTag = F.topTags[0];
  // 가장 많이 가진 SPA 브랜드(문장에서 실제로 가진 브랜드만 부르도록)
  const spa = new Map<string, number>();
  for (const i of F.known) if (i.groups.includes("spa")) spa.set(i.brandLabel || i.brand!.name, (spa.get(i.brandLabel || i.brand!.name) ?? 0) + 1);
  const topSpa = [...spa.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSpa) {
    v.spaBrand = topSpa[0];
    v.spaN = topSpa[1];
  }
  const std = F.kshare((i) => isMusinsaStd(i.brand!.name));
  if (std > 0) v.stdPct = pct(std);
  // 가장 몰린 계절
  const seasons = [["봄", "spring"], ["여름", "summer"], ["가을", "fall"], ["겨울", "winter"]] as const;
  const only = seasons.map(([name, s]) => ({ name, p: F.share((i) => i.seasons.length === 1 && i.seasons[0] === s) })).sort((a, b) => b.p - a.p)[0];
  if (only && only.p > 0) {
    v.seasonName = only.name;
    v.seasonPct = pct(only.p);
  }
  if (F.orders) {
    v.orders = F.orders.orders;
    v.events = F.orders.events.length + F.orders.exchanged;
    const paid = F.items.filter((i) => i.price != null && i.brand);
    if (paid.length) v.salePct = pct(paid.filter((i) => i.price! < ({ 1: 25000, 2: 45000, 3: 80000, 4: 150000, 5: 300000, 6: 600000 } as Record<number, number>)[i.brand!.price] * 0.55).length / paid.length);
  }
  return v;
}

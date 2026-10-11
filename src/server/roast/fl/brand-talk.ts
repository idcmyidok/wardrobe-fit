import "server-only";
import type { Item } from "../analyze";
import type { Feat } from "./feat";

/**
 * 브랜드 분석: 많이 가진 브랜드(최대 3개)마다 그 브랜드 계열에 맞는 한마디 + 옷장 전체 브랜드 구성 한마디.
 * 문장은 설계(FlConfig.brands)에서 고친다. 자리: {brand} 브랜드 이름, {n} 벌 수, {pct} 비율(%), {level} 가격대, {kind} 계열 이름.
 */

export const BRAND_KINDS = ["luxury", "designer", "contemporary", "premium_casual", "specialist", "jp_denim", "heritage", "street", "sports", "outdoor", "spa", "mass", "other"] as const;
export type BrandKind = (typeof BRAND_KINDS)[number];

export const KIND_NAME: Record<BrandKind, string> = {
  luxury: "명품",
  designer: "디자이너 브랜드",
  contemporary: "컨템포러리",
  premium_casual: "프리미엄 캐주얼",
  specialist: "한 우물 전문 브랜드",
  jp_denim: "일본 데님·워크웨어",
  heritage: "헤리티지",
  street: "스트릿",
  sports: "스포츠",
  outdoor: "아웃도어",
  spa: "SPA",
  mass: "대중 브랜드",
  other: "기타",
};

export const MIX_KEYS = ["loyal", "scattered", "spa_heavy", "mixed_tier", "unknown_heavy", "plain"] as const;
export type MixKey = (typeof MIX_KEYS)[number];

export const MIX_NAME: Record<MixKey, string> = {
  loyal: "한 브랜드가 35% 이상",
  scattered: "브랜드 12개 이상이고 1등 브랜드도 15% 미만",
  spa_heavy: "SPA·대중 브랜드가 절반 이상",
  mixed_tier: "저가(1~2단계)와 고가(5~6단계)가 함께 5벌 이상씩",
  unknown_heavy: "브랜드 자료에 없는 옷이 절반 이상",
  plain: "위에 해당 없음",
};

const LEVEL_WORD: Record<number, string> = { 1: "초저가", 2: "저가", 3: "중가", 4: "중고가", 5: "고가", 6: "최고가" };

/** 브랜드 하나의 대표 계열(앞쪽일수록 먼저) */
export const kindOf = (i: Item): BrandKind => (BRAND_KINDS as readonly string[]).find((k) => i.groups.includes(k as never)) as BrandKind ?? "other";

export interface BrandRow {
  label: string;
  kind: BrandKind;
  n: number;
  pct: number;
  level: string;
  ids: string[];
}

/** 많이 가진 브랜드(2벌 이상, 최대 3개) */
export function topBrands(F: Feat): BrandRow[] {
  const m = new Map<string, Item[]>();
  for (const i of F.known) m.set(i.brand!.name, [...(m.get(i.brand!.name) ?? []), i]);
  return [...m.values()]
    .filter((l) => l.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map((l) => ({
      label: l[0].brandLabel || l[0].brand!.name,
      kind: kindOf(l[0]),
      n: l.length,
      pct: Math.round((l.length / Math.max(F.n, 1)) * 100),
      level: LEVEL_WORD[l[0].brand!.price] ?? "",
      ids: l.map((i) => i.id),
    }));
}

export function mixOf(F: Feat): MixKey {
  if ((F.topBrand?.share ?? 0) >= 0.35) return "loyal";
  if (F.known.length < F.n * 0.5) return "unknown_heavy";
  if (F.group("spa") + F.group("mass") >= 0.5) return "spa_heavy";
  if (F.known.filter((i) => i.brand!.price <= 2).length >= 5 && F.known.filter((i) => i.brand!.price >= 5).length >= 5) return "mixed_tier";
  if (F.brandCount >= 12 && (F.topBrand?.share ?? 0) < 0.15) return "scattered";
  return "plain";
}

export const DEFAULT_BRAND_TEXT = {
  title: "브랜드 분석",
  status: ["브랜드 좀 까 보겠습니다.", "택부터 보죠."],
  kind: {
    luxury: ["{brand} {n}벌. 로고 값은 확실히 하셨네요. 옷이 사람을 입고 다니지 않게만 조심하시죠.", "{brand|가} {n}벌이나. 통장은 괜찮으신 거죠?"],
    designer: ["{brand} {n}벌. 디자이너 브랜드 고르는 눈은 인정합니다. 근데 같이 입는 옷이 그 값을 못 따라가면 그냥 비싼 옷이에요.", "{brand|를} {n}벌이나 모으셨네요. 취향은 확실한데 지갑 사정이 궁금해집니다."],
    contemporary: ["{brand} {n}벌. 무난하게 비싼 옷 사는 법을 아시네요. 무난하다는 게 함정이지만.", "{brand|가} {n}벌. 실패는 안 하는데 기억에도 안 남는 쪽입니다."],
    premium_casual: ["{brand} {n}벌. 적당히 좋은 옷 사는 안정형이시네요. 모험은 남의 일이고요.", "{brand|를} {n}벌. 이 정도면 매장 직원이 얼굴 알겠는데요."],
    specialist: ["{brand} {n}벌. 한 우물 판 브랜드를 고르셨네요. 그 브랜드가 잘하는 품목만 사셨길 바랍니다.", "{brand|가} {n}벌. 전문 브랜드를 아는 건 좋은데, 전문 분야 밖 물건까지 사진 않으셨죠?"],
    jp_denim: ["{brand} {n}벌. 원단 얘기 시작하면 30분은 하실 분이네요.", "{brand|가} {n}벌. 페이딩 기다리는 인내심은 존경합니다."],
    heritage: ["{brand} {n}벌. 역사 있는 브랜드 좋아하시네요. 본인 옷장 역사도 좀 써 보시죠.", "{brand|가} {n}벌. 클래식은 영원하다는데, 입는 방법까지 클래식할 필요는 없습니다."],
    street: ["{brand} {n}벌. 로고가 말을 대신해 주니 편하시겠어요.", "{brand|가} {n}벌. 길거리에서 같은 옷 입은 사람 몇 명이나 마주치셨나요?"],
    sports: ["{brand} {n}벌. 운동은 하시는 거죠? 옷만 운동하는 거 아니고요.", "{brand|가} {n}벌. 편한 건 알겠는데 매일 체육복 느낌은 피하셔야죠."],
    outdoor: ["{brand} {n}벌. 지하철 타는데 히말라야 장비가 왜 필요하신지.", "{brand|가} {n}벌. 기능성은 만점, 도시에서는 살짝 과장입니다."],
    spa: ["{brand} {n}벌. 실패 없는 선택인데 성공도 없는 선택이죠.", "{brand|가} {n}벌. 같은 옷 입은 사람이랑 엘리베이터에서 마주쳐도 당황하지 마세요."],
    mass: ["{brand} {n}벌. 다들 입는 데는 이유가 있죠. 그 이유가 본인 취향은 아니겠지만.", "{brand|가} {n}벌. 유행은 잘 따라가시네요. 앞서가진 않지만."],
    other: ["{brand} {n}벌. 제 자료엔 없는 브랜드인데, 아는 사람만 아는 건지 아무도 모르는 건지 궁금하네요."],
  } as Record<BrandKind, string[]>,
  mix: {
    loyal: ["옷장의 {pct}%가 {brand}입니다. 이 정도면 브랜드 앰배서더 지원하셔도 되겠어요."],
    scattered: ["브랜드가 {count}개입니다. 취향이 넓은 건지 그냥 눈에 보이는 대로 산 건지 헷갈리네요."],
    spa_heavy: ["SPA·대중 브랜드가 절반이 넘습니다. 가성비는 챙겼는데 개성은 영수증에 안 찍혔네요."],
    mixed_tier: ["초저가랑 고가가 한 옷장에 같이 있네요. 하이엔드 코트 안에 3천 원 티셔츠, 의도하신 거죠?"],
    unknown_heavy: ["브랜드를 모르는 옷이 절반이 넘습니다. 보세 사랑이 깊으시네요. 그래서 브랜드 점수는 덜 반영했습니다."],
    plain: ["브랜드 구성은 무난합니다. 칭찬 아닙니다."],
  } as Record<MixKey, string[]>,
};
export type BrandText = typeof DEFAULT_BRAND_TEXT;

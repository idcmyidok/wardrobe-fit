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
  status: ["브랜드 좀 까 보겠습니다.", "택부터 보죠.", "어디서 사셨는지 볼까요."],
  kind: {
    luxury: ["{brand} {n}벌이네요. 로고 값은 확실히 하셨으니 이제 옷이 사람을 입고 다니지 않게만 조심하시죠.", "{brand|가} {n}벌이나 있어요. 백화점 1층 향수 냄새가 여기까지 납니다.", "{level} 브랜드를 {n}벌이나 들이셨군요. 이 옷들 앞에선 나머지 옷들이 좀 주눅 들어 있겠어요."],
    designer: ["{brand} {n}벌. 디자이너 브랜드 고르는 눈은 있으세요. 같이 입는 옷이 그 값을 따라가 줘야 진짜고요.", "{brand|를} {n}벌이나 모으셨네요. 쇼룸 직원이 신상 나오면 먼저 연락 줄 것 같습니다.", "{brand}만 {n}벌이에요. 이 브랜드 런웨이는 아마 생중계로 보셨겠죠?"],
    contemporary: ["{brand} {n}벌. 무난하게 비싼 옷 사는 법을 아시네요. 그 무난함이 함정이긴 하지만요.", "{brand|가} {n}벌이에요. 실패는 안 하는데 기억에도 잘 안 남는 쪽입니다.", "{brand|으로} {n}벌을 채우셨네요. 백화점 3층 단골 냄새가 납니다."],
    premium_casual: ["{brand} {n}벌. 적당히 좋은 옷을 꾸준히 사는 안정형이시네요. 모험은 남의 일이고요.", "{brand|를} {n}벌이나. 매장 직원이 얼굴 정도는 기억하겠어요.", "{brand|가} {n}벌이면 그 브랜드 핏은 몸이 외웠겠네요. 편하긴 한데 비슷한 옷이 쌓이기 쉽습니다."],
    specialist: ["{brand} {n}벌. 한 우물 판 브랜드를 고르셨네요. 그 브랜드가 제일 잘하는 품목만 사셨길 바랍니다.", "{brand|가} {n}벌이에요. 전문 브랜드를 아는 건 좋은데, 전문 분야 밖 물건까지 사진 않으셨죠?", "{brand|는} 원래 한 가지로 유명한 곳이죠. {n}벌이나 있다는 건 그 한 가지에 꽤 진심이라는 뜻이고요."],
    jp_denim: ["{brand} {n}벌. 원단 얘기 시작하면 30분은 하실 분이네요.", "{brand|가} {n}벌이에요. 페이딩 기다리는 인내심은 존경합니다.", "{brand|를} {n}벌이나. 셀비지 끝단 접어서 보여 주는 게 습관이시죠?"],
    heritage: ["{brand} {n}벌. 역사 있는 브랜드를 좋아하시네요. 이제 본인 스타일 역사도 좀 써 보시죠.", "{brand|가} {n}벌이에요. 클래식은 영원하다지만 입는 방법까지 옛날식일 필요는 없습니다.", "{brand}만 {n}벌. 창립 연도부터 대표 모델까지 줄줄 외우실 분 같네요."],
    street: ["{brand} {n}벌. 로고가 말을 대신해 주니 편하시겠어요.", "{brand|가} {n}벌이에요. 길에서 같은 옷 입은 사람이랑 몇 번이나 눈 마주치셨나요?", "{brand|를} {n}벌이나 갖고 계시네요. 발매일 알람은 아직도 켜져 있죠?"],
    sports: ["{brand} {n}벌. 운동은 하시는 거죠? 옷만 운동하는 거 아니고요.", "{brand|가} {n}벌이에요. 편한 건 알겠는데 매일 체육 시간 느낌은 피하셔야죠.", "{brand|를} {n}벌 모으셨네요. 이 정도면 신발장 지분도 꽤 갖고 있겠습니다."],
    outdoor: ["{brand} {n}벌. 지하철 타는 데 히말라야 장비가 왜 필요하신지 궁금하네요.", "{brand|가} {n}벌이에요. 기능성은 만점인데 도시에선 살짝 과잉 대비입니다.", "{brand|를} {n}벌이나. 갑자기 산악회 가입 권유가 와도 복장은 이미 합격이에요."],
    spa: ["{brand} {n}벌. 무난하게 실패를 피하는 데는 이만한 게 없죠.", "{brand|가} {n}벌이에요. 같은 옷 입은 사람이랑 엘리베이터에서 마주쳐도 당황하지 마세요.", "{brand}에서만 {n}벌을 사셨네요. 회원 등급은 아마 꽤 높으시겠어요."],
    mass: ["{brand} {n}벌. 다들 입는 데는 이유가 있죠. 그 이유가 본인 취향인지는 한번 따져 보시고요.", "{brand|가} {n}벌이에요. 유행은 잘 따라가시네요. 앞서가진 않지만요.", "{brand|를} {n}벌. 친구랑 옷이 겹쳐도 웃고 넘길 넉살이 필요하겠습니다."],
    other: ["{brand} {n}벌. 제 자료엔 없는 브랜드예요. 아는 사람만 아는 건지 아무도 모르는 건지 궁금하네요.", "{brand|는} 처음 보는 이름이에요. {n}벌이나 있는 걸 보면 숨은 맛집 같은 곳이겠죠."],
  } as Record<BrandKind, string[]>,
  mix: {
    loyal: ["가진 옷의 {pct}%가 {brand}입니다. 브랜드 앰배서더 지원서를 써 보셔도 되겠어요.", "{brand} 비중이 {pct}%예요. 다른 브랜드들은 거의 객원 멤버 신세네요.", "한 브랜드에 이렇게 몰아주는 의리, 요즘 보기 드뭅니다."],
    scattered: ["브랜드가 {count}개예요. 취향이 넓은 건지 눈에 보이는 대로 산 건지 헷갈립니다.", "{count}개 브랜드가 한자리에 모였는데 대표 선수가 없어요. 동창회처럼 다들 반갑기만 합니다."],
    spa_heavy: ["SPA·대중 브랜드가 절반이 넘습니다. 가성비는 챙겼는데 개성은 영수증에 안 찍혔네요.", "절반 넘게 SPA·대중 브랜드예요. 쇼핑몰 한 층만 돌아도 이 목록을 거의 다시 만들 수 있겠습니다."],
    mixed_tier: ["초저가와 고가가 한 목록에 사이좋게 있네요. 고급 코트 안에 만 원짜리 티, 의도하신 거죠?", "가격대 폭이 엄청 넓어요. 하이로우 믹스를 노리셨다면 꽤 재밌는 조합이 나올 겁니다."],
    unknown_heavy: ["브랜드를 모르는 옷이 절반이 넘어요. 보세 사랑이 깊으시네요. 그래서 브랜드 점수는 덜 반영했습니다.", "제 자료에 없는 브랜드가 절반 이상이라 브랜드 평가는 살살 했어요. 동네 보세 가게 사장님들이 아끼는 단골이실지도요."],
    plain: ["브랜드 구성은 무난합니다. 칭찬도 흉도 아닌 딱 중간이에요.", "한쪽으로 쏠리지도, 너무 흩어지지도 않았어요. 브랜드 쪽은 평온하네요."],
  } as Record<MixKey, string[]>,
};
export type BrandText = typeof DEFAULT_BRAND_TEXT;

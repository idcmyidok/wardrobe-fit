import "server-only";
import type { Item } from "../analyze";
import { fill, MissingVar, type Rng, type Vars } from "../text";
import type { Evaluation } from "./engine";
import { lifeVars } from "./life";
import type { AskedQuestion } from "./special";

/**
 * 점수 질문: 옷장에서 잡힌 상황마다 묻고, 답에 따라 원점수를 올리거나 내리고 결과 문단을 붙인다.
 * 언제 묻는지(조건)는 코드, 문장·선택지·점수는 설계(FlConfig.asks)에서 고친다. 한 번에 tune.maxAsks개까지, 아래 순서대로 고른다.
 */

export interface AskOption {
  label: string;
  /** 원점수 증감 */
  points: number;
  react: string[];
  roast: string[];
}

export interface AskText {
  on: boolean;
  lead: string[];
  text: string;
  options: Record<string, AskOption>;
}

const pct = (v: number) => Math.round(v * 100);
const NEUTRAL = new Set(["블랙", "그레이", "화이트", "베이지", "브라운", "카키", "네이비", "데님"]);
const LOGO = /로고|그래픽|프린트|레터링|아트웍|캐릭터|graphic|logo|print|lettering/i;
const DECOY = ["미니멀", "스트릿", "아메카지", "고프코어", "프레피", "Y2K", "시티보이", "워크웨어", "댄디", "스포티"];

const isLoud = (i: Item) => Boolean(i.color) && !i.denim && !NEUTRAL.has(i.color!);
const isLogoTop = (i: Item) => i.cat === "top" && LOGO.test(i.g.productName);
const photosOf = (ev: Evaluation, ok: (i: Item) => boolean) => ev.F.items.filter((i) => i.hasPhoto && ok(i)).slice(0, 8).map((i) => i.id);

/** 대화에서 묻는 자리(그 이야기 바로 뒤). 자리가 꺼져 있으면 "남은 질문"에서 묻는다. */
export type AskAt = "scan" | "types" | "brands" | "age" | "timeline" | "axes";
export const AT_NAME: Record<AskAt, string> = { scan: "훑어보기 뒤", types: "유형 이야기 뒤", brands: "브랜드 분석 뒤", age: "나이 이야기 뒤", timeline: "구매 시기 이야기 뒤", axes: "항목 이야기 뒤" };

/** 조건: 맞으면 문장 자리 값, 아니면 null. 위에 있을수록 먼저 고른다. photos: 질문과 함께 보여 줄 옷 */
export const ASK_WHEN: Record<string, { label: string; at: AskAt; when: (ev: Evaluation) => Vars | null; photos?: (ev: Evaluation) => string[] }> = {
  age_young: {
    label: "29살 이상인데 어려 보이는 옷이 30% 이상",
    at: "age",
    when: (ev) => (ev.age?.verdict === "young" ? lifeVars(ev.age, null) : null),
    photos: (ev) => photosOf(ev, (i) => ev.age!.youngIds.includes(i.id)),
  },
  age_old: {
    label: "26살 이하인데 나이 들어 보이는 옷이 20% 이상",
    at: "age",
    when: (ev) => (ev.age?.verdict === "old" ? lifeVars(ev.age, null) : null),
    photos: (ev) => photosOf(ev, (i) => ev.age!.oldIds.includes(i.id)),
  },
  taste_shift: {
    label: "최근 1년에 산 옷이 2년 이상 전에 산 옷과 크게 다를 때",
    at: "timeline",
    when: (ev) => (ev.shift && ev.shift.verdict !== "steady" ? lifeVars(null, ev.shift) : null),
    photos: (ev) => photosOf(ev, (i) => ev.shift!.ids.includes(i.id)),
  },
  top_brand_why: {
    label: "한 브랜드가 20% 이상이고 4벌 이상",
    at: "brands",
    when: ({ F }) => (F.topBrand && F.topBrand.share >= 0.2 && F.topBrand.count >= 4 ? { brand: F.items.find((i) => F.topBrand!.ids.includes(i.id))?.brandLabel || F.topBrand.name, brandN: F.topBrand.count } : null),
  },
  loud_colors: {
    label: "튀는 색이 4가지 이상",
    at: "types",
    when: ({ F }) => {
      const loud = new Set(F.clothes.filter(isLoud).map((i) => i.color));
      return loud.size >= 4 ? { hues: loud.size } : null;
    },
    photos: (ev) => {
      // 색마다 한 벌씩
      const seen = new Set<string>();
      return photosOf(ev, (i) => !i.accessory && isLoud(i) && !seen.has(i.color!) && Boolean(seen.add(i.color!)));
    },
  },
  logo_heavy: {
    label: "상의의 40% 이상이 로고·그래픽",
    at: "types",
    when: ({ F }) => {
      const tops = F.clothes.filter((i) => i.cat === "top");
      const s = tops.length >= 6 ? tops.filter(isLogoTop).length / tops.length : 0;
      return s >= 0.4 ? { logoPct: pct(s) } : null;
    },
    photos: (ev) => photosOf(ev, isLogoTop),
  },
  bottoms_few: {
    label: "하의가 상의의 35% 미만",
    at: "axes",
    when: ({ F }) => {
      const tops = F.clothes.filter((i) => i.cat === "top").length;
      const bottoms = F.clothes.filter((i) => i.cat === "bottom").length;
      return tops >= 8 && bottoms / tops < 0.35 ? { tops, bottoms } : null;
    },
    photos: (ev) => photosOf(ev, (i) => i.cat === "bottom"),
  },
  size_pick: {
    label: "핏 표시가 있는 옷이 30% 이상(사이즈 고르는 법)",
    at: "axes",
    when: ({ F }) => (F.fits.marked >= 0.3 ? {} : null),
  },
  trend_buy: {
    label: "무신사 인기 브랜드가 50% 이상",
    at: "brands",
    when: ({ F }) => (F.popular >= 0.5 ? { popularPct: pct(F.popular) } : null),
  },
  unworn: {
    label: "옷이 60벌 이상",
    at: "scan",
    when: ({ F }) => (F.n >= 60 ? { n: F.n } : null),
  },
  style_self: {
    label: "항상(스타일 태그가 2개 이상 잡히면)",
    at: "types",
    when: ({ F }) => (F.topTags.length >= 2 ? { tag: F.topTags[0], tag2: F.topTags[1], decoy: DECOY.find((d) => !F.topTags.includes(d)) ?? "포멀" } : null),
  },
};
export const ASK_ORDER = Object.keys(ASK_WHEN);

const O = (label: string, points: number, react: string[], roast: string[]): AskOption => ({ label, points, react, roast });

export const DEFAULT_ASKS: Record<string, AskText> = {
  age_young: {
    on: true,
    lead: ["말 나온 김에 이 옷들 좀 보시죠."],
    text: "이거 지금도 밖에 입고 나가세요?",
    options: {
      proud: O("네, 당당하게 입어요", -2, ["자신감은 만점입니다. 주변 시선은 제가 책임 못 져요.", "당당하신 건 좋아요. 다만 거울이 가끔 다른 말을 할 수도 있습니다."], ["{age}살에 어려 보이는 옷을 당당하게 입는다고 하셨죠. 마음은 청춘인데 옷이 그걸 너무 크게 외치고 있어요. 한 벌씩만 섞어 보세요.", "어려 보이는 옷도 자신 있게 입는다고 답하셨습니다. 자신감은 그대로 두고, 그 옆에 차분한 한 벌만 붙이면 훨씬 자연스러워져요."]),
      home: O("집 앞이나 편할 때만요", 1, ["동네 마실용이면 충분히 납득됩니다.", "편의점까지는 봐 드리죠."], ["어려 보이는 옷은 집 앞 전용이라고요. 선은 지키시네요. 다음 쇼핑 예산은 밖에 입을 옷 쪽으로 돌리시면 됩니다."]),
      old: O("예전에 산 거예요", 0, ["그럼 슬슬 보내 줄 때가 됐네요."], ["어려 보이는 옷은 예전에 산 거라고요. 추억은 사진으로 남기고 옷은 보내 주셔도 됩니다."]),
    },
  },
  age_old: {
    on: true,
    lead: ["이번엔 이 옷들이요."],
    text: "이거 직접 고르신 거 맞죠?",
    options: {
      self: O("제가 골랐어요, 이게 클래식이죠", -1, ["클래식과 '부장님 룩'은 한 끗 차이예요.", "취향이 확고하시네요. 그 한 끗만 조심하시면 됩니다."], ["{age}살에 이 옷들을 직접 골랐다고 하셨죠. 점잖은 취향은 존중하는데, 지금은 클래식보다 회식 자리 부장님 쪽에 조금 더 가깝습니다."]),
      family: O("가족이 사 줬어요", 0, ["그럼 본인 탓은 아니네요. 반만요."], ["나이 들어 보이는 옷은 가족 선물이었군요. 고마운 마음은 간직하고, 매일 입는 옷은 직접 고르시죠."]),
      work: O("일 때문에 필요해서요", 1, ["사정이 있었군요. 그럼 주말 옷은 좀 젊게 가 보시죠."], ["일 때문에 점잖은 옷이 많다고 하셨습니다. 이해해요. 대신 쉬는 날 옷까지 출근시키진 마세요."]),
    },
  },
  taste_shift: {
    on: true,
    lead: ["방금 말한 최근 옷들이 이쪽이에요."],
    text: "취향이 바뀐 거예요, 그냥 그때그때 산 거예요?",
    options: {
      grew: O("일부러 바꿨어요", 2, ["의도한 변화라면 박수 쳐 드리죠."], ["{then}에서 {now|으로} 오면서 일부러 취향을 바꿨다고 하셨죠. 방향을 정하고 바꾼 거라면 앞으로 사는 옷은 점점 나아질 겁니다."]),
      friends: O("주변 영향이에요", -1, ["친구가 바뀌면 옷도 바뀌는군요."], ["주변 영향으로 취향이 바뀌셨다니, 옷도 인간관계를 타네요. 다음에 누구랑 친해지느냐에 따라 또 바뀌겠네요."]),
      random: O("그냥 그때그때 사요", -2, ["그래서 옷들이 갈팡질팡했군요."], ["그때그때 끌리는 대로 산다고요. 그래서 {then} 옷과 {now} 옷이 서로 모르는 사이처럼 보이는 겁니다."]),
      back: O("예전 스타일로 돌아갈 거예요", 0, ["유행은 돌고 돈다지만 사람은 좀 정하셔야죠."], ["예전 스타일로 돌아갈 거라고 하셨습니다. 그럼 최근에 산 옷들은 잠깐의 외도였던 걸로 정리하겠습니다."]),
    },
  },
  loud_colors: {
    on: true,
    lead: ["유형 얘기하다 보니 색이 자꾸 눈에 밟히네요. 튀는 색만 {hues}가지예요. 이 친구들이요."],
    text: "이거 실제로 같이 입으세요?",
    options: {
      point: O("하나만 포인트로 입어요", 2, ["그거면 됩니다. 색은 한 번에 하나만 떠드는 게 예의죠."], ["튀는 색은 한 번에 하나씩만 쓴다고 하셨죠. 말은 맞는데, 산 옷 목록을 보면 그 말을 믿기가 조금 어렵습니다."]),
      mix: O("섞어 입어요, 그게 멋이죠", -2, ["아, 신호등 콘셉트였군요.", "자신감은 만점입니다. 보는 사람 눈은 좀 쉬어야겠지만요."], ["튀는 색을 섞어 입는 게 멋이라니 배짱 하나는 좋습니다. 그게 멋이 되려면 나머지가 아주 조용해야 하는데, 지금은 다 같이 소리를 지르고 있습니다."]),
      closet: O("사실 거의 안 입어요", -1, ["그럼 그 옷들은 인테리어 소품이었네요."], ["튀는 색 옷은 거의 안 입는다고요. 그 돈이면 매일 입을 기본 바지가 하나 더 생겼을 텐데요."]),
    },
  },
  logo_heavy: {
    on: true,
    lead: ["그리고 상의 {logoPct}%가 로고·그래픽이에요. 이런 것들이요."],
    text: "일부러 모으신 거죠?",
    options: {
      fan: O("좋아하는 브랜드라 그래요", 0, ["팬심은 존중합니다. 대신 광고비는 못 받으시죠."], ["로고 옷이 많은 건 브랜드 사랑 때문이라고 하셨죠. 브랜드도 고마워할 겁니다. 공짜로 광고해 주시니까요."]),
      cheap: O("싸고 무난해서요", -2, ["로고 티가 무난하다는 말은 처음 들어 봐요."], ["로고·그래픽 티를 무난해서 고르셨다고요? 무난한 건 무지 티고, 그 옷들은 꽤 시끄러운 편입니다."]),
      layer: O("무지 옷이랑 섞어 입어요", 2, ["그거면 됐어요. 로고는 하나만 보여야 멋이죠."], ["로고 옷은 무지 옷과 섞어 입는다고 하셨습니다. 아는 분이네요. 다음엔 무지 쪽 비율만 조금 더 늘려 보세요."]),
    },
  },
  top_brand_why: {
    on: true,
    lead: ["브랜드 얘기 나온 김에 {brand}부터요. {brandN}벌이나 있네요."],
    text: "{brand} 왜 좋아하세요?",
    options: {
      fit: O("디자인이랑 핏이 잘 맞아서", 2, ["이유 있는 단골이네요. 그건 칭찬입니다."], ["{brand|는} 디자인과 핏 때문에 산다고 하셨죠. 이유 있는 단골은 좋습니다. 그 핏을 다른 브랜드에서도 찾아보면 고르는 재미가 더 생길 거예요."]),
      others: O("주변에서 다들 입어서", -2, ["주변 사람들이 대신 쇼핑해 주는 셈이네요."], ["주변에서 다들 입어서 {brand|를} 샀다면, 그건 본인 취향이 아니라 친구들 취향입니다."]),
      sale: O("세일할 때 싸게 사서", -1, ["세일 알림 켜 두신 거 다 알아요."], ["{brand|는} 세일 때 산다고요. 싸게 산 건 좋은데, 싸서 산 옷은 보통 제일 먼저 잊힙니다."]),
      habit: O("그냥 손이 가요", 0, ["습관성 구매로 적어 두겠습니다."], ["{brand}에 그냥 손이 간다고 하셨습니다. 편한 건 알겠는데 그게 쌓이면 유니폼이 돼요."]),
    },
  },
  bottoms_few: {
    on: true,
    lead: ["균형 얘기 나온 김에, 상의 {tops}벌에 하의 {bottoms}벌이에요. 하의는 이게 전부고요."],
    text: "이걸로 돌려 입는 거 괜찮으세요?",
    options: {
      enough: O("하의는 기본만 있으면 돼요", 0, ["그 기본이 정말 기본색이길 빌게요."], ["하의는 기본만 있으면 된다고 하셨죠. 맞는 말인데 그 기본이 {bottoms}벌이면 매일 같은 바지라는 뜻이에요."]),
      same: O("거의 매일 같은 바지예요", -2, ["그 바지, 고생이 많네요."], ["매일 같은 바지라니, 그 바지 출석률은 개근상감입니다. 상의를 아무리 바꿔도 사람들은 그 바지를 기억합니다."]),
      buy: O("안 그래도 사려던 참이에요", 1, ["상의 말고 하의 사러 가시는 거 맞죠?"], ["하의를 살 생각이라고요. 좋습니다. 이번엔 상의 코너 앞에서 멈추지 마세요."]),
    },
  },
  trend_buy: {
    on: true,
    lead: ["브랜드 얘기 하나만 더요. 무신사 인기 브랜드가 {popularPct}%네요."],
    text: "랭킹 보고 사신 거, 솔직히 몇 개예요?",
    options: {
      few: O("거의 없어요, 우연이에요", -1, ["우연이 이렇게 자주 겹치기도 하네요."], ["랭킹은 안 본다고 하셨는데 산 옷의 {popularPct}%가 인기 브랜드예요. 우연이라기엔 알고리즘이 본인을 너무 잘 압니다."]),
      some: O("몇 개는 그래요", 0, ["솔직해서 좋네요."], ["랭킹 보고 산 옷이 몇 벌 있다고 솔직하게 말씀하셨네요. 참고까진 괜찮습니다. 1위부터 차례로 담는 것만 아니면요."]),
      most: O("랭킹이 곧 제 취향이죠", -2, ["무신사 MD님이 좋아하시겠어요."], ["랭킹이 곧 취향이라고요. 그럼 본인 취향은 매주 월요일마다 바뀌는 셈이네요."]),
    },
  },
  unworn: {
    on: true,
    lead: ["시작부터 하나 묻고 가죠. 옷이 {n}벌이나 되네요."],
    text: "1년 동안 한 번도 안 입은 옷은 몇 벌쯤 될까요?",
    options: {
      none: O("거의 없어요", 2, ["{n}벌을 다 입는다고요? 반쯤은 믿어 볼게요."], ["{n}벌을 거의 다 입는다고 하셨죠. 사실이라면 옷 관리는 최상급입니다."]),
      some: O("열 벌 안팎이요", 0, ["그 정도면 평균이에요. 평균이 칭찬은 아니지만요."], ["안 입는 옷이 열 벌쯤이면 평범한 편이에요. 그 열 벌만 정리해도 훨씬 똑똑한 옷장이 됩니다."]),
      many: O("솔직히 절반은 될걸요", -3, ["옷장이 아니라 창고였군요."], ["안 입는 옷이 절반쯤이라고요. 옷은 입어야 옷입니다. 지금은 보관료 안 받는 창고예요."]),
    },
  },
  size_pick: {
    on: true,
    lead: ["핏 얘기가 나왔으니 하나 확인할게요. 핏 점수는 실측만 보고 매긴 거라서요."],
    text: "옷 살 때 사이즈는 어떻게 고르세요?",
    options: {
      measure: O("실측표랑 가진 옷을 비교해요", 3, ["교과서적이네요. 그런데 큰 옷이 섞인 건 미스터리입니다."], ["사이즈를 실측으로 비교해 고른다고 하셨죠. 이 정도 성의면 핏 점수는 믿어 드려야겠네요."]),
      fitting: O("매장에서 입어 보고 사요", 2, ["요즘 보기 드문 성실함입니다."], ["직접 입어 보고 사신다니요. 실패 확률이 제일 낮은 방법이죠. 귀찮음을 이겨 낸 건 칭찬받을 일입니다."]),
      usual: O("늘 입던 사이즈로요", 0, ["브랜드마다 사이즈가 다른 건 알고 계시죠?"], ["늘 입던 사이즈로 산다고요. 브랜드마다 M이 다 다르다는 걸 산 옷들이 증명하고 있습니다."]),
      big: O("넉넉하게 큰 걸로요", -1, ["오버핏이랑 그냥 큰 옷은 달라요. 아시죠?"], ["넉넉하게 큰 사이즈로 산다고 하셨습니다. 의도한 오버핏과 사이즈 실패는 어깨선에서 티가 나요."]),
    },
  },
  style_self: {
    on: true,
    lead: ["유형은 제가 이렇게 봤는데, 본인 생각도 들어 보죠."],
    text: "본인 스타일을 하나만 고르면?",
    options: {
      own: O("{tag}", 2, ["옷들도 같은 말을 하네요. 자기 객관화가 잘 되어 있으세요."], ["스스로 {tag} 스타일이라고 하셨는데 산 옷들도 동의합니다. 본인을 정확히 아시네요."]),
      second: O("{tag2}", 1, ["반쯤 맞았어요. 옷들은 {tag} 쪽을 더 밀고 있습니다."], ["스스로 {tag2} 스타일이라고 답하셨는데 옷들은 {tag} 쪽에 더 가까워요. 그래도 방향은 크게 안 틀렸습니다."]),
      decoy: O("{decoy}", -2, ["옷들을 보면 전혀 아닌데요."], ["스스로 {decoy} 스타일이라고요? 산 옷 중에서 {decoy|은} 찾기 어려워요. 되고 싶은 모습과 실제 사이가 꽤 멉니다."]),
      none: O("잘 모르겠어요", -1, ["모르겠다는 게 제일 솔직한 답이긴 하죠."], ["본인 스타일은 아직 모르겠다고 하셨죠. 옷들은 {tag} 쪽이라고 말하고 있으니 거기서부터 정리해 보시죠."]),
    },
  },
};

const tryFill = (t: string, v: Vars) => {
  try {
    return fill(t, v);
  } catch (e) {
    if (e instanceof MissingVar) return null;
    throw e;
  }
};

/** 조건이 맞는 점수 질문(최대 max개) */
export function buildAsks(ev: Evaluation, asks: Record<string, AskText>, r: Rng, max: number): (AskedQuestion & { at: AskAt })[] {
  const out: (AskedQuestion & { at: AskAt })[] = [];
  for (const id of ASK_ORDER) {
    if (out.length >= max) break;
    const tx = asks[id];
    if (!tx?.on) continue;
    const vars = ASK_WHEN[id].when(ev);
    if (!vars) continue;
    const lead = tx.lead.map((l) => tryFill(l, vars));
    const text = tryFill(tx.text, vars);
    const opts = Object.entries(tx.options).map(([k, o]) => ({ id: k, label: tryFill(o.label, vars) }));
    if (text == null || lead.some((l) => l == null) || opts.some((o) => o.label == null)) continue;
    const pickFilled = (list: string[]) => r.shuffle(list).map((t) => tryFill(t, vars)).find((t): t is string => t != null) ?? "";
    out.push({
      id: `ask_${id}`,
      lead: lead as string[],
      text,
      options: (id === "style_self" ? r.shuffle(opts) : opts) as { id: string; label: string }[],
      reactions: Object.fromEntries(Object.entries(tx.options).map(([k, o]) => [k, pickFilled(o.react)])),
      roast: Object.fromEntries(Object.entries(tx.options).map(([k, o]) => [k, o.roast.map((t) => tryFill(t, vars)).filter((t): t is string => t != null)])),
      photos: ASK_WHEN[id].photos?.(ev) ?? [],
      at: ASK_WHEN[id].at,
      points: Object.fromEntries(Object.entries(tx.options).map(([k, o]) => [k, o.points])),
    });
  }
  return out;
}

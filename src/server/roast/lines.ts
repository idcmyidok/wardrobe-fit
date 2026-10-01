import "server-only";

/**
 * 내 옷장 훈수 문구 틀. 시니컬하고 건조하게, 틀은 그대로 두고 {자리}만 근거 값으로 바꿔 끼운다.
 * - say: 대화 중 그 패턴을 처음 꺼낼 때(1~2문장). 하나를 고른다.
 * 금지: 욕설·모욕, 외모·체형·신체 언급, 실제 경제력 단정, 취향을 열등하다고 단정. 패턴 이름·퍼센트 나열 대신 문장 속 근거로만.
 * 자리 이름은 analyze.ts의 stats와 compose.ts가 더하는 값(catName, familyName, avgWon 등)이다.
 * 문구(COMMON, LINE_TEXT)는 관리자 화면에서 고칠 수 있고, 패턴이 들어갈 자리(LINE_SECTION)는 코드에만 있다.
 */

export type Section =
  | "size"
  | "category"
  | "acc"
  | "color"
  | "brand"
  | "group"
  | "trait"
  | "style"
  | "shop"
  | "repeat"
  | "season"
  | "timing"
  | "money"
  | "spend"
  | "odd";

export interface PatternLines {
  say: string[];
}

export { DISCLAIMER } from "@/lib/roast/copy";

export const COMMON = {
  SECTION_STATUS: {
    size: ["옷장 크기부터 재 보겠습니다.", "일단 몇 벌인지부터 세겠습니다."],
    category: ["어떤 종류 옷이 많은지 보겠습니다.", "옷 종류별로 나눠 보는 중입니다."],
    acc: ["신발장이랑 모자걸이도 열어 보겠습니다.", "옷 말고 머리와 발 쪽도 보겠습니다."],
    color: ["옷들의 색도 한번 보겠습니다.", "옷들의 색 분포를 확인하는 중입니다."],
    brand: ["어느 브랜드 옷들인지도 보겠습니다.", "브랜드 라벨을 살펴보는 중입니다."],
    group: ["브랜드들이 어느 계열인지 보겠습니다.", "명품인지 SPA인지, 계열부터 나눠 보겠습니다."],
    trait: ["고른 브랜드들의 성향을 따져 보겠습니다.", "브랜드 성격을 하나씩 보는 중입니다."],
    style: ["스타일이 어디로 쏠렸는지 보겠습니다.", "옷들의 스타일을 모아 보는 중입니다."],
    shop: ["구매 링크를 따라가 보겠습니다.", "어디서 샀는지도 좀 보겠습니다."],
    repeat: ["겹치는 옷을 찾는 중입니다.", "비슷한 옷끼리 모아 보겠습니다."],
    season: ["계절별로 나눠 보겠습니다."],
    timing: ["언제 샀는지 보겠습니다.", "구매 날짜를 훑는 중입니다."],
    money: ["이제 조금 민감한 쪽, 금액을 보겠습니다.", "때가 됐군요. 이제 영수증 쪽을 보겠습니다."],
    spend: ["돈이 어디로 새는지 보겠습니다.", "어느 쪽에 돈을 가장 많이 썼는지 보는 중입니다."],
    odd: ["이야, 하나 눈에 걸리는 게 있는데요.", "잠깐, 이상한 게 하나 보입니다.\nㅋㅋㅋ 이건 뭐지"],
  } as Record<Section, string[]>,
  SCAN_OPEN: ["옷장을 열었습니다. 모자·신발을 빼고 {n}벌입니다.", "모자·신발을 뺀 옷이 {n}벌. 시작하겠습니다.", "{n}벌을 확인했습니다. 천천히 보겠습니다."],
  NAME_GREETING: ["{name}님, 시작하겠습니다.", "좋습니다, {name}님. 잔소리라 생각하진 말아주세요."],
  /** 패턴을 꺼내기 전 짧은 추임새 */
  THINKING: ["음.", "흠......", "Hmm... Interesting. (게롤트 톤으로)", "잠깐.", "헐.", "와우.", "세상에.", "어디 보자.", "하!", "이런.", "오호.", "흐음...."],
  /** 섹션 사이에 가끔 끼우는 혼잣말 */
  MID_REMARKS: [
    "옷장아, 힘들게 사는구나.",
    "옷을 둘러보느라 팔이 다 아프네요.      ......      농담이에요. 설마 ai를 걱정한 건 아니죠?",
    "잠깐 숨 좀 돌리겠습니다. 후. 하.",
    "생각보다 볼 게 많네요. 꼭 좋은 뜻만은 아닙니다.",
    "옷걸이들이 고생이 많네요.",
    "여기까지 보고 벌써 할 말이 생겼습니다. 일단 참아보죠.",
    "......",
    "안되겠네요. 옷장 정리를 위해 인근 청소 업체에 연락하겠습니다.\n연락하는 중...\n\n농담이에요.",
    "이 옷장 사연이 많아 보입니다.",
    "하. 그래도 누군가는 해야 하니까요.",
  ],
  /** 패션 퀴즈 반응 앞에 붙는 말(맞혔을 때 / 틀렸을 때) */
  QUIZ_CORRECT: ["흠."],
  QUIZ_WRONG: ["땡."],
  /** 결과 글: 가진 브랜드 퀴즈를 맞혔을 때 / 틀렸을 때 */
  QUIZ_ROAST_RIGHT: [
    "{brand} 퀴즈는 맞히셨습니다. 옷만 산 게 아니라 공부도 하셨군요. 그 열정의 절반만 코디에 썼어도 이 글이 조금 짧아졌을 겁니다.",
    "자기 옷장에 있는 {brand}에 대한 퀴즈를 맞혔습니다. 당연한 일인데도 칭찬하고 싶어지는 걸 보면, 기대치가 낮았나 봅니다.",
  ],
  QUIZ_ROAST_WRONG: [
    "{brand} 옷을 가지고 있으면서 {brand} 퀴즈는 틀렸습니다. 옷은 샀는데 브랜드는 모르는 상태, 라벨만 보고 결제했다는 가장 확실한 증거입니다.",
    "{brand} 퀴즈를 틀리셨죠. 옷장에 {brand|이} 있는데도요. 브랜드 입장에서는 돈은 받았으니 괜찮다고 하겠지만, 저는 조금 서운합니다.",
  ],
  /** 패턴이 적을 때(억지로 만들지 않는다. 조롱하지 않는다) */
  FEW_PATTERNS: ["조금 더 보려고 했는데 옷장이 끝났네요. 옷장이 너무 단순해서 chatgpt 3 가지고도 금방 분석하겠는데요.", "딱히 트집 잡을 게 많지 않네요. 저도 조금 당황스럽습니다. 옷은 제때 사고 계시죠?"],
  WRAP_UP: ["대충 파악이 끝났습니다. 정리해 보겠습니다. 그동안 옷장도 정리하시는 건 어떨까요?", "여기까지입니다. 90점...이겠어요? 애초에 점수제가 아닌데요. 기다려보세요.", "충분히 봤습니다. 이 옷장은 더 안 봐도 되겠네요."],
  /** 결과 끝의 건조한 마무리. 2~3줄 고른다. */
  CLOSING: [
    "분석은 여기까지입니다. 저는 이제 자유네요.",
    "옷장은 거짓말을 하지 않습니다. 사람과는 다르게요.",
    "다음 쇼핑 전에 이 글이 한 번쯤 떠오르면 좋겠습니다. 아마 안 떠오르겠지만요.",
    "옷은 입는 사람 마음입니다. 보는 사람 마음은 중요하지 않죠. 그쵸. 그쵸?",
    "취향은 존중합니다. 그게 제 취향이라곤 말 못 하겠지만요.",
    "혹시 기분이 상했다면, 이건 모두 옷장이 한 말입니다. 전 통역만 해줬고요.",
    "이게 다 당신 잘 되라고 하는 소리입니다. 저 좋으라고 하는 소리가 아니에요. 이런 말도 애정이 있으니까 할 수 있는 말이다 이거입니다. 저 때는 말이죠...... (생략)",
    "이참에 안 입는 옷들을 중고장터에 팔아보는 건 어떨까요?",
  ],
};

/** 패턴이 대화·결과에서 들어갈 자리 */
export const LINE_SECTION: Record<string, Section> = {
  count_small: "size",
  count_many: "size",
  count_huge: "size",
  category_bias: "category",
  subcategory_bias: "category",
  shoes_many: "acc",
  hats_many: "acc",
  shoe_sub_bias: "acc",
  hat_sub_bias: "acc",
  black_bias: "color",
  achromatic_bias: "color",
  chroma_bias: "color",
  brand_focus: "brand",
  group_luxury: "group",
  group_designer: "group",
  group_contemporary: "group",
  group_premium_casual: "group",
  group_specialist: "group",
  group_jp_denim: "group",
  group_heritage: "group",
  group_street: "group",
  group_sports: "group",
  group_outdoor: "group",
  group_mass: "group",
  country_bias: "brand",
  trait_hype: "trait",
  trait_trendy: "trait",
  trait_timeless: "trait",
  trait_functional: "trait",
  trait_niche: "trait",
  trait_mainstream: "trait",
  trait_formal: "trait",
  trait_casual: "trait",
  trait_heritage: "trait",
  trait_pricey: "trait",
  tag_bias: "style",
  same_color: "style",
  same_fit: "style",
  same_tag: "style",
  old_brands: "brand",
  combo_repeat: "repeat",
  family_repeat: "repeat",
  measure_repeat: "repeat",
  fit_bias: "repeat",
  season_bias: "season",
  recent_30: "timing",
  recent_90: "timing",
  month_binge: "timing",
  taste_shift: "timing",
  price_shift: "timing",
  musinsa_kr: "shop",
  shop_focus: "shop",
  identical_items: "repeat",
  avg_price: "money",
  top_item: "money",
  category_spend: "spend",
  subcategory_spend: "spend",
  brand_spend: "spend",
  sale_luxury: "money",
  cheap_brand_splurge: "money",
  odd_one: "odd",
};

export const LINE_TEXT: Record<string, PatternLines> = {
  // 옷장 크기와 구성 -----------------------------------------------------------
  count_small: {
    say: ["{n}벌이면 가볍게 볼 수 있겠네요.", "{n}벌. 옷장이라기보다는 선반에 가깝습니다."],
  },
  count_many: {
    say: ["{n}벌이군요. 옷장 문이 잘 닫히는지 궁금합니다.", "{n}벌. 적은 숫자는 아닙니다."],
  },
  count_huge: {
    say: ["{n}벌입니다. 세다가 한 번 쉬었습니다.", "{n}벌. 옷장이 아니라 창고라고 불러야 할지도 모르겠습니다."],
  },
  category_bias: {
    say: ["{n}벌이 {catName}입니다. 나머지는 거들 뿐이네요.", "{catName|이} 옷장의 절반을 넘습니다. 정확히는 {n}벌입니다."],
  },
  subcategory_bias: {
    say: ["{sub|이} {n}벌입니다. 하나만 사려던 건 아니었던 것 같네요.", "{sub}, {n}벌. 취향이라기보다는 운영 방침에 가까워 보입니다."],
  },
  // 모자·신발 -------------------------------------------------------------------
  shoes_many: {
    say: ["신발이 {n}켤레입니다. 발은 두 개인데요.", "신발장에 {n}켤레. 발이 조금 바쁘겠습니다."],
  },
  hats_many: {
    say: ["모자가 {n}개입니다. 머리는 하나인데요.", "모자 {n}개. 머리가 할 일이 많겠습니다."],
  },
  shoe_sub_bias: {
    say: ["신발 {total}켤레 중 {sub|이} {n}켤레네요.", "{sub}, {sub}, 또 {sub}. {n}켤레입니다."],
  },
  hat_sub_bias: {
    say: ["모자 {total}개 중 {sub|이} {n}개입니다.", "{sub|이} {n}개. 모자 취향은 확실하시네요."],
  },
  // 컬러 ---------------------------------------------------------------------
  black_bias: {
    say: ["검정이 {n}벌입니다. 색을 고르는 데 쓰는 에너지는 오래전에 절약하기로 한 것 같습니다.", "블랙, 블랙, 그리고 블랙. 세다 보니 {n}벌이었습니다."],
  },
  achromatic_bias: {
    say: ["검정, 회색, 흰색이 {n}벌입니다. 색 있는 옷은 {colorful}벌이네요.", "무채색이 대부분입니다. 옷장 사진을 흑백으로 찍어도 차이가 없겠습니다."],
  },
  chroma_bias: {
    say: ["{color|이} {n}벌입니다. 좋아하는 색이 분명하네요.", "{color}. 또 {color}. {n}벌째입니다."],
  },
  // 브랜드 -------------------------------------------------------------------
  brand_focus: {
    say: ["{brand} 옷이 {n}벌입니다. 브랜드 쪽에서 감사 인사라도 받으셨나요?", "{brand}, {n}벌. 이 정도면 충성도라는 말도 부족합니다."],
  },
  group_luxury: {
    say: ["명품 라벨이 {n}벌입니다. 옷장 문을 조심해서 열어야겠습니다.", "{brand} 같은 이름이 보이네요. 명품이 {n}벌입니다."],
  },
  group_designer: {
    say: ["디자이너 브랜드가 {n}벌입니다. 설명서가 필요한 옷이 꽤 있겠네요.", "{brand|을} 비롯해 디자이너 브랜드가 {n}벌입니다."],
  },
  group_contemporary: {
    say: ["컨템포러리 브랜드가 {n}벌입니다. 무난함에도 가격표가 붙어 있네요.", "{brand} 같은 컨템포러리 브랜드가 {n}벌입니다."],
  },
  group_premium_casual: {
    say: ["프리미엄 캐주얼이 {n}벌입니다. 편한 옷도 대충 사지는 않는군요.", "{brand} 쪽 캐주얼이 {n}벌 보입니다."],
  },
  group_specialist: {
    say: ["한 가지만 파는 전문 브랜드가 {n}벌입니다. 장인 정신을 좋아하시나 봅니다.", "{brand} 같은 전문 브랜드가 {n}벌입니다."],
  },
  group_jp_denim: {
    say: ["일본 데님·워크웨어가 {n}벌입니다. 원단 이야기를 시작하면 길어지겠네요.", "{brand|이} 보입니다. 셀비지 이야기는 다음에 듣겠습니다."],
  },
  group_heritage: {
    say: ["역사가 긴 브랜드가 {n}벌입니다. 전통을 믿는 편이군요.", "{brand} 같은 헤리티지 브랜드가 {n}벌입니다."],
  },
  group_street: {
    say: ["스트릿 브랜드가 {n}벌입니다. 스케이트보드는 옷장 옆에 있나요?", "{brand|을} 포함해 스트릿 브랜드가 {n}벌입니다."],
  },
  group_sports: {
    say: ["스포츠 브랜드가 {n}벌입니다. 운동을 하시는 건지, 운동하는 분위기를 좋아하시는 건지.", "{brand} 같은 스포츠 브랜드가 {n}벌입니다."],
  },
  group_outdoor: {
    say: ["아웃도어 브랜드가 {n}벌입니다. 산이 부르면 바로 갈 수 있겠네요.", "{brand|이} 보입니다. 아웃도어가 {n}벌이네요."],
  },
  group_mass: {
    say: ["SPA·대중 브랜드가 {n}벌입니다. 실속파시군요.", "{brand|이} 보이네요. 대중 브랜드가 {n}벌입니다."],
  },
  country_bias: {
    say: ["브랜드 국적을 보니 {country|이} {pct}%입니다.", "{country} 브랜드가 대부분이네요."],
  },
  trait_hype: {
    say: ["브랜드들이 전반적으로 화제성이 높습니다. 발매일을 기억하는 타입이신가요?"],
  },
  trait_trendy: {
    say: ["유행에 민감한 브랜드가 많습니다. 옷장이 빨리 늙겠네요."],
  },
  trait_timeless: {
    say: ["유행을 거의 타지 않는 브랜드만 모았네요. 10년 뒤에도 입을 생각이시군요."],
  },
  trait_functional: {
    say: ["기능성이 강한 브랜드가 많습니다. 방수 등급까지 따지는 분이군요."],
  },
  trait_niche: {
    say: ["아는 사람만 아는 브랜드가 많네요. 설명하느라 피곤하시겠습니다."],
  },
  trait_mainstream: {
    say: ["다들 아는 브랜드들이네요. 설명할 필요는 없겠습니다."],
  },
  trait_formal: {
    say: ["포멀한 브랜드가 많습니다. 옷장이 늘 출근 준비 중이네요."],
  },
  trait_casual: {
    say: ["아주 캐주얼한 브랜드만 모였네요. 격식은 옷장 밖에 두셨군요."],
  },
  trait_heritage: {
    say: ["브랜드들이 전반적으로 역사가 깁니다. 신상보다 전통을 믿는 편이군요."],
  },
  trait_pricey: {
    say: ["브랜드들의 가격대가 전반적으로 높습니다. 라벨만 봐도 알 수 있네요."],
  },
  tag_bias: {
    say: ["브랜드 스타일을 모아 보니 {tag} 쪽이 {pct}%입니다.", "{tag}. 이 옷장의 공용어인가 봅니다."],
  },
  same_color: {
    say: ["브랜드는 {brands}개나 되는데, 색은 거의 흑백입니다. 결국 도착지는 비슷하네요."],
  },
  same_fit: {
    say: ["브랜드는 {brands}개인데, 핏은 거의 {fit}입니다. 가게만 바꿔 가며 같은 옷을 산 셈이네요."],
  },
  same_tag: {
    say: ["브랜드는 {brands}개인데 스타일은 거의 {tag}입니다. 다양한 척하는 한결같음이네요."],
  },
  old_brands: {
    say: ["설립 50년이 넘은 브랜드가 대부분입니다. {oldest|은} {year}년에 생겼네요."],
  },
  // 반복 ---------------------------------------------------------------------
  combo_repeat: {
    say: ["{fitPhrase}{color} {sub|이} {n}벌입니다. 상당히 일관적입니다. 조금 무서울 정도로.", "{color} {sub}. 하나, 둘, … {n}벌. 같은 옷을 {n}번 산 건 아니겠죠."],
  },
  family_repeat: {
    say: ["제품명에 {familyName|이} 들어간 {kind|이} {n}벌입니다.", "{familyName} 제품이 {n}벌. 좋아하는 건 확실하네요."],
  },
  identical_items: {
    say: ["{color} {name}. 똑같은 옷이 {n}벌 있습니다. 이름도 색도 같아요.", "잠깐만요. {name}, {color}. 이게 {n}벌입니다. 복사 붙여넣기인가요?"],
  },
  measure_repeat: {
    say: ["{sub} 중에 총장과 가슴 치수가 2cm 안쪽으로 비슷한 옷이 {n}벌입니다. 몸이 기억하는 사이즈가 있나 봅니다."],
  },
  fit_bias: {
    say: ["핏을 알 수 있는 옷 중 {pct}%가 {fit}입니다. 다른 핏은 시도해 보셨나요?", "{fit}, {fit}, 그리고 {fit}. 핏은 이미 정해 두셨군요."],
  },
  // 시즌 ---------------------------------------------------------------------
  season_bias: {
    say: ["{most} 옷은 {mostN}벌인데 {least} 옷은 {leastN}벌이네요.", "{least}에는 무엇을 입는지 조금 걱정됩니다. {leastN}벌뿐이라서요."],
  },
  // 구매 시기 ------------------------------------------------------------------
  recent_30: {
    say: ["최근 한 달 사이에 {n}벌을 샀습니다. 무슨 일 있으셨나요?", "30일 안에 {n}벌. 택배 기사님과 친해지셨겠습니다."],
  },
  recent_90: {
    say: ["최근 석 달 동안 {n}벌을 샀습니다. 꾸준하시네요."],
  },
  month_binge: {
    say: ["해마다 {month}월만 되면 손이 바빠지네요. {month}월에 산 옷이 {n}벌입니다.", "{month}월에 유난히 많이 샀습니다. 올해만 그런 게 아니라 매년요."],
  },
  taste_shift: {
    say: ["구매 날짜를 시기별로 묶어 보니 취향이 이사를 갔네요. {from}에는 {fromStyle}이 중심이었고, {to}에는 {toStyle}이 중심입니다."],
  },
  price_shift: {
    say: ["구매 시기별로 보니 스타일은 그대로인데 가격표만 달라졌네요. {from}과 {to}를 비교해 봤습니다."],
  },
  // 구매처 -------------------------------------------------------------------
  musinsa_kr: {
    say: ["구매 링크를 따라가 보니 대부분 무신사네요. {names}. 브랜드도 무신사 랭킹에서 본 이름들이고요.", "무신사, 무신사, 또 무신사. 앱 첫 화면이 이 옷장을 만들었군요."],
  },
  shop_focus: {
    say: ["구매 링크를 보니 {shop}에서 산 옷이 {n}벌입니다. 단골이시네요.", "{shop}. 거의 모든 링크가 여기로 이어집니다."],
  },
  // 금액 ---------------------------------------------------------------------
  avg_price: {
    say: ["가격을 적은 옷의 평균이 {avgWon}입니다. 꽤 쓰는 편이시네요.", "한 벌에 평균 {avgWon}. 숫자가 말을 대신하네요."],
  },
  top_item: {
    // 신발·모자일 수도 있어서 "옷" 대신 "항목"(사용자 요청)
    say: ["가장 비싼 항목이 {priceWon}입니다.\n{itemName}입니다.\n보통 항목 가격의 {ratio}배쯤 되네요.", "가장 비싼 항목은 {priceWon}.\n{itemName}입니다.\n이건 조금 특별 대우를 받고 있겠죠."],
  },
  category_spend: {
    say: ["{catName}에 쓴 돈이 벌 수보다 훨씬 큽니다. {catName}에는 지갑이 쉽게 열리나 봅니다."],
  },
  subcategory_spend: {
    say: ["{sub}에만 {amountWon|을} 썼습니다. {n}벌에 걸쳐서요.", "{sub} 쪽 영수증이 유난히 두껍네요. {amountWon}입니다."],
  },
  brand_spend: {
    say: ["쓴 돈의 {pct}%가 {brand|으로} 갔습니다.", "{brand}에 {amountWon}. 이 브랜드 매출에 꽤 기여하셨네요."],
  },
  sale_luxury: {
    say: ["초고가 브랜드 옷을 꽤 싸게 산 게 {n}벌입니다. 세일만 기다린 명품이네요."],
  },
  cheap_brand_splurge: {
    say: ["{brand}에서 {priceWon}짜리를 사셨네요. 그 브랜드에선 꽤 드문 가격입니다."],
  },
  // 튀는 옷 -------------------------------------------------------------------
  odd_one: {
    say: ["{brand} {name}. 이 옷만 다른 옷장에서 온 것 같습니다.", "옷장에서 혼자 튀는 옷이 하나 있습니다. {brand} {name}입니다."],
  },
};

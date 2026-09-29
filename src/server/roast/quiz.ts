import "server-only";
import type { Analysis } from "./analyze";
import { BRANDS, brandGroups, type BrandGroup } from "./brands";
import type { Rng } from "./text";

/**
 * 패션 퀴즈(계획서 7장). 명품·디자이너·일본 데님·워크웨어 브랜드를 가진 옷장에만 한 문제 낸다.
 * - 정답이 확실한 사실만. 선택지는 같은 브랜드 안에서 헷갈리는 것(다른 브랜드 이름으로 티 나게 하지 않는다).
 * - 정답·오답으로 사람이나 취향을 평가하지 않는다.
 * brand는 브랜드 자료(brands.json)의 브랜드명과 같아야 한다(테스트로 확인).
 */
export interface QuizItem {
  id: string;
  brand: string;
  question: string;
  options: [string, string, string, string];
  answer: string;
  correct: string[];
  wrong: string[];
  /** 화면에 쓰는 브랜드 이름(옷장 표기). pickQuiz가 채운다. */
  brandLabel?: string;
}

const OK = ["좋습니다. 적어도 라벨만 보고 산 건 아니네요.", "정답입니다. 조금 의외였습니다."];
const NO = ["괜찮습니다. 입는 데 이걸 외울 필요는 없으니까요.", "아쉽네요. 옷은 그래도 잘 입으실 겁니다."];

export const QUIZ: QuizItem[] = [
  {
    id: "margiela-men",
    brand: "Maison Margiela",
    question: "라벨에 0부터 23까지 숫자가 적혀 있죠. 남성복 라인은 몇 번일까요?",
    options: ["1", "10", "14", "22"],
    answer: "10",
    correct: ["좋습니다. 적어도 흰 실밥 네 개만 보고 산 건 아니네요."],
    wrong: ["괜찮습니다. 입는 데 번호를 외울 필요는 없으니까요."],
  },
  {
    id: "margiela-shoes",
    brand: "Maison Margiela",
    question: "같은 숫자 라벨에서 신발 라인은 몇 번일까요?",
    options: ["8", "11", "13", "22"],
    answer: "22",
    correct: ["정답입니다. 신발장도 번호로 정리하시나 봅니다."],
    wrong: ["괜찮습니다. 신발은 번호보다 사이즈가 중요하죠."],
  },
  {
    id: "margiela-tabi",
    brand: "Maison Margiela",
    question: "앞코가 두 갈래로 갈라진 타비 부츠. 무엇에서 모양을 따왔을까요?",
    options: ["일본 전통 버선(타비)", "일본 나막신(게다)", "발레 토슈즈", "말발굽"],
    answer: "일본 전통 버선(타비)",
    correct: ["맞습니다. 이름에 이미 답이 있었죠."],
    wrong: ["이름이 타비인데요. 괜찮습니다. 발가락은 기억할 겁니다."],
  },
  {
    id: "cdg-meaning",
    brand: "Comme des Garçons",
    question: "Comme des Garçons는 프랑스어로 무슨 뜻일까요?",
    options: ["소년들처럼", "소녀들을 위해", "친구들과 함께", "거리의 아이들"],
    answer: "소년들처럼",
    correct: ["정답입니다. 라벨을 꽤 오래 들여다보셨군요."],
    wrong: ["괜찮습니다. 프랑스어까지 할 필요는 없습니다."],
  },
  {
    id: "cdg-founder",
    brand: "Comme des Garçons",
    question: "꼼데가르송을 만든 디자이너는 누구일까요?",
    options: ["가와쿠보 레이", "와타나베 준야", "니노미야 케이", "쿠리하라 타오"],
    answer: "가와쿠보 레이",
    correct: ["맞습니다. 나머지 셋도 꼼데 식구라 헷갈릴 만했는데요."],
    wrong: ["아깝습니다. 그분도 꼼데 식구이긴 합니다."],
  },
  {
    id: "cdg-play",
    brand: "Comme des Garçons",
    question: "PLAY 라인의 눈 달린 하트, 누가 그렸을까요?",
    options: ["필립 파고우스키", "와타나베 준야", "쿠리하라 타오", "니노미야 케이"],
    answer: "필립 파고우스키",
    correct: ["정답입니다. 하트만 보고 산 건 아니었네요."],
    wrong: ["괜찮습니다. 하트는 누가 그렸든 귀엽습니다."],
  },
  {
    id: "rick-city",
    brand: "Rick Owens",
    question: "릭 오웬스가 파리로 옮기기 전, 브랜드를 처음 시작한 도시는 어디일까요?",
    options: ["로스앤젤레스", "뉴욕", "런던", "베를린"],
    answer: "로스앤젤레스",
    correct: ["맞습니다. 햇빛 많은 도시에서 이렇게 어두운 옷이 나왔습니다."],
    wrong: ["의외죠. 답은 로스앤젤레스입니다. 햇빛 많은 곳이요."],
  },
  {
    id: "rick-diffusion",
    brand: "Rick Owens",
    question: "데님과 저지를 중심으로 하는 릭 오웬스의 서브 라인은?",
    options: ["DRKSHDW", "Lilies", "Hun", "Performa"],
    answer: "DRKSHDW",
    correct: ["정답입니다. 모음 없이도 읽으셨군요."],
    wrong: ["괜찮습니다. 모음이 없는 이름은 원래 헷갈립니다."],
  },
  {
    id: "acne-name",
    brand: "Acne Studios",
    question: "Acne는 무엇의 줄임말일까요?",
    options: ["Ambition to Create Novel Expression", "Associated Creative Network Europe", "Art, Culture, Nature, Energy", "Avant-garde Clothing from Nordic Europe"],
    answer: "Ambition to Create Novel Expression",
    correct: ["정답입니다. 여드름이라고 생각한 적 없다는 거죠."],
    wrong: ["괜찮습니다. 대부분은 여드름부터 떠올립니다."],
  },
  {
    id: "acne-city",
    brand: "Acne Studios",
    question: "아크네 스튜디오가 시작된 도시는 어디일까요?",
    options: ["스톡홀름", "코펜하겐", "오슬로", "헬싱키"],
    answer: "스톡홀름",
    correct: OK,
    wrong: ["북유럽은 다 비슷해 보이죠. 스톡홀름입니다."],
  },
  {
    id: "thom-stripes",
    brand: "Thom Browne",
    question: "톰 브라운 옷 왼쪽 소매의 줄무늬는 몇 줄일까요?",
    options: ["2줄", "3줄", "4줄", "5줄"],
    answer: "4줄",
    correct: ["정답입니다. 세 줄이었으면 다른 브랜드였겠죠."],
    wrong: ["네 줄입니다. 세면서 입는 옷은 아니니까 괜찮습니다."],
  },
  {
    id: "thom-tab",
    brand: "Thom Browne",
    question: "톰 브라운 삼색 탭의 색 순서로 맞는 것은?",
    options: ["빨강·하양·파랑", "파랑·하양·빨강", "초록·하양·빨강", "검정·하양·빨강"],
    answer: "빨강·하양·파랑",
    correct: OK,
    wrong: NO,
  },
  {
    id: "balenciaga-origin",
    brand: "Balenciaga",
    question: "창립자 크리스토발 발렌시아가는 어느 나라 사람일까요?",
    options: ["스페인", "프랑스", "이탈리아", "벨기에"],
    answer: "스페인",
    correct: ["맞습니다. 파리 브랜드인 줄만 아는 사람이 많은데요."],
    wrong: ["스페인입니다. 이름에서 살짝 힌트가 있었습니다."],
  },
  {
    id: "prada-city",
    brand: "Prada",
    question: "1913년 프라다가 처음 문을 연 도시는?",
    options: ["밀라노", "로마", "피렌체", "베네치아"],
    answer: "밀라노",
    correct: OK,
    wrong: NO,
  },
  {
    id: "gucci-city",
    brand: "Gucci",
    question: "구찌가 처음 시작된 도시는?",
    options: ["피렌체", "밀라노", "로마", "나폴리"],
    answer: "피렌체",
    correct: OK,
    wrong: ["피렌체입니다. 밀라노라고 생각하는 분이 많죠."],
  },
  {
    id: "gucci-web",
    brand: "Gucci",
    question: "구찌의 웹 스트라이프, 가운데 색은?",
    options: ["빨강", "초록", "파랑", "노랑"],
    answer: "빨강",
    correct: ["정답입니다. 초록 사이의 빨강이죠."],
    wrong: ["초록 사이에 빨강입니다. 괜찮습니다."],
  },
  {
    id: "loewe-country",
    brand: "Loewe",
    question: "로에베가 시작된 나라는?",
    options: ["스페인", "이탈리아", "프랑스", "포르투갈"],
    answer: "스페인",
    correct: OK,
    wrong: ["스페인입니다. 마드리드요."],
  },
  {
    id: "bottega-weave",
    brand: "Bottega Veneta",
    question: "보테가 베네타가 가죽을 엮는 기법의 이름은?",
    options: ["인트레치아토", "카바트", "아르코", "조디"],
    answer: "인트레치아토",
    correct: ["정답입니다. 나머지는 가방 이름이었습니다."],
    wrong: ["그건 가방 이름입니다. 엮는 기법은 인트레치아토예요."],
  },
  {
    id: "burberry-fabric",
    brand: "Burberry",
    question: "토머스 버버리가 개발한, 트렌치코트에 쓰인 원단은?",
    options: ["개버딘", "트위드", "코듀로이", "캔버스"],
    answer: "개버딘",
    correct: OK,
    wrong: NO,
  },
  {
    id: "moncler-name",
    brand: "Moncler",
    question: "몽클레르라는 이름은 어디서 왔을까요?",
    options: ["프랑스 알프스 마을 이름", "몽블랑 산", "창업자 이름", "프랑스어 '밝은 산'"],
    answer: "프랑스 알프스 마을 이름",
    correct: ["정답입니다. 모네스티에 드 클레르몽, 줄여서 몽클레르죠."],
    wrong: ["마을 이름입니다. 모네스티에 드 클레르몽. 길어서 줄였습니다."],
  },
  {
    id: "ysl-smoking",
    brand: "Saint Laurent",
    question: "1966년 이브 생 로랑이 선보인 여성용 턱시도의 이름은?",
    options: ["르 스모킹", "몬드리안 드레스", "사하리엔", "피코트"],
    answer: "르 스모킹",
    correct: OK,
    wrong: ["나머지도 생 로랑의 대표작이라 헷갈릴 만했습니다."],
  },
  {
    id: "dior-newlook",
    brand: "Dior",
    question: "1947년 디올의 첫 컬렉션에 붙은 별명은?",
    options: ["뉴 룩", "H 라인", "A 라인", "튤립 라인"],
    answer: "뉴 룩",
    correct: OK,
    wrong: ["나머지도 디올의 라인이지만, 처음은 뉴 룩이었습니다."],
  },
  {
    id: "hermes-origin",
    brand: "Hermès",
    question: "1837년 에르메스가 처음 만든 것은?",
    options: ["말 안장과 마구", "여행 가방", "실크 스카프", "손목시계"],
    answer: "말 안장과 마구",
    correct: ["정답입니다. 그래서 로고에 마차가 있죠."],
    wrong: ["말 장비였습니다. 로고의 마차가 힌트였어요."],
  },
  {
    id: "lv-origin",
    brand: "Louis Vuitton",
    question: "루이 비통이 처음 이름을 알린 물건은?",
    options: ["여행용 트렁크", "핸드백", "구두", "향수"],
    answer: "여행용 트렁크",
    correct: OK,
    wrong: NO,
  },
  {
    id: "chanel-255",
    brand: "Chanel",
    question: "샤넬 2.55 가방의 숫자는 무슨 뜻일까요?",
    options: ["1955년 2월", "55번째 디자인", "2시 55분", "파리 2구 55번지"],
    answer: "1955년 2월",
    correct: OK,
    wrong: ["1955년 2월에 나온 가방이라서입니다."],
  },
  {
    id: "celine-accent",
    brand: "Celine",
    question: "2018년 셀린느 로고에서 사라진 것은?",
    options: ["첫 번째 e 위의 악센트", "마지막 마침표", "대문자 C", "로고 아래 밑줄"],
    answer: "첫 번째 e 위의 악센트",
    correct: ["정답입니다. Céline에서 Celine이 됐죠."],
    wrong: ["악센트입니다. Céline에서 Celine으로요."],
  },
  {
    id: "versace-logo",
    brand: "Versace",
    question: "베르사체 로고 속 얼굴은 누구일까요?",
    options: ["메두사", "아테나", "비너스", "헤라"],
    answer: "메두사",
    correct: OK,
    wrong: ["메두사입니다. 오래 쳐다보면 굳는다는 그분이요."],
  },
  {
    id: "fendi-ff",
    brand: "Fendi",
    question: "펜디의 FF 로고를 만든 디자이너는?",
    options: ["칼 라거펠트", "실비아 벤투리니 펜디", "킴 존스", "카를라 펜디"],
    answer: "칼 라거펠트",
    correct: OK,
    wrong: ["칼 라거펠트입니다. 펜디 가족들도 헷갈릴 만한 문제였습니다."],
  },
  {
    id: "miyake-plisse",
    brand: "Issey Miyake",
    question: "이세이 미야케의 남성 주름 라인 이름은?",
    options: ["옴므 플리세", "플리츠 플리즈", "바오바오", "에이포크"],
    answer: "옴므 플리세",
    correct: ["정답입니다. 플리츠 플리즈와 헷갈리기 쉬운데요."],
    wrong: ["옴므 플리세입니다. 주름이 많은 만큼 이름도 헷갈리죠."],
  },
  {
    id: "yohji-y3",
    brand: "Yohji Yamamoto",
    question: "요지 야마모토가 아디다스와 함께하는 라인은?",
    options: ["Y-3", "Y's", "Ground Y", "S'YTE"],
    answer: "Y-3",
    correct: OK,
    wrong: ["Y-3입니다. Y가 들어간 라인이 너무 많긴 하죠."],
  },
  {
    id: "visvim-fbt",
    brand: "visvim",
    question: "비즈빔 FBT 모카신의 이름은 어느 밴드에서 왔을까요?",
    options: ["Fun Boy Three", "Fine Young Cannibals", "Frankie Goes to Hollywood", "Flock of Seagulls"],
    answer: "Fun Boy Three",
    correct: ["정답입니다. 신발 이름까지 챙기시는군요."],
    wrong: ["Fun Boy Three입니다. 앨범 사진 속 신발이 시작이었죠."],
  },
  {
    id: "kapital-home",
    brand: "Kapital",
    question: "캐피탈의 본거지는 어디일까요?",
    options: ["오카야마 고지마", "도쿄 하라주쿠", "오사카 아메무라", "교토"],
    answer: "오카야마 고지마",
    correct: ["정답입니다. 청바지의 도시죠."],
    wrong: ["고지마입니다. 일본 청바지의 성지요."],
  },
  {
    id: "needles-logo",
    brand: "Needles",
    question: "니들스 로고의 모티브는?",
    options: ["나비", "나방", "잠자리", "벌"],
    answer: "나비",
    correct: OK,
    wrong: ["나비입니다. 파피용이라고 부르죠."],
  },
  {
    id: "evisu-pocket",
    brand: "Evisu",
    question: "에비수 청바지 뒷주머니에 그려진 것은?",
    options: ["갈매기", "파도", "후지산", "벚꽃"],
    answer: "갈매기",
    correct: OK,
    wrong: ["갈매기입니다. 뒷주머니를 너무 안 보셨네요."],
  },
  {
    id: "momotaro-name",
    brand: "Momotaro Jeans",
    question: "모모타로 진스라는 이름은 어디서 왔을까요?",
    options: ["일본 옛이야기의 복숭아 소년", "창업자 이름", "오카야마의 강 이름", "복숭아 품종"],
    answer: "일본 옛이야기의 복숭아 소년",
    correct: ["정답입니다. 오카야마의 영웅이죠."],
    wrong: ["옛이야기 속 복숭아 소년입니다. 오카야마의 상징이에요."],
  },
  {
    id: "ourlegacy-country",
    brand: "Our Legacy",
    question: "아워레가시는 어느 나라 브랜드일까요?",
    options: ["스웨덴", "덴마크", "노르웨이", "핀란드"],
    answer: "스웨덴",
    correct: OK,
    wrong: ["스웨덴입니다. 북유럽은 다 비슷해 보이죠."],
  },
  {
    id: "lemaire-bag",
    brand: "Lemaire",
    question: "르메르의 반달 모양 대표 가방 이름은?",
    options: ["크루아상", "브리오슈", "마카롱", "바게트 롤"],
    answer: "크루아상",
    correct: ["정답입니다. 배고픈 이름이죠."],
    wrong: ["크루아상입니다. 빵 이름인 건 맞혔습니다."],
  },
  {
    id: "offwhite-laces",
    brand: "Off-White",
    question: "오프화이트 신발끈에 적힌 글자는?",
    options: ["\"SHOELACES\"", "\"FOR WALKING\"", "\"LACE\"", "\"TIE ME\""],
    answer: "\"SHOELACES\"",
    correct: ["정답입니다. 신발끈에 신발끈이라고 적혀 있죠."],
    wrong: ["\"SHOELACES\"입니다. 신발끈에 신발끈이라고요."],
  },
  {
    id: "westwood-logo",
    brand: "Vivienne Westwood",
    question: "비비안 웨스트우드 로고의 모양은?",
    options: ["토성 고리를 두른 보주", "왕관과 사자", "방패와 장미", "해골과 왕관"],
    answer: "토성 고리를 두른 보주",
    correct: OK,
    wrong: ["토성 고리를 두른 보주입니다. 왕실과 우주를 합쳤죠."],
  },
  {
    id: "undercover-slogan",
    brand: "Undercover",
    question: "언더커버의 유명한 슬로건은?",
    options: ["We make noise not clothes", "Clothes make the man", "Noise is the new silence", "Fashion is dead"],
    answer: "We make noise not clothes",
    correct: OK,
    wrong: ["We make noise not clothes입니다. 옷이 아니라 소음을 만든다고요."],
  },
  {
    id: "jilsander-country",
    brand: "Jil Sander",
    question: "질 샌더는 어느 나라 사람일까요?",
    options: ["독일", "스웨덴", "덴마크", "오스트리아"],
    answer: "독일",
    correct: OK,
    wrong: ["독일입니다. 미니멀함이 그쪽이죠."],
  },
  {
    id: "dries-six",
    brand: "Dries Van Noten",
    question: "드리스 반 노튼이 속한 디자이너 모임의 별명은?",
    options: ["앤트워프 식스", "런던 파이브", "파리 세븐", "밀라노 포"],
    answer: "앤트워프 식스",
    correct: OK,
    wrong: ["앤트워프 식스입니다. 벨기에의 여섯 명이요."],
  },
  {
    id: "ann-six",
    brand: "Ann Demeulemeester",
    question: "앤 드뮐미스터가 속한 디자이너 모임의 별명은?",
    options: ["앤트워프 식스", "런던 파이브", "파리 세븐", "밀라노 포"],
    answer: "앤트워프 식스",
    correct: OK,
    wrong: ["앤트워프 식스입니다. 벨기에의 여섯 명이요."],
  },
  {
    id: "eg-city",
    brand: "Engineered Garments",
    question: "엔지니어드 가먼츠가 옷을 만드는 도시는?",
    options: ["뉴욕", "도쿄", "런던", "포틀랜드"],
    answer: "뉴욕",
    correct: OK,
    wrong: ["뉴욕입니다. 일본 디자이너가 뉴욕에서 만들죠."],
  },
  {
    id: "kenzo-founder",
    brand: "Kenzo",
    question: "겐조를 만든 다카다 겐조는 어느 나라 사람일까요?",
    options: ["일본", "프랑스", "중국", "한국"],
    answer: "일본",
    correct: OK,
    wrong: ["일본입니다. 파리에서 시작했을 뿐이죠."],
  },
  {
    id: "marni-city",
    brand: "Marni",
    question: "마르니가 시작된 도시는?",
    options: ["밀라노", "로마", "피렌체", "토리노"],
    answer: "밀라노",
    correct: OK,
    wrong: NO,
  },
];

const QUIZ_GROUPS: BrandGroup[] = ["luxury", "designer", "jp_denim"];
const BY_NAME = new Map(BRANDS.map((b) => [b.name, b]));

/** 가진 브랜드의 문제를 먼저, 없으면 가진 그룹의 다른 브랜드 문제를 고른다. */
export function pickQuiz(a: Analysis, r: Rng): QuizItem | null {
  const owned = new Set(a.quizBrands.map((b) => b.name));
  const mine = QUIZ.filter((q) => owned.has(q.brand));
  const label = (brand: string) => a.items.find((i) => i.brand?.name === brand)?.brandLabel || brand;
  if (mine.length) {
    const q = r.pick(mine);
    return { ...q, brandLabel: label(q.brand) };
  }
  const groups = new Set(a.quizGroups);
  const pool = QUIZ.filter((q) => {
    const b = BY_NAME.get(q.brand);
    return b && brandGroups(b).some((g) => QUIZ_GROUPS.includes(g) && groups.has(g));
  });
  if (!pool.length) return null;
  const q = r.pick(pool);
  return { ...q, brandLabel: q.brand };
}

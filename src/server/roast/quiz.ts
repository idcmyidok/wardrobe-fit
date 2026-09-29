import "server-only";
import type { Analysis } from "./analyze";
import type { Rng } from "./text";
import type { RoastTexts } from "./texts";

/**
 * 패션 퀴즈. 옷장에 있는 명품·디자이너·일본 데님 브랜드 중 퀴즈가 있는 브랜드로만 한 문제 낸다(없으면 퀴즈 없음).
 * - 남성 사용자 기준. 여성복·가방·잡화 문제는 넣지 않는다.
 * - 창립자·도시·디자이너 모임·원단 이름처럼 전공자만 알 만한 문제 대신, 로고·라인·대표 제품·유명한 시즌 아카이브를 묻는다.
 * - 정답이 확실한 사실만. 정답·오답으로 사람을 평가하지 않는다.
 * 문구(QUIZ_TEXT)는 관리자 화면에서 고칠 수 있다. 정답은 선택지 순서(answer)로 코드에 있다.
 * brand는 브랜드 자료(brands.json)의 브랜드명과 같아야 한다(테스트로 확인).
 */
export interface QuizDef {
  id: string;
  brand: string;
  /** 정답 선택지 번호(0부터) */
  answer: number;
}

export interface QuizText {
  question: string;
  options: string[];
  correct: string[];
  wrong: string[];
}

export const QUIZ: QuizDef[] = [
  { id: "margiela-men", brand: "Maison Margiela", answer: 1 },
  { id: "margiela-tabi", brand: "Maison Margiela", answer: 0 },
  { id: "margiela-gat", brand: "Maison Margiela", answer: 0 },
  { id: "cdg-meaning", brand: "Comme des Garçons", answer: 0 },
  { id: "cdg-play", brand: "Comme des Garçons", answer: 0 },
  { id: "rick-city", brand: "Rick Owens", answer: 0 },
  { id: "rick-diffusion", brand: "Rick Owens", answer: 0 },
  { id: "rick-ramones", brand: "Rick Owens", answer: 0 },
  { id: "acne-name", brand: "Acne Studios", answer: 0 },
  { id: "thom-stripes", brand: "Thom Browne", answer: 2 },
  { id: "thom-tab", brand: "Thom Browne", answer: 0 },
  { id: "thom-moncler", brand: "Thom Browne", answer: 0 },
  { id: "balenciaga-bernie", brand: "Balenciaga", answer: 0 },
  { id: "prada-linea", brand: "Prada", answer: 0 },
  { id: "gucci-web", brand: "Gucci", answer: 0 },
  { id: "gucci-tomford", brand: "Gucci", answer: 0 },
  { id: "loewe-paula", brand: "Loewe", answer: 0 },
  { id: "burberry-trench", brand: "Burberry", answer: 0 },
  { id: "moncler-name", brand: "Moncler", answer: 0 },
  { id: "moncler-gamme", brand: "Moncler", answer: 0 },
  { id: "sl-paris", brand: "Saint Laurent", answer: 0 },
  { id: "dior-hedi", brand: "Dior", answer: 0 },
  { id: "hermes-origin", brand: "Hermès", answer: 0 },
  { id: "lv-origin", brand: "Louis Vuitton", answer: 0 },
  { id: "lv-supreme", brand: "Louis Vuitton", answer: 0 },
  { id: "celine-accent", brand: "Celine", answer: 0 },
  { id: "celine-men", brand: "Celine", answer: 0 },
  { id: "versace-logo", brand: "Versace", answer: 0 },
  { id: "miyake-plisse", brand: "Issey Miyake", answer: 0 },
  { id: "miyake-jobs", brand: "Issey Miyake", answer: 0 },
  { id: "yohji-y3", brand: "Yohji Yamamoto", answer: 0 },
  { id: "visvim-fbt", brand: "visvim", answer: 0 },
  { id: "needles-logo", brand: "Needles", answer: 0 },
  { id: "evisu-pocket", brand: "Evisu", answer: 0 },
  { id: "momotaro-name", brand: "Momotaro Jeans", answer: 0 },
  { id: "momotaro-battle", brand: "Momotaro Jeans", answer: 0 },
  { id: "ironheart-heavy", brand: "Iron Heart", answer: 0 },
  { id: "ourlegacy-workshop", brand: "Our Legacy", answer: 0 },
  { id: "offwhite-laces", brand: "Off-White", answer: 0 },
  { id: "westwood-logo", brand: "Vivienne Westwood", answer: 0 },
  { id: "undercover-slogan", brand: "Undercover", answer: 0 },
  { id: "undercover-scab", brand: "Undercover", answer: 0 },
  { id: "jilsander-plusj", brand: "Jil Sander", answer: 0 },
  { id: "kenzo-tiger", brand: "Kenzo", answer: 0 },
  { id: "helmut-online", brand: "Helmut Lang", answer: 0 },
  { id: "vetements-dhl", brand: "Vetements", answer: 0 },
  { id: "sacai-hybrid", brand: "sacai", answer: 0 },
  { id: "junya-collab", brand: "Junya Watanabe", answer: 0 },
  { id: "auralee-fabric", brand: "AURALEE", answer: 0 },
  { id: "eg-bedford", brand: "Engineered Garments", answer: 0 },
];

const OK = ["좋습니다. 적어도 라벨만 보고 산 건 아니네요.", "정답입니다. 조금 의외였습니다."];
const NO = ["괜찮습니다. 입는 데 이걸 외울 필요는 없으니까요.", "아쉽네요. 옷은 그래도 잘 입으실 겁니다. 아마도요."];

export const QUIZ_TEXT: Record<string, QuizText> = {
  "margiela-men": {
    question: "마르지엘라 라벨에는 0부터 23까지 숫자가 적혀 있죠. 남성복 라인은 몇 번일까요?",
    options: ["1", "10", "14", "22"],
    correct: ["좋습니다. 적어도 흰 실밥 네 개만 보고 산 건 아니네요."],
    wrong: ["10번입니다. 괜찮습니다. 입는 데 번호를 외울 필요는 없으니까요."],
  },
  "margiela-tabi": {
    question: "앞코가 두 갈래로 갈라진 타비. 무엇에서 모양을 따왔을까요?",
    options: ["일본 전통 버선(타비)", "일본 나막신(게다)", "발레 토슈즈", "말발굽"],
    correct: ["맞습니다. 이름에 이미 답이 있었죠."],
    wrong: ["이름이 타비인데요. 괜찮습니다. 발가락은 기억할 겁니다."],
  },
  "margiela-gat": {
    question: "마르지엘라 레플리카 스니커즈 GAT. 원래 무엇을 본뜬 신발일까요?",
    options: ["독일군 훈련화", "미국 농구화", "영국 테니스화", "프랑스 해군 갑판화"],
    correct: ["정답입니다. German Army Trainer, 이름 그대로입니다."],
    wrong: ["독일군 훈련화입니다. GAT가 German Army Trainer의 줄임말이에요."],
  },
  "cdg-meaning": {
    question: "Comme des Garçons는 프랑스어로 무슨 뜻일까요?",
    options: ["소년들처럼", "소녀들을 위해", "친구들과 함께", "거리의 아이들"],
    correct: ["정답입니다. 라벨을 꽤 오래 들여다보셨군요."],
    wrong: ["소년들처럼, 입니다. 프랑스어까지 할 필요는 없습니다."],
  },
  "cdg-play": {
    question: "꼼데가르송 PLAY 하트 로고에 달려 있는 것은?",
    options: ["눈", "날개", "왕관", "번개"],
    correct: ["정답입니다. 하트가 늘 쳐다보고 있었죠."],
    wrong: ["눈입니다. 매일 입으면서 하트랑 눈도 안 마주치셨군요."],
  },
  "rick-city": {
    question: "릭 오웬스가 파리로 옮기기 전, 브랜드를 처음 시작한 도시는 어디일까요?",
    options: ["로스앤젤레스", "뉴욕", "런던", "베를린"],
    correct: ["맞습니다. 햇빛 많은 도시에서 이렇게 어두운 옷이 나왔습니다."],
    wrong: ["의외죠. 답은 로스앤젤레스입니다. 햇빛 많은 곳이요."],
  },
  "rick-diffusion": {
    question: "데님과 저지를 중심으로 하는 릭 오웬스의 서브 라인은?",
    options: ["DRKSHDW", "Lilies", "Hun", "Performa"],
    correct: ["정답입니다. 모음 없이도 읽으셨군요."],
    wrong: ["DRKSHDW입니다. 모음이 없는 이름은 원래 헷갈립니다."],
  },
  "rick-ramones": {
    question: "릭 오웬스 스니커즈 중 록 밴드 이름에서 따온 것은?",
    options: ["Ramones", "Geobasket", "Mega Bumper", "Bozo Tractor"],
    correct: ["정답입니다. 펑크 밴드 이름을 신고 다니시는군요."],
    wrong: ["Ramones입니다. 나머지도 릭 신발이긴 한데, 밴드는 아닙니다."],
  },
  "acne-name": {
    question: "Acne는 무엇의 줄임말일까요?",
    options: ["Ambition to Create Novel Expression", "Associated Creative Network Europe", "Art, Culture, Nature, Energy", "Avant-garde Clothing from Nordic Europe"],
    correct: ["정답입니다. 여드름이라고 생각한 적 없다는 거죠."],
    wrong: ["괜찮습니다. 대부분은 여드름부터 떠올립니다."],
  },
  "thom-stripes": {
    question: "톰 브라운 옷 왼쪽 소매의 줄무늬는 몇 줄일까요?",
    options: ["2줄", "3줄", "4줄", "5줄"],
    correct: ["정답입니다. 세 줄이었으면 다른 브랜드였겠죠."],
    wrong: ["네 줄입니다. 매일 보면서 안 세 보셨군요."],
  },
  "thom-tab": {
    question: "톰 브라운 삼색 탭의 색 순서로 맞는 것은?",
    options: ["빨강·하양·파랑", "파랑·하양·빨강", "초록·하양·빨강", "검정·하양·빨강"],
    correct: OK,
    wrong: NO,
  },
  "thom-moncler": {
    question: "톰 브라운이 디자인했던 몽클레르의 남성 라인은?",
    options: ["감므 블루(Gamme Bleu)", "감므 루즈(Gamme Rouge)", "그르노블(Grenoble)", "지니어스(Genius)"],
    correct: ["정답입니다. 파란 라인이라 톰 브라운이 맞았습니다."],
    wrong: ["감므 블루입니다. 2009년부터 톰 브라운이 맡았던 남성 라인이에요."],
  },
  "balenciaga-bernie": {
    question: "뎀나 시절 발렌시아가 2017 가을·겨울 남성 컬렉션이 로고를 따라 해 화제가 된 것은?",
    options: ["버니 샌더스 선거 로고", "코카콜라 로고", "나사(NASA) 로고", "디즈니 로고"],
    correct: ["정답입니다. 아카이브도 챙겨 보셨군요."],
    wrong: ["버니 샌더스 선거 로고입니다. 옷 가격은 전혀 사회주의적이지 않았지만요."],
  },
  "prada-linea": {
    question: "프라다 스포츠 라인 '리네아 로사(Linea Rossa)'는 무슨 뜻일까요?",
    options: ["빨간 줄", "빨간 산", "로사의 라인", "빨간 장미"],
    correct: ["정답입니다. 그 빨간 줄 로고 말이죠."],
    wrong: ["빨간 줄입니다. 로고에 이미 그려져 있었습니다."],
  },
  "gucci-web": {
    question: "구찌 웹 스트라이프, 초록 사이 가운데 색은?",
    options: ["빨강", "파랑", "노랑", "하양"],
    correct: ["정답입니다. 초록 사이의 빨강이죠."],
    wrong: ["빨강입니다. 괜찮습니다. 너무 자주 봐서 오히려 안 보였을 겁니다."],
  },
  "gucci-tomford": {
    question: "1990년대 중반 구찌를 다시 뜨게 만든 크리에이티브 디렉터는?",
    options: ["톰 포드", "알레산드로 미켈레", "프리다 지아니니", "사바토 데 사르노"],
    correct: ["정답입니다. 90년대 구찌 아카이브의 주인공이죠."],
    wrong: ["톰 포드입니다. 나머지 분들은 그 뒤에 왔습니다."],
  },
  "loewe-paula": {
    question: "로에베가 매년 여름 내는 휴양지 라인 이름은?",
    options: ["파울라스 이비자(Paula's Ibiza)", "로에베 리비에라", "카프리 클럽", "마요르카 데이즈"],
    correct: ["정답입니다. 여름마다 이비자에 가시나 봅니다. 옷만이라도요."],
    wrong: ["파울라스 이비자입니다. 70년대 이비자의 옷가게 이름에서 왔습니다."],
  },
  "burberry-trench": {
    question: "버버리 트렌치코트의 '트렌치'는 원래 무슨 뜻일까요?",
    options: ["전쟁터의 참호", "기차 선로", "광산 갱도", "빗물 배수로"],
    correct: ["정답입니다. 1차 세계대전 참호에서 입던 코트죠."],
    wrong: ["참호입니다. 1차 세계대전 군인들이 입던 코트였어요."],
  },
  "moncler-name": {
    question: "몽클레르라는 이름은 어디서 왔을까요?",
    options: ["프랑스 알프스 마을 이름", "몽블랑 산", "창업자 이름", "프랑스어 '밝은 산'"],
    correct: ["정답입니다. 모네스티에 드 클레르몽, 줄여서 몽클레르죠."],
    wrong: ["마을 이름입니다. 모네스티에 드 클레르몽. 길어서 줄였습니다."],
  },
  "moncler-gamme": {
    question: "톰 브라운이 디자인했던 몽클레르의 남성 라인은?",
    options: ["감므 블루(Gamme Bleu)", "감므 루즈(Gamme Rouge)", "그르노블(Grenoble)", "지니어스(Genius)"],
    correct: ["정답입니다. 패딩에 네 줄이 들어가던 시절이죠."],
    wrong: ["감므 블루입니다. 2009년부터 톰 브라운이 맡았던 남성 라인이에요."],
  },
  "sl-paris": {
    question: "2012년 에디 슬리먼이 오면서 기성복 이름이 바뀌었습니다. 어떻게 바뀌었을까요?",
    options: ["생 로랑 파리(Saint Laurent Paris)", "YSL 옴므", "로랑 파리", "생 로랑 리브 고쉬"],
    correct: ["정답입니다. 그때 Yves를 뺀다고 꽤 시끄러웠죠."],
    wrong: ["생 로랑 파리입니다. Yves가 빠져서 꽤 시끄러웠습니다."],
  },
  "dior-hedi": {
    question: "2000년대 초 디올 옴므의 아주 가는 스키니 실루엣을 만든 디자이너는?",
    options: ["에디 슬리먼", "크리스 반 아쉐", "킴 존스", "라프 시몬스"],
    correct: ["정답입니다. 그 시절 바지는 지금 입으면 다리가 기억할 겁니다."],
    wrong: ["에디 슬리먼입니다. 그 시절 바지를 입어 보면 바로 기억나실 겁니다."],
  },
  "hermes-origin": {
    question: "1837년 에르메스가 처음 만든 것은?",
    options: ["말 안장과 마구", "여행 가방", "실크 스카프", "손목시계"],
    correct: ["정답입니다. 그래서 로고에 마차가 있죠."],
    wrong: ["말 장비였습니다. 로고의 마차가 힌트였어요."],
  },
  "lv-origin": {
    question: "루이 비통이 처음 이름을 알린 물건은?",
    options: ["여행용 트렁크", "구두", "향수", "넥타이"],
    correct: OK,
    wrong: ["여행용 트렁크입니다. 옷보다 짐이 먼저였어요."],
  },
  "lv-supreme": {
    question: "2017 가을·겨울 루이 비통 남성 컬렉션에서 함께한 브랜드는?",
    options: ["슈프림", "나이키", "오프화이트", "베이프"],
    correct: ["정답입니다. 줄 서던 그 시절을 기억하시는군요."],
    wrong: ["슈프림입니다. 매장 앞 줄이 꽤 길었죠."],
  },
  "celine-accent": {
    question: "2018년 셀린느 로고에서 사라진 것은?",
    options: ["첫 번째 e 위의 악센트", "마지막 마침표", "대문자 C", "로고 아래 밑줄"],
    correct: ["정답입니다. Céline에서 Celine이 됐죠."],
    wrong: ["악센트입니다. Céline에서 Celine으로요."],
  },
  "celine-men": {
    question: "2018년 셀린느에 와서 남성복을 처음 시작한 디자이너는?",
    options: ["에디 슬리먼", "피비 파일로", "마이클 라이더", "킴 존스"],
    correct: ["정답입니다. 셀린느 남성복의 시작이죠."],
    wrong: ["에디 슬리먼입니다. 그 전에는 셀린느에 남성복이 없었습니다."],
  },
  "versace-logo": {
    question: "베르사체 로고 속 얼굴은 누구일까요?",
    options: ["메두사", "아테나", "비너스", "헤라"],
    correct: OK,
    wrong: ["메두사입니다. 오래 쳐다보면 굳는다는 그분이요."],
  },
  "miyake-plisse": {
    question: "이세이 미야케의 남성 주름 라인 이름은?",
    options: ["옴므 플리세", "플리츠 플리즈", "바오바오", "에이포크"],
    correct: ["정답입니다. 플리츠 플리즈와 헷갈리기 쉬운데요."],
    wrong: ["옴므 플리세입니다. 주름이 많은 만큼 이름도 헷갈리죠."],
  },
  "miyake-jobs": {
    question: "스티브 잡스가 매일 입던 이세이 미야케 옷은?",
    options: ["검은 터틀넥", "회색 후드티", "흰 셔츠", "남색 니트 조끼"],
    correct: ["정답입니다. 매일 같은 옷의 원조죠. 어디서 많이 본 방식이네요."],
    wrong: ["검은 터틀넥입니다. 같은 옷을 매일 입는 게 전설이 되기도 합니다."],
  },
  "yohji-y3": {
    question: "요지 야마모토가 아디다스와 함께하는 라인은?",
    options: ["Y-3", "Y's", "Ground Y", "S'YTE"],
    correct: OK,
    wrong: ["Y-3입니다. Y가 들어간 라인이 너무 많긴 하죠."],
  },
  "visvim-fbt": {
    question: "비즈빔 FBT 모카신의 이름은 어느 밴드에서 왔을까요?",
    options: ["Fun Boy Three", "Fine Young Cannibals", "Frankie Goes to Hollywood", "Flock of Seagulls"],
    correct: ["정답입니다. 신발 이름까지 챙기시는군요."],
    wrong: ["Fun Boy Three입니다. 앨범 사진 속 신발이 시작이었죠."],
  },
  "needles-logo": {
    question: "니들스 로고의 모티브는?",
    options: ["나비", "나방", "잠자리", "벌"],
    correct: OK,
    wrong: ["나비입니다. 트랙팬츠에 수놓인 그거요."],
  },
  "evisu-pocket": {
    question: "에비수 청바지 뒷주머니에 그려진 것은?",
    options: ["갈매기", "파도", "후지산", "벚꽃"],
    correct: OK,
    wrong: ["갈매기입니다. 뒷주머니를 너무 안 보셨네요."],
  },
  "momotaro-name": {
    question: "모모타로 진스라는 이름은 어디서 왔을까요?",
    options: ["일본 옛이야기의 복숭아 소년", "창업자 이름", "오카야마의 강 이름", "복숭아 품종"],
    correct: ["정답입니다. 오카야마의 영웅이죠."],
    wrong: ["옛이야기 속 복숭아 소년입니다. 오카야마의 상징이에요."],
  },
  "momotaro-battle": {
    question: "모모타로 진스 뒷주머니에 두 줄 무늬가 칠해진 라인의 이름은?",
    options: ["출진(Going to Battle)", "개선(Coming Home)", "승리(Victory)", "평화(Peace)"],
    correct: ["정답입니다. 청바지 입고 전쟁에 나가시는군요."],
    wrong: ["출진입니다. 이름은 비장한데 입는 곳은 대개 출근길이죠."],
  },
  "ironheart-heavy": {
    question: "아이언하트 청바지가 유명한 이유는?",
    options: ["아주 두껍고 무거운 데님", "잘 늘어나는 스판 데님", "찢어진 가공", "형광색 스티치"],
    correct: ["정답입니다. 여름에 입으면 후회하는 그 무게죠."],
    wrong: ["아주 두껍고 무거운 데님입니다. 한 번 입어 보면 무게로 기억합니다."],
  },
  "ourlegacy-workshop": {
    question: "아워레가시 '워크숍(Work Shop)' 라인은 주로 무엇으로 옷을 만들까요?",
    options: ["남은 원단과 재고", "재활용 플라스틱", "100% 새 캐시미어", "빈티지 군복"],
    correct: ["정답입니다. 남은 원단으로 만든 옷을 새 옷 값에 사셨죠."],
    wrong: ["남은 원단과 재고입니다. 친환경인데 가격은 친절하지 않죠."],
  },
  "offwhite-laces": {
    question: "오프화이트 신발끈에 적힌 글자는?",
    options: ["\"SHOELACES\"", "\"FOR WALKING\"", "\"LACE\"", "\"TIE ME\""],
    correct: ["정답입니다. 신발끈에 신발끈이라고 적혀 있죠."],
    wrong: ["\"SHOELACES\"입니다. 신발끈에 신발끈이라고요."],
  },
  "westwood-logo": {
    question: "비비안 웨스트우드 로고의 모양은?",
    options: ["토성 고리를 두른 보주", "왕관과 사자", "방패와 장미", "해골과 왕관"],
    correct: OK,
    wrong: ["토성 고리를 두른 보주입니다. 왕실과 우주를 합쳤죠."],
  },
  "undercover-slogan": {
    question: "언더커버의 유명한 슬로건은?",
    options: ["We make noise not clothes", "Clothes make the man", "Noise is the new silence", "Fashion is dead"],
    correct: OK,
    wrong: ["We make noise not clothes입니다. 옷이 아니라 소음을 만든다고요."],
  },
  "undercover-scab": {
    question: "언더커버가 파리에서 처음 보여 준 2003 봄·여름 컬렉션, 누더기 같은 패치워크로 유명한 그 시즌 이름은?",
    options: ["Scab", "Arts & Crafts", "Melting Pot", "Joyful"],
    correct: ["정답입니다. 아카이브 가격을 알면 조금 슬퍼지는 시즌이죠."],
    wrong: ["Scab입니다. 지금은 조각 하나에도 꽤 비싼 값이 붙습니다."],
  },
  "jilsander-plusj": {
    question: "질 샌더가 유니클로와 함께한 라인 이름은?",
    options: ["+J", "J+", "U×J", "JS Basic"],
    correct: ["정답입니다. 오픈런 하셨던 분이군요."],
    wrong: ["+J입니다. 매장 앞 줄이 꽤 길었죠."],
  },
  "kenzo-tiger": {
    question: "겐조 스웨트셔츠에 크게 들어가 유행했던 동물은?",
    options: ["호랑이", "사자", "표범", "늑대"],
    correct: ["정답입니다. 한때 거리에 호랑이가 꽤 많았죠."],
    wrong: ["호랑이입니다. 한때 거리에 호랑이가 넘쳐났습니다."],
  },
  "helmut-online": {
    question: "헬무트 랭이 1998년 컬렉션을 패션쇼 대신 처음 공개한 곳은?",
    options: ["인터넷", "TV 홈쇼핑", "잡지 부록", "라디오"],
    correct: ["정답입니다. 인터넷 쇼를 처음 한 디자이너죠."],
    wrong: ["인터넷입니다. 그때는 꽤 파격적이었습니다."],
  },
  "vetements-dhl": {
    question: "베트멍 2016 봄·여름에 회사 로고를 그대로 가져와 화제가 된 티셔츠는?",
    options: ["DHL", "FedEx", "UPS", "TNT"],
    correct: ["정답입니다. 택배 회사 티셔츠를 그 값에 파는 것도 재능입니다."],
    wrong: ["DHL입니다. 노란 택배 회사 티셔츠가 그렇게 비쌌습니다."],
  },
  "sacai-hybrid": {
    question: "사카이 옷의 가장 유명한 특징은?",
    options: ["서로 다른 옷을 이어 붙인 하이브리드", "모든 옷이 흰색", "큰 로고", "봉제선 없는 니트"],
    correct: ["정답입니다. 옷 두 벌 값을 한 벌로 내는 방식이죠."],
    wrong: ["서로 다른 옷을 이어 붙인 하이브리드입니다. 한 벌 안에 두 벌이 있습니다."],
  },
  "junya-collab": {
    question: "준야 와타나베 맨이 유독 자주 하는 것은?",
    options: ["다른 브랜드와 협업", "매 시즌 같은 옷 재발매", "로고 크게 넣기", "여성복만 만들기"],
    correct: ["정답입니다. 협업 태그가 두 개 붙은 옷이 많죠."],
    wrong: ["다른 브랜드와 협업입니다. 라벨이 두 개 붙은 옷이 많아요."],
  },
  "auralee-fabric": {
    question: "오라리가 다른 브랜드와 가장 다르게 내세우는 점은?",
    options: ["원단을 실부터 직접 개발함", "모든 옷에 큰 로고를 넣음", "매주 신상품을 냄", "오버사이즈 핏만 만듦"],
    correct: ["정답입니다. 그래서 무지 티셔츠 값이 그렇죠."],
    wrong: ["원단을 직접 개발하는 겁니다. 무지 티셔츠가 그 값인 이유죠."],
  },
  "eg-bedford": {
    question: "엔지니어드 가먼츠의 대표 재킷 이름은?",
    options: ["베드포드 재킷", "맨해튼 재킷", "소호 재킷", "브루클린 재킷"],
    correct: ["정답입니다. 주머니가 몇 개인지도 아시나요."],
    wrong: ["베드포드 재킷입니다. 주머니가 많은 그 재킷이요."],
  },
};

export interface PickedQuiz extends QuizText {
  id: string;
  answer: number;
}

/** 가진 브랜드(명품·디자이너·일본 데님)의 문제에서만 고른다. 없으면 퀴즈를 내지 않는다. */
export function pickQuiz(a: Analysis, r: Rng, T: RoastTexts): PickedQuiz | null {
  const owned = new Set(a.quizBrands.map((b) => b.name));
  const mine = QUIZ.filter((q) => owned.has(q.brand) && T.quiz[q.id]);
  if (!mine.length) return null;
  const q = r.pick(mine);
  return { ...T.quiz[q.id], id: q.id, answer: q.answer };
}

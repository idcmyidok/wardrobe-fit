import { FEATURES } from "./features";

/**
 * 업데이트 노트(사용자 메뉴 → 업데이트 노트). 최신 버전을 맨 위에 둔다.
 *
 * 버전 규칙(package.json version과 맨 위 노트가 같아야 한다):
 * - 신규 기능이 생기면 가운데 자리(1.1.0 → 1.2.0)
 * - 한 흐름의 변경·수정이면 끝자리(1.1.0 → 1.1.1)
 * - 크게 바뀌면 첫째 자리(2.0.0)를 올리고, 화면에서 "1.x", "2.x" 탭으로 나뉜다.
 * - features: 새로 생긴 기능. 한 줄 제목(무엇이 생겼는지) + 자세한 설명
 * - changes: 바뀐 내용
 * - fixes: 고친 문제(소제목 없이 한 줄씩)
 * - date·time: 노트를 처음 작성한 날짜와 시각(한국시간). 나중에 내용을 고쳐도 바꾸지 않는다.
 *   새 노트를 넣을 때 `TZ=Asia/Seoul date +"%Y-%m-%d %H:%M"`로 확인해 둘 다 적는다.
 * - 톤: 일반 사용자에게 말하듯 "~합니다" 체로, 어떤 버튼을 어디서 누르면 무엇이 보이는지 적고 개발 용어는 피한다.
 */
export interface ReleaseFeature {
  title: string;
  description: string;
  /** 숨긴 기능이면 그 기능 켜기 이름(src/lib/features.ts). 꺼져 있으면 노트에 보이지 않는다. */
  feature?: keyof typeof FEATURES;
}

export interface ReleaseNote {
  version: string;
  /** YYYY-MM-DD, 한국시간 */
  date: string;
  /** HH:mm, 한국시간. 처음 작성한 시각(고쳐도 그대로). 기록이 없는 옛 노트(1.0.0·1.1.0)는 비어 있다. */
  time?: string;
  features: ReleaseFeature[];
  changes: string[];
  fixes: string[];
}

const ALL_NOTES: ReleaseNote[] = [
  {
    version: "1.3.2",
    date: "2026-10-01",
    time: "05:03",
    features: [],
    changes: [
      "훈수와 옷장 데이터가 아는 브랜드가 8곳 늘었습니다. 중고 거래에서 많이 찾는 카키스·버드노트·올드조·아킴보 클럽·에피센터 투어리스트·아드리안 캐시미어·카미야·리버풀을 더해, 내 옷장의 브랜드를 더 정확히 알아봅니다.",
    ],
    fixes: [],
  },
  {
    version: "1.3.1",
    date: "2026-09-30",
    time: "21:28",
    features: [
      {
        title: "링크는 한 번에 여러 개",
        description: "\"새 옷 추가\"에서 상품 링크를 최대 5개까지 한 번에 붙여 넣을 수 있습니다. 옷마다 정보가 차례로 채워지고, 확인한 뒤 한 번에 옷장에 등록됩니다.",
      },
      {
        title: "입으면 이 정도 길이",
        description: "구매 판단기 결과의 길이감 아래에, 내 키에 맞춘 사람 그림 위로 그 옷의 총장을 겹쳐 보여 줍니다. 옷이 어디까지 내려오는지 한눈에 보입니다.",
      },
      {
        title: "주문내역만 보고 훈수",
        description:
          "무신사 주문내역을 붙여 넣기만 하면 그 주문만 보고 훈수를 둡니다. 하트가 많은 랭킹템을 얼마나 샀는지, 무신사 스탠다드나 한 브랜드에 얼마나 쏠렸는지, 반품·취소 습관, 예전과 요즘 주문의 변화까지 짚고 100점 만점 점수를 매깁니다. 붙여 넣은 주문내역은 저장하지 않습니다.",
        feature: "orderRoastMenu",
      },
      {
        title: "옷장 성적표 나왔습니다",
        description:
          "내 옷장 훈수의 결과가 한 편의 글로 바뀌었습니다. 맨 위에 100점 만점 점수와 한 줄 평가, 옷장을 한 문장으로 정리한 요약이 나오고, 많이 가진 옷·좋아하는 브랜드, 컬러·핏·지갑 사정 이야기가 이어집니다.",
      },
    ],
    changes: [
      "무신사 주문 가져오기는 하루에 500건까지 가져올 수 있고, 링크로 옷을 넣을 때의 횟수와 따로 셉니다. 주문 가져오기 화면에서는 남은 횟수 대신 \"하루에 너무 많이 가져오면 일시적으로 막힐 수 있어요\" 안내만 보입니다.",
      "내 옷장 훈수 대화가 더 사람처럼 흘러갑니다. 글자가 한 자씩 찍히고, 질문은 관련된 분석 이야기 바로 뒤에 나오며, \"스스로 패셔너블한가요?\" 질문은 늘 마지막에 나옵니다. 옷 사진이 많으면 스크롤바 대신 양옆 화살표로 넘겨 봅니다.",
      "훈수 질문과 퀴즈가 늘었습니다. 가진 브랜드의 패션 퀴즈(Cactus Jack·Yeezy 같은 힙합 아티스트 브랜드 포함), 밴드 티셔츠가 있으면 밴드 노래 퀴즈, 언더아머가 있으면 \"3대 500인가요?\"까지 나옵니다.",
      "훈수를 시작할 때 \"어떤 기준으로 평가하나요?\" 버튼으로 점수 기준을 볼 수 있고, 이름과 나이(한국식 나이)를 적으면 결과에 반영됩니다.",
      "훈수와 옷장 데이터가 아는 브랜드가 1,600곳을 넘었습니다. 크림·하이츠스토어 같은 편집숍의 스트릿·스케이트 브랜드와 국내 브랜드를 새로 조사해 더 정확히 봅니다.",
      "바지의 예상 핏은 허리를 빼고 판단합니다. 허리가 늘어나는 바지는 실측이 작게 나와 핏이 잘못 보일 수 있어서입니다.",
      "훈수와 옷장 데이터가 아는 브랜드가 3,500곳을 넘었습니다. 무신사에서 좋아요가 많은 브랜드를 새로 더해, 내 옷장의 브랜드를 더 많이 알아보고 더 정확히 봅니다.",
      "내 옷장 훈수 결과에서 구매 시기별 변화도 짚어 줍니다. 구매일을 적은 옷을 반기별로 묶어, 예전과 요즘 주로 사는 스타일이 달라졌거나 스타일은 같은데 가격대만 달라졌으면 한 줄 이야기해 줍니다.",
      "내 옷장 훈수의 \"무신사 취향\" 판단에 무신사 좋아요가 많은 브랜드도 함께 봅니다.",
      "하이츠스토어·니어서울에 입점한 브랜드 정보를 브랜드마다 다시 조사해 고쳤습니다. 훈수가 스타일과 가격대를 더 정확히 짚습니다.",
      "내 옷장 훈수에서 데님 팬츠 사진이 모두 보이고, 같은 데님이 중복으로 세어지지 않으며, 대중 브랜드와 뚜렷한 스타일을 판단하는 기준이 더 자연스러워졌습니다.",
    ],
    fixes: ["훈수 대화가 이어지는 동안 화면이 맨 아래까지 따라 내려가지 않던 문제를 고쳤습니다."],
  },
  {
    version: "1.3.0",
    date: "2026-09-30",
    time: "00:58",
    features: [
      {
        title: "옷장이 한마디 합니다",
        description:
          "위 메뉴에 \"내 옷장 훈수\"가 생겼습니다. 옷이 10벌 이상이면 \"시작하기\"를 누르고, 불릴 이름을 적으면 옷장을 둘러보며 색깔·브랜드·가격·종류에서 눈에 띄는 버릇을 짚어 줍니다. 중간중간 질문에 답하고, 가진 브랜드에 관한 패션 퀴즈도 풀 수 있습니다. 끝나면 옷장에 대한 짧고 솔직한 훈수 글을 보여 줍니다. AI가 다듬어 주는 결과는 하루 3번까지이고, 그 뒤에는 기본 문장으로 만들어 드립니다.",
      },
    ],
    changes: [
      "위 메뉴 이름이 바뀌었습니다. \"AI 구매 판단기\"는 \"구매 판단기\", \"옷장 분석\"은 \"옷장 데이터\"로 보입니다.",
      "구매 판단기 아래 구매 보류 옷 표가 내 옷장 표와 같은 폭으로 넓어져, 옆으로 밀지 않아도 다 보입니다.",
    ],
    fixes: [],
  },
  {
    version: "1.2.6",
    date: "2026-09-29",
    time: "19:09",
    features: [
      {
        title: "살까 말까, 일단 찜",
        description:
          "AI 구매 판단기 화면 맨 아래에 \"구매 보류 옷\" 목록이 생겼습니다. 판단 결과 아래 \"구매 보류 옷에 추가\"(VS 비교는 표의 옷마다 \"보류에 추가\")를 누르면 고른 사이즈의 실측·가격·사진이 담기고, \"+ 구매 보류 옷 추가\"로 링크나 직접 입력으로도 담을 수 있습니다. 옷장과는 따로 모여서 옷장 분석이나 구매 판단 비교에는 섞이지 않습니다.",
      },
      {
        title: "샀으면 옷장으로",
        description:
          "구매 보류 옷을 누르면 옷장 옷처럼 정보를 보고 고칠 수 있습니다. 실제로 샀다면 아래 \"구매했어요 → 옷장으로\"를 눌러 구매일·시즌·실제 구매가를 넣고 등록하면 옷장으로 옮겨집니다. 판단기에서 담은 옷은 \"판단 결과 보기\"로 그때 결과를 다시 볼 수 있습니다.",
      },
      {
        title: "직구도 달러로",
        description:
          "옷을 추가하거나 고칠 때 가격 칸 옆 \"$\"를 누르면 달러로 기록됩니다(기본은 원). 표에는 \"$49.99\"와 함께 원으로 바꾼 금액이 작게 나오고, 가격 정렬과 옷장 분석 금액도 원으로 바꿔 함께 계산합니다.",
      },
    ],
    changes: [
      "구매 판단 결과의 \"구매가, 구매일, 링크는 AI에 보내지 않습니다\" 안내가 두 버튼 아래 줄로 옮겨졌습니다.",
      "내 치수에서 몸무게 칸이 없어졌습니다. 계산에 쓰지 않던 값이라 저장된 몸무게도 지웁니다.",
      "내 치수에 입력한 신체치수는 이제 암호화해서 저장합니다. 화면에서 보고 고치는 방법은 그대로입니다.",
      "해외 쇼핑몰 링크에서 달러 가격을 읽으면 비워 두지 않고 달러로 채웁니다.",
    ],
    fixes: [],
  },
  {
    version: "1.2.5",
    date: "2026-09-29",
    time: "16:00",
    features: [
      {
        title: "기장도 봐드립니다",
        description:
          "내 치수에 키를 입력하면, 옷 정보와 구매 판단 결과의 핏 아래에 \"길이감\"이 나옵니다. 티셔츠·맨투맨 같은 이너와 아우터의 총장이 내 키에 비해 크롭·세미크롭·정핏·세미오버·오버핏 중 어디인지 알려 줍니다. 셔츠·블레이저·코트·롱패딩과 바지는 길이 취향이 달라 보지 않습니다.",
      },
      {
        title: "총장도 추천해 드려요",
        description:
          "내 치수 화면의 \"옷 종류별 추천 실측\"에서 반팔·긴팔·니트, 바람막이·레더·패딩 탭을 누르면 표 옆(모바일은 바로 아래)에 내 키에 맞춘 총장이 함께 나옵니다. \"이 옷 종류 수정\"으로 총장도 같이 고칠 수 있고, 고친 값은 길이감 판정에도 그대로 쓰입니다.",
      },
    ],
    changes: [
      "옷 정보의 예상 핏에서 부위별 판단 근거가 기본으로 접혀 있습니다. \"판단 근거 보기\"를 누르면 펼쳐집니다.",
      "내 치수 화면에서 신체치수를 한 번 저장하면 입력 칸이 접히고 한 줄 요약만 보입니다. 고치려면 \"수정하기\"를 눌러 주세요.",
      "\"내 치수 삭제\"는 따로 있던 항목 대신 \"수정하기\" 버튼 아래의 작은 글자로 옮겼습니다.",
      "신체치수 입력 칸 사이 간격을 줄여 화면이 덜 길어졌습니다.",
      "추천 실측에 \"롱패딩\" 탭을 따로 만들었습니다. 롱패딩은 총장이 취향이라 길이감은 보지 않습니다.",
      "키 입력 칸 안내가 \"총장 길이감 계산에 씁니다\"로 바뀌었습니다.",
    ],
    fixes: [],
  },
  {
    version: "1.2.4",
    date: "2026-09-29",
    time: "13:57",
    features: [],
    changes: [
      "주문내역 가져오기 화면에서 이미 내 옷장에 있는 옷(같은 상품, 같은 사이즈)은 \"이미 옷장에 있어요\"라고 표시되고 자동으로 제외됩니다. 그래도 추가하려면 그 옷의 체크박스를 눌러 주세요.",
      "아이폰 사파리 안내를 최신 화면에 맞게 고쳤습니다. 북마크는 주소창에 입력하지 않고, 북마크 목록에서 눌러야 실행됩니다.",
      "주문내역 가져오기 안내 3단계의 musinsa.com을 누르면 무신사가 바로 열립니다.",
      "주문내역으로 추가하는 버튼 아래에 개인정보를 수집하지 않는다는 안내를 넣었습니다.",
      "업데이트 노트의 각 버전 옆에 처음 작성한 날짜와 시각(한국시간)이 함께 표시됩니다.",
    ],
    fixes: ["업데이트 노트를 열면 수정 전 내용이 잠깐 보였다가 바뀌던 문제"],
  },
  {
    version: "1.2.3",
    date: "2026-09-29",
    time: "12:45",
    features: [
      {
        title: "언제 하나하나 지우고 앉아있어",
        description:
          "내 옷장의 \"옷 삭제\"를 누르면 간략하게 목록에 체크박스가 생깁니다. 지울 옷을 고르고 오른쪽 아래 \"선택 삭제하기\"를 누르면 한 번에 삭제되고, 5초 안에는 실행 취소할 수 있습니다.",
      },
      {
        title: "모바일도 무신사랑해",
        description: "이제 모바일 환경에서도 무신사 주문내역을 가져올 수 있습니다.",
      },
    ],
    changes: [
      "주문내역 가져오기 안내가 접속한 기기(PC·휴대폰)에 맞는 방법 하나만 보여줍니다.",
      "내 옷장의 세부분류·브랜드·시즌·컬러 필터는 검색창 옆 \"필터\"를 눌러 펼쳐야 나옵니다.",
    ],
    fixes: [],
  },
  {
    version: "1.2.2",
    date: "2026-09-29",
    time: "12:24",
    features: [],
    changes: ["업데이트 노트의 수정사항은 접혀 있고, 눌러서 펼쳐 볼 수 있어요."],
    fixes: [],
  },
  {
    version: "1.2.1",
    date: "2026-09-29",
    time: "02:36",
    features: [],
    changes: [
      "주문내역으로 추가하는 화면에 지원 쇼핑몰과 하루 분석 횟수, 많은 옷을 한꺼번에 넣을 때의 안내를 넣었어요.",
      "새 옷 추가 화면의 주문내역 추가를 아래쪽 버튼으로 옮겼어요.",
      "주문내역으로 옷을 모두 넣으면 완료를 알려 주고 내 옷장으로 이동해요.",
      "개인정보처리방침·이용약관 링크가 항상 화면 맨 아래에 있어요.",
    ],
    fixes: ["주문내역으로 넣은 옷의 브랜드와 제품명이 뒤바뀌어 저장되던 문제"],
  },
  {
    version: "1.2.0",
    date: "2026-09-29",
    time: "02:04",
    features: [
      {
        title: "무신사 주문내역으로 여러 벌 추가",
        description:
          "무신사 주문내역을 붙여 넣으면 구매 확정된 옷·신발·모자만 골라 상품 사진과 실측을 찾아 줍니다. 2팩·셋업은 한 벌씩 나누고, 한 벌씩 확인한 뒤 고른 옷만 옷장에 넣어요.",
      },
    ],
    changes: ["상품 링크 분석을 하루 100번까지 할 수 있어요."],
    fixes: [],
  },
  {
    version: "1.1.0",
    date: "2026-09-28",
    features: [
      {
        title: "내 치수",
        description: "신체치수를 저장하면 옷 종류·핏별로 추천 실측을 알려 줍니다. 추천 범위는 직접 고쳐서 쓸 수도 있어요.",
      },
      {
        title: "예상 핏 표시",
        description: "옷장 표와 구매 판단 결과에 내 몸 대비 핏을 6단계 미터기로 보여 줍니다. 입어 본 옷에는 \"내 핏\"을 직접 표기할 수 있어요.",
      },
      {
        title: "모자·신발 카테고리",
        description: "모자와 신발을 따로 등록하고, 구매 판단(핏체크)도 할 수 있어요. 신발은 가진 신발의 사이즈·착용감으로 평소 사이즈를 알려 줍니다.",
      },
      {
        title: "구매 판단 VS 비교",
        description: "사려는 옷 링크 2~3개를 나란히 비교해 핏 점수와 추천 순위를 보여 줍니다.",
      },
      {
        title: "옷장 간략하게/자세하게 보기",
        description: "사진·요약 목록과 실측까지 보이는 표를 전환할 수 있어요. 모바일은 간략하게, PC는 자세하게가 기본입니다.",
      },
      {
        title: "옷장 대분류 표 접기",
        description: "아우터·상의·하의 등 대분류 제목 옆 화살표로 표를 접고 펼칠 수 있어요.",
      },
      {
        title: "옷 사진 크게 보기",
        description: "옷 정보에서 사진을 누르면 화면 가득 크게 보여 줍니다.",
      },
      {
        title: "업데이트 노트",
        description: "사용자 메뉴에서 버전별 새 기능과 바뀐 점을 확인할 수 있어요.",
      },
    ],
    changes: [
      "세부분류를 무신사 기준으로 전면 개편, 셔츠/블라우스를 아우터로 이동",
      "예상 핏 판정을 옷 종류별 기준으로 새로 정리(가슴·어깨, 엉덩이·허벅지를 부위별로 판정한 뒤 종합)",
      "허리는 핏 단계와 관계없이 작음·적정·너무 큼으로만 판정",
      "\"내 핏\" 표기로 예상 핏 기준이 옮겨지던 보정 삭제",
      "구매 판단 결과에 핏 4종류별 점수, 안 맞는 치수, 내 치수와의 비교 근거 추가",
      "구매 판단 비교 목록에 세부분류 표시, 같은 세부분류 옷만 자동 체크",
      "옷장 표 사이즈 정렬을 알파벳순에서 S/M/L 순으로 변경",
      "옷장 표 시즌 정렬 삭제(시즌은 필터로만 분류)",
      "옷장 표 열 이름 \"예상핏\" → \"핏\", 직접 평가 표시 방식 정리",
      "옷장 분석 기준을 전체 누적 금액에서 최근 6개월 평균 소비로 변경, 6개월 이내 구매액 추가 표시",
      "월별 구매 그래프를 누르면 그 달 상세 정보 표시, 구매 없는 달은 생략",
      "브랜드 분석 10위까지 표시 + 더보기",
      "모바일 옷장 목록에 구매가 표시, 사진이 잘리지 않게 표시",
      "옷 정보 삭제 버튼을 빨간색으로 강조",
      "어깨너비 재는 법 안내를 직선 측정 기준으로 변경",
      "사이트 아이콘 변경",
    ],
    fixes: [
      "구매 판단 AI 설명이 항상 실패하던 문제(Gemini 응답 잘림)",
      "옷 총장·소매는 핏 판정에서 제외(길이는 별도 비교만 제공)",
      "사용하지 않는 팔길이·다리길이 입력 항목 삭제",
      "구매가 안내 문구를 한 줄로 축소",
      "모바일에서 월별 구매 그래프가 뻑뻑하게 넘어가던 문제",
      "옷 정보의 상품 링크가 눌리지 않던 문제",
      "추천 실측 표에서 옷 종류를 바꾸면 칸 위치가 달라지던 문제",
      "하단 개인정보처리방침 줄 정렬(모바일 가운데, PC 왼쪽)",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-27",
    features: [
      {
        title: "옷장 관리",
        description: "옷을 등록·수정·삭제하고, 브랜드·사이즈·실측 등 상세 정보를 기록합니다.",
      },
      {
        title: "링크로 옷 가져오기",
        description: "쇼핑몰 상품 링크만 붙여넣으면 상품 정보와 실측을 자동으로 채워 줍니다.",
      },
      {
        title: "AI 핏체크(구매 판단)",
        description: "사려는 옷을 가진 옷과 비교해 사이즈를 추천합니다. 규칙 기반 판정은 무료이고, AI가 결과를 요약해 줍니다.",
      },
      {
        title: "옷장 분석",
        description: "구매 금액, 브랜드, 색상 등 가진 옷의 통계를 보여 줍니다.",
      },
      {
        title: "회원가입·로그인",
        description: "이메일로 가입하고 로그인하며, 로그인 상태를 유지할 수 있어요.",
      },
    ],
    changes: [],
    fixes: [],
  },
];

/** 지금 버전(맨 위 노트) */
/** 화면에 보이는 노트: 꺼 둔 기능의 문장은 뺀다 */
export const RELEASE_NOTES: ReleaseNote[] = ALL_NOTES.map((n) => ({ ...n, features: n.features.filter((f) => !f.feature || FEATURES[f.feature]) }));

export const CURRENT_VERSION = RELEASE_NOTES[0]?.version ?? "";

/** "1.1.0" → "1" */
export const majorOf = (version: string) => version.split(".")[0];

/** 첫째 자리별로 묶는다. 최신 묶음이 먼저 */
export function groupByMajor(notes: ReleaseNote[] = RELEASE_NOTES): { major: string; notes: ReleaseNote[] }[] {
  const groups: { major: string; notes: ReleaseNote[] }[] = [];
  for (const note of notes) {
    const major = majorOf(note.version);
    const group = groups.find((g) => g.major === major);
    if (group) group.notes.push(note);
    else groups.push({ major, notes: [note] });
  }
  return groups;
}

/**
 * 관리자가 화면에서 고친 노트. DB(release_note_edits.body)에 신규 기능·변경 내용·수정사항을 JSON으로 저장하고,
 * 있으면 코드의 노트 대신 같은 모양으로 보여 준다. 버전과 날짜는 코드의 노트를 따른다.
 */
export type ReleaseNoteContent = Pick<ReleaseNote, "features" | "changes" | "fixes">;
export type ReleaseNoteEdits = Record<string, ReleaseNoteContent>;

/** 수정 칸 세 개의 글. 한 줄이 한 항목이고, 신규 기능은 "제목: 설명"으로 쓴다. */
export interface ReleaseNoteDraft {
  features: string;
  changes: string;
  fixes: string;
}

export const RELEASE_NOTE_BODY_MAX = 20000;

export function noteToDraft(note: ReleaseNoteContent): ReleaseNoteDraft {
  return {
    features: note.features.map((f) => (f.description ? `${f.title}: ${f.description}` : f.title)).join("\n"),
    changes: note.changes.join("\n"),
    fixes: note.fixes.join("\n"),
  };
}

/** 줄마다 앞의 "-", "·", "•"와 빈칸을 떼고, 빈 줄은 버린다. */
const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-·•]\s*/, "").trim())
    .filter(Boolean);

/** 신규 기능 줄 "제목: 설명"을 나눈다. ":"가 없으면 제목만 있는 것으로 본다. */
export function splitFeatureLine(line: string): ReleaseFeature {
  const at = line.indexOf(":");
  if (at < 0) return { title: line.trim(), description: "" };
  return { title: line.slice(0, at).trim(), description: line.slice(at + 1).trim() };
}

export function draftToContent(draft: ReleaseNoteDraft): ReleaseNoteContent {
  return { features: lines(draft.features).map(splitFeatureLine), changes: lines(draft.changes), fixes: lines(draft.fixes) };
}

/** DB에 저장된 글을 읽는다. 모양이 맞지 않으면 null(코드의 노트를 보여 준다). */
export function parseEditBody(body: string): ReleaseNoteContent | null {
  try {
    const v = JSON.parse(body) as Partial<ReleaseNoteContent>;
    const strs = (a: unknown): a is string[] => Array.isArray(a) && a.every((x) => typeof x === "string");
    const feats = (a: unknown): a is ReleaseFeature[] =>
      Array.isArray(a) && a.every((x) => x && typeof x.title === "string" && typeof x.description === "string");
    if (!feats(v.features) || !strs(v.changes) || !strs(v.fixes)) return null;
    return { features: v.features, changes: v.changes, fixes: v.fixes };
  } catch {
    return null;
  }
}

/** 버전 → 그 노트에 넣은 사진 주소(관리자가 넣는다) */
export type ReleaseNoteImages = Record<string, string>;

/** 노트 사진을 담는 Storage bucket(공개 읽기, 관리자만 쓰기) */
export const RELEASE_NOTE_IMAGE_BUCKET = "release-note-images";

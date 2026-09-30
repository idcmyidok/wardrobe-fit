/**
 * AI 옷장 분석(/roast)에서 서버와 화면이 주고받는 모양. 분석·문구는 서버에서 만들고 화면은 순서대로 재생만 한다.
 * 사진은 옷 id로만 주고, 화면이 옷장 목록(또는 결과에 저장한 사진 주소)에서 찾아 보여 준다.
 */

export interface RoastOption {
  id: string;
  label: string;
  /** 브랜드 버리기: 대표 사진 옷 id */
  photoId?: string;
  /** 선택지 칸에 한 줄로 늘어놓는 사진(칸을 넘는 사진은 보이지 않는다) */
  photoIds?: string[];
  /** 고른 뒤 칸의 빈자리에 보여 주는 금액(브랜드 총액·옷 가격, "N ￦") */
  amount?: string;
}

/** 답한 뒤 반응과 함께 보여 주는 옷 사진과 그 옷 가격 */
export interface RoastPriced {
  id: string;
  amount: string;
}

export interface RoastQuestion {
  id: string;
  lead: string[];
  text: string;
  options: RoastOption[];
  /** 선택지 id별 즉시 반응 */
  reactions: Record<string, string>;
  photos: string[];
  /** 앞 멘트 번호별로 붙일 사진(패션 퀴즈: 그 브랜드 옷) */
  leadPhotos?: Record<number, string[]>;
  /** 패션 퀴즈 정답 선택지 id(틀렸을 때 정답을 표시) */
  answer?: string;
  /** 답한 뒤 반응 아래에 붙이는 옷 사진과 가격("~에 쓴 돈, 알고 있었나요?") */
  reveal?: RoastPriced[];
}

export type RoastStep =
  | { t: "status"; text: string }
  /** gap: 앞 이야기와 끊어서 보여 준다(섹션 사이 혼잣말) */
  | { t: "say"; text: string; photos?: string[]; gap?: boolean }
  | { t: "think" }
  | { t: "ask"; q: number };

export interface RoastScript {
  /** 같은 분석을 서버에서 다시 만들 때 쓰는 값 */
  seed: number;
  steps: RoastStep[];
  questions: RoastQuestion[];
}

export interface RoastParagraph {
  text: string;
  photos: string[];
}

/** 결과에 복사해 두는 관련 옷 정보(옷을 지워도 문장은 남는다) */
export interface RoastGarmentRef {
  brand: string;
  name: string;
  imagePath: string | null;
  /** 화면에서 보여 줄 때 새로 만든 주소 */
  imageUrl?: string | null;
}

export interface RoastResult {
  name: string | null;
  createdAt: string;
  garmentCount: number;
  headline: string;
  paragraphs: RoastParagraph[];
  closing: string[];
  disclaimer: string;
  garments: Record<string, RoastGarmentRef>;
  answers: { id: string; question: string; answer: string }[];
  patterns: { id: string; stats: Record<string, string | number> }[];
  aiUsed: boolean;
  /** 결과를 만든 때의 옷장 요약값(옷장 변화 안내용) */
  wardrobeHash: string;
}

export type RoastStart =
  | { ok: true; script: RoastScript; aiLeft: number | null }
  | { ok: false; code: "too_few"; count: number }
  | { ok: false; code: "error"; message: string };

export type RoastFinish = { ok: true; result: RoastResult } | { ok: false; message: string };

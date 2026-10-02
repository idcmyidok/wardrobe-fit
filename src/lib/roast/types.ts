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
  /** gap: 새 이야기(분석 문장 묶음·질문 하나)의 시작. 앞 이야기와 간격을 두고 보여 준다. */
  | { t: "status"; text: string; gap?: boolean }
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

/** 결과 페이지(옷장 진단 리포트). 예전 결과에는 없고, 그때는 headline·paragraphs(긴 훈수 글)를 보여 준다. */
export interface RoastReport {
  /** 첫 줄: 총점 구간별 평가 */
  headline: string;
  /** 굵은 제목 + 목록(많이 가진 옷, 좋아하는 브랜드) */
  lists: { title: string; items: string[] }[];
  /** 총 옷장 점수(0~100, 질문·퀴즈 답이 더하거나 뺀다) */
  total: { score: number };
  /** 진단 문단: lead는 굵게, answer는 관련 질문 답에 붙는 한 줄, photos는 옆으로 넘기는 사진 줄 */
  points: { id: string; lead: string; text: string; answer?: string; photos?: string[] }[];
  /** 제목 바로 아래 한 문장: 가장 뚜렷한 특징 두세 개를 이은 요약 */
  summary?: string;
  /** 예전 결과의 옷장 DNA(굵은 앞말 + 문장들). 새 결과에는 없고 summary를 쓴다. */
  dnaLead?: string;
  dna?: string[];
  /** 기준 안내(예: 브랜드 정보가 있는 옷 수) */
  notes: string[];
  /**
   * 점수 풀이(관리자에게만): 기본 점수 + 항목별 증감 + 질문 답 증감 → 총점.
   * 일반 사용자의 결과에는 서버가 지우고 보낸다.
   */
  scoreDetail?: { base: number; items: { label: string; why: string; delta: number; garments?: string[] }[]; total: number };
  /** 첫 줄 아래 섹션 순서(관리자 "결과 구성"). 없으면 lists·total·points·dna·notes(dna는 예전 결과만) */
  order?: string[];
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
  /** 새 결과 페이지. 있으면 이걸 보여 준다. 없는 옛 결과(2026-09-30 이전 저장분)만 headline·paragraphs(긴 훈수 글)를 보여 주고, 새 결과는 이 둘을 비워 둔다. */
  report?: RoastReport;
  garments: Record<string, RoastGarmentRef>;
  answers: { id: string; question: string; answer: string }[];
  patterns: { id: string; stats: Record<string, string | number> }[];
  /** 결과를 만든 때의 옷장 요약값(옷장 변화 안내용) */
  wardrobeHash: string;
}

export type RoastStart =
  | { ok: true; script: RoastScript }
  | { ok: false; code: "too_few"; count: number }
  | { ok: false; code: "error"; message: string };

export type RoastFinish = { ok: true; result: RoastResult } | { ok: false; message: string };

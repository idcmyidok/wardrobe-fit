# Wardrobe Fit

입어본 옷의 실측과 착용 후기를 기록해 두고, 새로 사려는 옷이 나한테 어떻게 맞을지 그 기록과 비교해 보는 웹 서비스입니다.

https://wardrobe-fit-self.vercel.app

## 만든 이유

온라인에서 옷을 살 때 사이즈표는 늘 있는데, 그 숫자가 나한테 어떤 느낌인지는 알기 어렵습니다. 그래서 결국 옷장에서 비슷한 옷을 꺼내 줄자로 재 보고, 상세 페이지 숫자와 하나씩 맞춰 보게 됩니다.

이 과정을 한 번 기록해 두면 다음부터는 자동으로 비교할 수 있지 않을까 해서 만들었습니다. 키나 몸무게로 체형을 추정하지 않고, "내가 실제로 입어 본 옷"만 기준으로 삼습니다.

## 할 수 있는 것

- **내 옷장**: 옷마다 사진, 브랜드, 사이즈, 컬러, 구매 정보, 실측, 착용 후기를 남깁니다. 대분류별 표로 보고 검색·필터·정렬합니다.
- **링크로 등록**: 상품 링크를 붙여 넣으면 브랜드, 제품명, 사진, 컬러, 사이즈표를 읽어서 입력 칸을 채웁니다. 구매한 사이즈를 고르면 그 사이즈의 실측이 들어가고, 확인한 뒤 등록합니다.
- **구매 판단**: 사려는 옷의 실측을 비슷한 내 옷들과 치수별로 비교합니다. 사이즈를 최대 3개까지 같이 놓고 볼 수 있습니다.
- **옷장 분석**: 구매 금액, 월별 구매, 브랜드·컬러 비율, 시즌 분포, 부족한 종류를 한 화면에 보여줍니다.

구매 판단 결과는 이런 식입니다.

```
치수   새 옷   만족했던 범위    판단
어깨   46     45 – 47 (3벌)   만족했던 옷들과 비슷함
가슴   60     59 – 61 (3벌)   만족했던 옷들과 비슷함
총장   72     69 – 70 (3벌)   길다고 적은 B 자켓(71.5)과 비슷

어깨·가슴은 만족했던 자켓들과 비슷하고, 총장은 만족 범위보다 2cm 깁니다.
```

"사세요/사지 마세요"가 아니라 어느 치수가 어떻게 다른지, 그 판단이 어떤 옷과 어떤 후기에서 나왔는지를 보여주는 게 목표입니다.

## 신경 쓴 부분

**계산은 규칙으로, AI는 선택으로.** 치수 비교, 만족 범위, 신뢰도는 전부 서버 규칙이 계산합니다. 요약 문장도 규칙이 먼저 만들고, AI 키가 있을 때만 AI가 설명을 덧붙입니다. AI가 실패하거나 한도에 걸려도 결과는 그대로 나옵니다. 무료 등급 안에서 운영하려고 이렇게 정했고, 무료 Gemini에는 후기 원문이나 제품명 없이 숫자만 보냅니다.

**후기는 자유롭게 쓰고, 읽는 건 규칙이.** 착용 후기는 점수 없이 한 칸에 편하게 씁니다. "어깨는 좋은데 총장이 조금 길다" 같은 문장을 절 단위로 나눠 치수별 느낌을 뽑고, 비교할 때 근거로 씁니다.

**쇼핑몰은 믿지 않는 입력.** 링크 분석은 DNS를 먼저 확인해 내부망 주소를 막고(SSRF), redirect마다 다시 검사하고, 크기와 시간을 제한합니다. 무신사 전용 parser, Shopify·Cafe24 플랫폼 parser, 나머지를 위한 일반 parser를 순서대로 쓰고, 표가 아니라 글로 적힌 사이즈 정보도 읽습니다. 자동으로 읽은 값은 사용자가 확인하기 전에는 저장하지 않습니다.

**권한은 DB가 판단.** 모든 사용자 테이블과 사진 저장소에 Supabase RLS를 걸었습니다. 서버 코드도 사용자 세션으로 DB에 접근하고, 다른 사용자 데이터에 접근할 수 없다는 건 테스트로 확인합니다.

**AI가 만든 것 같지 않은 화면.** 카드, 그라데이션, 큰 히어로 문구, "자동 입력됨" 같은 배지를 쓰지 않았습니다. 따뜻한 무채색에 올리브 포인트 하나, 얇은 선과 표 위주로 만들었고 다크 모드를 지원합니다.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Zod · cheerio · Vitest · Playwright · Vercel · GitHub Actions

AI는 선택입니다. `GEMINI_API_KEY`(Gemini Flash-Lite) 또는 `ANTHROPIC_API_KEY`(Claude Haiku 4.5)가 있으면 씁니다.

## 로컬에서 실행

Node 22 기준입니다.

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

Supabase 값(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)을 비워 두면 로그인 없이 예시 데이터로 둘러보는 미리보기 모드로 뜹니다. 화면만 볼 때는 이걸로 충분합니다.

실제로 쓰려면 Supabase 프로젝트를 만들고 `supabase/migrations/`를 순서대로 적용합니다. Authentication > URL Configuration의 Redirect URLs에 `http://localhost:3000/**`를 넣어야 인증 메일 링크가 돌아옵니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 빌드 / 실행 |
| `npm run lint` | ESLint(디자인 토큰 밖의 색·radius도 경고) |
| `npm run typecheck` | 타입 검사 |
| `npm test` | 단위 테스트(parser, 정리 규칙, 비교 로직, SSRF 방어 등) |
| `npm run test:db` | Supabase 없이 PGlite로 마이그레이션과 RLS 교차 접근 차단 확인 |
| `npm run test:e2e` | Playwright E2E(로컬 Supabase 필요, [e2e/README.md](./e2e/README.md)) |
| `npm run check:bundle` | 빌드 결과의 브라우저 번들에 비밀 키가 없는지 확인 |
| `npm run db:apply` / `npm run db:types` | 원격 Supabase에 마이그레이션 적용 / DB 타입 생성 |
| `npm run test:rls` | 실제 Supabase에서 사용자 간 접근 차단 확인 |

환경 변수는 `.env.example`에 설명과 함께 이름만 적어 두었습니다.

## 테스트와 배포

- PR마다 GitHub Actions가 lint, 타입 검사, 단위 테스트, 빌드, 번들 키 검사를 하고, 로컬 Supabase를 띄워 E2E를 돌립니다. E2E는 외부 쇼핑몰과 AI를 부르지 않고 모의 응답을 씁니다.
- 브랜치는 `feature/*` → `develop` → `main` 순서입니다. Vercel은 `main`(운영)과 `develop`만 배포합니다.
- 사용자별로 하루(최근 24시간) 링크 분석 50회, 구매 판단 20회, 그중 AI 요약 10회까지 쓸 수 있고, 화면에 남은 횟수와 초기화까지 남은 시간이 나옵니다.

## 폴더

```
src/
  app/              페이지와 API(/api/imports, /api/fit-checks 등)
  components/       화면 컴포넌트
  server/import/    링크 분석: 안전한 fetch, parser, 정리 규칙
  server/ai/        AI 제공자 선택과 요약 검증
  lib/fit/          비교 대상 선정, 후기 읽기, 치수 비교(화면과 서버가 같이 씀)
  styles/tokens.css 디자인 토큰
supabase/migrations/ 스키마, RLS, Storage 정책
e2e/                 Playwright 시나리오
```

설계와 결정 이유는 [PROJECT_SPEC.md](./PROJECT_SPEC.md)에 자세히 적어 두었습니다.

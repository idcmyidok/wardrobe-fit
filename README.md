# Wardrobe Fit

Personal wardrobe management and AI fit recommendation service.

설계 문서: [PROJECT_SPEC.md](./PROJECT_SPEC.md)

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | production 빌드 / 실행 |
| `npm run lint` | ESLint (디자인 토큰 외 색상·radius 임의 값 경고 포함) |
| `npm run typecheck` | TypeScript 검사 |
| `npm run test:db` | Supabase 없이 PGlite로 migration과 RLS 교차 접근 차단 검증 |
| `npm run db:apply` | migration을 실제 Supabase에 적용하고 DB 타입 생성 (`SUPABASE_ACCESS_TOKEN` 필요) |
| `npm run db:types` | DB 타입만 다시 생성 |
| `npm run test:rls` | 실제 Supabase에서 사용자 A/B 교차 접근 차단 확인 (service role key 필요, 테스트 사용자는 끝나면 삭제) |

환경 변수는 `.env.example`을 `.env.local`로 복사해 채운다. `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 비어 있으면 인증 없이 예시 데이터로 둘러보는 미리보기 모드로 뜬다.

## 현재 화면 (인증 연결, DB 미연결 mock data)

- `/` 비로그인 첫 화면. `?mode=signup`, `?mode=reset`으로 오른쪽 패널 전환. 로그인 상태면 `/wardrobe`로 이동
- `/auth/confirm` 가입 인증·재설정 메일 링크 처리, `/auth/update-password` 새 비밀번호
- `/wardrobe`, `/fit-check`, `/analysis` 로그인 필요(`src/proxy.ts`). 데이터는 아직 `src/lib/mock/` 사용

### Supabase Auth 설정

- Authentication > URL Configuration: Site URL을 배포 주소로, Redirect URLs에 `http://localhost:3000/**`와 배포 주소 `/**`를 추가
- 다른 기기에서 메일 링크를 열어도 되게 하려면 Email Templates의 링크를 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (재설정은 `type=recovery`)로 바꾼다. 기본 템플릿도 동작하지만 요청한 브라우저에서 열어야 한다
- "로그인 상태 유지"를 끄면 세션 쿠키가 브라우저 세션 쿠키로 바뀌어 브라우저를 닫을 때 로그아웃된다(`wf_remember` 쿠키)

## 디렉터리

```
src/
  app/
    (public)/page.tsx        비로그인 첫 화면
    (app)/layout.tsx         로그인 후 공통 헤더, 서버에서 사용자 재확인
    auth/                    메일 링크 처리, 새 비밀번호
  proxy.ts                   세션 갱신 + 보호 경로 리다이렉트
supabase/migrations/         스키마, RLS, Storage, 분류 시드
scripts/db/                  migration 적용, RLS 검증 스크립트
  server/auth/               로그인·가입·재설정·로그아웃 Server Action
    (app)/wardrobe/          내 옷장, 새 옷 추가(placeholder)
    (app)/fit-check/         AI 구매 판단기(placeholder)
  components/
    ui/        도메인 무관 primitive (button, input, select, checkbox, field, badge, empty-state)
    layout/    app-header, user-menu, page-header, coming-soon
    landing/   service-intro
    auth/      auth-panel, sign-in/sign-up/reset-request form
    wardrobe/  wardrobe-view, wardrobe-filters, category-toggle, wardrobe-table, garment-thumbnail
  lib/
    supabase/  server/browser client, proxy 세션 갱신, 상태 유지 쿠키 규칙
    images/    사진 WebP 변환(1600px)·썸네일(300px)·EXIF 제거, Storage 업로드
    constants/ categories, seasons, sort
    types/     domain
    format/    price, date
    mock/      garments (DB 연결 후 삭제)
  styles/
    tokens.css   디자인 토큰 (PROJECT_SPEC.md 6장)
    globals.css  Tailwind theme을 토큰으로만 제한
```

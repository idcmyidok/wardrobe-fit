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

환경 변수는 `.env.example`을 `.env.local`로 복사해 채운다. 현재 단계에서는 사용하지 않는다.

## 현재 화면 (인증·DB 미연결, mock data)

- `/` 비로그인 첫 화면. `?mode=signup`, `?mode=reset`으로 오른쪽 패널 전환
- `/wardrobe` 내 옷장 (개발 확인용, `src/lib/mock/garments.ts` 사용)
- `/wardrobe/new`, `/fit-check` 준비 중 placeholder

## 디렉터리

```
src/
  app/
    (public)/page.tsx        비로그인 첫 화면
    (app)/layout.tsx         로그인 후 공통 헤더
    (app)/wardrobe/          내 옷장, 새 옷 추가(placeholder)
    (app)/fit-check/         AI 구매 판단기(placeholder)
  components/
    ui/        도메인 무관 primitive (button, input, select, checkbox, field, badge, empty-state)
    layout/    app-header, user-menu, page-header, coming-soon
    landing/   service-intro
    auth/      auth-panel, sign-in/sign-up/reset-request form
    wardrobe/  wardrobe-view, wardrobe-filters, category-toggle, wardrobe-table, garment-thumbnail
  lib/
    constants/ categories, seasons, sort
    types/     domain
    format/    price, date
    mock/      garments (DB 연결 후 삭제)
  styles/
    tokens.css   디자인 토큰 (PROJECT_SPEC.md 6장)
    globals.css  Tailwind theme을 토큰으로만 제한
```

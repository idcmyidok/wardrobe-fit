# E2E 테스트

로컬 Supabase(Docker)에 붙어 가입·등록·수정·삭제·링크 등록·사용자 간 차단을 실제로 확인한다.
원격(운영) Supabase에는 붙지 않는다. `support.ts`가 주소를 보고 멈춘다.

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta
eval "$(npx supabase status -o env)"
export NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY E2E_MAILPIT_URL=$MAILPIT_URL
npx playwright install chromium   # 처음 한 번
npm run build && npm run test:e2e
npx supabase stop
```

- 외부 쇼핑몰에는 나가지 않는다. 링크 등록은 `/api/imports` 응답만 흉내 내고, 분석 기록은 실제 DB에 넣는다.
- 테스트가 만든 사용자·옷·사진·분석 기록은 테스트가 끝나면 지운다.
- CI는 `.github/workflows/ci.yml`에서 같은 순서로 돌린다.

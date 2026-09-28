@AGENTS.md

# 버전·배포 규칙

## 버전 (major.minor.patch)
- 지금 버전은 `package.json`의 `version`이다. 업데이트 노트(`src/lib/release-notes.ts`)의 맨 위 버전과 같아야 한다(테스트로 확인).
- 한 흐름의 변경·수정을 올릴 때마다 patch를 올린다: 1.1.0 → 1.1.1
- 신규 기능이 생기면 minor를 올리고 patch는 0: 1.1.3 → 1.2.0
- 크게 바뀌면 major: 2.0.0(업데이트 노트 창에서 1.x·2.x 탭으로 나뉜다)
- 버전을 올리는 PR에서 `npm version <버전> --no-git-tag-version`으로 `package.json`·`package-lock.json`을 바꾸고, 업데이트 노트 맨 위에 그 버전 항목을 추가하거나 채운다.
  - 신규 기능: 한 줄 제목 + 자세한 설명
  - 변경 내용: 바뀐 점을 짧게
  - 수정사항: 소제목 없이 한 줄씩
- 사이트에서 숨겨 둔 기능(`src/lib/features.ts`에서 끈 것)은 노트에 적지 않는다.

## 브랜치·배포
- 작업은 기능 브랜치 → `develop` PR로만 병합한다. `develop`에 모아 두었다가, 사용자가 요청할 때만 `develop` → `main` PR로 한 번에 올린다.
- `main`에 올린 뒤에는 그 병합 커밋에 `v<버전>` 태그(예: `v1.1.0`)를 단다.
- Vercel은 `develop`(미리보기)과 `main`(운영)만 배포한다.

# 프로젝트 스킬

이 폴더의 스킬은 이 저장소를 여는 모든 Claude Code 세션(로컬·클라우드)에서 자동으로 불러옵니다. `/<스킬 이름>`으로 직접 부르거나, 상황에 맞으면 Claude가 알아서 씁니다.

| 스킬 | 하는 일 | 출처 (커밋) | 라이선스 |
|---|---|---|---|
| `design-taste-frontend` | 템플릿처럼 보이지 않게 디자인 방향을 잡는 규칙 (Taste Skill) | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/taste-skill` (b482f7a) | MIT |
| `image-to-code` | 디자인 이미지·스크린샷을 분석해서 그대로 코드로 옮기기 | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/image-to-code-skill` (b482f7a) | MIT |
| `web-design-guidelines` | UI 코드를 Web Interface Guidelines 기준으로 점검 | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` (063bee9) | MIT |
| `awesome-design` | 실제 서비스의 디자인 시스템(DESIGN.md)을 받아 참고 | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 기반 래퍼 (13be5c0) | MIT |
| `playwright-cli` | 브라우저를 띄워 화면을 직접 보고 테스트 | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) `skills/playwright-cli` (b85c7a7) | Apache-2.0 |

## 참고

- `awesome-design`은 원본 저장소가 스킬이 아니라 DESIGN.md 모음(약 2.8MB)이라서, 파일을 모두 넣지 않고 필요할 때 해당 브랜드 파일만 받아오도록 감쌌습니다.
- `web-design-guidelines`와 `awesome-design`은 실행할 때 GitHub에서 최신 규칙이나 파일을 받아옵니다.
- `image-to-code`는 원래 이미지를 직접 만드는 에이전트용으로 쓰였습니다. Claude Code에서는 참고 이미지(스크린샷·시안)를 함께 주면 가장 잘 동작합니다.
- `playwright-cli`는 `playwright-cli` 명령이 필요합니다. 없으면 스킬 안내대로 `npm install -g @playwright/cli@latest`로 설치합니다.
- 원본을 업데이트하려면 해당 저장소의 같은 경로를 다시 복사하고 위 표의 커밋을 바꿉니다.

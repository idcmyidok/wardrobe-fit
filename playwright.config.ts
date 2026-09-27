import { defineConfig, devices } from "@playwright/test";

/**
 * E2E(PROJECT_SPEC.md 22장 13단계). 로컬 Supabase(`npx supabase start`)에 붙어 실제 가입·저장·RLS를 확인한다.
 * 먼저 `npm run build`를 하고, e2e/README.md의 환경 변수를 넣은 뒤 `npm run test:e2e`.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

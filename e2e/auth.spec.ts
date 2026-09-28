import { expect, login, test } from "./support";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Mailpit(로컬 Supabase 메일함)에서 가장 최근 메일의 링크를 꺼낸다. */
async function confirmLink(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML?: string; Text?: string };
      const link = (msg.HTML ?? msg.Text ?? "").match(/href="([^"]+)"/)?.[1] ?? (msg.Text ?? "").match(/https?:\/\/\S+/)?.[0];
      if (link) return link.replaceAll("&amp;", "&");
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  throw new Error("인증 메일이 오지 않았습니다");
}

test("가입 → 메일 인증 → 옷장 → 로그아웃 → 보호된 경로는 로그인으로", async ({ page, trackEmail }) => {
  const email = `e2e-signup-${Date.now()}@example.com`;
  const password = `E2e-${crypto.randomUUID()}`;
  trackEmail(email);

  await page.goto("/?mode=signup");
  await page.fill("#signup-email", email);
  await page.fill("#signup-password", password);
  await page.fill("#signup-password-confirm", password);
  await page.getByRole("checkbox", { name: "모두 동의" }).check();
  await page.getByRole("button", { name: "가입하고 인증 메일 받기" }).click();
  await expect(page).toHaveURL(/mode=sent/);

  // 인증 전에는 로그인되지 않는다.
  await page.goto("/");
  await page.fill("#signin-email", email);
  await page.fill("#signin-password", password);
  await page.locator("form:has(#signin-email) button[type=submit]").click();
  await expect(page.getByRole("alert").filter({ hasText: "이메일 인증" })).toBeVisible();

  await page.goto(await confirmLink(email));
  await expect(page).toHaveURL(/\/wardrobe$/);
  await expect(page.getByText("아직 등록한 옷이 없습니다")).toBeVisible();

  await page.getByRole("button", { name: /e2e-signup/ }).click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/wardrobe/new");
  await expect(page).toHaveURL(/\/\?next=%2Fwardrobe%2Fnew/);
});

test("로그인하면 원래 가려던 화면으로 돌아간다", async ({ page, makeUser }) => {
  const user = await makeUser("next");
  await page.goto("/wardrobe/new?mode=manual");
  await expect(page).toHaveURL(/next=/);
  await page.fill("#signin-email", user.email);
  await page.fill("#signin-password", user.password);
  await page.locator("form:has(#signin-email) button[type=submit]").click();
  await expect(page).toHaveURL(/\/wardrobe\/new\?mode=manual$/);
  await expect(page.locator("#f-name")).toBeVisible();
});

test("비밀번호가 틀리면 안내가 나온다", async ({ page, makeUser }) => {
  const user = await makeUser("wrong");
  await login(page, { ...user, password: "wrong-password-1" });
  await expect(page.getByRole("alert").filter({ hasText: "올바르지 않습니다" })).toBeVisible();
});

test("상태 유지로 로그인하면 브라우저를 다시 열어도 바로 옷장, 로그아웃 뒤에는 이메일이 채워져 있다", async ({ browser, page, makeUser }) => {
  const user = await makeUser("remember");
  await login(page, user);
  await expect(page).toHaveURL(/\/wardrobe$/);

  // 브라우저를 닫았다 연 것처럼 만료일이 있는 쿠키만 새 창으로 옮긴다.
  const kept = (await page.context().cookies()).filter((cookie) => cookie.expires > 0);
  const reopened = await browser.newContext({ baseURL: new URL(page.url()).origin });
  await reopened.addCookies(kept);
  const again = await reopened.newPage();
  await again.goto("/");
  await expect(again).toHaveURL(/\/wardrobe$/);

  await again.getByRole("button", { name: /e2e-remember/ }).click();
  await again.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(again).toHaveURL(/\/$/);
  await expect(again.locator("#signin-email")).toHaveValue(user.email);
  await reopened.close();
});

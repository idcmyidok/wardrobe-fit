import { expect, login, test } from "./support";

test("관리자가 아니면 관리자 페이지가 없는 페이지로 보인다", async ({ page, makeUser }) => {
  const user = await makeUser("plain");
  await login(page, user);
  await expect(page).toHaveURL(/\/wardrobe$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
  await page.goto("/wardrobe");
  await expect(page.getByText("아직 등록한 옷이 없습니다")).toBeVisible();
  await page.getByRole("button", { name: /e2e-plain/ }).click();
  await expect(page.getByRole("menuitem", { name: "로그아웃" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "관리자 페이지" })).toHaveCount(0);
});

test("관리자는 통계를 보고 사용자를 정지·해제·삭제한다", async ({ page, browser, admin, makeUser, seedGarments }) => {
  const boss = await makeUser("boss");
  const member = await makeUser("member");
  await seedGarments(member, [{ category_id: "top", product_name: "회원의 셔츠" }]);
  const { error } = await admin.from("admins").insert({ user_id: boss.id });
  expect(error).toBeNull();

  // 정지 전에 로그인해 둔 회원 화면
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await login(memberPage, member);
  await expect(memberPage).toHaveURL(/\/wardrobe$/);

  await login(page, boss);
  // 옷 목록을 읽는 동안에는 임시 머리글이 보이다가 바뀐다. 다 뜬 뒤에 메뉴를 연다.
  await expect(page.getByText("아직 등록한 옷이 없습니다")).toBeVisible();
  await page.getByRole("button", { name: /e2e-boss/ }).click();
  await page.getByRole("menuitem", { name: "관리자 페이지" }).click();
  await expect(page.getByRole("heading", { name: "관리자", exact: true })).toBeVisible();
  await expect(page.getByText("가입자", { exact: true })).toBeVisible();
  // 관리자는 사용 한도가 없고, 회원은 한도가 있다.
  expect((await (await page.request.get("/api/usage")).json()).unlimited).toBe(true);
  expect((await (await memberPage.request.get("/api/usage")).json()).unlimited).toBe(false);

  const row = page.locator(`tr[data-user-email="${member.email}"]`);
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(3)).toHaveText("1");
  // 내 계정 줄에는 관리 버튼이 없다.
  await expect(page.locator(`tr[data-user-email="${boss.email}"]`).getByRole("button")).toHaveCount(0);

  // 정지: 이미 로그인한 화면도 쫓겨나고, 다시 로그인할 수 없다.
  await row.getByRole("button", { name: `${member.email} 정지`, exact: true }).click();
  await expect(row.getByText("정지됨")).toBeVisible();
  expect((await memberPage.request.post("/api/fit-checks", { data: {} })).status()).toBe(401);
  await memberPage.goto("/wardrobe");
  await expect(memberPage).toHaveURL(/\/\?error=suspended$/);
  await expect(memberPage.getByText("이용이 정지된 계정입니다.")).toBeVisible();
  // 정지된 계정의 로그인은 Supabase가 일반 로그인 실패로 돌려준다(정지 여부를 알리지 않음).
  await login(memberPage, member);
  await expect(memberPage.getByRole("alert").filter({ hasText: "올바르지 않습니다" })).toBeVisible();
  await expect(memberPage).not.toHaveURL(/\/wardrobe/);

  // 해제하면 다시 로그인할 수 있다.
  await row.getByRole("button", { name: `${member.email} 정지 해제`, exact: true }).click();
  await expect(row.getByText("정상", { exact: true })).toBeVisible();
  await login(memberPage, member);
  await expect(memberPage).toHaveURL(/\/wardrobe$/);
  await memberContext.close();

  // 삭제는 한 번 더 확인한 뒤 계정과 옷을 모두 지운다.
  await row.getByRole("button", { name: `${member.email} 삭제`, exact: true }).click();
  await row.getByRole("button", { name: `${member.email} 정말 삭제`, exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await admin.auth.admin.getUserById(member.id)).data.user).toBeNull();
  expect((await admin.from("garments").select("id").eq("user_id", member.id)).data).toEqual([]);
});

test("관리자가 테스터로 지정하면 한도가 없어지고, 해제하면 돌아온다", async ({ page, browser, admin, makeUser }) => {
  const boss = await makeUser("boss2");
  const member = await makeUser("tester");
  const { error } = await admin.from("admins").insert({ user_id: boss.id });
  expect(error).toBeNull();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await login(memberPage, member);
  await expect(memberPage).toHaveURL(/\/wardrobe$/);
  const usage = async () => (await memberPage.request.get("/api/usage")).json();
  expect((await usage()).unlimited).toBe(false);

  await login(page, boss);
  await expect(page).toHaveURL(/\/wardrobe$/);
  await page.goto("/admin");
  const row = page.locator(`tr[data-user-email="${member.email}"]`);
  await row.getByRole("button", { name: `${member.email} 테스터 지정`, exact: true }).click();
  await expect(row.getByText("테스터", { exact: true })).toBeVisible();
  expect(await usage()).toMatchObject({ unlimited: true, unlimitedReason: "tester" });
  await memberPage.goto("/settings");
  await expect(memberPage.getByText("테스터 계정이라 사용 한도가 없습니다.")).toBeVisible();

  await row.getByRole("button", { name: `${member.email} 테스터 해제`, exact: true }).click();
  await expect(row.getByText("테스터", { exact: true })).toHaveCount(0);
  expect(await usage()).toMatchObject({ unlimited: false, unlimitedReason: null });
  await memberContext.close();
});

import { expect, login, test } from "./support";

test("모자는 실측 3개, 신발은 착용감으로 등록하고 표에 보인다", async ({ page, admin, makeUser }) => {
  const user = await makeUser("hat-shoes");
  await login(page, user);
  const manual = async () => {
    await page.goto("/wardrobe/new");
    await page.getByRole("radiogroup", { name: "추가 방법" }).locator("label", { hasText: "직접 입력" }).click();
  };

  // 모자
  await manual();
  await page.selectOption("#f-cat", "hat");
  await page.selectOption("#f-sub", "hat.cap");
  await page.fill("#f-name", "로고 볼캡");
  await page.fill("#f-size", "FREE");
  await page.fill("#f-m-head", "58");
  await page.fill("#f-m-depth", "15.5");
  await page.fill("#f-m-brim", "7");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page).toHaveURL(/\/wardrobe\?item=/);

  // 신발
  await manual();
  await page.selectOption("#f-cat", "shoes");
  await page.selectOption("#f-sub", "shoes.sneakers");
  await page.fill("#f-name", "척 70 하이");
  await page.fill("#f-size", "270");
  await expect(page.locator("#f-m-length")).toHaveCount(0);
  await page.getByRole("group", { name: "발볼" }).locator("label", { hasText: "좁음" }).click();
  await page.getByRole("group", { name: "발등" }).locator("label", { hasText: "딱 맞음" }).click();
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page).toHaveURL(/\/wardrobe\?item=/);
  await expect(page.getByRole("dialog").getByText("좁음")).toBeVisible();

  const { data: rows } = await admin.from("garments").select("*").eq("user_id", user.id).order("created_at");
  expect(rows?.[0]).toMatchObject({ category_id: "hat", m_head: 58, m_depth: 15.5, m_brim: 7, m_length: null, shoe_fit_width: null });
  expect(rows?.[1]).toMatchObject({ category_id: "shoes", size_label: "270", shoe_fit_length: null, shoe_fit_width: "tight", shoe_fit_instep: "good", m_length: null });

  // DB도 대분류에 맞지 않는 값을 막는다.
  const bad = await admin.from("garments").insert({ user_id: user.id, category_id: "shoes", product_name: "잘못된 신발", m_length: 28 });
  expect(bad.error?.message).toMatch(/garments_measurements_match_category/);
  const badFit = await admin.from("garments").insert({ user_id: user.id, category_id: "hat", product_name: "잘못된 모자", shoe_fit_width: "tight" });
  expect(badFit.error?.message).toMatch(/garments_shoe_fit_only_shoes/);

  // 옷장 표: 모자는 머리둘레 열, 신발은 발볼 열
  await page.keyboard.press("Escape");
  const table = page.locator("table:visible");
  await expect(table.getByRole("columnheader", { name: /머리둘레/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "발볼" })).toBeVisible();
});

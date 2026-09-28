import { expect, login, test } from "./support";

test("오늘의 코디: 옷이 부족하면 안내하고, 상의·하의가 있으면 카드로 추천한다", async ({ page, admin, makeUser }) => {
  const user = await makeUser("outfit");
  await login(page, user);
  await expect(page).toHaveURL(/\/wardrobe$/);

  await page.goto("/outfit");
  await expect(page.getByText("옷이 부족해서 코디를 추천할 수 없어요")).toBeVisible();

  const { error } = await admin.from("garments").insert([
    { user_id: user.id, category_id: "top", product_name: "옥스포드 셔츠", color_name: "화이트", seasons: ["all"] },
    { user_id: user.id, category_id: "bottom", product_name: "데님 팬츠", color_name: "진청", seasons: ["all"] },
  ]);
  expect(error).toBeNull();

  await page.reload();
  const cards = page.getByRole("region", { name: "추천 코디" });
  await expect(cards.getByText("AI가 옷장 정보로 고른 임시 추천이라")).toBeVisible();
  await expect(cards.getByText("옥스포드 셔츠")).toBeVisible();
  await expect(cards.getByText("데님 팬츠")).toBeVisible();
});

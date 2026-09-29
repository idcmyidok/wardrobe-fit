import { expect, login, samplePhoto, test } from "./support";

test("직접 등록(사진 포함) → 검색·필터 → 수정 → 삭제 → 실행 취소", async ({ page, browser, admin, makeUser, seedGarments }) => {
  const user = await makeUser("crud");
  await seedGarments(user, [{ category_id: "outer", subcategory_id: "outer.shirt", brand: "COS", product_name: "옥스포드 셔츠", size_label: "M" }]);
  await login(page, user);
  await expect(page).toHaveURL(/\/wardrobe$/);

  // 등록
  await page.getByRole("link", { name: "+ 새 옷 추가" }).click();
  await page.getByRole("radiogroup", { name: "추가 방법" }).locator("label", { hasText: "직접 입력" }).click();
  await page.selectOption("#f-cat", "bottom");
  await page.selectOption("#f-sub", "bottom.denim");
  await page.fill("#f-brand", "Levi's");
  await page.fill("#f-name", "501 오리지널 데님");
  await page.fill("#f-size", "32");
  await page.fill("#f-m-waist", "41");
  await page.fill("#f-m-length", "102.5");
  await page.locator("input[type=file]").setInputFiles(await samplePhoto(browser));
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page).toHaveURL(/\/wardrobe\?item=/);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("501 오리지널 데님")).toBeVisible();

  const { data: saved } = await admin.from("garments").select("*").eq("user_id", user.id).eq("product_name", "501 오리지널 데님").single();
  expect(saved).toMatchObject({ category_id: "bottom", m_waist: 41, m_length: 102.5, m_chest: null });
  expect(saved?.image_path).toMatch(new RegExp(`^${user.id}/${saved?.id}/`));

  // 닫고 검색·필터
  await page.keyboard.press("Escape");
  const table = page.locator("table:visible");
  await page.getByPlaceholder("브랜드, 제품명 검색").fill("데님");
  await expect(page).toHaveURL(/q=%EB%8D%B0%EB%8B%98|q=데님/);
  await expect(table.getByText("501 오리지널 데님")).toBeVisible();
  await expect(table.getByText("옥스포드 셔츠")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("table:visible").getByText("501 오리지널 데님")).toBeVisible();
  await page.getByPlaceholder("브랜드, 제품명 검색").fill("");
  await page.getByRole("group", { name: "대분류" }).locator("label", { hasText: "하의" }).click();
  await expect(page.locator("table:visible").getByText("501 오리지널 데님")).toHaveCount(0);
  await expect(page.locator("table:visible").getByText("옥스포드 셔츠")).toBeVisible();
  await page.getByRole("group", { name: "대분류" }).locator("label", { hasText: "하의" }).click();

  // 수정
  await page.locator("table:visible").getByRole("button", { name: "501 오리지널 데님" }).click();
  await dialog.getByRole("button", { name: "옷 정보 수정" }).click();
  const waist = dialog.getByLabel("허리");
  await waist.fill("40.5");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByText("40.5")).toBeVisible();
  const { data: edited } = await admin.from("garments").select("m_waist").eq("id", saved!.id).single();
  expect(edited?.m_waist).toBe(40.5);

  // 삭제 → 실행 취소
  await dialog.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("삭제했습니다")).toBeVisible();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(page.locator("table:visible").getByText("501 오리지널 데님")).toBeVisible();
  const { data: restored } = await admin.from("garments").select("deleted_at").eq("id", saved!.id).single();
  expect(restored?.deleted_at).toBeNull();
});

test("서버 검증: 잘못된 실측은 저장하지 않고 칸 아래에 알려 준다", async ({ page, admin, makeUser }) => {
  const user = await makeUser("invalid");
  await login(page, user, "/wardrobe/new?mode=manual");
  await expect(page.locator("#f-name")).toBeVisible();
  await page.fill("#f-name", "검증 셔츠");
  await page.fill("#f-m-chest", "300");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.locator("#e-m-chest")).toContainText("200cm");
  await expect(page.locator("#f-m-chest")).toBeFocused();
  const { count } = await admin.from("garments").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  expect(count).toBe(0);
});

test("모바일: 기본은 간략 목록, 자세하게로 표 보기, 누르면 상세 페이지", async ({ browser, makeUser, seedGarments }) => {
  const user = await makeUser("mobile");
  const [id] = await seedGarments(user, [{ category_id: "outer", brand: "Our Legacy", product_name: "워크 자켓" }]);
  const context = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await login(page, user);
  // 모바일 기본은 간략하게(목록). 자세하게를 누르면 PC처럼 표가 보이고, 표는 가로로 스크롤된다.
  const viewGroup = page.getByRole("group", { name: "보기 방식" });
  await expect(viewGroup.getByRole("button", { name: "간략하게" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("table:visible")).toHaveCount(0);
  await viewGroup.getByRole("button", { name: "자세하게" }).click();
  await expect(page.locator("table:visible").getByText("워크 자켓")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await viewGroup.getByRole("button", { name: "간략하게" }).click();
  await expect(page.locator("table:visible")).toHaveCount(0);
  await page.getByRole("button", { name: /워크 자켓/ }).click();
  await expect(page).toHaveURL(new RegExp(`/wardrobe/${id}$`));
  await expect(page.getByRole("heading", { name: "워크 자켓" }).or(page.getByText("워크 자켓").first())).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});

test("옷 삭제: 간략하게로 바뀌고 체크한 옷만 한꺼번에 삭제, 실행 취소로 되살림", async ({ page, admin, makeUser, seedGarments }) => {
  const user = await makeUser("bulk-delete");
  const ids = await seedGarments(user, [
    { category_id: "outer", brand: "COS", product_name: "울 코트" },
    { category_id: "top", brand: "Uniqlo", product_name: "크루넥 티" },
    { category_id: "bottom", brand: "Levi's", product_name: "501 데님" },
  ]);
  await login(page, user);
  await expect(page.locator("table:visible").first()).toBeVisible();

  await page.getByRole("button", { name: "옷 삭제" }).click();
  await expect(page.locator("table:visible")).toHaveCount(0);
  const submit = page.getByRole("button", { name: /^선택 삭제하기/ });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: "COS 울 코트 선택" }).check();
  await page.getByRole("checkbox", { name: "Levi's 501 데님 선택" }).check();
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText("선택 삭제하기 (2)");
  await submit.click();
  await page.getByRole("alertdialog", { name: "2벌을 삭제할까요?" }).getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("2벌을 삭제했습니다")).toBeVisible();
  // 삭제가 끝나면 원래 보기로 돌아온다.
  await expect(submit).toHaveCount(0);
  await expect(page.locator("table:visible").getByText("크루넥 티")).toBeVisible();
  await expect(page.getByText("울 코트")).toHaveCount(0);
  const { data: rows } = await admin.from("garments").select("id, deleted_at").in("id", ids);
  expect(rows?.filter((r) => r.deleted_at).map((r) => r.id).sort()).toEqual([ids[0], ids[2]].sort());

  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(page.locator("table:visible").getByText("울 코트")).toBeVisible();
  const { data: back } = await admin.from("garments").select("deleted_at").in("id", ids);
  expect(back?.every((r) => r.deleted_at === null)).toBe(true);
});

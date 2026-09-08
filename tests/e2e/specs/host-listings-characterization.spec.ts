import hostListContract from "../../../src/features/profile/api/__fixtures__/host-accommodation-list.json" with { type: "json" };
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

test("preserves host status filters, missing-address labels, and management actions", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await page.route("https://d1wivnghydqg7i.cloudfront.net/stay.jpg", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  api.register("GET", "/api/v1/profile/host/accommodations", (request) => {
    const status = new Map(request.query).get("status");
    const accommodations = hostListContract.accommodations.filter(
      (listing) => listing.status === status,
    );
    return apiSuccess({
      accommodations,
      page_info: {
        ...hostListContract.page_info,
        current_size: accommodations.length,
      },
    });
  });

  await page.goto("/profile?mode=host");
  await page
    .getByRole("button", { name: "서울 하우스 31 숙소 관리 열기" })
    .click();
  const dialog = page.getByRole("dialog", { name: "숙소 관리" });
  await expect(
    dialog.getByRole("button", { name: "서울 하우스 31 상세 보기" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "리스팅 비공개", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "리스팅 공개", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "숙소 관리 닫기" }).click();

  await page.getByRole("tab", { name: "비공개", exact: true }).click();
  await page
    .getByRole("button", { name: "서울 하우스 32 숙소 관리 열기" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "리스팅 공개", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "서울 하우스 32 상세 보기" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "숙소 관리 닫기" }).click();

  await page.getByRole("tab", { name: "작성 중", exact: true }).click();
  await expect(page.getByText("위치 정보 없음", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이름 없음 숙소 관리 열기" }).click();
  await expect(
    dialog.getByRole("button", { name: "리스팅 공개", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "리스팅 비공개", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "리스팅 수정", exact: true }),
  ).toBeVisible();
});

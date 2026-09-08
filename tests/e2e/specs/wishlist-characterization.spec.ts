import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";
import mixedHistoryContract from "../../../src/features/wishlist/api/__fixtures__/recently-viewed-mixed-history.json" with { type: "json" };

const pageInfo = {
  has_next: false,
  next_cursor: null,
  current_size: 1,
};

test("renders the backend recent-history contract and removes the selected accommodation", async ({
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
  api.register(
    "GET",
    "/api/v1/members/recently-viewed",
    apiSuccess(mixedHistoryContract),
  );
  api.register(
    "GET",
    "/api/v1/members/wishlists",
    apiSuccess({
      wishlists: [],
      page_info: { ...pageInfo, current_size: 0 },
    }),
  );
  api.register(
    "DELETE",
    "/api/v1/members/recently-viewed/32",
    apiSuccess(null),
  );

  await page.goto("/wishlist?view=recently-viewed");

  await expect(page.getByRole("listitem")).toHaveCount(3);
  const detailButtons = page.getByRole("button", {
    name: /서울 하우스 \d+ 숙소 상세 보기/,
  });
  await expect(detailButtons.nth(0)).toHaveAccessibleName(
    "서울 하우스 33 숙소 상세 보기",
  );
  await expect(detailButtons.nth(1)).toHaveAccessibleName(
    "서울 하우스 32 숙소 상세 보기",
  );
  await expect(detailButtons.nth(2)).toHaveAccessibleName(
    "서울 하우스 31 숙소 상세 보기",
  );
  await expect(page.getByLabel("평점 4.8, 후기 (4)")).toBeVisible();
  await expect(page.getByLabel("평점 0.0, 후기 (0)")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "서울 하우스 31 위시리스트 변경" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "서울 하우스 32 위시리스트 저장" }),
  ).toBeVisible();

  api.register(
    "GET",
    "/api/v1/members/recently-viewed",
    apiSuccess({
      accommodations: mixedHistoryContract.accommodations.filter(
        (item) => item.accommodation_id !== 32,
      ),
      total_count: 2,
    }),
  );
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page
    .getByRole("button", { name: "서울 하우스 32 최근 조회에서 삭제" })
    .click();

  await expect(
    page.getByRole("button", { name: "서울 하우스 32 숙소 상세 보기" }),
  ).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(2);
});

test("restores wishlist index, recent, and detail views through browser history", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/members/recently-viewed",
    apiSuccess({
      accommodations: [
        {
          viewed_at: "2026-08-29T00:00:00Z",
          accommodation_id: 81,
          accommodation_name: "최근 본 테스트 숙소",
          thumbnail_url: null,
          address_summary: null,
          review_summary: null,
          is_in_wishlist: false,
        },
      ],
      total_count: 1,
    }),
  );
  api.register(
    "GET",
    "/api/v1/members/wishlists",
    apiSuccess({
      wishlists: [
        {
          id: 7,
          name: "브라우저 테스트 여행",
          created_at: "2026-08-29T00:00:00Z",
          wishlist_item_count: 2,
          thumbnail_image_url: null,
          is_contained: null,
          wishlist_accommodation_id: null,
        },
      ],
      page_info: pageInfo,
    }),
  );
  api.register(
    "GET",
    "/api/v1/members/wishlists/accommodations/7",
    apiSuccess({
      wishlist_accommodations: [
        {
          wishlist_accommodation_id: 501,
          memo: "브라우저 메모",
          created_at: "2026-08-29T00:00:00Z",
          accommodation: {
            id: 81,
            name: "최근 본 테스트 숙소",
            thumbnail_url: null,
          },
          address_summary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: "종로구",
          },
          review_summary: { total_count: null, average_rating: null },
          is_in_wishlist: true,
        },
        {
          wishlist_accommodation_id: 502,
          memo: null,
          created_at: "2026-08-28T00:00:00Z",
          accommodation: {
            id: 82,
            name: "후기 있는 테스트 숙소",
            thumbnail_url: null,
          },
          address_summary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: "종로구",
          },
          review_summary: { total_count: 8, average_rating: 4.8 },
          is_in_wishlist: true,
        },
      ],
      page_info: { ...pageInfo, current_size: 2 },
    }),
  );

  await page.goto("/wishlist#history");
  await expect(
    page.getByRole("heading", { name: "위시리스트", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: /최근 조회/ }).click();
  await expect(page).toHaveURL(/\/wishlist\?view=recently-viewed#history$/);
  await expect(
    page.getByRole("heading", { name: "최근 조회", level: 1 }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/wishlist#history$/);
  await expect(
    page.getByRole("heading", { name: "위시리스트", level: 1 }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /브라우저 테스트 여행 위시리스트 열기/ })
    .click();
  await expect(page).toHaveURL(/\/wishlist\?id=7#history$/);
  await expect(
    page.getByRole("heading", { name: "브라우저 테스트 여행", level: 1 }),
  ).toBeVisible();

  const unratedCard = page.getByRole("button", {
    name: "최근 본 테스트 숙소 숙소 상세 보기",
    exact: true,
  });
  const ratedCard = page.getByRole("button", {
    name: "후기 있는 테스트 숙소 숙소 상세 보기",
    exact: true,
  });
  await expect(unratedCard).toBeVisible();
  await expect(unratedCard.locator('[aria-label^="평점"]')).toHaveCount(0);
  await expect(ratedCard.getByLabel("평점 4.8, 후기 (8)")).toBeVisible();
  await page.reload();
  await expect(unratedCard).toBeVisible();
  await expect(ratedCard).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/wishlist#history$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/wishlist\?id=7#history$/);
  await expect(page.getByText("브라우저 메모")).toBeVisible();
});

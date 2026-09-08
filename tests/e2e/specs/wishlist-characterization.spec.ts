import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const pageInfo = {
  has_next: false,
  next_cursor: null,
  current_size: 1,
};

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

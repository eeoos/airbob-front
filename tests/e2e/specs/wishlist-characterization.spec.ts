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
          wishlist_item_count: 1,
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
          review_summary: { total_count: 0, average_rating: 0 },
          is_in_wishlist: true,
        },
      ],
      page_info: pageInfo,
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

  await page.getByRole("button", { name: /브라우저 테스트 여행/ }).click();
  await expect(page).toHaveURL(/\/wishlist\?id=7#history$/);
  await expect(
    page.getByRole("heading", { name: "브라우저 테스트 여행", level: 1 }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/wishlist#history$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/wishlist\?id=7#history$/);
  await expect(page.getByText("브라우저 메모")).toBeVisible();
});

import contract from "../../../src/features/accommodations/detail/api/__fixtures__/public-accommodation-detail.json" with { type: "json" };
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

test("uses the public backend contract for photos, amenities, reviews and booking", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await page.setViewportSize({ width: 425, height: 1024 });
  await page.route(
    "https://d1wivnghydqg7i.cloudfront.net/contract/**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/></svg>',
      });
    },
  );
  const path = `/api/v1/accommodations/${contract.id}`;
  api.register("GET", path, apiSuccess(contract));
  api.register(
    "GET",
    `${path}/availability`,
    apiSuccess({
      booking_window_start_inclusive: "2026-07-01",
      booking_window_end_exclusive: "2027-01-01",
      unavailable_ranges: [],
    }),
  );
  api.register(
    "GET",
    `${path}/reviews`,
    apiSuccess({
      page_info: { current_size: 4, has_next: false, next_cursor: null },
      reviews: [5, 5, 4, 4].map((rating, index) => ({
        id: index + 100,
        rating,
        content: `계약 후기 ${index + 1}`,
        reviewed_at: "2026-06-28T01:00:00Z",
        images: [],
        reviewer: {
          id: index + 200,
          nickname: `테스트 회원 ${index + 1}`,
          thumbnail_image_url: null,
        },
      })),
    }),
  );
  api.register("GET", "/api/v1/coupons", apiSuccess({ infos: [] }));

  await page.goto(
    `/accommodations/${contract.id}?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2`,
  );

  await expect(
    page.getByRole("heading", { name: contract.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `${contract.name} 모바일 사진 1 크게 보기`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "숙소 편의시설" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(page.getByText("최대 인원 4명", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "위시리스트에 저장", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "후기 4개 모두 보기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "숙박 날짜 변경" }),
  ).toContainText("300,000");
  expect(api.matching("GET", path)).toHaveLength(1);
  expect(api.matching("GET", `${path}/availability`)).toHaveLength(1);
});

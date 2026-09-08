import expiredGuestListContract from "../../../src/features/reservations/api/__fixtures__/guest-reservation-list-expired.json" with { type: "json" };
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

test("shows an expired hold in cancelled trips using the backend list contract", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await page.route(
    "https://d1wivnghydqg7i.cloudfront.net/stay.jpg",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#e5ddd1"/></svg>',
      });
    },
  );
  api.register("GET", "/api/v1/profile/guest/reservations", (request) => {
    const params = new Map(request.query);
    expect(params.get("filterType")).toBe("CANCELLED");
    return apiSuccess(expiredGuestListContract);
  });

  await page.goto("/profile?mode=guest&tab=cancelled");

  const trip = page.getByRole("link", { name: "목록 숙소 예약 상세 보기" });
  await expect(trip).toBeVisible();
  await expect(trip).toHaveAttribute(
    "href",
    "/reservations/40000000-0000-4000-8000-000000000041",
  );
  await expect(
    page.getByText("2026년 11월 1일 ~ 3일", { exact: true }),
  ).toBeVisible();
  expect(
    api.matching("GET", "/api/v1/profile/guest/reservations"),
  ).toHaveLength(1);
});

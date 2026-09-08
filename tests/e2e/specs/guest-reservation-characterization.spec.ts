import expiredGuestListContract from "../../../src/features/reservations/api/__fixtures__/guest-reservation-list-expired.json" with { type: "json" };
import guestDetailContract from "../../../src/features/reservations/api/__fixtures__/guest-reservation-detail-payment.json" with { type: "json" };
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

test("renders the narrowed guest payment contract with reservation dates and review permission", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await page.route(
    "https://d1wivnghydqg7i.cloudfront.net/contract/**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#e5ddd1"/></svg>',
      });
    },
  );
  await page.route("https://www.google.com/maps/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "Synthetic map",
    });
  });
  const path = `/api/v1/profile/guest/reservations/${guestDetailContract.reservation_uid}`;
  api.register("GET", path, apiSuccess(guestDetailContract));

  await page.goto(`/reservations/${guestDetailContract.reservation_uid}`);

  await expect(page.getByText("GUEST-2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "결제 정보" })).toContainText(
    "₩100,001",
  );
  await expect(page.getByRole("region", { name: "결제 정보" })).toContainText(
    "카드",
  );
  await expect(page.getByRole("region", { name: "결제 정보" })).toContainText(
    "부분 취소",
  );
  await expect(
    page.getByRole("region", { name: "여행을 맞이하는 사람" }),
  ).toContainText("테스트 호스트 님");
  await expect(page.getByRole("region", { name: "여행 일정" })).toContainText(
    "11월 1일",
  );
  await expect(page.getByRole("region", { name: "여행 일정" })).toContainText(
    "11월 3일",
  );
  await expect(page.getByRole("button", { name: "리뷰 작성하기" })).toHaveCount(
    0,
  );
  expect(api.matching("GET", path)).toHaveLength(1);
});

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

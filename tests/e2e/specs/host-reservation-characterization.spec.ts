import hostStayContract from "../../../src/features/reservations/api/__fixtures__/host-reservation-stay-payment.json" with { type: "json" };
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

for (const timezoneId of ["Asia/Seoul", "America/New_York"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });

    test("shows calendar nights and the original payment amount from the backend contract", async ({
      api,
      page,
      session,
    }) => {
      session.authenticate();
      const path = `/profile/host/reservations/${hostStayContract.reservation_uid}`;
      api.register("GET", `/api/v1${path}`, apiSuccess(hostStayContract));

      await page.goto(path);

      await expect(
        page.getByText("2게스트 • 2박 • ₩100,001", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("2026년 11월 1일 (일)", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("2026년 11월 3일 (화)", { exact: true }),
      ).toBeVisible();
      const payment = page.getByRole("complementary", { name: "결제 정보" });
      await expect(
        payment.getByText("숙박 기간", { exact: true }),
      ).toBeVisible();
      await expect(payment.getByText("2박", { exact: true })).toBeVisible();
      await expect(
        payment.getByText("최초 결제 금액", { exact: true }),
      ).toBeVisible();
      await expect(
        payment.getByText("₩100,001", { exact: true }),
      ).toBeVisible();
      await expect(payment).not.toContainText("×");
    });
  });
}

test("explains loaded-only sorting and reorders newly loaded reservations without dropping rows", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  const firstPage = Array.from({ length: 20 }, (_, index) => ({
    reservation_uid: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    reservation_code: `HOST-${index}`,
    total_price: 100001,
    currency: "KRW",
    guest_count: 2,
    check_in_date: `2026-11-${String(index + 10).padStart(2, "0")}`,
    check_out_date: `2026-11-${String(index + 11).padStart(2, "0")}`,
    time_zone_id: "Asia/Seoul",
    status: "CONFIRMED",
    created_at: `2026-09-${String(20 - index).padStart(2, "0")}T00:00:00Z`,
    guest: {
      id: index + 1,
      nickname: `게스트 ${index}`,
      thumbnail_image_url: null,
    },
    accommodation: { id: 7, name: "호스트 계약 숙소", thumbnail_url: null },
  }));
  api.register("GET", "/api/v1/profile/host/reservations", (request) => {
    const params = new Map(request.query);
    expect(params.get("filterType")).toBe("UPCOMING");
    expect(params.get("size")).toBe("20");
    if (params.get("cursor") === "page-2") {
      return apiSuccess({
        reservations: [
          {
            ...firstPage[0],
            reservation_uid: "10000000-0000-4000-8000-000000000021",
            reservation_code: "HOST-20",
            check_in_date: "2026-11-05",
            check_out_date: "2026-11-06",
            guest: {
              id: 21,
              nickname: "다음 페이지 게스트",
              thumbnail_image_url: null,
            },
          },
        ],
        page_info: { current_size: 1, has_next: false, next_cursor: null },
      });
    }
    return apiSuccess({
      reservations: firstPage,
      page_info: { current_size: 20, has_next: true, next_cursor: "page-2" },
    });
  });

  await page.goto("/profile?mode=host&tab=reservations-upcoming");

  const details = page.getByRole("button", { name: /예약 상세$/ });
  await expect(
    page.getByText(
      "현재 불러온 예약 20건 안에서 체크인 날짜순으로 정렬합니다.",
    ),
  ).toBeVisible();
  await expect(details).toHaveCount(20);
  await expect(details.first()).toHaveAccessibleName("게스트 19 예약 상세");
  await page.getByRole("button", { name: "체크인 늦은 날짜순 정렬" }).click();
  await expect(details.first()).toHaveAccessibleName("게스트 0 예약 상세");
  await page.mouse.wheel(0, 10000);

  await expect(details).toHaveCount(21);
  await page
    .getByRole("button", { name: "체크인 빠른 날짜순 정렬" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "현재 불러온 예약 21건 안에서 체크인 날짜순으로 정렬합니다.",
    ),
  ).toBeVisible();
  await expect(details.first()).toHaveAccessibleName(
    "다음 페이지 게스트 예약 상세",
  );
  expect(api.matching("GET", "/api/v1/profile/host/reservations")).toHaveLength(
    2,
  );
});

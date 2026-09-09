import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

test.use({ hasTouch: true });

const imageUrl = "https://images.airbob.invalid/mobile-detail.svg";
const name = "모바일 상세 확인 숙소";
const address = {
  country: "대한민국",
  state: null,
  city: "부산",
  district: "중구",
};
const coordinate = { latitude: 35.17, longitude: 129.07 };
const summary = { total_count: 3, average_rating: 4.67 };
const searchUrl =
  "/search?destination=Busan&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2";

test.beforeEach(async ({ api, session, context }) => {
  session.clear();
  await context.route(imageUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/></svg>',
    }),
  );
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess({
      stay_search_result_listing: [
        {
          id: 281,
          name,
          accommodation_thumbnail_url: imageUrl,
          base_price: 150000,
          currency: "KRW",
          type: "HOUSE",
          address_summary: address,
          coordinate,
          review_summary: summary,
          is_in_wishlist: false,
        },
      ],
      page_info: {
        page_size: 18,
        current_page: 0,
        total_pages: 1,
        total_elements: 1,
        is_first: true,
        is_last: true,
        has_next: false,
        has_previous: false,
      },
    }),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/281",
    apiSuccess({
      id: 281,
      name,
      description: "숙소 상세 설명",
      type: "ENTIRE_PLACE",
      base_price: 150000,
      currency: "KRW",
      check_in_time: "15:00:00",
      check_out_time: "11:00:00",
      time_zone_id: "Asia/Seoul",
      is_in_wishlist: false,
      address_summary: address,
      coordinate,
      host: { id: 282, nickname: "호스트", thumbnail_image_url: null },
      policy: { max_occupancy: 4, infant_occupancy: 1, pet_occupancy: 1 },
      amenities: [
        { type: "WIFI", count: 1 },
        { type: "HEATING", count: 1 },
        { type: "AIR_CONDITIONER", count: 1 },
      ],
      images: [1, 2, 3].map((id) => ({ id, image_url: imageUrl })),
      review_summary: summary,
    }),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/281/availability",
    apiSuccess({
      booking_window_start_inclusive: "2026-07-01",
      booking_window_end_exclusive: "2027-01-01",
      unavailable_ranges: [],
    }),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/281/reviews",
    apiSuccess({
      page_info: { current_size: 3, has_next: false, next_cursor: null },
      reviews: [1, 2, 3].map((id) => ({
        id,
        content: `후기 ${id} 내용입니다.`,
        rating: 5,
        images: [],
        reviewed_at: "2026-06-28T01:00:00Z",
        reviewer: {
          id: id + 300,
          nickname: `게스트 ${id}`,
          thumbnail_image_url: null,
        },
      })),
    }),
  );
});

test("opens mobile details in place with a photo header, review carousel and inline booking calendar", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 425, height: 1024 });
  await page.goto(searchUrl);
  const pagesBefore = context.pages().length;
  await page.getByRole("link", { name: `숙소 상세 보기: ${name}` }).click();
  await expect(page).toHaveURL(/\/accommodations\/281\?.*adultOccupancy=2/);
  expect(context.pages()).toHaveLength(pagesBefore);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Airbob 홈으로 이동" }),
  ).toBeHidden();
  const photo = page.getByRole("button", {
    name: `${name} 모바일 사진 1 크게 보기`,
  });
  const bounds = await photo.boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.y).toBe(0);
  expect(bounds?.width).toBe(425);
  const save = page.getByRole("button", {
    name: "위시리스트에 저장",
    exact: true,
  });
  expect((await save.boundingBox())?.x).toBeGreaterThan(350);
  const amenityBounds = await page
    .getByRole("region", { name: "숙소 편의시설" })
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map((item) => ({
        x: item.getBoundingClientRect().x,
        y: item.getBoundingClientRect().y,
      })),
    );
  expect(amenityBounds[0]?.y).toBe(amenityBounds[1]?.y);
  expect(amenityBounds[1]?.x).toBeGreaterThan(amenityBounds[0]?.x ?? 0);

  const carousel = page.getByRole("region", {
    name: "후기 미리보기",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "이전 후기", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "다음 후기", exact: true }),
  ).toHaveCount(0);
  await carousel.scrollIntoViewIfNeeded();
  const carouselBounds = await carousel.boundingBox();
  expect(carouselBounds).not.toBeNull();
  const swipeY = carouselBounds!.y + 80;
  const touchClient = await context.newCDPSession(page);
  await touchClient.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 330, y: swipeY }],
  });
  for (let step = 1; step <= 10; step++) {
    await touchClient.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 330 - step * 25, y: swipeY }],
    });
  }
  await touchClient.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touchClient.detach();
  await expect
    .poll(() => carousel.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(100);
  const widths = await carousel.evaluate((el) => ({
    card: el.firstElementChild?.getBoundingClientRect().width ?? 0,
    viewport: el.clientWidth,
  }));
  expect(widths.card).toBeGreaterThan(250);
  expect(widths.card).toBeLessThan(widths.viewport);
  await page.getByRole("button", { name: "후기 3개 모두 보기" }).click();
  const reviews = page.getByRole("dialog", { name: "후기 3개", exact: true });
  await expect(reviews).toBeVisible();
  expect(await reviews.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 425,
    height: 1024,
  });
  await reviews.getByRole("button", { name: "후기 모달 닫기" }).click();
  await expect(reviews).toBeHidden();

  await page.getByRole("button", { name: "숙박 날짜 변경" }).click();
  const calendar = page.getByRole("region", { name: "숙박 날짜", exact: true });
  await expect(
    calendar.getByRole("heading", { name: "부산, 대한민국에서 2박" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("dialog", { name: "예약 정보", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "성인 늘리기" })).toHaveCount(
    0,
  );
  await expect(calendar.getByRole("grid")).toHaveCount(1);
  await calendar.getByRole("gridcell", { name: /2026년 7월 10일/ }).click();
  await calendar.getByRole("gridcell", { name: /2026년 7월 14일/ }).click();
  await expect(page).toHaveURL(/checkOut=2026-07-14/);
  await expect(
    page.getByRole("button", { name: "숙박 날짜 변경" }),
  ).toContainText("게스트 2명");
  await expect(
    page.getByRole("button", { name: "숙박 날짜 변경" }),
  ).toContainText("600,000");
  await expect(
    calendar.getByRole("heading", { name: "부산, 대한민국에서 4박" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "이전 화면으로", exact: true })
    .click();
  await expect(page).toHaveURL(searchUrl);
  expect(context.pages()).toHaveLength(pagesBefore);
});

test("keeps desktop details in a new tab with the existing booking card", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(searchUrl);
  const newPage = context.waitForEvent("page");
  await page.getByRole("link", { name: `숙소 상세 보기: ${name}` }).click();
  const detail = await newPage;
  await expect(detail).toHaveURL(/\/accommodations\/281\?/);
  await expect(page).toHaveURL(searchUrl);
  await expect(
    detail.getByRole("region", { name: "숙소 예약", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("link", { name: "Airbob 홈으로 이동" }),
  ).toBeVisible();
  const booking = detail.getByRole("region", {
    name: "숙소 예약",
    exact: true,
  });
  await booking.getByRole("button", { name: /^체크인 / }).click();
  const calendar = booking.getByRole("dialog", {
    name: "예약 날짜 선택",
    exact: true,
  });
  await expect(calendar.getByRole("grid")).toHaveCount(2);
  await calendar.getByRole("button", { name: "날짜 지우기" }).click();
  await calendar.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    booking.getByRole("heading", { name: "날짜를 선택해 요금 확인" }),
  ).toBeVisible();
  await booking
    .getByRole("button", { name: "예약 가능 여부 보기", exact: true })
    .click();
  await expect(calendar).toBeVisible();
});

test("selects missing dates from the mobile booking bar at 320px and supports direct-entry back navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/accommodations/281");
  await page
    .getByRole("button", { name: "예약 가능 여부 보기", exact: true })
    .click();
  const dates = page.getByRole("dialog", {
    name: "예약 날짜 선택",
    exact: true,
  });
  await expect(
    dates.getByRole("heading", { name: "체크인 날짜 선택" }),
  ).toBeVisible();
  await expect(
    dates.getByRole("button", { name: "저장", exact: true }),
  ).toBeDisabled();
  await expect(dates.getByRole("grid")).toHaveCount(7);
  expect(await dates.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(320);
  await dates.getByRole("gridcell", { name: /2026년 8월 30일/ }).click();
  await expect(
    dates.getByRole("heading", { name: "체크아웃 날짜 선택" }),
  ).toBeVisible();
  await dates.getByRole("gridcell", { name: /2026년 9월 2일/ }).click();
  await expect(page).not.toHaveURL(/checkIn=/);
  await dates.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dates).toBeHidden();
  await expect(page).toHaveURL(/checkIn=2026-08-30&checkOut=2026-09-02/);
  const calendar = page.getByRole("region", { name: "숙박 날짜", exact: true });
  await expect(
    page.getByRole("button", { name: "숙박 날짜 변경" }),
  ).toContainText("450,000");
  await expect(
    calendar.getByRole("grid", { name: "2026년 8월" }),
  ).toBeVisible();
  await calendar.getByRole("button", { name: "날짜 지우기" }).click();
  await expect(page).not.toHaveURL(/checkIn=/);
  await expect(
    page.getByRole("button", { name: "숙박 날짜 변경" }),
  ).toContainText("날짜를 선택해");
  await expect(
    page.getByRole("button", { name: "숙박 날짜 변경" }),
  ).toContainText("★ 4.7");
  await page
    .getByRole("button", { name: "예약 가능 여부 보기", exact: true })
    .click();
  await expect(dates).toBeVisible();
  await dates.getByRole("gridcell", { name: /2026년 7월 10일/ }).click();
  await dates.getByRole("gridcell", { name: /2026년 7월 12일/ }).click();
  await dates.getByRole("button", { name: "날짜 선택 닫기" }).click();
  await expect(page).not.toHaveURL(/checkIn=/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: "이전 화면으로", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search$/);
});

test("opens editable review from the mobile booking bar and returns to the inline calendar without checkout", async ({
  page,
  api,
  session,
}) => {
  session.authenticate();
  api.register("GET", "/api/v1/coupons", apiSuccess({ infos: [] }));
  api.register("GET", "/api/v1/members/me/coupons", apiSuccess({ infos: [] }));
  api.register(
    "POST",
    "/api/v1/members/recently-viewed/281",
    apiSuccess(null, 201),
  );
  api.register(
    "POST",
    "/api/v1/reservation-quotes",
    apiSuccess(
      {
        quote_uid: "11111111-1111-4111-8111-111111111111",
        accommodation_id: 281,
        order_name: `${name} 2박`,
        check_in: "2026-07-10",
        check_out: "2026-07-12",
        guest_count: 2,
        nightly_price: 150000,
        nights: 2,
        subtotal: 300000,
        discount_amount: 0,
        amount: 300000,
        currency: "KRW",
        payment_required: true,
        inventory_held: false,
        server_time: "2026-07-01T03:00:00Z",
      },
      201,
    ),
  );
  await page.setViewportSize({ width: 425, height: 1024 });
  await page.goto(
    "/accommodations/281?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
  );
  await page.getByRole("button", { name: "예약하기", exact: true }).click();
  await expect(page).toHaveURL("/accommodations/281/confirm");
  const review = page.getByRole("region", { name: "예약 검토" });
  await expect(review).toBeInViewport();
  await expect(page.getByRole("main")).toContainText("₩300,000");
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeEnabled();
  expect(api.matching("POST", "/api/v1/reservations")).toHaveLength(0);
  await page.getByRole("button", { name: "날짜 변경", exact: true }).click();
  const dateEditor = page.getByRole("dialog", {
    name: "날짜 변경",
    exact: true,
  });
  await expect(
    dateEditor.getByRole("gridcell", { name: /2026년 7월 15일/ }),
  ).toBeEnabled();
  await dateEditor.getByRole("button", { name: "취소", exact: true }).click();
  await page
    .getByRole("button", { name: "숙소로 돌아가기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/accommodations\/281\?checkIn=2026-07-10/);
  const calendar = page.getByRole("region", { name: "숙박 날짜", exact: true });
  await expect(
    calendar.getByRole("gridcell", { name: /2026년 7월 15일/ }),
  ).toBeEnabled();
  expect(api.matching("POST", "/api/v1/reservations")).toHaveLength(0);
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 425, height: 1024 },
]) {
  test.describe(`photo gallery at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true });

    test("dismisses empty space by mouse and touch while keeping photos and controls active", async ({
      page,
    }) => {
      await page.goto("/accommodations/281");
      const photoTrigger = page.getByRole("button", {
        name: /(?:대표 사진|모바일 사진 1) 크게 보기$/,
      });
      await photoTrigger.click();
      const gallery = page.getByRole("dialog", { name: `${name} 사진 갤러리` });
      const closeControl = gallery.getByRole("button", {
        name: "사진 갤러리 닫기",
        exact: true,
      });
      await expect(closeControl).toHaveCSS("clip-path", "inset(50%)");
      const mainPhoto = gallery.locator("img:not(button img)");
      await mainPhoto.click();
      await expect(gallery).toBeVisible();
      await gallery
        .getByRole("button", { name: "다음 사진", exact: true })
        .click();
      await expect(mainPhoto).toHaveAttribute("alt", `${name} 2`);
      await gallery
        .getByRole("button", { name: `${name} 사진 3 보기`, exact: true })
        .click();
      await expect(mainPhoto).toHaveAttribute("alt", `${name} 3`);

      const dialogBounds = await gallery.boundingBox();
      const thumbnailBounds = await gallery
        .getByRole("button", { name: `${name} 사진 3 보기`, exact: true })
        .boundingBox();
      expect(dialogBounds).not.toBeNull();
      expect(thumbnailBounds).not.toBeNull();
      // This blank point is inside the transparent dialog, beyond the thumbnails.
      const blank = {
        x: dialogBounds!.x + dialogBounds!.width - 12,
        y: thumbnailBounds!.y + thumbnailBounds!.height / 2,
      };
      expect(blank.x).toBeGreaterThan(
        thumbnailBounds!.x + thumbnailBounds!.width,
      );
      await page.mouse.click(blank.x, blank.y);
      await expect(gallery).toBeHidden();
      await expect(photoTrigger).toBeFocused();

      await photoTrigger.click();
      await expect(gallery).toBeVisible();
      await page.touchscreen.tap(blank.x, blank.y);
      await expect(gallery).toBeHidden();
      await expect(photoTrigger).toBeFocused();

      await photoTrigger.click();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(closeControl).toBeFocused();
      await expect(closeControl).toHaveCSS("clip-path", "none");
      await closeControl.press("Escape");
      await expect(gallery).toBeHidden();
    });
  });
}

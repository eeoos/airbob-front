import type { Locator } from "@playwright/test";
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const syntheticAccommodation = {
  id: 181,
  name: "반응형 테스트 숙소",
  accommodation_thumbnail_url: null,
  base_price: 181_000,
  currency: "KRW",
  type: "HOUSE",
  address_summary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "마포구",
  },
  coordinate: {
    latitude: 37.556,
    longitude: 126.923,
  },
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  is_in_wishlist: false,
};

const searchResponse = {
  stay_search_result_listing: [syntheticAccommodation],
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
};

const searchURL = "/search?destination=Seoul&adultOccupancy=2";
const detailURL =
  "/accommodations/281?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2";

const responsiveDetailAccommodation = {
  id: 281,
  name: "반응형 상세 테스트 숙소",
  description: "작은 화면부터 넓은 화면까지 흐름을 확인하는 합성 숙소입니다.",
  type: "ENTIRE_PLACE",
  base_price: 210_000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  time_zone_id: "Asia/Seoul",
  is_in_wishlist: false,
  address_summary: {
    country: "대한민국",
    state: "서울특별시",
    city: "서울",
    district: "마포구",
  },
  coordinate: {
    latitude: 37.556,
    longitude: 126.923,
  },
  host: {
    id: 282,
    nickname: "반응형 호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: [
    { type: "WIFI", count: 1 },
    { type: "HEATING", count: 1 },
  ],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

const responsiveDetailAvailability = {
  booking_window_start_inclusive: "2026-01-01",
  booking_window_end_exclusive: "2027-01-01",
  unavailable_ranges: [],
};

const expectFullyInsideViewport = async (locator: Locator, width: number) => {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? width) + (bounds?.width ?? 1)).toBeLessThanOrEqual(
    width,
  );
};

const expectNoHorizontalOverflow = async (
  page: import("@playwright/test").Page,
  width: number,
) => {
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(widths.viewport).toBe(width);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
};

test("keeps the 320px search route free of horizontal overflow with core actions reachable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(searchResponse),
  );
  await page.setViewportSize({ width: 320, height: 720 });

  await page.goto(searchURL);

  const search = page.getByRole("search", { name: "숙소 검색" });
  const coreActions = [
    page.getByRole("link", { name: "Airbob 홈으로 이동" }),
    search.getByRole("button", { name: "검색" }),
    page.getByRole("button", { name: "사용자 메뉴" }),
    page.getByRole("button", { name: /검색 결과 패널 조절/ }),
  ];

  for (const action of coreActions) {
    await expectFullyInsideViewport(action, 320);
  }

  await expect(
    page.getByRole("link", {
      name: "숙소 상세 보기: 반응형 테스트 숙소",
    }),
  ).toHaveCount(1);

  await expectNoHorizontalOverflow(page, 320);
});

test("keeps the search action balanced from 320px through 4K", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(searchResponse),
  );

  const viewportWidths = [
    320, 390, 768, 769, 1024, 1025, 1280, 1920, 2560, 3840,
  ];

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(searchURL);

    const search = page.getByRole("search", { name: "숙소 검색" });
    const searchButton = search.getByRole("button", { name: "검색" });
    const compactGeometry = await searchButton.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const visual = getComputedStyle(button, "::before");
      const icon = button.querySelector("svg")?.getBoundingClientRect();

      return {
        buttonHeight: bounds.height,
        buttonWidth: bounds.width,
        iconHeight: icon?.height ?? 0,
        iconWidth: icon?.width ?? 0,
        visualHeight: Number.parseFloat(visual.height),
        visualWidth: Number.parseFloat(visual.width),
      };
    });

    expect(compactGeometry, `compact geometry at ${width}px`).toEqual({
      buttonHeight: 44,
      buttonWidth: 44,
      iconHeight: 14,
      iconWidth: 14,
      visualHeight: 40,
      visualWidth: 40,
    });
    await expectFullyInsideViewport(searchButton, width);

    await search.getByRole("button", { name: "Seoul" }).click();
    await expect(search).toHaveAttribute("data-expanded", "");

    const expandedGeometry = await searchButton.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const visual = getComputedStyle(button, "::before");
      const icon = button.querySelector("svg")?.getBoundingClientRect();

      return {
        buttonHeight: bounds.height,
        buttonWidth: bounds.width,
        iconHeight: icon?.height ?? 0,
        iconWidth: icon?.width ?? 0,
        visualHeight: Number.parseFloat(visual.height),
        visualWidth: Number.parseFloat(visual.width),
      };
    });

    expect(expandedGeometry, `expanded geometry at ${width}px`).toEqual({
      buttonHeight: 44,
      buttonWidth: 44,
      iconHeight: width <= 768 ? 14 : 16,
      iconWidth: width <= 768 ? 14 : 16,
      visualHeight: 44,
      visualWidth: 44,
    });
    await expectFullyInsideViewport(searchButton, width);
    await expectNoHorizontalOverflow(page, width);
  }
});

const responsiveBoundary = (
  width: number,
  layout: "bottom-sheet" | "desktop",
) => {
  const hasBottomSheet = layout === "bottom-sheet";

  return {
    width,
    layout,
    bottomSheetCount: hasBottomSheet ? 1 : 0,
    controlledRegions: hasBottomSheet ? [true] : [],
    bottomSheetVisible: hasBottomSheet,
  };
};

for (const boundary of [
  responsiveBoundary(320, "bottom-sheet"),
  responsiveBoundary(390, "bottom-sheet"),
  responsiveBoundary(768, "bottom-sheet"),
  responsiveBoundary(1023, "bottom-sheet"),
  responsiveBoundary(1024, "bottom-sheet"),
  responsiveBoundary(1025, "desktop"),
  responsiveBoundary(1280, "desktop"),
  responsiveBoundary(1440, "desktop"),
]) {
  test(`renders only the ${boundary.layout} result layout at ${boundary.width}px`, async ({
    api,
    page,
    session,
  }) => {
    session.clear();
    api.register(
      "GET",
      "/api/v1/search/accommodations",
      apiSuccess(searchResponse),
    );
    await page.setViewportSize({ width: boundary.width, height: 720 });

    await page.goto(searchURL);

    const resultLink = page.getByRole("link", {
      name: "숙소 상세 보기: 반응형 테스트 숙소",
    });
    const bottomSheetHandle = page.getByRole("button", {
      name: /검색 결과 패널 조절/,
    });
    const bottomSheetResults = page.getByRole("group", {
      name: "검색 결과 목록",
    });
    await expect(resultLink).toHaveCount(1);
    await expect(resultLink).toBeVisible();
    await expect(bottomSheetHandle).toHaveCount(boundary.bottomSheetCount);
    await expect(bottomSheetResults).toHaveCount(boundary.bottomSheetCount);
    await expect(bottomSheetHandle).toBeVisible({
      visible: boundary.bottomSheetVisible,
    });
    await expect(bottomSheetResults).toBeVisible({
      visible: boundary.bottomSheetVisible,
    });

    const controlledRegions = await bottomSheetHandle.evaluateAll((handles) =>
      handles.map((handle) => {
        const controlledId = handle.getAttribute("aria-controls");
        return Boolean(controlledId && document.getElementById(controlledId));
      }),
    );
    expect(controlledRegions).toEqual(boundary.controlledRegions);
    await expectNoHorizontalOverflow(page, boundary.width);
  });
}

test("reflows the detail hero, overview, and booking entry from 320px through 1440px", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/accommodations/281",
    apiSuccess(responsiveDetailAccommodation),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/281/availability",
    apiSuccess(responsiveDetailAvailability),
  );

  await page.goto(detailURL);
  await expect(
    page.getByRole("heading", {
      name: "반응형 상세 테스트 숙소",
      level: 1,
    }),
  ).toBeVisible();

  const layouts = [
    { width: 320, comparisonAxis: "y" },
    { width: 390, comparisonAxis: "y" },
    { width: 768, comparisonAxis: "y" },
    { width: 1024, comparisonAxis: "y" },
    { width: 1025, comparisonAxis: "x" },
    { width: 1280, comparisonAxis: "x" },
    { width: 1440, comparisonAxis: "x" },
  ] as const;

  for (const { width, comparisonAxis } of layouts) {
    await test.step(`${width}px detail layout`, async () => {
      await page.setViewportSize({ width, height: width <= 768 ? 844 : 900 });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      );

      const homeLink = page.getByRole("link", {
        name: "Airbob 홈으로 이동",
      });
      const heroFallback = page.getByRole("img", {
        name: "반응형 상세 테스트 숙소 숙소 사진 없음",
      });
      const overviewHeading = page.getByRole("heading", {
        name: "서울의 전체 숙소",
        level: 2,
      });
      const bookingAction = page.getByRole("button", { name: "예약하기" });

      await expectFullyInsideViewport(homeLink, width);
      await expect(heroFallback).toBeVisible();
      await expect(overviewHeading).toBeVisible();
      await expect(bookingAction).toBeVisible();
      await expectNoHorizontalOverflow(page, width);

      const overviewBounds = await overviewHeading.boundingBox();
      const bookingBounds = await bookingAction.boundingBox();
      expect(overviewBounds).not.toBeNull();
      expect(bookingBounds).not.toBeNull();

      expect(bookingBounds?.[comparisonAxis] ?? 0).toBeGreaterThan(
        overviewBounds?.[comparisonAxis] ?? Number.POSITIVE_INFINITY,
      );
    });
  }
});

test("keeps booking fields anchored when the calendar opens from 320px through wide desktop", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/accommodations/281",
    apiSuccess(responsiveDetailAccommodation),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/281/availability",
    apiSuccess(responsiveDetailAvailability),
  );

  const viewportWidths = [
    320, 390, 768, 769, 1024, 1025, 1280, 1440, 1920, 2560, 3840,
  ];

  for (const width of viewportWidths) {
    await test.step(`${width}px anchored booking calendar`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/accommodations/281?adultOccupancy=1");

      const bookingCard = page.getByRole("region", { name: "숙소 예약" });
      const fields = {
        checkIn: bookingCard.getByRole("button", {
          name: "체크인 날짜 추가",
        }),
        checkOut: bookingCard.getByRole("button", {
          name: "체크아웃 날짜 추가",
        }),
        guests: bookingCard.getByRole("button", { name: /인원/ }),
        primaryAction: bookingCard.getByRole("button", {
          name: "예약 가능 여부 보기",
        }),
      };
      await bookingCard.scrollIntoViewIfNeeded();
      await expect(fields.checkIn).toBeVisible();

      const before = Object.fromEntries(
        await Promise.all(
          Object.entries(fields).map(async ([name, locator]) => [
            name,
            await locator.boundingBox(),
          ]),
        ),
      );

      await fields.checkIn.click();
      const dateOverlay = page.getByRole("dialog", {
        name: "예약 날짜 선택",
      });
      await expect(dateOverlay).toBeVisible();

      const after = Object.fromEntries(
        await Promise.all(
          Object.entries(fields).map(async ([name, locator]) => [
            name,
            await locator.boundingBox(),
          ]),
        ),
      );

      for (const name of Object.keys(fields)) {
        const beforeBounds = before[name];
        const afterBounds = after[name];
        expect(beforeBounds, `${name} before at ${width}px`).not.toBeNull();
        expect(afterBounds, `${name} after at ${width}px`).not.toBeNull();
        for (const key of ["x", "y", "width", "height"] as const) {
          expect(
            afterBounds?.[key],
            `${name}.${key} at ${width}px`,
          ).toBeCloseTo(beforeBounds?.[key] ?? Number.NaN, 1);
        }
      }

      const overlayBounds = await dateOverlay.boundingBox();
      expect(overlayBounds).not.toBeNull();
      expect(overlayBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(
        (overlayBounds?.x ?? width) + (overlayBounds?.width ?? 1),
      ).toBeLessThanOrEqual(width);

      await expectNoHorizontalOverflow(page, width);

      await dateOverlay.getByRole("button", { name: "닫기" }).click();
      await expect(dateOverlay).toBeHidden();
    });
  }
});

test("keeps the fixed mobile calendar above the anchored booking fields", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/accommodations/281",
    apiSuccess(responsiveDetailAccommodation),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/281/availability",
    apiSuccess(responsiveDetailAvailability),
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/accommodations/281?adultOccupancy=1");

  const bookingCard = page.getByRole("region", { name: "숙소 예약" });
  const checkIn = bookingCard.getByRole("button", {
    name: "체크인 날짜 추가",
  });
  await bookingCard.scrollIntoViewIfNeeded();
  await checkIn.click();

  const dateOverlay = page.getByRole("dialog", { name: "예약 날짜 선택" });
  const overlayBounds = await dateOverlay.boundingBox();
  const checkInBounds = await checkIn.boundingBox();
  expect(overlayBounds).not.toBeNull();
  expect(checkInBounds).not.toBeNull();
  const overlapLeft = Math.max(overlayBounds!.x, checkInBounds!.x);
  const overlapTop = Math.max(overlayBounds!.y, checkInBounds!.y);
  const overlapRight = Math.min(
    overlayBounds!.x + overlayBounds!.width,
    checkInBounds!.x + checkInBounds!.width,
  );
  const overlapBottom = Math.min(
    overlayBounds!.y + overlayBounds!.height,
    checkInBounds!.y + checkInBounds!.height,
  );
  expect(overlapRight).toBeGreaterThan(overlapLeft);
  expect(overlapBottom).toBeGreaterThan(overlapTop);

  const overlayOwnsOverlap = await dateOverlay.evaluate(
    (dialog, point) => {
      const hitTarget = document.elementFromPoint(point.x, point.y);
      return Boolean(hitTarget && dialog.contains(hitTarget));
    },
    {
      x: overlapLeft + (overlapRight - overlapLeft) / 2,
      y: overlapTop + (overlapBottom - overlapTop) / 2,
    },
  );
  expect(overlayOwnsOverlap).toBe(true);
});

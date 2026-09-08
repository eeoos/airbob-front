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
const DETAIL_PAGE_MAX_WIDTH = 1760;

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
    search.getByRole("button", { name: "이전 화면으로" }),
    search.getByRole("button", {
      name: /Seoul.*검색 조건 수정/,
    }),
    search.getByRole("button", { name: "검색 조건 수정", exact: true }),
    page.getByRole("button", { name: /검색 결과 패널 조절/ }),
  ];

  for (const action of coreActions) {
    await expectFullyInsideViewport(action, 320);
  }

  const resultLink = page.getByRole("link", {
    name: "숙소 상세 보기: 반응형 테스트 숙소",
    includeHidden: true,
  });
  await expect(resultLink).toBeVisible();
  await page.getByRole("button", { name: /검색 결과 패널 조절/ }).click();
  await expect(resultLink).toBeVisible();

  await expectNoHorizontalOverflow(page, 320);
});

test("keeps the mobile search summary balanced through the tablet boundary", async ({
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

  for (const width of [320, 390, 768, 769, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(searchURL);

    const search = page.getByRole("search", { name: "숙소 검색" });
    const summaryButton = search.getByRole("button", {
      name: /Seoul.*검색 조건 수정/,
    });
    const filterButton = search.getByRole("button", {
      name: "검색 조건 수정",
      exact: true,
    });
    const compactGeometry = await summaryButton.evaluate((button) => {
      const bounds = button.getBoundingClientRect();

      return {
        buttonHeight: bounds.height,
        buttonWidth: bounds.width,
      };
    });

    expect(
      compactGeometry.buttonHeight,
      `mobile summary height at ${width}px`,
    ).toBeGreaterThanOrEqual(44);
    expect(
      compactGeometry.buttonWidth,
      `mobile summary width at ${width}px`,
    ).toBeGreaterThan(0);
    await expectFullyInsideViewport(summaryButton, width);
    await expectFullyInsideViewport(filterButton, width);

    await summaryButton.click();
    const dialog = page.getByRole("dialog", { name: "숙소 검색" });
    const submitButton = dialog.getByRole("button", {
      name: "검색",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(submitButton).toBeVisible();
    const submitBounds = await submitButton.boundingBox();
    expect(submitBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectFullyInsideViewport(submitButton, width);
    await dialog.getByRole("button", { name: "검색 닫기" }).click();
    await expectNoHorizontalOverflow(page, width);
  }
});

test("keeps the desktop search action balanced from 1025px through 4K", async ({
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

  for (const width of [1025, 1280, 1920, 2560, 3840]) {
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
      iconHeight: 16,
      iconWidth: 16,
      visualHeight: 44,
      visualWidth: 44,
    });
    await expectFullyInsideViewport(searchButton, width);
    await expectNoHorizontalOverflow(page, width);
  }
});

for (const width of [320, 390, 768, 1023, 1024]) {
  test(`renders only the bottom-sheet result layout at ${width}px`, async ({
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
    await page.setViewportSize({ width, height: 720 });

    await page.goto(searchURL);

    const resultLink = page.getByRole("link", {
      name: "숙소 상세 보기: 반응형 테스트 숙소",
      includeHidden: true,
    });
    const bottomSheetHandle = page.getByRole("button", {
      name: /검색 결과 패널 조절/,
    });
    const bottomSheetResults = page.getByRole("group", {
      name: "검색 결과 목록",
      includeHidden: true,
    });
    await expect(resultLink).toHaveCount(1);
    await expect(bottomSheetHandle).toHaveCount(1);
    await expect(bottomSheetResults).toHaveCount(1);
    await expect(bottomSheetHandle).toBeVisible();
    await expect(bottomSheetHandle).toHaveAttribute("data-state", "half");
    await bottomSheetHandle.focus();
    await page.keyboard.press("Home");
    await expect(bottomSheetHandle).toHaveAttribute("data-state", "collapsed");
    await expect(bottomSheetResults).toBeHidden();
    await expect(resultLink).toBeHidden();

    const sheet = bottomSheetHandle.locator("xpath=ancestor::section[1]");
    const collapsedGeometry = await sheet.evaluate((element) => {
      const rootStyles = getComputedStyle(document.documentElement);
      const peekHeight = Number.parseFloat(
        rootStyles.getPropertyValue("--layout-search-bottom-sheet-peek-height"),
      );
      const visibleHeight =
        window.innerHeight - element.getBoundingClientRect().top;

      return { peekHeight, visibleHeight };
    });
    expect(
      Math.abs(collapsedGeometry.visibleHeight - collapsedGeometry.peekHeight),
    ).toBeLessThanOrEqual(2);

    await bottomSheetHandle.click();
    await expect(bottomSheetHandle).toHaveAttribute("data-state", "half");
    await expect(bottomSheetResults).toBeVisible();
    await expect(resultLink).toBeVisible();

    const controlledRegions = await bottomSheetHandle.evaluateAll((handles) =>
      handles.map((handle) => {
        const controlledId = handle.getAttribute("aria-controls");
        return Boolean(controlledId && document.getElementById(controlledId));
      }),
    );
    expect(controlledRegions).toEqual([true]);
    await expectNoHorizontalOverflow(page, width);
  });
}

for (const width of [1025, 1280, 1440]) {
  test(`renders only the desktop result layout at ${width}px`, async ({
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
    await page.setViewportSize({ width, height: 720 });
    await page.goto(searchURL);

    await expect(
      page.getByRole("link", {
        name: "숙소 상세 보기: 반응형 테스트 숙소",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /검색 결과 패널 조절/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "검색 결과 목록" }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page, width);
  });
}

test("keeps every mobile sheet snap attached to the viewport", async ({
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(searchURL);

  const handle = page.getByRole("button", {
    name: /검색 결과 패널 조절/,
  });
  const sheet = handle.locator("xpath=ancestor::section[1]");
  const readSheetGeometry = () =>
    sheet.evaluate((element) => {
      const rootStyles = getComputedStyle(document.documentElement);
      const surfaceTop =
        Number.parseFloat(
          rootStyles.getPropertyValue("--layout-search-header-mobile-height"),
        ) +
        Number.parseFloat(
          rootStyles.getPropertyValue("--layout-search-header-divider-height"),
        );
      const peekHeight = Number.parseFloat(
        rootStyles.getPropertyValue("--layout-search-bottom-sheet-peek-height"),
      );
      const top = element.getBoundingClientRect().top;

      return {
        peekHeight,
        surfaceHeight: window.innerHeight - surfaceTop,
        surfaceTop,
        top,
        visibleHeight: window.innerHeight - top,
      };
    });

  await handle.focus();
  await page.keyboard.press("Home");
  await expect(handle).toHaveAttribute("data-state", "collapsed");
  await expect
    .poll(async () => {
      const geometry = await readSheetGeometry();
      return Math.abs(geometry.visibleHeight - geometry.peekHeight);
    })
    .toBeLessThanOrEqual(2);

  await handle.click();
  await expect(handle).toHaveAttribute("data-state", "half");
  await expect
    .poll(async () => {
      const geometry = await readSheetGeometry();
      return Math.abs(geometry.visibleHeight - geometry.surfaceHeight * 0.7);
    })
    .toBeLessThanOrEqual(3);

  await handle.click();
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await expect
    .poll(async () => {
      const geometry = await readSheetGeometry();
      return Math.abs(geometry.top - geometry.surfaceTop);
    })
    .toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: "지도 보기" }).click();
  await expect(handle).toHaveAttribute("data-state", "collapsed");
  await expect
    .poll(async () => {
      const geometry = await readSheetGeometry();
      return Math.abs(geometry.visibleHeight - geometry.peekHeight);
    })
    .toBeLessThanOrEqual(2);

  const documentGeometry = await page.evaluate(() => ({
    bodyHeight: document.body.scrollHeight,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(documentGeometry.bodyHeight).toBeLessThanOrEqual(
    documentGeometry.viewportHeight,
  );
  expect(documentGeometry.documentHeight).toBeLessThanOrEqual(
    documentGeometry.viewportHeight,
  );
});

test("keeps the desktop result and map panes balanced across monitor widths", async ({
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
  await page.goto(searchURL);

  for (const [width, expectedColumns] of [
    [1025, 2],
    [1280, 2],
    [1440, 2],
    [1600, 3],
    [1920, 3],
    [2560, 3],
    [3840, 3],
  ] as const) {
    await test.step(`${width}px split layout`, async () => {
      await page.setViewportSize({ width, height: 900 });

      const resultsPane = page.locator('[data-search-pane="results"]');
      const mapPane = page.locator('[data-search-pane="map"]');
      const headerContainer = page.locator('[data-header-layout="full-width"]');
      const homeLink = page.getByRole("link", {
        name: "Airbob 홈으로 이동",
      });
      const userMenu = page.getByRole("button", { name: "사용자 메뉴" });
      const resultGrid = page.getByRole("list", {
        name: "숙소 검색 결과",
      });
      await expect(resultsPane).toBeVisible();
      await expect(mapPane).toBeVisible();

      const [
        resultsBounds,
        mapBounds,
        headerBounds,
        homeLinkBounds,
        userMenuBounds,
        columns,
      ] = await Promise.all([
        resultsPane.boundingBox(),
        mapPane.boundingBox(),
        headerContainer.boundingBox(),
        homeLink.boundingBox(),
        userMenu.boundingBox(),
        resultGrid.evaluate(
          (grid) =>
            getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        ),
      ]);

      expect(resultsBounds).not.toBeNull();
      expect(mapBounds).not.toBeNull();
      expect(headerBounds).not.toBeNull();
      expect(homeLinkBounds).not.toBeNull();
      expect(userMenuBounds).not.toBeNull();
      expect(
        Math.abs(resultsBounds!.width - mapBounds!.width),
        `balanced panes at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(resultsBounds!.x, `results left edge at ${width}px`).toBe(32);
      expect(
        mapBounds!.x + mapBounds!.width,
        `map right edge at ${width}px`,
      ).toBe(width - 32);
      expect(headerBounds!.x, `header left edge at ${width}px`).toBe(32);
      expect(
        headerBounds!.x + headerBounds!.width,
        `header right edge at ${width}px`,
      ).toBe(width - 32);
      expect(homeLinkBounds!.x, `logo left edge at ${width}px`).toBe(32);
      expect(
        userMenuBounds!.x + userMenuBounds!.width,
        `menu right edge at ${width}px`,
      ).toBe(width - 32);
      expect(columns, `result columns at ${width}px`).toBe(expectedColumns);
      await expectNoHorizontalOverflow(page, width);
    });
  }
});

test("aligns the detail shell from 320px through 4K", async ({
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
    [320, "y", 24],
    [390, "y", 24],
    [768, "y", 24],
    [769, "y", 24],
    [1024, "y", 24],
    [1025, "x", 40],
    [1200, "x", 40],
    [1201, "x", 64],
    [1280, "x", 64],
    [1366, "x", 64],
    [1400, "x", 64],
    [1401, "x", 80],
    [1440, "x", 80],
    [1536, "x", 80],
    [1600, "x", 80],
    [1760, "x", 80],
    [1920, "x", 80],
    [2560, "x", 80],
    [3840, "x", 80],
  ] as const;

  for (const [width, comparisonAxis, expectedGutter] of layouts) {
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
      const locationHeading = page.getByRole("heading", {
        name: "위치",
        level: 2,
      });
      const reviewsHeading = page.getByRole("heading", {
        name: "아직 등록된 후기가 없어요",
        level: 2,
      });
      const detailStateOwner = page.getByRole("region", {
        name: "숙소 상세 상태",
      });
      const bookingAction = page.getByRole("button", { name: "예약하기" });

      const navigationAction =
        // eslint-disable-next-line playwright/no-conditional-in-test -- Each viewport has a different navigation control by design.
        width <= 1024
          ? page.getByRole("button", { name: "이전 화면으로", exact: true })
          : homeLink;
      await expectFullyInsideViewport(navigationAction, width);
      await expect(heroFallback).toBeVisible();
      await expect(overviewHeading).toBeVisible();
      await expect(locationHeading).toBeVisible();
      await expect(reviewsHeading).toBeVisible();
      await expect(bookingAction).toBeVisible();
      await expectNoHorizontalOverflow(page, width);

      const heroTitle = page.getByRole("heading", {
        name: "반응형 상세 테스트 숙소",
        level: 1,
      });
      const [
        heroTitleBounds,
        overviewBounds,
        locationBounds,
        reviewsBounds,
        bookingBounds,
      ] = await Promise.all([
        heroTitle.boundingBox(),
        overviewHeading.boundingBox(),
        locationHeading.boundingBox(),
        page
          .getByRole("region", {
            name: "아직 등록된 후기가 없어요",
            exact: true,
          })
          .boundingBox(),
        bookingAction.boundingBox(),
      ]);

      const computedGutter = await detailStateOwner.evaluate((owner) =>
        Number.parseFloat(
          getComputedStyle(owner).getPropertyValue("--detail-inline-gutter"),
        ),
      );
      expect(computedGutter, `detail gutter at ${width}px`).toBe(
        expectedGutter,
      );

      expect(heroTitleBounds).not.toBeNull();
      expect(overviewBounds).not.toBeNull();
      expect(locationBounds).not.toBeNull();
      expect(reviewsBounds).not.toBeNull();
      expect(bookingBounds).not.toBeNull();

      const expectedContainerLeft = Math.max(
        0,
        (width - DETAIL_PAGE_MAX_WIDTH) / 2,
      );
      const expectedContentLeft = expectedContainerLeft + expectedGutter;
      expect(
        Math.abs(heroTitleBounds!.x - expectedContentLeft),
        `detail gutter offset at ${width}px`,
      ).toBeLessThanOrEqual(1);

      const alignedLeftEdges = [
        overviewBounds!.x,
        locationBounds!.x,
        reviewsBounds!.x,
      ];
      for (const left of alignedLeftEdges) {
        expect(
          Math.abs(left - heroTitleBounds!.x),
          `detail left edge at ${width}px`,
        ).toBeLessThanOrEqual(1);
      }

      const bookingSpace =
        // eslint-disable-next-line playwright/no-conditional-in-test -- Mobile uses a viewport footer; desktop uses the right sidebar.
        width <= 1024
          ? // eslint-disable-next-line playwright/no-conditional-in-test -- Match the viewport height in this responsive matrix.
            (width <= 768 ? 844 : 900) -
            (bookingBounds!.y + bookingBounds!.height)
          : bookingBounds![comparisonAxis] - overviewBounds![comparisonAxis];
      expect(bookingSpace).toBeGreaterThanOrEqual(0);
    });
  }

  for (const [width, expectedGutter] of [
    [1025, 40],
    [1200, 40],
    [1201, 64],
    [1366, 64],
    [1400, 64],
    [1401, 80],
    [1536, 80],
    [1600, 80],
    [1760, 80],
    [1920, 80],
    [2560, 80],
    [3840, 80],
  ] as const) {
    await test.step(`${width}px desktop right edge`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const heroBounds = await page
        .getByRole("img", {
          name: "반응형 상세 테스트 숙소 숙소 사진 없음",
        })
        .boundingBox();
      const bookingBounds = await page
        .getByRole("region", { name: "숙소 예약" })
        .boundingBox();

      expect(heroBounds).not.toBeNull();
      expect(bookingBounds).not.toBeNull();
      const heroRight = heroBounds!.x + heroBounds!.width;
      const bookingRight = bookingBounds!.x + bookingBounds!.width;
      const expectedContainerLeft = Math.max(
        0,
        (width - DETAIL_PAGE_MAX_WIDTH) / 2,
      );
      const expectedContainerWidth = Math.min(width, DETAIL_PAGE_MAX_WIDTH);
      const expectedContentRight =
        expectedContainerLeft + expectedContainerWidth - expectedGutter;
      expect(
        Math.abs(heroRight - expectedContentRight),
        `detail right gutter offset at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(heroRight - bookingRight),
        `booking and hero right edge at ${width}px`,
      ).toBeLessThanOrEqual(1);
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

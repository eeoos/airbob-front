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

const expectFullyInsideViewport = async (locator: Locator, width: number) => {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? width) + (bounds?.width ?? 1)).toBeLessThanOrEqual(
    width,
  );
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

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.viewport).toBe(320);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
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
  responsiveBoundary(1023, "bottom-sheet"),
  responsiveBoundary(1024, "bottom-sheet"),
  responsiveBoundary(1025, "desktop"),
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
  });
}

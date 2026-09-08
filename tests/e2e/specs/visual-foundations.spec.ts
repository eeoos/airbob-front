import type { Page } from "@playwright/test";
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const VIEWPORT = { width: 1280, height: 800 } as const;
const SEARCH_URL = "/search?destination=Seoul&adultOccupancy=2";
const SYNTHETIC_IMAGE_ORIGIN = "https://images.airbob.invalid";
const SEARCH_IMAGE_URL = `${SYNTHETIC_IMAGE_ORIGIN}/phase-1/search-card.svg`;
const DETAIL_IMAGE_URLS = Array.from(
  { length: 5 },
  (_, index) => `${SYNTHETIC_IMAGE_ORIGIN}/phase-1/detail-${index + 1}.svg`,
);
const DETAIL_AMENITY_TYPES = [
  "WIFI",
  "AIR_CONDITIONER",
  "HEATING",
  "KITCHEN",
  "WASHER",
  "DRYER",
  "PARKING",
  "TV",
  "HAIR_DRYER",
  "IRON",
  "SHAMPOO",
  "BED_LINENS",
  "EXTRA_PILLOWS",
  "CRIB",
  "HIGH_CHAIR",
  "DISHWASHER",
  "COFFEE_MACHINE",
  "MICROWAVE",
  "REFRIGERATOR",
  "ELEVATOR",
  "POOL",
  "HOT_TUB",
  "GYM",
  "SMOKE_ALARM",
  "CARBON_MONOXIDE_ALARM",
  "FIRE_EXTINGUISHER",
  "PETS_ALLOWED",
  "OUTDOOR_SPACE",
  "BBQ_GRILL",
  "BALCONY",
  "FUTURE_AMENITY",
] as const;

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  fullPage: false,
  // The shared baseline intentionally ignores small OS font-rasterization
  // differences while still catching structural, spacing, and color drift.
  maxDiffPixelRatio: 0.08,
  scale: "css",
} as const;

const foundationScreenshotOptions = {
  ...screenshotOptions,
  maxDiffPixelRatio: 0.02,
} as const;

const componentScreenshotOptions = {
  animations: "disabled",
  caret: "hide",
  maxDiffPixelRatio: 0.02,
  scale: "css",
} as const;

const syntheticImagePalette = [
  ["#dff4fb", "#5aaed2", "#14323f"],
  ["#f6e9df", "#c9785d", "#4b3028"],
  ["#e7f1e8", "#78a77e", "#294a32"],
  ["#eee8f7", "#9678bd", "#3f3057"],
  ["#fff1d9", "#d89d45", "#5d431d"],
] as const;

const syntheticImageBody = (index: number): string => {
  const [surface, accent, ink] =
    syntheticImagePalette[index % syntheticImagePalette.length] ??
    syntheticImagePalette[0];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="${surface}" />
      <circle cx="920" cy="160" r="92" fill="${accent}" opacity="0.72" />
      <path d="M0 610 260 370l170 160 190-210 260 290 150-120 170 150v160H0Z" fill="${accent}" opacity="0.5" />
      <path d="M365 610V350l235-150 235 150v260H365Z" fill="white" opacity="0.92" />
      <path d="M470 610V455h260v155M515 365h170" fill="none" stroke="${ink}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
};

const installSyntheticImages = async (
  page: Page,
  imageUrls: readonly string[],
) => {
  await Promise.all(
    imageUrls.map((imageUrl, index) =>
      page.route(imageUrl, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/svg+xml; charset=utf-8",
          body: syntheticImageBody(index),
        });
      }),
    ),
  );
};

const searchAccommodation = {
  id: 81,
  name: "서촌 디자인 테스트 숙소",
  accommodation_thumbnail_url: SEARCH_IMAGE_URL,
  base_price: 120_000,
  currency: "KRW",
  type: "HOUSE",
  address_summary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "종로구",
  },
  coordinate: {
    latitude: 37.579,
    longitude: 126.969,
  },
  review_summary: {
    total_count: 24,
    average_rating: 4.92,
  },
  is_in_wishlist: false,
};

const searchResponse = {
  stay_search_result_listing: [searchAccommodation],
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

const detailAccommodation = {
  id: 7,
  name: "합정 디자인 테스트 숙소",
  description: "머무는 동안 편안하게 쉴 수 있도록 정돈한 합성 숙소입니다.",
  type: "ENTIRE_PLACE",
  base_price: 150_000,
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
    latitude: 37.549,
    longitude: 126.914,
  },
  host: {
    id: 202,
    nickname: "합성 호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: DETAIL_AMENITY_TYPES.map((type) => ({ type, count: 1 })),
  images: DETAIL_IMAGE_URLS.map((imageUrl, index) => ({
    id: index + 1,
    image_url: imageUrl,
  })),
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

const detailAvailability = {
  booking_window_start_inclusive: "2026-01-01",
  booking_window_end_exclusive: "2027-01-01",
  unavailable_ranges: [],
};

const editableAccommodation = {
  id: 31,
  name: "합정 에디터 테스트 숙소",
  description: "숙소 편집 폼의 시각 기준을 고정하기 위한 합성 설명입니다.",
  type: "APARTMENT",
  base_price: 125_000,
  currency: "KRW",
  check_in_time: "15:00",
  check_out_time: "11:00",
  address: {
    country: "대한민국",
    state: "서울특별시",
    city: "서울",
    district: "마포구",
    street: "월드컵북로",
    detail: "101호",
    postal_code: "04000",
  },
  coordinate: {
    latitude: 37.556,
    longitude: 126.923,
  },
  host: {
    id: 202,
    nickname: "합성 호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
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

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  viewport: VIEWPORT,
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
});

const waitForStablePaint = async (page: import("@playwright/test").Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
};

test("keeps the desktop search and header foundation visually stable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await installSyntheticImages(page, [SEARCH_IMAGE_URL]);
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(searchResponse),
  );

  await page.goto(SEARCH_URL);
  await expect(
    page.getByRole("link", {
      name: "숙소 상세 보기: 서촌 디자인 테스트 숙소",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Airbob 홈으로 이동" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "서촌 디자인 테스트 숙소" }),
  ).toBeVisible();
  await waitForStablePaint(page);

  await expect(page).toHaveScreenshot(
    "search-and-header-foundation.png",
    foundationScreenshotOptions,
  );
  await expect(
    page.getByRole("search", { name: "숙소 검색" }),
  ).toHaveScreenshot(
    "compact-search-bar-foundation.png",
    componentScreenshotOptions,
  );
});

test("keeps the accommodation detail foundation visually stable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await installSyntheticImages(page, DETAIL_IMAGE_URLS);
  api.register(
    "GET",
    "/api/v1/accommodations/7",
    apiSuccess(detailAccommodation),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/7/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto(
    "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
  );
  await expect(
    page.getByRole("heading", { name: "합정 디자인 테스트 숙소", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "합정 디자인 테스트 숙소",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("무선 인터넷")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForStablePaint(page);

  await expect(page).toHaveScreenshot(
    "accommodation-detail-foundation.png",
    foundationScreenshotOptions,
  );
  await expect(
    page.getByRole("region", { name: "숙소 예약" }),
  ).toHaveScreenshot(
    "completed-booking-card-foundation.png",
    componentScreenshotOptions,
  );

  const amenities = page.getByRole("region", { name: "숙소 편의시설" });
  await page.addStyleTag({
    content: "header { display: none !important; }",
  });
  await amenities.scrollIntoViewIfNeeded();
  await waitForStablePaint(page);
  await expect(amenities.locator("[data-amenity-code]")).toHaveCount(
    DETAIL_AMENITY_TYPES.length,
  );
  const iconBounds = await amenities.locator("svg").evaluateAll((icons) =>
    icons.map((icon) => {
      const bounds = (icon as SVGGraphicsElement).getBBox();
      return {
        height: bounds.height,
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      };
    }),
  );
  for (const bounds of iconBounds) {
    expect(bounds.width).toBeGreaterThan(1);
    expect(bounds.height).toBeGreaterThan(1);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(24);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(24);
  }
  await expect(amenities).toHaveScreenshot(
    "accommodation-amenities-foundation.png",
    componentScreenshotOptions,
  );

  await page.setViewportSize({ width: 390, height: 900 });
  await amenities.scrollIntoViewIfNeeded();
  await waitForStablePaint(page);
  await expect(amenities).toHaveScreenshot(
    "accommodation-amenities-mobile-foundation.png",
    componentScreenshotOptions,
  );
});

test("keeps the empty booking card and anchored date overlay visually stable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installSyntheticImages(page, DETAIL_IMAGE_URLS);
  api.register(
    "GET",
    "/api/v1/accommodations/7",
    apiSuccess(detailAccommodation),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/7/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto("/accommodations/7?adultOccupancy=1");
  const bookingCard = page.getByRole("region", { name: "숙소 예약" });
  const checkIn = bookingCard.getByRole("button", {
    name: "체크인 날짜 추가",
  });
  await bookingCard.scrollIntoViewIfNeeded();
  await expect(checkIn).toBeVisible();
  await waitForStablePaint(page);

  await expect(bookingCard).toHaveScreenshot(
    "empty-booking-card-foundation.png",
    componentScreenshotOptions,
  );

  const before = await checkIn.boundingBox();
  await checkIn.click();
  const dateOverlay = page.getByRole("dialog", { name: "예약 날짜 선택" });
  await expect(dateOverlay).toBeVisible();
  await waitForStablePaint(page);
  const after = await checkIn.boundingBox();

  expect(after).toEqual(before);
  await expect(dateOverlay).toHaveScreenshot(
    "anchored-booking-date-overlay-foundation.png",
    componentScreenshotOptions,
  );

  await dateOverlay.getByRole("button", { name: "닫기" }).click();
  await page.setViewportSize({ width: 390, height: 900 });
  await bookingCard.scrollIntoViewIfNeeded();
  await checkIn.click();
  await expect(dateOverlay).toBeVisible();
  await waitForStablePaint(page);
  await expect(dateOverlay).toHaveScreenshot(
    "mobile-booking-date-overlay-foundation.png",
    componentScreenshotOptions,
  );

  await dateOverlay.getByRole("button", { name: "닫기" }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await bookingCard.scrollIntoViewIfNeeded();
  await checkIn.click();
  await expect(dateOverlay).toBeVisible();
  await waitForStablePaint(page);
  await expect(dateOverlay).toHaveScreenshot(
    "tablet-booking-date-overlay-foundation.png",
    componentScreenshotOptions,
  );
});

test("keeps the authentication dialog and overlay visually stable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await installSyntheticImages(page, [SEARCH_IMAGE_URL]);
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(searchResponse),
  );

  await page.goto(SEARCH_URL);
  await expect(
    page.getByRole("link", {
      name: "숙소 상세 보기: 서촌 디자인 테스트 숙소",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "사용자 메뉴" }).click();
  await page.getByRole("menuitem", { name: "로그인" }).click();

  const dialog = page.getByRole("dialog", { name: "로그인" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "닫기", exact: true }),
  ).toBeFocused();
  await waitForStablePaint(page);

  await expect(page).toHaveScreenshot(
    "authentication-dialog-foundation.png",
    screenshotOptions,
  );
});

test("keeps the accommodation editor form foundation visually stable", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(editableAccommodation),
  );

  await page.goto("/accommodations/31/edit");
  await page.getByRole("button").filter({ hasText: "숙소 정보" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소 정보를 알려주세요" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("예: 편안한 아파트")).toHaveValue(
    "합정 에디터 테스트 숙소",
  );
  await waitForStablePaint(page);

  await expect(page).toHaveScreenshot(
    "accommodation-editor-foundation.png",
    screenshotOptions,
  );
});

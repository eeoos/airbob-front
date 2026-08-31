import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const VIEWPORT = { width: 1280, height: 800 } as const;
const SEARCH_URL = "/search?destination=Seoul&adultOccupancy=2";

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  fullPage: false,
  // The shared baseline intentionally ignores small OS font-rasterization
  // differences while still catching structural, spacing, and color drift.
  maxDiffPixelRatio: 0.08,
  scale: "css",
} as const;

const searchAccommodation = {
  id: 81,
  name: "서촌 디자인 테스트 숙소",
  accommodation_thumbnail_url: null,
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
  unavailable_dates: [],
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
  amenities: [
    { type: "WIFI", count: 1 },
    { type: "AIR_CONDITIONER", count: 1 },
    { type: "HEATING", count: 1 },
    { type: "PARKING", count: 1 },
  ],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
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
  await waitForStablePaint(page);

  await expect(page).toHaveScreenshot(
    "search-and-header-foundation.png",
    screenshotOptions,
  );
});

test("keeps the accommodation detail foundation visually stable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/accommodations/7",
    apiSuccess(detailAccommodation),
  );

  await page.goto(
    "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
  );
  await expect(
    page.getByRole("heading", { name: "합정 디자인 테스트 숙소", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("무선 인터넷")).toBeVisible();
  await waitForStablePaint(page);

  await expect(page).toHaveScreenshot(
    "accommodation-detail-foundation.png",
    screenshotOptions,
  );
});

test("keeps the authentication dialog and overlay visually stable", async ({
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

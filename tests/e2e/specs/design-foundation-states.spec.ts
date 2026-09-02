import type { Page } from "@playwright/test";
import { apiFailure, apiSuccess, type ApiResponseSpec } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const SEARCH_URL = "/search?destination=Seoul&adultOccupancy=2";
const DETAIL_URL =
  "/accommodations/381?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2";
const BROKEN_LISTING_IMAGE_URL =
  "https://images.airbob.invalid/phase-1/broken-listing.jpg";
const BROKEN_HERO_IMAGE_URL =
  "https://images.airbob.invalid/phase-1/broken-hero.jpg";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => {
      if (!resolvePromise) {
        throw new Error("Deferred response was not initialized.");
      }
      resolvePromise(value);
    },
  };
};

const makeSearchAccommodation = (
  id: number,
  name: string,
  thumbnailUrl: string | null = null,
) => ({
  id,
  name,
  accommodation_thumbnail_url: thumbnailUrl,
  base_price: 120_000 + id,
  currency: "KRW",
  type: "HOUSE",
  address_summary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "종로구",
  },
  coordinate: {
    latitude: 37.57 + id / 10_000,
    longitude: 126.98 + id / 10_000,
  },
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  is_in_wishlist: false,
});

const makeSearchResponse = (
  accommodations: ReturnType<typeof makeSearchAccommodation>[],
  options: { currentPage?: number; totalPages?: number } = {},
) => {
  const currentPage = options.currentPage ?? 0;
  const totalPages = options.totalPages ?? (accommodations.length > 0 ? 1 : 0);

  return {
    stay_search_result_listing: accommodations,
    page_info: {
      page_size: 18,
      current_page: currentPage,
      total_pages: totalPages,
      total_elements: accommodations.length,
      is_first: currentPage === 0,
      is_last: totalPages === 0 || currentPage === totalPages - 1,
      has_next: currentPage < totalPages - 1,
      has_previous: currentPage > 0,
    },
  };
};

const searchAccommodation = makeSearchAccommodation(381, "상태 테스트 숙소");
const searchResponse = makeSearchResponse([searchAccommodation]);
const emptySearchResponse = makeSearchResponse([]);

const detailAccommodation = {
  id: 381,
  name: "상세 상태 테스트 숙소",
  description: "화면 상태를 결정론적으로 검증하기 위한 합성 숙소입니다.",
  type: "ENTIRE_PLACE",
  base_price: 180_000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  time_zone_id: "Asia/Seoul",
  is_in_wishlist: false,
  address_summary: {
    country: "대한민국",
    state: "서울특별시",
    city: "서울",
    district: "종로구",
  },
  coordinate: {
    latitude: 37.579,
    longitude: 126.969,
  },
  host: {
    id: 382,
    nickname: "상태 호스트",
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

const detailAvailability = {
  booking_window_start_inclusive: "2026-01-01",
  booking_window_end_exclusive: "2027-01-01",
  unavailable_ranges: [],
};

const installBrokenImage = async (page: Page, imageUrl: string) => {
  let requestCount = 0;

  await page.route(imageUrl, async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 404,
      contentType: "image/jpeg",
      body: "synthetic missing image",
    });
  });

  return () => requestCount;
};

const requestPage = (query: readonly (readonly [string, string])[]) =>
  Object.fromEntries(query).page ?? "0";

test("announces the cold search skeleton before rendering results", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const searchDeferred = createDeferred<ApiResponseSpec>();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    () => searchDeferred.promise,
  );

  await page.goto(SEARCH_URL);

  const loadingState = page
    .locator('[data-state-kind="loading"]')
    .filter({ hasText: "숙소를 찾는 중입니다." });
  await expect(loadingState).toHaveAttribute("role", "status");
  await expect(loadingState).toHaveAttribute("aria-busy", "true");
  await expect(loadingState.locator('[aria-hidden="true"]')).toHaveCount(24);

  searchDeferred.resolve(apiSuccess(searchResponse));
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 상태 테스트 숙소" }),
  ).toBeVisible();
  await expect(loadingState).toBeHidden();
});

test("renders a polite empty search state without a retry action", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(emptySearchResponse),
  );

  await page.goto(SEARCH_URL);

  const emptyState = page
    .locator('[data-state-kind="empty"]')
    .filter({ hasText: "조건에 맞는 숙소가 없어요" });
  await expect(emptyState).toHaveAttribute("role", "status");
  await expect(emptyState).toContainText(
    "여행지나 날짜, 인원 조건을 바꿔 다시 찾아보세요.",
  );
  await expect(
    emptyState.getByRole("button", { name: "다시 시도" }),
  ).toHaveCount(0);
});

test("renders a non-retryable search failure without a retry command", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiFailure(422, "S422", "검색 조건을 확인할 수 없습니다."),
  );

  await page.goto(SEARCH_URL);

  const terminalState = page
    .locator('[data-state-kind="terminal-error"]')
    .filter({ hasText: "검색 결과를 확인할 수 없어요" });
  await expect(terminalState).toHaveAttribute("role", "alert");
  await expect(terminalState).toContainText("검색 조건을 확인해주세요.");
  await expect(
    terminalState.getByRole("button", { name: "다시 시도" }),
  ).toHaveCount(0);
});

test("recovers an initial search 503 through one explicit retry", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  let attempts = 0;
  api.register("GET", "/api/v1/search/accommodations", () => {
    attempts += 1;
    return attempts <= 2
      ? apiFailure(503, "S503", "검색 서비스를 사용할 수 없습니다.")
      : apiSuccess(searchResponse);
  });

  await page.goto(SEARCH_URL);
  await expect.poll(() => attempts).toBe(1);
  await page.clock.runFor(1_000);
  await expect.poll(() => attempts).toBe(2);

  const retryState = page
    .locator('[data-state-kind="retryable-error"]')
    .filter({ hasText: "숙소를 불러오지 못했어요" });
  await expect(retryState).toHaveAttribute("role", "alert");
  await expect(retryState).toContainText("검색 결과를 불러오지 못했습니다.");

  const resultStateOwner = page.getByRole("region", {
    name: "검색 결과 상태",
  });
  await retryState.getByRole("button", { name: "다시 시도" }).click();

  await expect.poll(() => attempts).toBe(3);
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 상태 테스트 숙소" }),
  ).toBeVisible();
  await expect(retryState).toBeHidden();
  await expect(resultStateOwner).toBeFocused();
});

test("keeps stale search cards visible when a refreshed page fails", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const firstPageAccommodation = makeSearchAccommodation(
    391,
    "기존 결과 유지 숙소",
  );
  let failedPageAttempts = 0;
  api.register("GET", "/api/v1/search/accommodations", (request) => {
    if (requestPage(request.query) === "0") {
      return apiSuccess(
        makeSearchResponse([firstPageAccommodation], {
          currentPage: 0,
          totalPages: 2,
        }),
      );
    }

    failedPageAttempts += 1;
    return apiFailure(503, "S503", "다음 검색 페이지를 사용할 수 없습니다.");
  });

  await page.goto(SEARCH_URL);
  const staleCard = page.getByRole("link", {
    name: "숙소 상세 보기: 기존 결과 유지 숙소",
  });
  await expect(staleCard).toBeVisible();

  await page
    .getByRole("navigation", { name: "검색 결과 페이지" })
    .getByRole("button", { name: "2" })
    .click();
  await expect.poll(() => failedPageAttempts).toBe(1);
  await page.clock.runFor(1_000);
  await expect.poll(() => failedPageAttempts).toBe(2);

  await expect(staleCard).toBeVisible();
  const refreshAlert = page
    .getByRole("alert")
    .filter({ hasText: "새 결과를 불러오지 못했어요" });
  await expect(refreshAlert).toContainText("검색 결과를 불러오지 못했습니다.");
  await expect(
    refreshAlert.getByRole("button", { name: "다시 시도" }),
  ).toHaveCount(1);
});

test("keeps a labeled listing frame when the thumbnail is null", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const accommodation = makeSearchAccommodation(392, "사진 없는 검색 숙소");
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(makeSearchResponse([accommodation])),
  );

  await page.goto(SEARCH_URL);

  await expect(
    page.getByRole("img", { name: "사진 없는 검색 숙소 이미지 없음" }),
  ).toBeVisible();
  await expect(page.getByText("사진 준비 중")).toBeVisible();
});

test("replaces one exact broken listing image without removing the card", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const getImageRequestCount = await installBrokenImage(
    page,
    BROKEN_LISTING_IMAGE_URL,
  );
  const accommodation = makeSearchAccommodation(
    393,
    "깨진 이미지 검색 숙소",
    BROKEN_LISTING_IMAGE_URL,
  );
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(makeSearchResponse([accommodation])),
  );

  await page.goto(SEARCH_URL);

  await expect(
    page.getByRole("link", {
      name: "숙소 상세 보기: 깨진 이미지 검색 숙소",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "깨진 이미지 검색 숙소 이미지 없음" }),
  ).toBeVisible();
  expect(getImageRequestCount()).toBe(1);
});

test("announces the detail skeleton before rendering the top section", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const detailDeferred = createDeferred<ApiResponseSpec>();
  api.register(
    "GET",
    "/api/v1/accommodations/381",
    () => detailDeferred.promise,
  );
  api.register(
    "GET",
    "/api/v1/accommodations/381/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto(DETAIL_URL);

  const loadingState = page
    .locator('[data-state-kind="loading"]')
    .filter({ hasText: "숙소 정보를 불러오는 중입니다." });
  await expect(loadingState).toHaveAttribute("role", "status");
  await expect(loadingState).toHaveAttribute("aria-busy", "true");

  detailDeferred.resolve(apiSuccess(detailAccommodation));
  await expect(
    page.getByRole("heading", { name: "상세 상태 테스트 숙소", level: 1 }),
  ).toBeVisible();
  await expect(loadingState).toBeHidden();
});

test("renders a terminal detail state for A001 without retry", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/accommodations/381",
    apiFailure(404, "A001", "숙소를 찾을 수 없습니다."),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/381/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto(DETAIL_URL);

  const terminalState = page
    .locator('[data-state-kind="terminal-error"]')
    .filter({ hasText: "숙소 정보를 확인할 수 없어요" });
  await expect(terminalState).toHaveAttribute("role", "alert");
  await expect(terminalState).toContainText(
    "존재하지 않거나 삭제된 숙소입니다.",
  );
  await expect(
    terminalState.getByRole("button", { name: "다시 시도" }),
  ).toHaveCount(0);
});

test("recovers a detail 503 through the explicit retry command", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  let detailAttempts = 0;
  api.register("GET", "/api/v1/accommodations/381", () => {
    detailAttempts += 1;
    return detailAttempts === 1
      ? apiFailure(503, "A503", "숙소 서비스를 사용할 수 없습니다.")
      : apiSuccess(detailAccommodation);
  });
  api.register(
    "GET",
    "/api/v1/accommodations/381/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto(DETAIL_URL);

  const retryState = page
    .locator('[data-state-kind="retryable-error"]')
    .filter({ hasText: "숙소 정보를 불러오지 못했어요" });
  await expect(retryState).toContainText(
    "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
  );
  const detailStateOwner = page.getByRole("region", {
    name: "숙소 상세 상태",
  });
  await retryState.getByRole("button", { name: "다시 시도" }).click();

  await expect.poll(() => detailAttempts).toBe(2);
  await expect(
    page.getByRole("heading", { name: "상세 상태 테스트 숙소", level: 1 }),
  ).toBeVisible();
  await expect(retryState).toBeHidden();
  await expect(detailStateOwner).toBeFocused();
});

test("keeps detail content while the primary availability retry owns focus", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const availabilityDeferred = createDeferred<ApiResponseSpec>();
  let availabilityAttempts = 0;
  api.register(
    "GET",
    "/api/v1/accommodations/381",
    apiSuccess(detailAccommodation),
  );
  api.register("GET", "/api/v1/accommodations/381/availability", () => {
    availabilityAttempts += 1;
    return availabilityAttempts === 1
      ? apiFailure(503, "A503", "예약 가능 여부를 확인할 수 없습니다.")
      : availabilityDeferred.promise;
  });

  await page.goto(DETAIL_URL);

  await expect(
    page.getByRole("heading", { name: "상세 상태 테스트 숙소", level: 1 }),
  ).toBeVisible();
  const availabilityAlert = page.getByRole("alert", {
    name: "예약 가능 여부",
  });
  await expect(availabilityAlert).toContainText(
    "예약 가능한 날짜를 불러오지 못했습니다.",
  );

  await page.getByRole("button", { name: "날짜 다시 불러오기" }).click();

  const availabilityStatus = page.getByRole("status", {
    name: "예약 가능 여부",
  });
  await expect(availabilityStatus).toContainText(
    "예약 가능한 날짜를 확인하고 있습니다.",
  );
  await expect(
    page.getByText(
      "예약 가능한 날짜를 확인하고 있어요. 확인이 끝나면 날짜를 선택할 수 있습니다.",
    ),
  ).toBeFocused();

  availabilityDeferred.resolve(apiSuccess(detailAvailability));
  const dateTrigger = page
    .locator('button[aria-controls="booking-date-picker"]')
    .first();
  await expect(dateTrigger).toBeEnabled();
  await expect(page.getByRole("button", { name: "예약하기" })).toBeFocused();
  await expect.poll(() => availabilityAttempts).toBe(2);
});

test("keeps a stable, non-interactive hero frame when images are absent", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/accommodations/381",
    apiSuccess(detailAccommodation),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/381/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto(DETAIL_URL);

  await expect(
    page.getByRole("img", {
      name: "상세 상태 테스트 숙소 숙소 사진 없음",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "상세 상태 테스트 숙소 대표 사진 크게 보기",
    }),
  ).toHaveCount(0);
});

test("replaces one exact broken hero image while preserving gallery access", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  const getImageRequestCount = await installBrokenImage(
    page,
    BROKEN_HERO_IMAGE_URL,
  );
  api.register(
    "GET",
    "/api/v1/accommodations/381",
    apiSuccess({
      ...detailAccommodation,
      images: [{ id: 1, image_url: BROKEN_HERO_IMAGE_URL }],
    }),
  );
  api.register(
    "GET",
    "/api/v1/accommodations/381/availability",
    apiSuccess(detailAvailability),
  );

  await page.goto(DETAIL_URL);

  await expect(
    page.getByRole("button", {
      name: "상세 상태 테스트 숙소 대표 사진 크게 보기",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "상세 상태 테스트 숙소 대표 사진을 불러올 수 없음",
    }),
  ).toBeVisible();
  expect(getImageRequestCount()).toBe(1);
});

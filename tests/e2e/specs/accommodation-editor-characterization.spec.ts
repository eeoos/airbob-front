import type { Page } from "@playwright/test";
import {
  apiFailure,
  apiSuccess,
  type ApiResponseSpec,
} from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const makeEditableAccommodation = (baseURL: string) => ({
  id: 31,
  name: "합정 테스트 숙소",
  description: "현재 편집 동작을 고정하기 위한 합성 숙소입니다.",
  type: "APARTMENT",
  base_price: 125000,
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
    nickname: "합정 호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [{ type: "WIFI", count: 1 }],
  images: [
    {
      id: 301,
      image_url: new URL("/logo192.png", baseURL).href,
    },
  ],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
});

const emptyHostListings = {
  accommodations: [],
  page_info: {
    has_next: false,
    next_cursor: null,
    current_size: 0,
  },
};

const emptyGuestReservations = {
  reservations: [],
  page_info: {
    has_next: false,
    next_cursor: null,
    current_size: 0,
  },
};

const openInfoStep = async (page: Page) => {
  await page.getByRole("button").filter({ hasText: "숙소 정보" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소 정보를 알려주세요" }),
  ).toBeVisible();
};

const openPublishStep = async (page: Page) => {
  await page.getByRole("button").filter({ hasText: "숙소 등록" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소를 등록하세요" }),
  ).toBeVisible();
};

test("renders a recoverable editor state when host accommodation hydration fails", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/404",
    apiFailure(404, "A404", "숙소를 찾을 수 없습니다."),
  );

  await page.goto("/accommodations/404/edit");

  await expect(
    page.getByRole("heading", { name: "숙소 정보를 불러오지 못했어요" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "호스트 화면으로 돌아가기" }),
  ).toBeVisible();
  expect(
    api.matching("GET", "/api/v1/profile/host/accommodations/404").length,
  ).toBeGreaterThanOrEqual(1);
});

test("hydrates an existing accommodation and saves its update before publishing", async ({
  api,
  baseURL,
  page,
  session,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required.");
  }
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(makeEditableAccommodation(baseURL)),
  );
  api.register(
    "PATCH",
    "/api/v1/accommodations/31",
    apiSuccess(null),
  );
  api.register(
    "PATCH",
    "/api/v1/accommodations/31/publish",
    apiSuccess(null),
  );
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations",
    apiSuccess(emptyHostListings),
  );

  await page.goto("/accommodations/31/edit");

  await expect(
    page.getByRole("heading", { name: "숙소 위치를 알려주세요" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("주소를 검색하세요")).toHaveValue(
    "월드컵북로",
  );
  await expect(
    page.getByPlaceholder("101호 또는 건물명, 동/호수 등을 입력하세요"),
  ).toHaveValue("101호");

  await openInfoStep(page);
  await page.getByPlaceholder("예: 편안한 아파트").fill("정돈된 합정 테스트 숙소");
  await openPublishStep(page);
  await page.getByRole("button", { name: "저장하기" }).click();

  await expect(page).toHaveURL(/\/profile\?mode=host$/);
  await expect(
    page.getByRole("heading", { name: "숙소 관리", level: 2 }),
  ).toBeVisible();

  const updateRequests = api.matching(
    "PATCH",
    "/api/v1/accommodations/31",
  );
  const publishRequests = api.matching(
    "PATCH",
    "/api/v1/accommodations/31/publish",
  );

  expect(updateRequests).toHaveLength(1);
  expect(publishRequests).toHaveLength(1);
  expect(updateRequests[0].body).toEqual({
    name: "정돈된 합정 테스트 숙소",
  });
  expect(updateRequests[0].sequence).toBeLessThan(
    publishRequests[0].sequence,
  );
});

test("lazy-loads the exact Daum postcode integration before mapping a selection", async ({
  api,
  baseURL,
  page,
  session,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required.");
  }
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(makeEditableAccommodation(baseURL)),
  );

  await page.goto("/accommodations/31/edit");
  await page.getByRole("button", { name: "주소 검색" }).click();

  await expect(page.getByPlaceholder("주소를 검색하세요")).toHaveValue(
    "테헤란로 123",
  );
  await expect(
    page.getByPlaceholder("101호 또는 건물명, 동/호수 등을 입력하세요"),
  ).toHaveValue("");
});

test("does not publish after the editor unmounts while an update is still in flight", async ({
  api,
  baseURL,
  page,
  session,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required.");
  }
  session.authenticate();
  let releaseUpdate!: (response: ApiResponseSpec) => void;
  const pendingUpdate = new Promise<ApiResponseSpec>((resolve) => {
    releaseUpdate = resolve;
  });

  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(makeEditableAccommodation(baseURL)),
  );
  api.register(
    "PATCH",
    "/api/v1/accommodations/31",
    () => pendingUpdate,
  );
  api.register(
    "PATCH",
    "/api/v1/accommodations/31/publish",
    apiSuccess(null),
  );
  api.register(
    "GET",
    "/api/v1/profile/guest/reservations",
    apiSuccess(emptyGuestReservations),
  );

  await page.goto("/accommodations/31/edit");
  await openInfoStep(page);
  await page.getByPlaceholder("예: 편안한 아파트").fill("늦은 응답 테스트 숙소");
  await openPublishStep(page);

  const updateFinished = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === "/api/v1/accommodations/31",
  );
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect
    .poll(() => api.matching("PATCH", "/api/v1/accommodations/31").length)
    .toBe(1);

  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "프로필", level: 1 }),
  ).toBeVisible();

  releaseUpdate(apiSuccess(null));
  await updateFinished;
  await page.waitForLoadState("networkidle");

  expect(
    api.matching("PATCH", "/api/v1/accommodations/31/publish"),
  ).toHaveLength(0);
  await expect(page).toHaveURL(/\/profile$/);
});

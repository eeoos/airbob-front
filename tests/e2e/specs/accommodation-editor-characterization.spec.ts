import type { Page } from "@playwright/test";
import {
  apiFailure,
  apiSuccess,
  requireApiRequest,
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

const installSyntheticEditorImageAssets = async (
  page: Page,
  baseURL: string,
) => {
  const upgradedAppOrigin = new URL(baseURL);
  upgradedAppOrigin.protocol = "https:";
  const allowedPaths = new Set(["/logo192.png", "/logo512.png"]);

  await page.route(
    (url) =>
      url.origin === upgradedAppOrigin.origin && allowedPaths.has(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    },
  );
};

const openInfoStep = async (page: Page) => {
  await page.getByRole("button").filter({ hasText: "숙소 정보" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소 정보를 알려주세요" }),
  ).toBeVisible();
};

const openPhotosStep = async (page: Page) => {
  await page.getByRole("button").filter({ hasText: "숙소 사진" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소 사진을 등록하세요" }),
  ).toBeVisible();
};

const selectPendingImage = async (page: Page) => {
  await page.getByLabel("숙소 사진 추가 선택").setInputFiles({
    name: "pending-room.png",
    mimeType: "image/png",
    buffer: Buffer.from("pending-room"),
  });
  await expect(page.getByRole("button", { name: "이미지 삭제" })).toHaveCount(
    2,
  );
};

const openPublishStep = async (page: Page) => {
  await page.getByRole("button").filter({ hasText: "숙소 등록" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소를 등록하세요" }),
  ).toBeVisible();
};

test("renders an invalid-resource editor state when the accommodation is absent", async ({
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
    page.getByRole("heading", { name: "숙소 정보를 확인할 수 없어요" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "호스트 화면으로 돌아가기" }),
  ).toBeVisible();
  expect(
    api.matching("GET", "/api/v1/profile/host/accommodations/404").length,
  ).toBeGreaterThanOrEqual(1);
});

test("renders a retryable editor state when host hydration fails transiently", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/500",
    apiFailure(500, "C003", "일시적인 서버 오류입니다."),
  );

  await page.goto("/accommodations/500/edit");

  await expect(
    page.getByRole("heading", { name: "숙소 정보를 불러오지 못했어요" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "호스트 화면으로 돌아가기" }),
  ).toBeVisible();
  expect(
    api.matching("GET", "/api/v1/profile/host/accommodations/500").length,
  ).toBeGreaterThanOrEqual(1);
});

test("hydrates an existing accommodation and saves its update before publishing", async ({
  api,
  appBaseURL: baseURL,
  page,
  session,
}) => {
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
  const updateRequest = requireApiRequest(updateRequests, 0, "editor update");
  const publishRequest = requireApiRequest(
    publishRequests,
    0,
    "editor publish",
  );

  expect(updateRequest.body).toEqual({
    name: "정돈된 합정 테스트 숙소",
  });
  expect(updateRequest.sequence).toBeLessThan(publishRequest.sequence);
});

test("lazy-loads the exact Daum postcode integration before mapping a selection", async ({
  api,
  appBaseURL: baseURL,
  page,
  session,
}) => {
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

test("finishes a pending image upload before save-and-exit navigation", async ({
  api,
  appBaseURL: baseURL,
  page,
  session,
}) => {
  session.authenticate();
  let releaseUpload!: (response: ApiResponseSpec) => void;
  const pendingUpload = new Promise<ApiResponseSpec>((resolve) => {
    releaseUpload = resolve;
  });

  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(makeEditableAccommodation(baseURL)),
  );
  api.register(
    "POST",
    "/api/v1/accommodations/31/images",
    () => pendingUpload,
  );
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations",
    apiSuccess(emptyHostListings),
  );
  await installSyntheticEditorImageAssets(page, baseURL);

  await page.goto("/accommodations/31/edit");
  await openPhotosStep(page);
  await selectPendingImage(page);
  await page.getByRole("button", { name: "저장 후 나가기" }).click();

  await expect
    .poll(
      () => api.matching("POST", "/api/v1/accommodations/31/images").length,
    )
    .toBe(1);
  await expect(page).toHaveURL(/\/accommodations\/31\/edit$/);
  await expect(
    page.getByRole("button", { name: "저장 후 나가기" }),
  ).toBeDisabled();
  expect(
    api.matching("GET", "/api/v1/profile/host/accommodations"),
  ).toHaveLength(0);

  releaseUpload(
    apiSuccess({
      uploaded_images: [
        {
          id: 302,
          image_url: new URL("/logo512.png", baseURL).href,
        },
      ],
    }),
  );
  await pendingUpload;

  await expect(page).toHaveURL(/\/profile\?mode=host$/);
  await expect(
    page.getByRole("heading", { name: "숙소 관리", level: 2 }),
  ).toBeVisible();

  const uploadRequests = api.matching(
    "POST",
    "/api/v1/accommodations/31/images",
  );
  const profileRequests = api.matching(
    "GET",
    "/api/v1/profile/host/accommodations",
  );
  expect(uploadRequests).toHaveLength(1);
  expect(profileRequests).toHaveLength(1);
  expect(
    requireApiRequest(uploadRequests, 0, "image upload").sequence,
  ).toBeLessThan(
    requireApiRequest(profileRequests, 0, "profile refresh").sequence,
  );
});

test("keeps the editor mounted when a pending image upload fails", async ({
  api,
  appBaseURL: baseURL,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(makeEditableAccommodation(baseURL)),
  );
  api.register(
    "POST",
    "/api/v1/accommodations/31/images",
    apiFailure(500, "C003", "이미지 업로드 결과를 확인할 수 없습니다."),
  );
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations",
    apiSuccess(emptyHostListings),
  );
  await installSyntheticEditorImageAssets(page, baseURL);

  await page.goto("/accommodations/31/edit");
  await openPhotosStep(page);
  await selectPendingImage(page);
  await page.getByRole("button", { name: "저장 후 나가기" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "요청 결과를 확인할 수 없습니다. 새로고침 후 서버 상태를 확인해 주세요.",
  );
  await expect(page).toHaveURL(/\/accommodations\/31\/edit$/);
  await expect(
    page.getByRole("button", { name: "저장 후 나가기" }),
  ).toBeDisabled();
  expect(
    api.matching("POST", "/api/v1/accommodations/31/images"),
  ).toHaveLength(1);
  expect(
    api.matching("PATCH", "/api/v1/accommodations/31"),
  ).toHaveLength(0);
  expect(
    api.matching("PATCH", "/api/v1/accommodations/31/publish"),
  ).toHaveLength(0);
  expect(
    api.matching("GET", "/api/v1/profile/host/accommodations"),
  ).toHaveLength(0);
});

test("blocks editor commands while an ambiguous image deletion is reconciled once", async ({
  api,
  appBaseURL: baseURL,
  page,
  session,
}) => {
  session.authenticate();
  const detail = {
    ...makeEditableAccommodation(baseURL),
    images: [
      ...makeEditableAccommodation(baseURL).images,
      {
        id: 302,
        image_url: new URL("/logo512.png", baseURL).href,
      },
    ],
  };
  let deleteStarted = false;
  let releaseReconciliation!: (response: ApiResponseSpec) => void;
  const pendingReconciliation = new Promise<ApiResponseSpec>((resolve) => {
    releaseReconciliation = resolve;
  });

  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    () => (deleteStarted ? pendingReconciliation : apiSuccess(detail)),
  );
  api.register(
    "DELETE",
    "/api/v1/accommodations/31/images/301",
    () => {
      deleteStarted = true;
      return apiFailure(500, "C003", "이미지 삭제 결과를 확인할 수 없습니다.");
    },
  );
  await installSyntheticEditorImageAssets(page, baseURL);

  await page.goto("/accommodations/31/edit");
  await openPhotosStep(page);
  const initialDetailReads = api.matching(
    "GET",
    "/api/v1/profile/host/accommodations/31",
  ).length;
  await page.getByRole("button", { name: "이미지 삭제" }).first().click();

  await expect
    .poll(
      () =>
        api.matching("GET", "/api/v1/profile/host/accommodations/31").length,
    )
    .toBe(initialDetailReads + 1);
  await expect(
    page.getByRole("button", { name: "저장 후 나가기" }),
  ).toBeDisabled();
  await expect(
    page.locator("form").locator('button[type="button"]').last(),
  ).toBeDisabled();
  await expect(
    page.getByRole("button").filter({ hasText: "숙소 등록" }),
  ).toBeDisabled();
  expect(
    api.matching("DELETE", "/api/v1/accommodations/31/images/301"),
  ).toHaveLength(1);
  expect(
    api.matching("PATCH", "/api/v1/accommodations/31"),
  ).toHaveLength(0);
  expect(
    api.matching("PATCH", "/api/v1/accommodations/31/publish"),
  ).toHaveLength(0);

  releaseReconciliation(apiSuccess(detail));
  await pendingReconciliation;
  await expect(page.getByRole("button", { name: "이미지 삭제" })).toHaveCount(
    2,
  );

  expect(
    api.matching("DELETE", "/api/v1/accommodations/31/images/301"),
  ).toHaveLength(1);
  expect(
    api.matching("GET", "/api/v1/profile/host/accommodations/31"),
  ).toHaveLength(initialDetailReads + 1);
  expect(
    api.matching("PATCH", "/api/v1/accommodations/31"),
  ).toHaveLength(0);
  expect(
    api.matching("PATCH", "/api/v1/accommodations/31/publish"),
  ).toHaveLength(0);
  await expect(page).toHaveURL(/\/accommodations\/31\/edit$/);
});

test("does not publish after the editor unmounts while an update is still in flight", async ({
  api,
  appBaseURL: baseURL,
  page,
  session,
}) => {
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

  await page.getByRole("button", { name: "저장하기" }).click();
  await expect
    .poll(() => api.matching("PATCH", "/api/v1/accommodations/31").length)
    .toBe(1);

  const updateAborted = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === "/api/v1/accommodations/31",
  );
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "프로필", level: 1 }),
  ).toBeVisible();
  await updateAborted;

  releaseUpdate(apiSuccess(null));
  await pendingUpdate;

  expect(
    api.matching("PATCH", "/api/v1/accommodations/31/publish"),
  ).toHaveLength(0);
  await expect(page).toHaveURL(/\/profile$/);
});

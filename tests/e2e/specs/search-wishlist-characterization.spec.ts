import type { Page } from "@playwright/test";
import {
  apiSuccess,
  type ApiRequestRecord,
  type ApiResponseSpec,
} from "../fixtures/api";
import { SYNTHETIC_USER_B } from "../fixtures/session";
import { test, expect } from "../fixtures/test";

const emptySearchResponse = {
  stay_search_result_listing: [],
  page_info: {
    page_size: 18,
    current_page: 0,
    total_pages: 0,
    total_elements: 0,
    is_first: true,
    is_last: true,
    has_next: false,
    has_previous: false,
  },
};

const makeSearchAccommodation = (
  id: number,
  name: string,
  isInWishlist = false,
) => ({
  id,
  name,
  accommodation_thumbnail_url: null,
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
  is_in_wishlist: isInWishlist,
});

const getRequestQuery = (request: ApiRequestRecord) =>
  Object.fromEntries(request.query);

const openUserMenu = (page: Page) =>
  page.getByRole("button", { name: "사용자 메뉴" }).click();

const logout = async (page: Page) => {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page.getByRole("button", { name: "프로필" })).toBeHidden();
};

const loginAsUserB = async (page: Page) => {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "로그인" }).click();
  const dialog = page.getByRole("dialog", { name: "로그인" });
  await dialog.getByLabel("이메일").fill(SYNTHETIC_USER_B.email);
  await dialog.getByLabel("비밀번호").fill("synthetic-password");
  await dialog.getByRole("button", { name: "로그인", exact: true }).click();
};

test("keeps a URL-driven search stable across a full browser refresh", async ({
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

  const searchURL = "/search?destination=Seoul&adultOccupancy=2";
  const expectedSearchURL =
    /\/search\?destination=Seoul&adultOccupancy=2$/;
  await page.goto(searchURL);

  await expect(
    page.getByRole("heading", { name: "숙소 0개", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
  await expect(page).toHaveURL(expectedSearchURL);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "숙소 0개", level: 2 }),
  ).toBeVisible();
  await expect(page).toHaveURL(expectedSearchURL);

  const searchRequests = api.matching(
    "GET",
    "/api/v1/search/accommodations",
  );
  expect(searchRequests.length).toBeGreaterThanOrEqual(2);

  for (const request of searchRequests) {
    expect(Object.fromEntries(request.query)).toMatchObject({
      destination: "Seoul",
      adultOccupancy: "2",
      childOccupancy: "0",
      infantOccupancy: "0",
      petOccupancy: "0",
      page: "0",
      size: "18",
    });
  }
});

test("restores a direct paginated search through a full browser refresh", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register("GET", "/api/v1/search/accommodations", (request) => {
    const requestedPage = Number(getRequestQuery(request).page ?? "0");

    return apiSuccess({
      stay_search_result_listing: [
        makeSearchAccommodation(
          100 + requestedPage,
          `페이지 ${requestedPage + 1} 숙소`,
        ),
      ],
      page_info: {
        page_size: 18,
        current_page: requestedPage,
        total_pages: 3,
        total_elements: 3,
        is_first: requestedPage === 0,
        is_last: requestedPage === 2,
        has_next: requestedPage < 2,
        has_previous: requestedPage > 0,
      },
    });
  });

  const searchURL = "/search?destination=Seoul&adultOccupancy=2&page=2";
  await page.goto(searchURL);

  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 3 숙소" }),
  ).toBeVisible();
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(
    searchURL,
  );

  await page.reload();

  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 3 숙소" }),
  ).toBeVisible();
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(
    searchURL,
  );

  const directPageRequests = api
    .matching("GET", "/api/v1/search/accommodations")
    .filter((request) => getRequestQuery(request).page === "2");
  expect(directPageRequests.length).toBeGreaterThanOrEqual(2);
});

test("restores paginated search URLs and requests through browser history", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register("GET", "/api/v1/search/accommodations", (request) => {
    const requestedPage = Number(getRequestQuery(request).page ?? "0");

    return apiSuccess({
      stay_search_result_listing: [
        makeSearchAccommodation(
          100 + requestedPage,
          `페이지 ${requestedPage + 1} 숙소`,
        ),
      ],
      page_info: {
        page_size: 18,
        current_page: requestedPage,
        total_pages: 3,
        total_elements: 3,
        is_first: requestedPage === 0,
        is_last: requestedPage === 2,
        has_next: requestedPage < 2,
        has_previous: requestedPage > 0,
      },
    });
  });

  await page.goto("/search?destination=Seoul&adultOccupancy=2");

  const pagination = page.getByRole("navigation", {
    name: "검색 결과 페이지",
  });
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 1 숙소" }),
  ).toBeVisible();
  await expect(pagination.getByRole("button", { name: "1" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await pagination.getByRole("button", { name: "2" }).click();
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 2 숙소" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");

  await pagination.getByRole("button", { name: "3" }).click();
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 3 숙소" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");

  const pageTwoRequestsBeforeBack = api.matching(
    "GET",
    "/api/v1/search/accommodations",
  ).filter((request) => getRequestQuery(request).page === "1").length;
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 2 숙소" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  await expect
    .poll(
      () =>
        api
          .matching("GET", "/api/v1/search/accommodations")
          .filter((request) => getRequestQuery(request).page === "1").length,
    )
    .toBeGreaterThan(pageTwoRequestsBeforeBack);

  const pageThreeRequestsBeforeForward = api.matching(
    "GET",
    "/api/v1/search/accommodations",
  ).filter((request) => getRequestQuery(request).page === "2").length;
  await page.goForward();
  await expect(
    page.getByRole("link", { name: "숙소 상세 보기: 페이지 3 숙소" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  await expect
    .poll(
      () =>
        api
          .matching("GET", "/api/v1/search/accommodations")
          .filter((request) => getRequestQuery(request).page === "2").length,
    )
    .toBeGreaterThan(pageThreeRequestsBeforeForward);
});

test("maps viewport URL coordinates to the search request without loading Google", async ({
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

  const viewportURL =
    "/search?topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&adultOccupancy=2";
  await page.goto(viewportURL);

  await expect(page.getByText("지도를 불러올 수 없습니다.")).toBeVisible();
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(
    viewportURL,
  );

  const viewportRequests = api.matching(
    "GET",
    "/api/v1/search/accommodations",
  );
  expect(viewportRequests.length).toBeGreaterThanOrEqual(1);
  expect(getRequestQuery(viewportRequests[0])).toMatchObject({
    topLeftLat: "38",
    topLeftLng: "126",
    bottomRightLat: "37",
    bottomRightLng: "128",
    adultOccupancy: "2",
    page: "0",
    size: "18",
  });
  expect(getRequestQuery(viewportRequests[0])).not.toHaveProperty(
    "destination",
  );
});

test("projects wishlist add and remove state while collapsing duplicate clicks", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  let isContained = false;
  const accommodationId = 81;
  const wishlistId = 7;
  const wishlistAccommodationId = 501;

  api.register("GET", "/api/v1/search/accommodations", () =>
    apiSuccess({
      stay_search_result_listing: [
        makeSearchAccommodation(
          accommodationId,
          "위시리스트 상태 테스트 숙소",
          isContained,
        ),
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
  api.register("GET", "/api/v1/members/wishlists", () =>
    apiSuccess({
      wishlists: [
        {
          id: wishlistId,
          name: "여름 여행",
          created_at: "2026-07-01T00:00:00Z",
          wishlist_item_count: isContained ? 1 : 0,
          thumbnail_image_url: null,
          is_contained: isContained,
          wishlist_accommodation_id: isContained
            ? wishlistAccommodationId
            : null,
        },
      ],
      page_info: {
        has_next: false,
        next_cursor: null,
        current_size: 1,
      },
    }),
  );
  api.register(
    "POST",
    `/api/v1/members/wishlists/accommodations/${wishlistId}`,
    () => {
      isContained = true;
      return apiSuccess({ id: wishlistAccommodationId }, 201);
    },
  );
  api.register(
    "DELETE",
    `/api/v1/members/wishlists/accommodations/${wishlistAccommodationId}`,
    () => {
      isContained = false;
      return apiSuccess(null);
    },
  );

  await page.goto("/search?destination=Seoul&adultOccupancy=2");

  const cardSaveButton = page.getByRole("button", {
    name: "위시리스트에 저장",
  });
  await expect(cardSaveButton).toBeVisible();
  await cardSaveButton.click();

  const wishlistDialog = page.getByRole("dialog", {
    name: "위시리스트에 저장하기",
  });
  const wishlistButton = wishlistDialog.getByRole("button", {
    name: /여름 여행/,
  });
  await expect(wishlistButton).toHaveAttribute("aria-pressed", "false");

  await wishlistButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });

  await expect(wishlistButton).toHaveAttribute("aria-pressed", "true");
  const addRequests = api.matching(
    "POST",
    `/api/v1/members/wishlists/accommodations/${wishlistId}`,
  );
  expect(addRequests).toHaveLength(1);
  expect(addRequests[0].body).toEqual({ accommodation_id: accommodationId });

  await wishlistDialog.getByRole("button", { name: "닫기" }).click();
  const cardRemoveButton = page.getByRole("button", {
    name: "위시리스트에서 제거",
  });
  await expect(cardRemoveButton).toHaveAttribute("aria-pressed", "true");

  await cardRemoveButton.click();
  const containedWishlistButton = wishlistDialog.getByRole("button", {
    name: /여름 여행/,
  });
  await expect(containedWishlistButton).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(containedWishlistButton).toBeEnabled();
  await containedWishlistButton.click();

  await expect(containedWishlistButton).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    api.matching(
      "DELETE",
      `/api/v1/members/wishlists/accommodations/${wishlistAccommodationId}`,
    ),
  ).toHaveLength(1);

  await wishlistDialog.getByRole("button", { name: "닫기" }).click();
  await expect(cardSaveButton).toHaveAttribute("aria-pressed", "false");
});

test("fences an in-flight A membership result before B runs the same command", async ({
  api,
  context,
  page,
  session,
}) => {
  await context.route(
    /^https:\/\/images\.unsplash\.com\/photo-1566073771259-6a8506099945(?:\?.*)?$/,
    (route) => route.fulfill({ status: 204, body: "" }),
  );
  session.authenticate();
  const accommodationId = 91;
  const wishlistId = 17;
  const wishlistAccommodationId = 701;
  let isContained = false;
  let addAttempt = 0;
  let resolveOldAdd!: (response: ApiResponseSpec) => void;
  const oldAddResponse = new Promise<ApiResponseSpec>((resolve) => {
    resolveOldAdd = resolve;
  });

  api.register("GET", "/api/v1/search/accommodations", () =>
    apiSuccess({
      stay_search_result_listing: [
        makeSearchAccommodation(
          accommodationId,
          "세션 경계 테스트 숙소",
          isContained,
        ),
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
  api.register("GET", "/api/v1/members/wishlists", () =>
    apiSuccess({
      wishlists: [
        {
          id: wishlistId,
          name: "세션 경계 여행",
          created_at: "2026-08-29T00:00:00Z",
          wishlist_item_count: isContained ? 1 : 0,
          thumbnail_image_url: null,
          is_contained: isContained,
          wishlist_accommodation_id: isContained
            ? wishlistAccommodationId
            : null,
        },
      ],
      page_info: {
        has_next: false,
        next_cursor: null,
        current_size: 1,
      },
    }),
  );
  api.register(
    "POST",
    `/api/v1/members/wishlists/accommodations/${wishlistId}`,
    () => {
      addAttempt += 1;
      if (addAttempt === 1) return oldAddResponse;

      isContained = true;
      return apiSuccess({ id: wishlistAccommodationId }, 201);
    },
  );

  const searchUrl = "/search?destination=Seoul&adultOccupancy=2";
  const secondPage = await context.newPage();
  await Promise.all([page.goto(searchUrl), secondPage.goto(searchUrl)]);

  await page.getByRole("button", { name: "위시리스트에 저장" }).click();
  const oldDialog = page.getByRole("dialog", {
    name: "위시리스트에 저장하기",
  });
  await oldDialog.getByRole("button", { name: /세션 경계 여행/ }).click();
  await expect
    .poll(
      () =>
        api.matching(
          "POST",
          `/api/v1/members/wishlists/accommodations/${wishlistId}`,
        ).length,
    )
    .toBe(1);

  await logout(secondPage);
  await loginAsUserB(secondPage);
  await expect(page.getByRole("button", { name: "프로필" })).toBeVisible();
  await expect(secondPage.getByRole("button", { name: "프로필" })).toBeVisible();

  const countAccommodationScopedWishlistReads = () =>
    api
      .matching("GET", "/api/v1/members/wishlists")
      .filter(
        (request) =>
          getRequestQuery(request).accommodationId ===
          String(accommodationId),
      ).length;
  const scopedReadsBeforeOldAddResolution =
    countAccommodationScopedWishlistReads();

  resolveOldAdd(apiSuccess({ id: wishlistAccommodationId }, 201));
  await expect(oldDialog).toBeHidden();
  const currentSaveButton = page.getByRole("button", {
    name: "위시리스트에 저장",
  });
  await expect(currentSaveButton).toHaveAttribute("aria-pressed", "false");
  expect(countAccommodationScopedWishlistReads()).toBe(
    scopedReadsBeforeOldAddResolution,
  );

  await currentSaveButton.click();
  const currentDialog = page.getByRole("dialog", {
    name: "위시리스트에 저장하기",
  });
  await currentDialog
    .getByRole("button", { name: /세션 경계 여행/ })
    .click();

  await expect(
    currentDialog.getByRole("button", { name: /세션 경계 여행/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    api.matching(
      "POST",
      `/api/v1/members/wishlists/accommodations/${wishlistId}`,
    ),
  ).toHaveLength(2);
});

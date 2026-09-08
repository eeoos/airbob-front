import type { Page } from "@playwright/test";
import {
  apiSuccess,
  requireApiRequest,
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
  const expectedSearchURL = /\/search\?destination=Seoul&adultOccupancy=2$/;
  await page.goto(searchURL);

  await expect(
    page.getByRole("heading", { name: "숙소 0개", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("조건에 맞는 숙소가 없어요")).toBeVisible();
  await expect(page).toHaveURL(expectedSearchURL);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "숙소 0개", level: 2 }),
  ).toBeVisible();
  await expect(page).toHaveURL(expectedSearchURL);

  const searchRequests = api.matching("GET", "/api/v1/search/accommodations");
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

  const pageTwoRequestsBeforeBack = api
    .matching("GET", "/api/v1/search/accommodations")
    .filter((request) => getRequestQuery(request).page === "1").length;
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

  const pageThreeRequestsBeforeForward = api
    .matching("GET", "/api/v1/search/accommodations")
    .filter((request) => getRequestQuery(request).page === "2").length;
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

test("places pagination after results and returns to the top after page changes", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register("GET", "/api/v1/search/accommodations", (request) => {
    const requestedPage = Number(getRequestQuery(request).page ?? "0");
    const resultCount = requestedPage === 3 ? 3 : 18;
    const nameSuffix =
      requestedPage === 2
        ? " 넓은 거실과 바다 전망이 있는 가족 숙소".repeat(8)
        : "";

    return apiSuccess({
      stay_search_result_listing: Array.from(
        { length: resultCount },
        (_, index) => {
          const accommodation = makeSearchAccommodation(
            requestedPage * 100 + index + 1,
            `페이지 ${requestedPage + 1} 숙소 ${index + 1}${index % 3 === 1 ? nameSuffix : ""}`,
          );
          return {
            ...accommodation,
            address_summary: {
              ...accommodation.address_summary,
              city:
                index % 4 === 0
                  ? "서울 용산구 한강 전망이 보이는 조용한 동네"
                  : "서울",
            },
          };
        },
      ),
      page_info: {
        page_size: 18,
        current_page: requestedPage,
        total_pages: 4,
        total_elements: 57,
        is_first: requestedPage === 0,
        is_last: requestedPage === 3,
        has_next: requestedPage < 3,
        has_previous: requestedPage > 0,
      },
    });
  });

  const desktopViewports = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ];

  for (const viewport of desktopViewports) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      await page.goto("/search?destination=Seoul&adultOccupancy=2");

      const pagination = page.getByRole("navigation", {
        name: "검색 결과 페이지",
      });
      await expect(pagination).not.toBeInViewport();
      const resultsScrollArea = page.getByRole("region", {
        name: "숙소 목록 스크롤",
      });
      await expect(
        resultsScrollArea.getByRole("navigation", { name: "검색 결과 페이지" }),
      ).toHaveCount(1);
      await pagination.scrollIntoViewIfNeeded();
      await expect(pagination).toBeInViewport();
      await expect
        .poll(() =>
          page.evaluate(() => ({
            documentHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
            windowScrollY: window.scrollY,
          })),
        )
        .toEqual({
          documentHeight: viewport.height,
          viewportHeight: viewport.height,
          windowScrollY: 0,
        });

      for (const { button, currentPage } of [
        { button: "2", currentPage: "2" },
        { button: "3", currentPage: "3" },
        { button: "다음", currentPage: "4" },
        { button: "이전", currentPage: "3" },
        { button: "1", currentPage: "1" },
        { button: "다음", currentPage: "2" },
        { button: "다음", currentPage: "3" },
      ]) {
        await pagination
          .getByRole("button", { name: button, exact: true })
          .click();
        const activeButton = pagination.getByRole("button", {
          name: currentPage,
          exact: true,
        });
        await expect(activeButton).toHaveAttribute("aria-current", "page");
        await expect(activeButton).toBeEnabled();
        expect(
          await resultsScrollArea.evaluate((element) => element.scrollTop),
        ).toBe(0);
        await expect(
          resultsScrollArea.getByRole("listitem").first(),
        ).toBeInViewport();
        const lastCardBottom = await resultsScrollArea
          .getByRole("listitem")
          .last()
          .evaluate((element) => element.getBoundingClientRect().bottom);
        const paginationTop = await pagination.evaluate(
          (element) => element.getBoundingClientRect().top,
        );
        expect(paginationTop).toBeGreaterThan(lastCardBottom);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        await pagination.scrollIntoViewIfNeeded();
        for (const pageButton of await pagination.getByRole("button").all()) {
          await expect(pageButton).toBeInViewport({ ratio: 1 });
        }
        const cardRows = await page
          .getByTestId("search-result-card")
          .evaluateAll((cards) => {
            const rows = new Map<number, number[][]>();
            for (const card of cards) {
              const info = card.querySelector("a > div:last-child");
              if (!info) throw new Error("Missing accommodation information");
              const top = card.getBoundingClientRect().top;
              const partTops = Array.from(info.children).map(
                (part) => part.getBoundingClientRect().top,
              );
              rows.set(top, [...(rows.get(top) ?? []), partTops]);
            }
            return Array.from(rows.values());
          });
        for (const row of cardRows) {
          for (const partIndex of [0, 1, 2]) {
            const positions = row.map(
              (parts) => parts[partIndex] ?? Number.NaN,
            );
            expect(
              Math.max(...positions) - Math.min(...positions),
            ).toBeLessThan(1);
          }
        }
      }
    });
  }
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

  await expect(
    page.getByText("지도 없이 결과를 둘러볼 수 있어요"),
  ).toBeVisible();
  await expect(page.getByText("조건에 맞는 숙소가 없어요")).toBeVisible();
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(
    viewportURL,
  );

  const viewportRequests = api.matching("GET", "/api/v1/search/accommodations");
  expect(viewportRequests.length).toBeGreaterThanOrEqual(1);
  const viewportRequest = requireApiRequest(
    viewportRequests,
    0,
    "viewport search",
  );

  expect(getRequestQuery(viewportRequest)).toMatchObject({
    topLeftLat: "38",
    topLeftLng: "126",
    bottomRightLat: "37",
    bottomRightLng: "128",
    adultOccupancy: "2",
    page: "0",
    size: "18",
  });
  expect(getRequestQuery(viewportRequest)).not.toHaveProperty("destination");
});

test("saves through the picker then removes directly from the heart while collapsing duplicate clicks", async ({
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
  await expect(wishlistButton).toHaveAccessibleName(/저장되지 않음/);

  await wishlistButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });

  await expect(wishlistDialog).toBeHidden();
  const addRequests = api.matching(
    "POST",
    `/api/v1/members/wishlists/accommodations/${wishlistId}`,
  );
  expect(addRequests).toHaveLength(1);
  expect(requireApiRequest(addRequests, 0, "wishlist add").body).toEqual({
    accommodation_id: accommodationId,
  });

  const savedCardButton = page.getByRole("button", {
    name: "위시리스트에서 제거",
  });
  await expect(savedCardButton).toHaveAttribute("aria-pressed", "true");

  await savedCardButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });

  await expect(cardSaveButton).toHaveAttribute("aria-pressed", "false");
  await expect(wishlistDialog).toBeHidden();
  expect(
    api.matching(
      "DELETE",
      `/api/v1/members/wishlists/accommodations/${wishlistAccommodationId}`,
    ),
  ).toHaveLength(1);

  expect(
    api.matching(
      "POST",
      `/api/v1/members/wishlists/accommodations/${wishlistId}`,
    ),
  ).toHaveLength(1);
  await page.reload();
  await expect(cardSaveButton).toHaveAttribute("aria-pressed", "false");
  await cardSaveButton.click();
  await expect(wishlistDialog).toBeVisible();
  await expect(wishlistButton).toHaveAccessibleName(/저장되지 않음/);
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
  await expect(
    secondPage.getByRole("button", { name: "프로필" }),
  ).toBeVisible();

  const countAccommodationScopedWishlistReads = () =>
    api
      .matching("GET", "/api/v1/members/wishlists")
      .filter(
        (request) =>
          getRequestQuery(request).accommodationId === String(accommodationId),
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
  await currentDialog.getByRole("button", { name: /세션 경계 여행/ }).click();

  await expect(currentDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "위시리스트에서 제거" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    api.matching(
      "POST",
      `/api/v1/members/wishlists/accommodations/${wishlistId}`,
    ),
  ).toHaveLength(2);
});

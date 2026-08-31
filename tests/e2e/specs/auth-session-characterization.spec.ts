import type { BrowserContext, Page } from "@playwright/test";
import {
  apiSuccess,
  requireApiRequest,
  type ApiHarness,
} from "../fixtures/api";
import { SYNTHETIC_USER_B, type SyntheticUser } from "../fixtures/session";
import { test, expect } from "../fixtures/test";

const emptyPage = {
  has_next: false,
  next_cursor: null,
  current_size: 0,
};

const searchableAccommodation = {
  id: 81,
  name: "인증 취소 테스트 숙소",
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
    latitude: 37.572,
    longitude: 126.979,
  },
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  is_in_wishlist: false,
};

const identityOwnedSessionStoragePrefixes = [
  "airbob:booking-payment-v1:",
  "airbob:reservation-checkout:",
  "airbob:reservation-checkout-index:",
  "airbob:payment-confirmed:",
] as const;

const deterministicSessionRoute = "/search?destination=Seoul&adultOccupancy=2";

const stubHomeHeroImage = (context: BrowserContext) =>
  context.route(
    /^https:\/\/images\.unsplash\.com\/photo-1566073771259-6a8506099945(?:\?.*)?$/,
    (route) => route.fulfill({ status: 204, body: "" }),
  );

const registerDeterministicSessionRoute = (api: ApiHarness) => {
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess({
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
    }),
  );
};

const openUserMenu = async (page: Page) => {
  await page.getByRole("button", { name: "사용자 메뉴" }).click();
};

const closeUserMenu = async (page: Page) => {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "사용자 메뉴" })).toBeHidden();
};

const expectAuthenticatedHeader = async (page: Page) => {
  await expect(page.getByRole("button", { name: "프로필" })).toBeVisible();
  await openUserMenu(page);
  await expect(page.getByRole("menuitem", { name: "로그아웃" })).toBeVisible();
  await closeUserMenu(page);
};

const expectAnonymousHeader = async (page: Page) => {
  await expect(page.getByRole("button", { name: "프로필" })).toBeHidden();
  await openUserMenu(page);
  await expect(page.getByRole("menuitem", { name: "로그인" })).toBeVisible();
  await closeUserMenu(page);
};

const loginFromSessionRoute = async (page: Page, user: SyntheticUser) => {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "로그인" }).click();

  const dialog = page.getByRole("dialog", { name: "로그인" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("이메일").fill(user.email);
  await dialog.getByLabel("비밀번호").fill("synthetic-password");
  await dialog.getByRole("button", { name: "로그인", exact: true }).click();
};

const logoutFromSessionRoute = async (page: Page) => {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
};

const seedOwnedSessionStorage = async (page: Page, tabId: string) => {
  await page.evaluate((syntheticTabId) => {
    sessionStorage.setItem(
      "airbob:booking-payment-v1:checkout",
      `synthetic-checkout-${syntheticTabId}`,
    );
    sessionStorage.setItem(
      "airbob:booking-payment-v1:callback",
      `synthetic-callback-${syntheticTabId}`,
    );
    sessionStorage.setItem(
      `airbob:reservation-checkout:${syntheticTabId}`,
      `retired-checkout-${syntheticTabId}`,
    );
    sessionStorage.setItem(
      `airbob:reservation-checkout-index:synthetic-${syntheticTabId}`,
      syntheticTabId,
    );
    sessionStorage.setItem(
      `airbob:payment-confirmed:synthetic-${syntheticTabId}`,
      "1",
    );
    sessionStorage.setItem("airbob:unrelated", `keep-${syntheticTabId}`);
  }, tabId);
};

const readOwnedSessionStorage = (page: Page) =>
  page.evaluate((prefixes) => {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index),
    ).filter((key): key is string => key !== null);

    return {
      ownedKeys: keys.filter((key) =>
        prefixes.some((prefix) => key.startsWith(prefix)),
      ),
      unrelated: sessionStorage.getItem("airbob:unrelated"),
    };
  }, identityOwnedSessionStoragePrefixes);

const expectOwnedSessionStorageCleared = async (page: Page, tabId: string) => {
  await expect
    .poll(() => readOwnedSessionStorage(page))
    .toEqual({
      ownedKeys: [],
      unrelated: `keep-${tabId}`,
    });
};

test("returns an anonymous user to the complete protected URL after login", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/members/recently-viewed",
    apiSuccess({ accommodations: [], total_count: 0 }),
  );
  api.register(
    "GET",
    "/api/v1/members/wishlists",
    apiSuccess({
      wishlists: [
        {
          id: 7,
          name: "여름 여행",
          created_at: "2026-07-01T00:00:00Z",
          wishlist_item_count: 0,
          thumbnail_image_url: null,
          is_contained: null,
          wishlist_accommodation_id: null,
        },
      ],
      page_info: { ...emptyPage, current_size: 1 },
    }),
  );
  api.register(
    "GET",
    "/api/v1/members/wishlists/accommodations/7",
    apiSuccess({
      wishlist_accommodations: [],
      page_info: emptyPage,
    }),
  );

  await page.goto("/wishlist?id=7#memo");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "로그인", level: 2 }),
  ).toBeVisible();

  await page.getByLabel("이메일").fill("person-a@example.invalid");
  await page.getByLabel("비밀번호").fill("synthetic-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/wishlist\?id=7#memo$/);
  await expect(
    page.getByRole("heading", { name: "여름 여행", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("위시리스트가 비어있습니다.")).toBeVisible();

  const loginRequests = api.matching("POST", "/api/v1/auth/login");
  expect(loginRequests).toHaveLength(1);
  expect(requireApiRequest(loginRequests, 0, "login").body).toEqual({
    email: "person-a@example.invalid",
    password: "synthetic-password",
  });

  const detailRequests = api.matching(
    "GET",
    "/api/v1/members/wishlists/accommodations/7",
  );
  expect(detailRequests.length).toBeGreaterThanOrEqual(1);
  expect(
    Object.fromEntries(
      requireApiRequest(detailRequests, 0, "wishlist detail").query,
    ),
  ).toMatchObject({
    size: "20",
  });
});

test("cancels a pending anonymous wishlist save when the auth modal closes", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess({
      stay_search_result_listing: [searchableAccommodation],
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

  const searchURL = "/search?destination=Seoul&adultOccupancy=2";
  await page.goto(searchURL);

  const saveButton = page.getByRole("button", {
    name: "위시리스트에 저장",
  });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  const authDialog = page.getByRole("dialog", { name: "로그인" });
  await expect(authDialog).toBeVisible();
  await authDialog.getByRole("button", { name: "닫기" }).click();

  await expect(authDialog).toBeHidden();
  await expect(saveButton).toHaveAttribute("aria-pressed", "false");
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(
    searchURL,
  );
  expect(api.matching("POST", "/api/v1/auth/login")).toHaveLength(0);
  expect(
    api.requests.filter(
      (request) =>
        request.method !== "GET" &&
        request.pathname.startsWith(
          "/api/v1/members/wishlists/accommodations/",
        ),
    ),
  ).toHaveLength(0);

  await saveButton.click();
  await expect(authDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(authDialog).toBeHidden();
  await expect(saveButton).toHaveAttribute("aria-pressed", "false");
});

test("resumes an anonymous wishlist intent once in the authenticated session generation", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess({
      stay_search_result_listing: [searchableAccommodation],
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
  api.register(
    "GET",
    "/api/v1/members/wishlists",
    apiSuccess({
      wishlists: [
        {
          id: 7,
          name: "로그인 뒤 이어진 여행",
          created_at: "2026-07-01T00:00:00Z",
          wishlist_item_count: 0,
          thumbnail_image_url: null,
          is_contained: false,
          wishlist_accommodation_id: null,
        },
      ],
      page_info: { ...emptyPage, current_size: 1 },
    }),
  );

  const searchURL = "/search?destination=Seoul&adultOccupancy=2";
  await page.goto(searchURL);
  await page.getByRole("button", { name: "위시리스트에 저장" }).click();

  const authDialog = page.getByRole("dialog", { name: "로그인" });
  await authDialog.getByLabel("이메일").fill(SYNTHETIC_USER_B.email);
  await authDialog.getByLabel("비밀번호").fill("synthetic-password");
  await authDialog.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(authDialog).toBeHidden();
  await expect(
    page.getByRole("dialog", { name: "위시리스트에 저장하기" }),
  ).toBeVisible();
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(
    searchURL,
  );

  expect(api.matching("POST", "/api/v1/auth/login")).toHaveLength(1);
  const resumedReads = api.matching("GET", "/api/v1/members/wishlists");
  expect(resumedReads).toHaveLength(1);
  expect(
    Object.fromEntries(
      requireApiRequest(resumedReads, 0, "resumed wishlist").query,
    ),
  ).toMatchObject({
    accommodationId: String(searchableAccommodation.id),
    size: "20",
  });
  expect(
    api.requests.filter(
      (request) =>
        request.method !== "GET" &&
        request.pathname.startsWith("/api/v1/members/wishlists"),
    ),
  ).toHaveLength(0);
});

test("synchronizes a successful logout and clears each same-origin tab", async ({
  api,
  context,
  page,
  session,
}) => {
  await stubHomeHeroImage(context);
  session.authenticate();
  registerDeterministicSessionRoute(api);
  const secondPage = await context.newPage();

  await Promise.all([
    page.goto(deterministicSessionRoute),
    secondPage.goto(deterministicSessionRoute),
  ]);
  await Promise.all([
    expectAuthenticatedHeader(page),
    expectAuthenticatedHeader(secondPage),
  ]);
  await Promise.all([
    seedOwnedSessionStorage(page, "tab-a"),
    seedOwnedSessionStorage(secondPage, "tab-b"),
  ]);

  const meRequestsBeforeLogout = api.matching("GET", "/api/v1/auth/me").length;
  await logoutFromSessionRoute(page);

  await Promise.all([
    expectAnonymousHeader(page),
    expectAnonymousHeader(secondPage),
    expectOwnedSessionStorageCleared(page, "tab-a"),
    expectOwnedSessionStorageCleared(secondPage, "tab-b"),
  ]);

  expect(api.matching("POST", "/api/v1/auth/logout")).toHaveLength(1);
  const meRequestsAfterLogout = api.matching("GET", "/api/v1/auth/me").length;
  expect(meRequestsAfterLogout - meRequestsBeforeLogout).toBeGreaterThanOrEqual(
    1,
  );
  expect(meRequestsAfterLogout - meRequestsBeforeLogout).toBeLessThanOrEqual(2);
});

test("publishes a B login to another page through remote session revalidation", async ({
  api,
  context,
  page,
  session,
}) => {
  session.clear();
  registerDeterministicSessionRoute(api);
  const secondPage = await context.newPage();

  await Promise.all([
    page.goto(deterministicSessionRoute),
    secondPage.goto(deterministicSessionRoute),
  ]);
  await Promise.all([
    expectAnonymousHeader(page),
    expectAnonymousHeader(secondPage),
  ]);

  const meRequestsBeforeLogin = api.matching("GET", "/api/v1/auth/me").length;
  await loginFromSessionRoute(page, SYNTHETIC_USER_B);

  await Promise.all([
    expectAuthenticatedHeader(page),
    expectAuthenticatedHeader(secondPage),
  ]);

  const loginRequests = api.matching("POST", "/api/v1/auth/login");
  expect(loginRequests).toHaveLength(1);
  expect(requireApiRequest(loginRequests, 0, "cross-tab login").body).toEqual({
    email: SYNTHETIC_USER_B.email,
    password: "synthetic-password",
  });
  const meRequestsAfterLogin = api.matching("GET", "/api/v1/auth/me").length;
  expect(meRequestsAfterLogin - meRequestsBeforeLogin).toBeGreaterThanOrEqual(
    2,
  );
  expect(meRequestsAfterLogin - meRequestsBeforeLogin).toBeLessThanOrEqual(3);
});

test("keeps the sender locally anonymous when logout fails while the remote page revalidates A", async ({
  api,
  context,
  page,
  session,
}) => {
  session.authenticate();
  session.failNextLogout();
  registerDeterministicSessionRoute(api);
  const secondPage = await context.newPage();

  await Promise.all([
    page.goto(deterministicSessionRoute),
    secondPage.goto(deterministicSessionRoute),
  ]);
  await Promise.all([
    expectAuthenticatedHeader(page),
    expectAuthenticatedHeader(secondPage),
  ]);

  const meRequestsBeforeLogout = api.matching("GET", "/api/v1/auth/me").length;
  await logoutFromSessionRoute(page);

  await expect(page.getByRole("button", { name: "프로필" })).toBeHidden();
  await expect(page.getByRole("alert")).toContainText(
    "서버에서 로그아웃을 확인하지 못했습니다.",
  );
  await expect
    .poll(() => api.matching("GET", "/api/v1/auth/me").length)
    .toBeGreaterThan(meRequestsBeforeLogout);
  await expectAuthenticatedHeader(secondPage);

  expect(api.matching("POST", "/api/v1/auth/logout")).toHaveLength(1);
  const meRequestsAfterLogout = api.matching("GET", "/api/v1/auth/me").length;
  expect(meRequestsAfterLogout - meRequestsBeforeLogout).toBeGreaterThanOrEqual(
    1,
  );
  expect(meRequestsAfterLogout - meRequestsBeforeLogout).toBeLessThanOrEqual(2);
});

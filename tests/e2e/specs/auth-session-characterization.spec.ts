import { apiSuccess } from "../fixtures/api";
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
  expect(loginRequests[0].body).toEqual({
    email: "person-a@example.invalid",
    password: "synthetic-password",
  });

  const detailRequests = api.matching(
    "GET",
    "/api/v1/members/wishlists/accommodations/7",
  );
  expect(detailRequests.length).toBeGreaterThanOrEqual(1);
  expect(Object.fromEntries(detailRequests[0].query)).toMatchObject({
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

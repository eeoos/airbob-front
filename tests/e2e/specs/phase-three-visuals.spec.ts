import type { Locator, Page } from "@playwright/test";
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const DESKTOP_VIEWPORT = { width: 1440, height: 1000 } as const;
const MOBILE_VIEWPORT = { width: 320, height: 1100 } as const;
const SYNTHETIC_IMAGE_ORIGIN = "https://images.airbob.invalid";
const WISHLIST_ID = 17;
const GUEST_RESERVATION_UID = "30000000-0000-4000-8000-000000000001";
const HOST_RESERVATION_UID = "30000000-0000-4000-8000-000000000002";
const REVIEW_RESERVATION_UID = "30000000-0000-4000-8000-000000000003";

const imageUrls = {
  editor: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/editor.svg`,
  guestTrip: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/guest-trip.svg`,
  hostStay: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/host-stay.svg`,
  review: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/review.svg`,
  reviewStay: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/review-stay.svg`,
  wishlistCollection: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/wishlist-collection.svg`,
  wishlistStay: `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/wishlist-stay.svg`,
} as const;

const detailImageUrls = Array.from(
  { length: 5 },
  (_, index) => `${SYNTHETIC_IMAGE_ORIGIN}/phase-3/detail-${index + 1}.svg`,
);

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  fullPage: false,
  maxDiffPixelRatio: 0.03,
  scale: "css",
} as const;

const locatorScreenshotOptions = {
  animations: screenshotOptions.animations,
  caret: screenshotOptions.caret,
  maxDiffPixelRatio: screenshotOptions.maxDiffPixelRatio,
  scale: screenshotOptions.scale,
} as const;

const pageInfo = {
  current_size: 1,
  has_next: false,
  next_cursor: null,
};

const syntheticImagePalette = [
  ["#dff4fb", "#5aaed2", "#14323f"],
  ["#f6e9df", "#c9785d", "#4b3028"],
  ["#e7f1e8", "#78a77e", "#294a32"],
  ["#eee8f7", "#9678bd", "#3f3057"],
] as const;

const syntheticImageBody = (index: number): string => {
  const [surface, accent, ink] =
    syntheticImagePalette[index % syntheticImagePalette.length] ??
    syntheticImagePalette[0];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="${surface}" />
      <circle cx="940" cy="155" r="96" fill="${accent}" opacity="0.72" />
      <path d="M0 610 260 370l170 160 190-210 260 290 150-120 170 150v160H0Z" fill="${accent}" opacity="0.5" />
      <path d="M365 610V350l235-150 235 150v260H365Z" fill="white" opacity="0.92" />
      <path d="M470 610V455h260v155M515 365h170" fill="none" stroke="${ink}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
};

const installSyntheticImages = async (
  page: Page,
  urls: readonly string[],
): Promise<void> => {
  await Promise.all(
    urls.map((url, index) =>
      page.route(url, async (route) => {
        await route.fulfill({
          body: syntheticImageBody(index),
          contentType: "image/svg+xml; charset=utf-8",
          status: 200,
        });
      }),
    ),
  );
};

const waitForStablePaint = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => {})),
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
};

const expectNoHorizontalOverflow = async (
  page: Page,
  expectedWidth: number,
): Promise<void> => {
  const { offenders, ...widths } = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    offenders: Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();

        return {
          className: element.className,
          clientWidth: element.clientWidth,
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          scrollWidth: element.scrollWidth,
          tagName: element.tagName,
          width: Math.round(bounds.width),
        };
      })
      .filter(
        ({ left, right, width }) =>
          width > 0 && (left < 0 || right > window.innerWidth),
      )
      .slice(0, 12),
    viewport: window.innerWidth,
  }));
  const diagnostic = JSON.stringify(offenders);

  expect(widths.viewport).toBe(expectedWidth);
  expect(widths.body, diagnostic).toBeLessThanOrEqual(widths.viewport);
  expect(widths.document, diagnostic).toBeLessThanOrEqual(widths.viewport);
};

const capture = async (page: Page, name: string): Promise<void> => {
  await waitForStablePaint(page);
  await expect(page).toHaveScreenshot(name, screenshotOptions);
};

const captureAtTop = async (page: Page, name: string): Promise<void> => {
  await waitForStablePaint(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo(0, 0);
  });
  await expect(
    page.getByRole("link", { name: "Airbob 홈으로 이동" }),
  ).toBeInViewport();
  await expect(page).toHaveScreenshot(name, screenshotOptions);
};

const captureLocator = async (
  locator: Locator,
  name: string,
): Promise<void> => {
  await waitForStablePaint(locator.page());
  await expect(locator).toHaveScreenshot(name, locatorScreenshotOptions);
};

const expectHeaderReady = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole("link", { name: "Airbob 홈으로 이동" }),
  ).toBeVisible();
};

const wishlistCollection = {
  page_info: pageInfo,
  wishlists: [
    {
      created_at: "2026-06-20T00:00:00Z",
      id: WISHLIST_ID,
      is_contained: null,
      name: "가을 서울 산책",
      thumbnail_image_url: imageUrls.wishlistCollection,
      wishlist_accommodation_id: null,
      wishlist_item_count: 1,
    },
  ],
};

const recentlyViewedCollection = {
  accommodations: [
    {
      accommodation_id: 71,
      accommodation_name: "서촌의 고요한 집",
      address_summary: {
        city: "서울",
        country: "대한민국",
        district: "종로구",
        state: "서울특별시",
      },
      is_in_wishlist: true,
      review_summary: { average_rating: 4.91, total_count: 42 },
      thumbnail_url: imageUrls.wishlistStay,
      viewed_at: "2026-07-01T02:00:00Z",
    },
  ],
  total_count: 1,
};

const wishlistDetail = {
  wishlist_name: "가을 서울 산책",
  page_info: pageInfo,
  wishlist_accommodations: [
    {
      accommodation: {
        id: 71,
        name: "서촌의 고요한 집",
        thumbnail_url: imageUrls.wishlistStay,
      },
      address_summary: {
        city: "서울",
        country: "대한민국",
        district: "종로구",
        state: "서울특별시",
      },
      created_at: "2026-06-20T00:00:00Z",
      is_in_wishlist: true,
      memo: "아침 산책과 작은 서점을 함께 둘러보기",
      review_summary: { average_rating: 4.91, total_count: 42 },
      wishlist_accommodation_id: 501,
    },
  ],
};

const guestReservations = {
  page_info: pageInfo,
  reservations: [
    {
      accommodation: {
        id: 71,
        name: "서촌의 고요한 집",
        thumbnail_url: imageUrls.guestTrip,
      },
      check_in_date: "2026-09-12",
      check_out_date: "2026-09-15",
      created_at: "2026-06-18T00:00:00Z",
      reservation_id: 301,
      reservation_uid: GUEST_RESERVATION_UID,
      status: "CONFIRMED",
      time_zone_id: "Asia/Seoul",
    },
  ],
};

const hostReservations = {
  page_info: pageInfo,
  reservations: [
    {
      accommodation: {
        id: 82,
        name: "망원 햇살 스테이",
        thumbnail_url: imageUrls.hostStay,
      },
      check_in_date: "2026-09-20",
      check_out_date: "2026-09-23",
      created_at: "2026-06-22T00:00:00Z",
      currency: "KRW",
      guest: {
        id: 303,
        nickname: "합성 게스트",
        thumbnail_image_url: null,
      },
      guest_count: 2,
      reservation_code: "AIRBOB-SYNTHETIC-302",
      reservation_uid: HOST_RESERVATION_UID,
      status: "CONFIRMED",
      time_zone_id: "Asia/Seoul",
      total_price: 420_000,
    },
  ],
};

const hostListings = {
  accommodations: [
    {
      address_summary: {
        city: "서울",
        country: "대한민국",
        district: "마포구",
        state: "서울특별시",
      },
      created_at: "2026-05-10T00:00:00Z",
      id: 82,
      name: "망원 햇살 스테이",
      status: "PUBLISHED",
      thumbnail_url: imageUrls.hostStay,
      type: "ENTIRE_PLACE",
    },
  ],
  page_info: pageInfo,
};

const hostReservationDetail = {
  accommodation: {
    id: 82,
    name: "망원 햇살 스테이",
    thumbnail_url: imageUrls.hostStay,
  },
  address: {
    city: "서울",
    country: "대한민국",
    detail: "3층",
    district: "마포구",
    postal_code: "03900",
    state: "서울특별시",
    street: "망원로",
  },
  check_in_date_time: "2026-09-20T15:00:00+09:00",
  check_out_date_time: "2026-09-23T11:00:00+09:00",
  created_at: "2026-06-22T00:00:00Z",
  guest: {
    id: 303,
    nickname: "합성 게스트",
    thumbnail_image_url: null,
  },
  guest_count: 2,
  payment: {
    total_amount: 420_000,
  },
  request_message: "조용한 체크인을 부탁드립니다.",
  reservation_code: "AIRBOB-SYNTHETIC-302",
  reservation_uid: HOST_RESERVATION_UID,
  status: "CONFIRMED",
  time_zone_id: "Asia/Seoul",
};

const detailAccommodation = {
  address_summary: {
    city: "서울",
    country: "대한민국",
    district: "마포구",
    state: "서울특별시",
  },
  amenities: [
    { count: 1, type: "WIFI" },
    { count: 1, type: "AIR_CONDITIONER" },
    { count: 1, type: "HEATING" },
  ],
  base_price: 150_000,
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  coordinate: { latitude: 37.549, longitude: 126.914 },
  currency: "KRW",
  description: "천천히 머물며 동네의 결을 느낄 수 있는 합성 숙소입니다.",
  host: {
    id: 202,
    nickname: "합성 호스트",
    thumbnail_image_url: null,
  },
  id: 7,
  images: detailImageUrls.map((imageUrl, index) => ({
    id: index + 1,
    image_url: imageUrl,
  })),
  is_in_wishlist: false,
  name: "합정 여행 기록 스테이",
  policy: { infant_occupancy: 1, max_occupancy: 4, pet_occupancy: 0 },
  review_summary: { average_rating: 4.83, total_count: 3 },
  time_zone_id: "Asia/Seoul",
  type: "ENTIRE_PLACE",
};

const detailAvailability = {
  booking_window_end_exclusive: "2027-01-01",
  booking_window_start_inclusive: "2026-01-01",
  unavailable_ranges: [],
};

const reviews = {
  page_info: { ...pageInfo, current_size: 3 },
  reviews: [
    {
      content: "햇살이 오래 머물고 동네 산책을 시작하기 좋은 집이었습니다.",
      id: 901,
      images: [{ id: 9101, image_url: imageUrls.review }],
      rating: 5,
      reviewed_at: "2026-06-28T01:00:00Z",
      reviewer: {
        id: 401,
        nickname: "합성 여행자 하나",
        thumbnail_image_url: null,
      },
    },
    {
      content: "체크인이 편안했고 필요한 안내가 차분하게 정리되어 있었어요.",
      id: 902,
      images: [],
      rating: 5,
      reviewed_at: "2026-06-18T01:00:00Z",
      reviewer: {
        id: 402,
        nickname: "합성 여행자 둘",
        thumbnail_image_url: null,
      },
    },
    {
      content: "조용한 밤과 가까운 시장이 특히 기억에 남았습니다.",
      id: 903,
      images: [],
      rating: 4,
      reviewed_at: "2026-05-30T01:00:00Z",
      reviewer: {
        id: 403,
        nickname: "합성 여행자 셋",
        thumbnail_image_url: null,
      },
    },
  ],
};

const reviewableReservation = {
  accommodation: {
    id: 7,
    name: "합정 여행 기록 스테이",
    thumbnail_url: imageUrls.reviewStay,
  },
  address: {
    city: "서울",
    country: "대한민국",
    detail: "2층",
    district: "마포구",
    state: "서울특별시",
    street: "양화로",
  },
  can_write_review: true,
  check_in_date_time: "2026-06-10T15:00:00+09:00",
  check_out_date_time: "2026-06-12T11:00:00+09:00",
  reservation_uid: REVIEW_RESERVATION_UID,
};

const editableAccommodation = {
  address: {
    city: "서울",
    country: "대한민국",
    detail: "101호",
    district: "마포구",
    postal_code: "04000",
    state: "서울특별시",
    street: "월드컵북로",
  },
  amenities: [
    { count: 1, type: "WIFI" },
    { count: 1, type: "HEATING" },
  ],
  base_price: 125_000,
  check_in_time: "15:00",
  check_out_time: "11:00",
  coordinate: { latitude: 37.556, longitude: 126.923 },
  currency: "KRW",
  description: "호스트 스튜디오의 시각 기준을 고정하는 합성 설명입니다.",
  host: {
    id: 202,
    nickname: "합성 호스트",
    thumbnail_image_url: null,
  },
  id: 31,
  images: [{ id: 301, image_url: imageUrls.editor }],
  name: "합정 호스트 스튜디오",
  policy: { infant_occupancy: 1, max_occupancy: 4, pet_occupancy: 0 },
  review_summary: { average_rating: 0, total_count: 0 },
  type: "APARTMENT",
};

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  viewport: DESKTOP_VIEWPORT,
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
});

test("keeps the wishlist library and saved stay detail stable through 320px", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installSyntheticImages(page, [
    imageUrls.wishlistCollection,
    imageUrls.wishlistStay,
  ]);
  api.register(
    "GET",
    "/api/v1/members/wishlists",
    apiSuccess(wishlistCollection),
  );
  api.register(
    "GET",
    "/api/v1/members/recently-viewed",
    apiSuccess(recentlyViewedCollection),
  );
  api.register(
    "GET",
    `/api/v1/members/wishlists/accommodations/${WISHLIST_ID}`,
    apiSuccess(wishlistDetail),
  );

  await page.goto("/wishlist");
  await expectHeaderReady(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "위시리스트" }),
  ).toBeVisible();
  const openCollection = page.getByRole("button", {
    name: /가을 서울 산책 위시리스트 열기/,
  });
  await expect(openCollection).toBeVisible();
  await captureAtTop(page, "phase-three-wishlist-library-desktop.png");

  await page.setViewportSize(MOBILE_VIEWPORT);
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await expect(
    page.getByRole("button", { name: "검색을 시작해 보세요" }),
  ).toBeVisible();
  await captureAtTop(page, "phase-three-wishlist-library-mobile.png");

  await openCollection.click();
  await expect(page).toHaveURL(`/wishlist?id=${WISHLIST_ID}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "가을 서울 산책" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "서촌의 고요한 집 숙소 상세 보기" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await captureAtTop(page, "phase-three-wishlist-detail-mobile.png");

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await captureAtTop(page, "phase-three-wishlist-detail-desktop.png");
});

test("keeps guest trips and host reservation management stable through 320px", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installSyntheticImages(page, [imageUrls.guestTrip, imageUrls.hostStay]);
  api.register(
    "GET",
    "/api/v1/profile/guest/reservations",
    apiSuccess(guestReservations),
  );
  api.register(
    "GET",
    "/api/v1/profile/host/reservations",
    apiSuccess(hostReservations),
  );
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations",
    apiSuccess(hostListings),
  );

  await page.goto("/profile?mode=guest&tab=upcoming");
  await expectHeaderReady(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "프로필" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "다가올 여행" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "서촌의 고요한 집 예약 상세 보기" }),
  ).toBeVisible();
  await captureAtTop(page, "phase-three-profile-guest-trips-desktop.png");

  await page.setViewportSize(MOBILE_VIEWPORT);
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await expect(
    page.getByRole("button", { name: "검색을 시작해 보세요" }),
  ).toBeVisible();
  await captureAtTop(page, "phase-three-profile-guest-trips-mobile.png");

  await page.goto("/profile?mode=host&tab=reservations-upcoming");
  await expect(
    page.getByRole("heading", { level: 2, name: "예약 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "합성 게스트 예약 상세" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await captureAtTop(page, "phase-three-profile-host-reservations-mobile.png");

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await captureAtTop(page, "phase-three-profile-host-reservations-desktop.png");

  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/profile?mode=host&tab=listings-published");
  await expect(
    page.getByRole("heading", { level: 2, name: "숙소 관리" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "망원 햇살 스테이 숙소 관리 열기" })
    .click();
  const actionDialog = page.getByRole("dialog", { name: "숙소 관리" });
  await expect(actionDialog).toBeVisible();
  await expect(
    actionDialog.getByRole("button", { name: "숙소 관리 닫기" }),
  ).toBeFocused();
  await expect(
    actionDialog.getByRole("group", { name: "숙소 관리 작업" }),
  ).toContainText("리스팅 수정");
  await expect(
    actionDialog.getByRole("button", { name: "리스팅 비공개" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await capture(page, "phase-three-host-listing-action-mobile.png");
});

test("keeps the host reservation ledger stable through 320px", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installSyntheticImages(page, [imageUrls.hostStay]);
  api.register(
    "GET",
    `/api/v1/profile/host/reservations/${HOST_RESERVATION_UID}`,
    apiSuccess(hostReservationDetail),
  );

  await page.goto(`/profile/host/reservations/${HOST_RESERVATION_UID}`);
  await expectHeaderReady(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "합성 게스트님의 예약" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "체크인 정보" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "망원 햇살 스테이 숙소로 이동하기" }),
  ).toBeVisible();
  await captureAtTop(page, "phase-three-host-reservation-detail-desktop.png");

  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 1200 });
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await captureAtTop(page, "phase-three-host-reservation-detail-mobile.png");
});

test("keeps review previews and the review modal interaction stable", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await installSyntheticImages(page, [...detailImageUrls, imageUrls.review]);
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
  api.register("GET", "/api/v1/accommodations/7/reviews", apiSuccess(reviews));

  await page.goto("/accommodations/7");
  await expectHeaderReady(page);
  const reviewHeading = page.getByRole("heading", {
    level: 2,
    name: "평점 4.83 · 후기 3개",
  });
  await reviewHeading.scrollIntoViewIfNeeded();
  await expect(reviewHeading).toBeVisible();
  const openReviews = page.getByRole("button", {
    name: "후기 3개 모두 보기",
  });
  await expect(openReviews).toBeVisible();
  const reviewSection = page.locator(
    'section[aria-labelledby="accommodation-reviews-title"]',
  );
  await captureLocator(reviewSection, "phase-three-review-preview-desktop.png");

  await openReviews.click();
  const dialog = page.getByRole("dialog", { name: "후기 3개" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "후기 모달 닫기" }),
  ).toBeFocused();
  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 900 });
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await capture(page, "phase-three-review-modal-mobile.png");
});

test("keeps the review creation form stable through 320px", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installSyntheticImages(page, [imageUrls.reviewStay]);
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${REVIEW_RESERVATION_UID}`,
    apiSuccess(reviewableReservation),
  );

  await page.goto(`/reservations/${REVIEW_RESERVATION_UID}/review`);
  await expectHeaderReady(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "숙박 경험 남기기" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "5점" })).toBeChecked();
  await expect(page.getByLabel("리뷰 내용")).toBeVisible();
  await expect(page.getByLabel("사진 선택")).toBeAttached();
  await expect(
    page.getByRole("button", { name: "리뷰 작성하기" }),
  ).toBeDisabled();
  await captureAtTop(page, "phase-three-review-create-desktop.png");

  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 1200 });
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await captureAtTop(page, "phase-three-review-create-mobile.png");
});

test("keeps the host editor information step stable through 320px", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installSyntheticImages(page, [imageUrls.editor]);
  api.register(
    "GET",
    "/api/v1/profile/host/accommodations/31",
    apiSuccess(editableAccommodation),
  );

  await page.goto("/accommodations/31/edit");
  await expectHeaderReady(page);
  await page.getByRole("button").filter({ hasText: "숙소 정보" }).click();
  await expect(
    page.getByRole("heading", { name: "숙소 정보를 알려주세요" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("예: 편안한 아파트")).toHaveValue(
    "합정 호스트 스튜디오",
  );
  await expect(
    page.getByRole("button", { name: "저장 후 나가기" }),
  ).toBeVisible();
  await captureAtTop(page, "phase-three-editor-info-desktop.png");

  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 900 });
  await expectNoHorizontalOverflow(page, MOBILE_VIEWPORT.width);
  await captureAtTop(page, "phase-three-editor-info-mobile.png");
});

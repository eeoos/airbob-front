import type { Locator } from "@playwright/test";
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const syntheticAccommodation = {
  id: 81,
  name: "접근성 테스트 숙소",
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

const searchResponse = {
  stay_search_result_listing: [syntheticAccommodation],
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

const searchURL = "/search?destination=Seoul&adultOccupancy=2";

const expectFocusInside = async (container: Locator) => {
  await expect
    .poll(() =>
      container.evaluate((element) =>
        element.contains(element.ownerDocument.activeElement),
      ),
    )
    .toBe(true);
};

const expectMinimumTouchTarget = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
};

const expectVisibleFocusIndicator = async (locator: Locator) => {
  await locator.focus();
  await expect(locator).toBeFocused();

  const hasVisibleIndicator = await locator.evaluate((element) => {
    const styles = getComputedStyle(element);
    const hasOutline =
      styles.outlineStyle !== "none" &&
      Number.parseFloat(styles.outlineWidth) > 0;
    const hasBoxShadow = styles.boxShadow !== "none";

    return hasOutline || hasBoxShadow;
  });

  expect(hasVisibleIndicator).toBe(true);
};

test("keeps stacked dialogs modal, focus-contained, and Escape ordered", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(searchResponse),
  );
  api.register(
    "GET",
    "/api/v1/members/wishlists",
    apiSuccess({
      wishlists: [
        {
          id: 7,
          name: "합성 여행",
          created_at: "2026-07-01T00:00:00Z",
          wishlist_item_count: 0,
          thumbnail_image_url: null,
          is_contained: false,
          wishlist_accommodation_id: null,
        },
      ],
      page_info: {
        has_next: false,
        next_cursor: null,
        current_size: 1,
      },
    }),
  );

  await page.goto(searchURL);

  const saveButton = page.getByRole("button", {
    name: "위시리스트에 저장",
  });
  await saveButton.click();

  const root = page.locator("#root");
  const wishlistDialog = page
    .locator('#airbob-portal-root [role="dialog"]')
    .filter({
      has: page.locator("h2", {
        hasText: "위시리스트에 저장하기",
      }),
    });

  await expect(wishlistDialog).toBeVisible();
  await expectFocusInside(wishlistDialog);
  await expect(root).toHaveAttribute("aria-hidden", "true");
  await expect(root).toHaveAttribute("inert", "");

  const createTrigger = wishlistDialog.getByRole("button", {
    name: "새로운 위시리스트 만들기",
  });
  await createTrigger.click();

  const createDialog = page.getByRole("dialog", {
    name: "위시리스트 만들기",
  });
  const nameInput = createDialog.getByLabel("이름");
  const createCloseButton = createDialog.getByRole("button", {
    name: "닫기",
    exact: true,
  });
  const cancelButton = createDialog.getByRole("button", { name: "취소" });

  await expect(createDialog).toBeVisible();
  await expect(nameInput).toBeFocused();
  await expect(page.locator('#airbob-portal-root [role="dialog"]')).toHaveCount(
    2,
  );
  await expect(wishlistDialog.locator("xpath=..")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(wishlistDialog.locator("xpath=..")).toHaveAttribute("inert", "");

  await page.keyboard.press("Shift+Tab");
  await expect(createCloseButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(createCloseButton).toBeFocused();
  await expectFocusInside(createDialog);

  await page.keyboard.press("Escape");

  await expect(createDialog).toBeHidden();
  await expect(wishlistDialog).toBeVisible();
  await expect(wishlistDialog.locator("xpath=..")).not.toHaveAttribute(
    "inert",
    "",
  );
  await expect(createTrigger).toBeFocused();
  await expect(root).toHaveAttribute("inert", "");

  await page.keyboard.press("Escape");

  await expect(wishlistDialog).toBeHidden();
  await expect(saveButton).toBeFocused();
  await expect(root).not.toHaveAttribute("aria-hidden", "true");
  await expect(root).not.toHaveAttribute("inert", "");
});

test("moves and selects dates through the calendar grid, then restores trigger focus", async ({
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

  await page.goto(searchURL);

  const search = page.getByRole("search", { name: "숙소 검색" });
  const dateTrigger = search.locator(
    'button[aria-controls="search-date-picker"]',
  );
  await dateTrigger.click();

  const datePicker = page.locator("#search-date-picker");
  await expect(datePicker).toBeVisible();
  await expect(
    datePicker.getByRole("grid", { name: "2026년 7월" }),
  ).toBeVisible();
  await expect(
    datePicker.getByRole("grid", { name: "2026년 8월" }),
  ).toBeVisible();

  const rovingTabStop = () =>
    datePicker.locator('[role="gridcell"][tabindex="0"]');
  await expect(rovingTabStop()).toHaveCount(1);
  await expect(rovingTabStop()).toHaveAccessibleName("2026년 7월 1일 수요일");
  await expect(rovingTabStop()).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(rovingTabStop()).toHaveAccessibleName("2026년 7월 2일 목요일");
  await expect(rovingTabStop()).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(
    datePicker.getByRole("gridcell", {
      name: "2026년 7월 2일 목요일",
    }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(rovingTabStop()).toHaveAccessibleName("2026년 7월 3일 금요일");

  await page.keyboard.press("ArrowRight");
  await expect(rovingTabStop()).toHaveAccessibleName("2026년 7월 4일 토요일");
  await page.keyboard.press("Space");

  await expect(
    datePicker.locator('[role="gridcell"][aria-selected="true"]'),
  ).toHaveCount(2);
  await expect(datePicker.getByRole("status")).toHaveText(
    "2026년 7월 2일 목요일부터 2026년 7월 4일 토요일까지 선택됨",
  );

  await page.keyboard.press("Escape");

  await expect(datePicker).toBeHidden();
  await expect(dateTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(dateTrigger).toBeFocused();
});

test("keeps mobile calendar date targets at least 44 by 44 pixels", async ({
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
  await page.setViewportSize({ width: 390, height: 720 });

  await page.goto(searchURL);
  const search = page.getByRole("search", { name: "숙소 검색" });
  const summaryButton = search.getByRole("button", {
    name: /Seoul.*검색 조건 수정/,
  });
  const mobileHeaderTargets = [
    search.getByRole("button", { name: "이전 화면으로" }),
    summaryButton,
    search.getByRole("button", {
      name: "검색 조건 수정",
      exact: true,
    }),
  ];

  for (const target of mobileHeaderTargets) {
    await expectMinimumTouchTarget(target);
  }

  await summaryButton.click();
  const dialog = page.getByRole("dialog", { name: "숙소 검색" });
  await dialog.locator('button[aria-controls="search-date-picker"]').click();

  const enabledDate = page
    .locator('#search-date-picker [role="gridcell"]:not([disabled])')
    .first();
  const primaryTargets = [
    dialog.getByRole("button", { name: "검색 닫기" }),
    dialog.getByRole("button", { name: "다음", exact: true }),
    enabledDate,
  ];

  expect(primaryTargets).toHaveLength(3);
  for (const target of primaryTargets) {
    await expectMinimumTouchTarget(target);
  }
});

test("moves through the mobile destination, date, and guest steps without squeezing autocomplete", async ({
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
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(searchURL);
  const search = page.getByRole("search", { name: "숙소 검색" });
  await search.getByRole("button", { name: /Seoul.*검색 조건 수정/ }).click();

  const dialog = page.getByRole("dialog", { name: "숙소 검색" });
  await dialog.getByRole("button", { name: /여행지 검색 열기/ }).click();

  const destinationInput = dialog.getByRole("combobox", { name: "여행지" });
  await expect(destinationInput).toBeFocused();
  await dialog.getByRole("button", { name: "여행지 입력 지우기" }).click();

  const recommendations = dialog.getByRole("list", {
    name: "추천 여행지",
  });
  await expect(recommendations).toBeVisible();
  const busanRecommendation = recommendations.getByRole("button", {
    name: /부산.*바다와 도심/,
  });
  const recommendationBounds = await busanRecommendation.boundingBox();
  expect(recommendationBounds).not.toBeNull();
  expect(recommendationBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(
    (recommendationBounds?.x ?? 0) + (recommendationBounds?.width ?? 0),
  ).toBeLessThanOrEqual(390);
  await busanRecommendation.click();

  const datePicker = dialog.getByRole("dialog", { name: "검색 날짜 선택" });
  await expect(datePicker).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "다음", exact: true }),
  ).toBeVisible();

  const enabledDates = datePicker.locator(
    'button[role="gridcell"]:not([disabled])',
  );
  await enabledDates.nth(0).click();
  await enabledDates.nth(2).click();
  await dialog.getByRole("button", { name: "다음", exact: true }).click();

  await expect(
    dialog.getByRole("dialog", { name: "검색 인원 선택" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "검색", exact: true }),
  ).toBeVisible();
});

test("keeps phase-one controls visibly focused and keyboard-operable", async ({
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

  await page.goto(searchURL);

  const search = page.getByRole("search", { name: "숙소 검색" });
  const destinationTrigger = search.getByRole("button", { name: "Seoul" });
  await destinationTrigger.focus();
  await page.keyboard.press("Enter");

  const destinationInput = search.getByRole("combobox", { name: "여행지" });
  await expect(destinationInput).toBeFocused();
  await expect(destinationInput).toHaveAttribute("aria-autocomplete", "list");
  await expect(destinationInput).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Escape");
  await expect(destinationInput).toBeFocused();

  const focusTargets = [
    page.getByRole("link", { name: "Airbob 홈으로 이동" }),
    search.getByRole("button", { name: "검색" }),
    page.getByRole("link", {
      name: "숙소 상세 보기: 접근성 테스트 숙소",
    }),
    page.getByRole("button", { name: "위시리스트에 저장" }),
    page.getByRole("button", { name: "사용자 메뉴" }),
  ];

  for (const target of focusTargets) {
    await expectVisibleFocusIndicator(target);
  }

  const menuButton = page.getByRole("button", { name: "사용자 메뉴" });
  await menuButton.focus();
  await page.keyboard.press("Enter");

  const loginItem = page.getByRole("menuitem", { name: "로그인" });
  const signupItem = page.getByRole("menuitem", { name: "회원가입" });
  await expect(loginItem).toBeFocused();
  await page.keyboard.press("End");
  await expect(signupItem).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "사용자 메뉴" })).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test("honors reduced motion while keyboard controls move the mobile results sheet", async ({
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
  await page.setViewportSize({ width: 390, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto(searchURL);

  const handle = page.getByRole("button", {
    name: /검색 결과 패널 조절/,
  });
  const sheet = handle.locator("xpath=ancestor::section[1]");

  await expect(handle).toHaveAttribute("data-state", "collapsed");
  await handle.focus();
  await expect(handle).toBeFocused();
  expect(
    await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  const collapsedTransform = await sheet.evaluate(
    (element) => getComputedStyle(element).transform,
  );

  await page.keyboard.press("ArrowUp");
  await expect(handle).toHaveAttribute("data-state", "half");
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  const resultCard = page.getByTestId("search-result-card");
  await resultCard.hover();
  const cardMotion = await resultCard.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      transform: styles.transform,
      transitionDuration: styles.transitionDuration,
    };
  });
  expect(cardMotion.transform).toBe("none");
  expect(cardMotion.transitionDuration).toBe("0s");
  const halfTransform = await sheet.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(halfTransform).not.toBe(collapsedTransform);

  await page.keyboard.press("ArrowUp");
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  const expandedTransform = await sheet.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(expandedTransform).not.toBe(halfTransform);

  await page.keyboard.press("ArrowDown");
  await expect(handle).toHaveAttribute("data-state", "half");
  await page.keyboard.press("Home");
  await expect(handle).toHaveAttribute("data-state", "collapsed");
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("group", { name: "검색 결과 목록" }),
  ).toBeHidden();

  await page.keyboard.press("End");
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await expect(
    page.getByRole("group", { name: "검색 결과 목록" }),
  ).toBeVisible();
  await expect(handle).toBeFocused();

  const motion = await sheet.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animationDuration: styles.animationDuration,
      transitionDuration: styles.transitionDuration,
      willChange: styles.willChange,
    };
  });
  expect(motion.animationDuration).toBe("0s");
  expect(motion.transitionDuration).toBe("0s");
  expect(motion.willChange).toBe("auto");
});

test("anchors the first pointer drag to the collapsed sheet and suppresses its click", async ({
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(searchURL);

  const handle = page.getByRole("button", {
    name: /검색 결과 패널 조절/,
  });
  const sheet = handle.locator("xpath=ancestor::section[1]");
  const handleBounds = await handle.boundingBox();
  const initialSheetBounds = await sheet.boundingBox();

  expect(handleBounds).not.toBeNull();
  expect(initialSheetBounds).not.toBeNull();

  const pointerX = (handleBounds?.x ?? 0) + (handleBounds?.width ?? 0) / 2;
  const pointerY = (handleBounds?.y ?? 0) + (handleBounds?.height ?? 0) / 2;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX, pointerY - 24, { steps: 4 });

  const draggedSheetBounds = await sheet.boundingBox();
  expect(draggedSheetBounds).not.toBeNull();
  expect(draggedSheetBounds?.y ?? 0).toBeLessThan(
    (initialSheetBounds?.y ?? 0) - 10,
  );
  expect(draggedSheetBounds?.y ?? 0).toBeGreaterThan(
    (initialSheetBounds?.y ?? 0) - 40,
  );

  await page.mouse.up();
  await expect(handle).toHaveAttribute("data-state", "collapsed");
  await expect(handle).toHaveAttribute("aria-expanded", "false");
});

test("keeps sheet content continuous and resumes a snap after an interrupted drag", async ({
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(searchURL);

  const handle = page.getByRole("button", {
    name: /검색 결과 패널 조절/,
  });
  const sheet = handle.locator("xpath=ancestor::section[1]");
  const title = sheet.getByRole("heading", { name: "숙소 1개" });
  const content = page.getByRole("group", {
    name: "검색 결과 목록",
    includeHidden: true,
  });

  await handle.click();
  await expect(handle).toHaveAttribute("data-state", "half");

  const titleBounds = await title.boundingBox();
  expect(titleBounds).not.toBeNull();
  const pointerX = (titleBounds?.x ?? 0) + (titleBounds?.width ?? 0) / 2;
  const pointerY = (titleBounds?.y ?? 0) + (titleBounds?.height ?? 0) / 2;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX, pointerY - 24, { steps: 4 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const geometry = await sheet.evaluate((element) => {
        const rootStyles = getComputedStyle(document.documentElement);
        const surfaceTop =
          Number.parseFloat(
            rootStyles.getPropertyValue("--layout-search-header-mobile-height"),
          ) +
          Number.parseFloat(
            rootStyles.getPropertyValue(
              "--layout-search-header-divider-height",
            ),
          );
        const surfaceHeight = window.innerHeight - surfaceTop;
        const visibleHeight =
          window.innerHeight - element.getBoundingClientRect().top;

        return Math.abs(visibleHeight - surfaceHeight * 0.5);
      });

      return geometry;
    })
    .toBeLessThanOrEqual(3);

  await handle.click();
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await expect
    .poll(
      async () => (await sheet.boundingBox())?.y ?? Number.POSITIVE_INFINITY,
    )
    .toBeLessThanOrEqual(82);

  await handle.click();
  await expect(handle).toHaveAttribute("data-state", "collapsed");
  expect(await content.getAttribute("hidden")).toBeNull();
  await expect(content).toBeHidden();
});

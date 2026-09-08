import type { CDPSession, Page } from "@playwright/test";
import { apiSuccess } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

test.use({
  viewport: { width: 425, height: 1024 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(({ api, session }) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess({
      stay_search_result_listing: Array.from({ length: 6 }, (_, index) => ({
        id: index + 81,
        name: `드래그 테스트 숙소 ${index + 1}`,
        accommodation_thumbnail_url: null,
        base_price: 120000,
        currency: "KRW",
        type: "HOUSE",
        address_summary: {
          country: "대한민국",
          state: null,
          city: "부산",
          district: "중구",
        },
        coordinate: { latitude: 35.17, longitude: 129.07 },
        review_summary: { total_count: 0, average_rating: 0 },
        is_in_wishlist: false,
      })),
      page_info: {
        page_size: 18,
        current_page: 0,
        total_pages: 1,
        total_elements: 6,
        is_first: true,
        is_last: true,
        has_next: false,
        has_previous: false,
      },
    }),
  );
});

const touchDrag = async (client: CDPSession, fromY: number, toY: number) => {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: fromY }],
  });
  for (let step = 1; step <= 10; step++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 200, y: fromY + ((toY - fromY) * step) / 10 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
};

const readGeometry = (page: Page) =>
  page.getByRole("region", { name: "숙소 목록 스크롤" }).evaluate((content) => {
    const sheet = content.closest("section");
    const card = content.querySelector('[data-testid="search-result-card"]');
    const root = getComputedStyle(document.documentElement);
    const headerBottom =
      Number.parseFloat(
        root.getPropertyValue("--layout-search-header-mobile-height"),
      ) +
      Number.parseFloat(
        root.getPropertyValue("--layout-search-header-divider-height"),
      );
    return {
      headerBottom,
      sheetTop: sheet?.getBoundingClientRect().top ?? 0,
      cardTop: card?.getBoundingClientRect().top ?? 0,
      scrollTop: content.scrollTop,
      viewportHeight: innerHeight,
      countBottom:
        content.querySelector("h2")?.getBoundingClientRect().bottom ?? 0,
    };
  });

test("hands touch gestures between the sheet and native list scrolling", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search?destination=Busan");
  const handle = page.getByRole("button", { name: /검색 결과 패널 조절/ });
  await expect(handle).toHaveAttribute("data-state", "half");
  const initial = await readGeometry(page);
  expect(
    Math.abs(
      initial.sheetTop -
        initial.headerBottom -
        (initial.viewportHeight - initial.headerBottom) * 0.3,
    ),
  ).toBeLessThan(2);

  const client = await context.newCDPSession(page);
  await touchDrag(client, initial.cardTop + 120, initial.cardTop - 120);
  await expect(handle).toHaveAttribute("data-state", "expanded");
  const expanded = await readGeometry(page);
  expect(expanded.scrollTop).toBe(0);
  expect(expanded.countBottom).toBeGreaterThan(expanded.headerBottom);
  expect(expanded.cardTop).toBeGreaterThan(expanded.countBottom);
  await expect(page).toHaveURL(/\/search\?destination=Busan$/);

  await touchDrag(client, 500, 250);
  await expect
    .poll(async () => (await readGeometry(page)).scrollTop)
    .toBeGreaterThan(0);
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await expect
    .poll(async () => {
      const geometry = await readGeometry(page);
      return geometry.countBottom - geometry.headerBottom;
    })
    .toBeLessThan(0);
  await page.getByRole("button", { name: "지도 보기" }).click();
  await expect(handle).toHaveAttribute("data-state", "collapsed");
  await expect(
    page.getByRole("group", { name: "검색 결과 목록" }),
  ).toBeHidden();
  await expect(page.getByTestId("search-mobile-map-layer")).not.toHaveAttribute(
    "inert",
  );
  expect((await readGeometry(page)).scrollTop).toBe(0);

  await handle.click();
  await expect(handle).toHaveAttribute("data-state", "half");
  await touchDrag(client, initial.cardTop + 120, initial.cardTop - 120);
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await touchDrag(client, 200, 420);
  await expect(handle).toHaveAttribute("data-state", "half");
  expect((await readGeometry(page)).scrollTop).toBe(0);
  await expect(page.getByRole("heading", { name: "숙소 6개" })).toBeVisible();
  await client.detach();
});

test("supports mouse drags and wheel transitions without opening the dragged card", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search?destination=Busan");
  const handle = page.getByRole("button", { name: /검색 결과 패널 조절/ });
  await expect(handle).toHaveAttribute("data-state", "half");
  const initial = await readGeometry(page);
  await page.mouse.move(200, initial.cardTop + 120);
  await page.mouse.down();
  await page.mouse.move(200, initial.cardTop - 120, { steps: 12 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await expect(page).toHaveURL(/\/search\?destination=Busan$/);
  await page.mouse.move(200, 240);
  await page.mouse.wheel(0, -120);
  await expect(handle).toHaveAttribute("data-state", "half");
  await page.clock.runFor(200);
  await page.mouse.move(200, initial.cardTop + 80);
  await page.mouse.wheel(0, 120);
  await expect(handle).toHaveAttribute("data-state", "expanded");
  await page.mouse.wheel(0, 80);
  expect((await readGeometry(page)).scrollTop).toBe(0);
});

test("scrolls the count away during one continuous swipe beyond the expanded snap", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search?destination=Busan");
  const handle = page.getByRole("button", { name: /검색 결과 패널 조절/ });
  await expect(handle).toHaveAttribute("data-state", "half");
  const initial = await readGeometry(page);
  const client = await context.newCDPSession(page);
  await touchDrag(client, initial.cardTop + 120, 100);
  await expect(handle).toHaveAttribute("data-state", "expanded");
  const expanded = await readGeometry(page);
  expect(expanded.scrollTop).toBeGreaterThan(72);
  expect(expanded.countBottom).toBeLessThan(expanded.headerBottom);
  await expect(page).toHaveURL(/\/search\?destination=Busan$/);
  await client.detach();
});

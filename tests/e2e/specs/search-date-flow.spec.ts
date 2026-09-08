import { apiSuccess } from "../fixtures/api";
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

test.beforeEach(({ api, session }) => {
  session.clear();
  api.register(
    "GET",
    "/api/v1/search/accommodations",
    apiSuccess(emptySearchResponse),
  );
});

test("opens a unified date range on destination Enter without autocomplete", async ({
  page,
}) => {
  await page.goto("/search?destination=Seoul");
  const search = page.getByRole("search", { name: "숙소 검색" });
  await search.getByRole("button", { name: "Seoul", exact: true }).click();
  const input = search.getByRole("combobox", { name: "여행지" });
  await input.fill("부산");

  await expect(input).toHaveCSS("box-shadow", "none");
  await expect(input).toHaveCSS("outline-style", "none");
  await input.press("Enter");

  const datePicker = page.getByRole("dialog", { name: "검색 날짜 선택" });
  const dateTrigger = search.getByRole("button", { name: /체크인.*체크아웃/ });
  await expect(datePicker).toBeVisible();
  await expect(
    datePicker.locator('[role="gridcell"][tabindex="0"]'),
  ).toBeFocused();
  await expect(dateTrigger).toHaveText(/날짜\s*날짜 추가/);
  await datePicker
    .getByRole("gridcell", { name: "2026년 7월 10일 금요일" })
    .click();
  await expect(dateTrigger).toHaveText(/날짜\s*7월 10일 - 날짜 추가/);
  await datePicker
    .getByRole("gridcell", { name: "2026년 7월 12일 일요일" })
    .click();
  await expect(dateTrigger).toHaveText(/날짜\s*7월 10일 - 7월 12일/);
  await expect(
    datePicker.getByRole("heading", { name: "2026년 7월" }),
  ).toHaveCount(1);
  await datePicker.getByRole("button", { name: "날짜 지우기" }).click();
  await expect(dateTrigger).toHaveText(/날짜\s*날짜 추가/);
  await page.keyboard.press("Escape");
  await expect(datePicker).toBeHidden();
  await expect(dateTrigger).toBeFocused();
  await expect(page).toHaveURL(/destination=Seoul$/);
});

for (const activation of ["click", "Enter"] as const) {
  test(`keeps dates open after destination ${activation} while place details resolve`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "google", {
        value: {
          maps: {
            Map: class {},
            places: {
              AutocompleteSessionToken: class {},
              AutocompleteSuggestion: {
                fetchAutocompleteSuggestions: async () => ({
                  suggestions: [
                    {
                      placePrediction: {
                        placeId: "synthetic-busan",
                        mainText: { text: "부산" },
                        secondaryText: { text: "대한민국" },
                        text: { text: "대한민국 부산" },
                        toPlace: () => ({
                          fetchFields: () =>
                            new Promise<void>((resolve) => {
                              window.addEventListener(
                                "airbob-test-resolve-place",
                                () => resolve(),
                                { once: true },
                              );
                            }),
                          location: { lat: () => 35.18, lng: () => 129.08 },
                          viewport: {
                            getNorthEast: () => ({
                              lat: () => 35.4,
                              lng: () => 129.3,
                            }),
                            getSouthWest: () => ({
                              lat: () => 35,
                              lng: () => 128.8,
                            }),
                          },
                        }),
                      },
                    },
                  ],
                }),
              },
            },
          },
        },
      });
    });

    await page.goto("/search?destination=Seoul");
    const search = page.getByRole("search", { name: "숙소 검색" });
    await search.getByRole("button", { name: "Seoul", exact: true }).click();
    const input = search.getByRole("combobox", { name: "여행지" });
    await input.fill("부산");
    const suggestion = page.getByRole("button", { name: "부산 대한민국" });
    await expect(suggestion).toBeVisible();
    const confirmDestination = {
      click: () => suggestion.click(),
      Enter: () => input.press("Enter"),
    };
    await confirmDestination[activation]();

    const datePicker = page.getByRole("dialog", { name: "검색 날짜 선택" });
    await expect(datePicker).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "검색 지역 추천" }),
    ).toBeHidden();
    await expect(input).toHaveAttribute("aria-busy", "true");
    await datePicker
      .getByRole("gridcell", { name: "2026년 7월 10일 금요일" })
      .click();
    await datePicker
      .getByRole("gridcell", { name: "2026년 7월 12일 일요일" })
      .click();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("airbob-test-resolve-place")),
    );
    await expect(input).toHaveAttribute("aria-busy", "false");
    await expect(datePicker).toBeVisible();
    await search.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page).toHaveURL(
      /destination=.*checkIn=2026-07-10.*checkOut=2026-07-12/,
    );
    expect(new URL(page.url()).searchParams.get("lat")).toBe("35.18");
    expect(new URL(page.url()).searchParams.get("destination")).toBe(
      "대한민국 부산",
    );
  });
}

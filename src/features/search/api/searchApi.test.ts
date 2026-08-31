import type { SearchResultPageWire } from "./contracts";
import { createSearchApi, type SearchApiTransport } from "./searchApi";

const emptyWirePage: SearchResultPageWire = {
  stay_search_result_listing: [],
  page_info: {
    page_size: 18,
    current_page: 2,
    total_pages: 3,
    total_elements: 0,
    is_first: false,
    is_last: true,
    has_next: false,
    has_previous: true,
  },
};

describe("search API adapter", () => {
  it("preserves method, path, query keys, signal and omits a request body", async () => {
    const transport = vi.fn().mockResolvedValue(emptyWirePage);
    const api = createSearchApi(transport as SearchApiTransport);
    const signal = new AbortController().signal;

    await expect(
      api.search(
        {
          destination: "Seoul",
          checkIn: "2026-09-10",
          checkOut: "2026-09-12",
          adultOccupancy: 2,
          childOccupancy: 0,
          infantOccupancy: 0,
          petOccupancy: 1,
          page: 2,
          size: 18,
        },
        { signal },
      ),
    ).resolves.toEqual({
      accommodations: [],
      pageInfo: {
        pageSize: 18,
        currentPage: 2,
        totalPages: 3,
        totalElements: 0,
        isFirst: false,
        isLast: true,
        hasNext: false,
        hasPrevious: true,
      },
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: "/search/accommodations",
      params: {
        destination: "Seoul",
        checkIn: "2026-09-10",
        checkOut: "2026-09-12",
        adultOccupancy: 2,
        childOccupancy: 0,
        infantOccupancy: 0,
        petOccupancy: 1,
        page: 2,
        size: 18,
      },
      signal,
    });
    expect(transport.mock.calls[0][0]).not.toHaveProperty("body");
  });
});

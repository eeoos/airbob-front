import { requestApiData } from "../../../platform/http/request";
import { requireDefined } from "../../../test/assertions";
import type { SearchResultPageWire } from "./contracts";
import { searchApi } from "./searchApi";

vi.mock("../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);

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
  beforeEach(() => {
    mockRequestApiData.mockReset();
  });

  it("preserves method, path, query keys, signal and omits a request body", async () => {
    mockRequestApiData.mockResolvedValue(emptyWirePage);
    const signal = new AbortController().signal;

    await expect(
      searchApi.search(
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

    expect(mockRequestApiData).toHaveBeenCalledTimes(1);
    expect(mockRequestApiData).toHaveBeenCalledWith({
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
    const firstCall = requireDefined(
      mockRequestApiData.mock.calls[0],
      "transport call",
    );
    expect(
      requireDefined(firstCall[0], "transport request"),
    ).not.toHaveProperty("body");
  });
});

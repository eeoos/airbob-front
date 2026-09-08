import {
  requestApiData,
  requestApiDataNullable,
} from "../../../platform/http/request";
import { recentlyViewedApi } from "./recentlyViewedApi";
import mixedHistoryContract from "./__fixtures__/recently-viewed-mixed-history.json";

vi.mock("../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
  requestApiDataNullable: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);
const mockRequestApiDataNullable = vi.mocked(requestApiDataNullable);

describe("recently viewed API adapter", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
    mockRequestApiDataNullable.mockReset();
  });

  it("preserves backend history order, timestamps, nullable summaries, and member-specific saves", async () => {
    mockRequestApiData.mockResolvedValue(mixedHistoryContract);

    const result = await recentlyViewedApi.getRecentlyViewed();

    expect(result.totalCount).toBe(3);
    expect(result.accommodations).toEqual([
      {
        viewedAt: "2026-09-07T00:00:00Z",
        accommodationId: 33,
        accommodationName: "서울 하우스 33",
        thumbnailUrl: "/stay.jpg",
        addressSummary: {
          country: null,
          state: null,
          city: null,
          district: null,
        },
        reviewSummary: null,
        isInWishlist: false,
      },
      {
        viewedAt: "2026-09-06T00:00:00Z",
        accommodationId: 32,
        accommodationName: "서울 하우스 32",
        thumbnailUrl: "/stay.jpg",
        addressSummary: {
          country: "대한민국",
          state: null,
          city: "서울",
          district: "마포구",
        },
        reviewSummary: { totalCount: 0, averageRating: 0 },
        isInWishlist: false,
      },
      {
        viewedAt: "2026-09-06T00:00:00Z",
        accommodationId: 31,
        accommodationName: "서울 하우스 31",
        thumbnailUrl: "/stay.jpg",
        addressSummary: {
          country: "대한민국",
          state: null,
          city: "서울",
          district: "마포구",
        },
        reviewSummary: { totalCount: 4, averageRating: 4.75 },
        isInWishlist: true,
      },
    ]);
  });

  it("preserves get/add/remove paths and forwards AbortSignal", async () => {
    mockRequestApiData.mockResolvedValue({
      accommodations: [],
      total_count: 0,
    });
    mockRequestApiDataNullable.mockResolvedValue(null);
    const signal = new AbortController().signal;

    await expect(
      recentlyViewedApi.getRecentlyViewed({ signal }),
    ).resolves.toEqual({
      accommodations: [],
      totalCount: 0,
    });
    await recentlyViewedApi.add(31, { signal });
    await recentlyViewedApi.remove(31, { signal });

    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/recently-viewed",
      signal,
    });
    expect(mockRequestApiDataNullable).toHaveBeenNthCalledWith(1, {
      method: "POST",
      path: "/members/recently-viewed/31",
      signal,
    });
    expect(mockRequestApiDataNullable).toHaveBeenNthCalledWith(2, {
      method: "DELETE",
      path: "/members/recently-viewed/31",
      signal,
    });
  });
});

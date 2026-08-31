import {
  requestApiData,
  requestApiDataNullable,
} from "../../../platform/http/request";
import { recentlyViewedApi } from "./recentlyViewedApi";

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

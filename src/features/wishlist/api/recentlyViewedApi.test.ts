import type { ApiTransport } from "./transport";
import { createRecentlyViewedApi } from "./recentlyViewedApi";

describe("recently viewed API adapter", () => {
  it("preserves get/add/remove paths and forwards AbortSignal", async () => {
    const request = vi.fn().mockResolvedValue({
      accommodations: [],
      total_count: 0,
    });
    const requestNullable = vi.fn().mockResolvedValue(null);
    const api = createRecentlyViewedApi({
      request,
      requestNullable,
    } as ApiTransport);
    const signal = new AbortController().signal;

    await expect(api.getRecentlyViewed({ signal })).resolves.toEqual({
      accommodations: [],
      totalCount: 0,
    });
    await api.add(31, { signal });
    await api.remove(31, { signal });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/recently-viewed",
      signal,
    });
    expect(requestNullable).toHaveBeenNthCalledWith(1, {
      method: "POST",
      path: "/members/recently-viewed/31",
      signal,
    });
    expect(requestNullable).toHaveBeenNthCalledWith(2, {
      method: "DELETE",
      path: "/members/recently-viewed/31",
      signal,
    });
  });
});

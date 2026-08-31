import type { HostListingPageWire } from "./hostListingsContracts";
import {
  createHostListingsApi,
  type HostListingsApiTransport,
} from "./hostListingsApiFactory";

const wirePage: HostListingPageWire = {
  accommodations: [
    {
      id: 31,
      name: "합정 숙소",
      thumbnail_url: "/listing.jpg",
      status: "PUBLISHED",
      type: "APARTMENT",
      address_summary: {
        country: "대한민국",
        state: "서울특별시",
        city: "서울",
        district: "마포구",
      },
      created_at: "2026-08-30T00:00:00Z",
    },
  ],
  page_info: {
    current_size: 1,
    has_next: true,
    next_cursor: "cursor-2",
  },
};

describe("host listings API adapter", () => {
  it("preserves the first-page method, path, size/status query, signal and wire mapping", async () => {
    const transport = vi.fn().mockResolvedValue(wirePage);
    const api = createHostListingsApi(transport as HostListingsApiTransport);
    const signal = new AbortController().signal;

    await expect(
      api.getHostListings({ size: 20, status: "PUBLISHED" }, { signal }),
    ).resolves.toEqual({
      listings: [
        {
          id: 31,
          name: "합정 숙소",
          thumbnailUrl: "/listing.jpg",
          status: "PUBLISHED",
          type: "APARTMENT",
          addressSummary: {
            country: "대한민국",
            state: "서울특별시",
            city: "서울",
            district: "마포구",
          },
          createdAt: "2026-08-30T00:00:00Z",
        },
      ],
      pageInfo: {
        currentSize: 1,
        hasNext: true,
        nextCursor: "cursor-2",
      },
    });
    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: "/profile/host/accommodations",
      params: { size: 20, status: "PUBLISHED" },
      signal,
    });
    expect(transport.mock.calls.at(0)?.at(0)).not.toHaveProperty("body");
    expect(transport.mock.calls.at(0)?.at(0)?.params).not.toHaveProperty(
      "cursor",
    );
  });

  it("forwards an exact cursor without changing the selected status", async () => {
    const transport = vi.fn().mockResolvedValue({
      accommodations: [],
      page_info: { current_size: 0, has_next: false, next_cursor: null },
    } satisfies HostListingPageWire);
    const api = createHostListingsApi(transport as HostListingsApiTransport);
    const signal = new AbortController().signal;

    await api.getHostListings(
      { cursor: "cursor-2", size: 20, status: "UNPUBLISHED" },
      { signal },
    );

    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: "/profile/host/accommodations",
      params: {
        cursor: "cursor-2",
        size: 20,
        status: "UNPUBLISHED",
      },
      signal,
    });
  });
});

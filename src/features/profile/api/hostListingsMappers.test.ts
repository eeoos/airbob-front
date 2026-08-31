import type { HostListingPageWire } from "./hostListingsContracts";
import { toHostListingPage } from "./hostListingsMappers";

describe("host listing wire mapper", () => {
  it("preserves nullable draft fields while removing snake_case from the model", () => {
    const wire: HostListingPageWire = {
      accommodations: [
        {
          id: 9,
          name: null,
          thumbnail_url: null,
          status: "DRAFT",
          type: null,
          address_summary: null,
          created_at: "2026-08-30T01:00:00Z",
        },
      ],
      page_info: {
        current_size: 1,
        has_next: false,
        next_cursor: null,
      },
    };

    expect(toHostListingPage(wire)).toEqual({
      listings: [
        {
          id: 9,
          name: null,
          thumbnailUrl: null,
          status: "DRAFT",
          type: null,
          addressSummary: null,
          createdAt: "2026-08-30T01:00:00Z",
        },
      ],
      pageInfo: {
        currentSize: 1,
        hasNext: false,
        nextCursor: null,
      },
    });
  });
});

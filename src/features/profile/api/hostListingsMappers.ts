import type { HostListingPage } from "../model/hostListing";
import type { HostListingPageWire } from "./hostListingsContracts";

export const toHostListingPage = (
  wire: HostListingPageWire,
): HostListingPage => ({
  listings: wire.accommodations.map((listing) => ({
    id: listing.id,
    name: listing.name,
    thumbnailUrl: listing.thumbnail_url,
    status: listing.status,
    type: listing.type,
    addressSummary: listing.address_summary
      ? {
          country: listing.address_summary.country,
          state: listing.address_summary.state,
          city: listing.address_summary.city,
          district: listing.address_summary.district,
        }
      : null,
    createdAt: listing.created_at,
  })),
  pageInfo: {
    currentSize: wire.page_info.current_size,
    hasNext: wire.page_info.has_next,
    nextCursor: wire.page_info.next_cursor,
  },
});

import type { SearchRequest, SearchResultPage } from "../model/search";
import type { SearchResultPageWire, SearchWireRequest } from "./contracts";

export const toSearchWireRequest = (
  request: SearchRequest,
): SearchWireRequest => ({ ...request });

export const toSearchResultPage = (
  wire: SearchResultPageWire,
): SearchResultPage => ({
  accommodations: wire.stay_search_result_listing.map((accommodation) => ({
    id: accommodation.id,
    name: accommodation.name,
    thumbnailUrl: accommodation.accommodation_thumbnail_url,
    basePrice: accommodation.base_price,
    currency: accommodation.currency,
    type: accommodation.type,
    addressSummary: {
      country: accommodation.address_summary.country,
      state: accommodation.address_summary.state,
      city: accommodation.address_summary.city,
      district: accommodation.address_summary.district,
    },
    coordinate: {
      latitude: accommodation.coordinate.latitude,
      longitude: accommodation.coordinate.longitude,
    },
    reviewSummary: {
      totalCount: accommodation.review_summary.total_count,
      averageRating: accommodation.review_summary.average_rating,
    },
    isInWishlist: accommodation.is_in_wishlist,
  })),
  pageInfo: {
    pageSize: wire.page_info.page_size,
    currentPage: wire.page_info.current_page,
    totalPages: wire.page_info.total_pages,
    totalElements: wire.page_info.total_elements,
    isFirst: wire.page_info.is_first,
    isLast: wire.page_info.is_last,
    hasNext: wire.page_info.has_next,
    hasPrevious: wire.page_info.has_previous,
  },
});

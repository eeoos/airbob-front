import type { SearchResultPageWire } from "./contracts";
import { toSearchResultPage, toSearchWireRequest } from "./mappers";

describe("search wire mappers", () => {
  it("preserves the backend's current camelCase query contract including zero", () => {
    expect(
      toSearchWireRequest({
        destination: "Seoul",
        adultOccupancy: 2,
        childOccupancy: 0,
        page: 0,
        size: 18,
      }),
    ).toEqual({
      destination: "Seoul",
      adultOccupancy: 2,
      childOccupancy: 0,
      page: 0,
      size: 18,
    });
  });

  it("maps nullable and zero-valued snake_case response fields to camelCase", () => {
    const wire: SearchResultPageWire = {
      stay_search_result_listing: [
        {
          id: 7,
          name: "서울 하우스",
          accommodation_thumbnail_url: null,
          base_price: 0,
          currency: "KRW",
          type: "HOUSE",
          address_summary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: null,
          },
          coordinate: { latitude: null, longitude: null },
          review_summary: { total_count: 0, average_rating: 0 },
          is_in_wishlist: false,
        },
        {
          id: 8,
          name: "부산 하우스",
          accommodation_thumbnail_url: "/stay.jpg",
          base_price: 120000,
          currency: "KRW",
          type: "APARTMENT",
          address_summary: {
            country: "대한민국",
            state: "부산광역시",
            city: "부산",
            district: "해운대구",
          },
          coordinate: { latitude: 35.16, longitude: 129.16 },
          review_summary: { total_count: 1, average_rating: 5 },
          is_in_wishlist: true,
        },
      ],
      page_info: {
        page_size: 18,
        current_page: 0,
        total_pages: 1,
        total_elements: 2,
        is_first: true,
        is_last: true,
        has_next: false,
        has_previous: false,
      },
    };

    expect(toSearchResultPage(wire)).toEqual({
      accommodations: [
        {
          id: 7,
          name: "서울 하우스",
          thumbnailUrl: null,
          basePrice: 0,
          currency: "KRW",
          type: "HOUSE",
          addressSummary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: null,
          },
          coordinate: { latitude: null, longitude: null },
          reviewSummary: { totalCount: 0, averageRating: 0 },
          isInWishlist: false,
        },
        {
          id: 8,
          name: "부산 하우스",
          thumbnailUrl: "/stay.jpg",
          basePrice: 120000,
          currency: "KRW",
          type: "APARTMENT",
          addressSummary: {
            country: "대한민국",
            state: "부산광역시",
            city: "부산",
            district: "해운대구",
          },
          coordinate: { latitude: 35.16, longitude: 129.16 },
          reviewSummary: { totalCount: 1, averageRating: 5 },
          isInWishlist: true,
        },
      ],
      pageInfo: {
        pageSize: 18,
        currentPage: 0,
        totalPages: 1,
        totalElements: 2,
        isFirst: true,
        isLast: true,
        hasNext: false,
        hasPrevious: false,
      },
    });
  });
});

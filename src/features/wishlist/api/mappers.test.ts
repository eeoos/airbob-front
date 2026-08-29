import {
  toRecentlyViewedCollection,
  toWishlistCollection,
  toWishlistDetail,
} from "./mappers";
import type {
  RecentlyViewedCollectionWire,
  WishlistCollectionWire,
  WishlistDetailWire,
} from "./contracts";

const pageInfo = {
  has_next: true,
  next_cursor: "cursor-2",
  current_size: 1,
} as const;

describe("wishlist wire mappers", () => {
  it("maps wishlist collection wire fields to the feature model", () => {
    const wire: WishlistCollectionWire = {
      wishlists: [
        {
          id: 7,
          name: "여름 여행",
          created_at: "2026-07-01T00:00:00Z",
          wishlist_item_count: 2,
          thumbnail_image_url: "/wishlist.jpg",
          is_contained: true,
          wishlist_accommodation_id: 91,
        },
      ],
      page_info: pageInfo,
    };

    expect(toWishlistCollection(wire)).toEqual({
      wishlists: [
        {
          id: 7,
          name: "여름 여행",
          createdAt: "2026-07-01T00:00:00Z",
          itemCount: 2,
          thumbnailImageUrl: "/wishlist.jpg",
          containsAccommodation: true,
          wishlistAccommodationId: 91,
        },
      ],
      pageInfo: {
        hasNext: true,
        nextCursor: "cursor-2",
        currentSize: 1,
      },
    });
  });

  it("maps nested wishlist accommodation wire fields without leaking snake_case", () => {
    const wire: WishlistDetailWire = {
      wishlist_accommodations: [
        {
          wishlist_accommodation_id: 91,
          memo: "창가 방",
          created_at: "2026-07-02T00:00:00Z",
          accommodation: {
            id: 31,
            name: "서울 하우스",
            thumbnail_url: "/stay.jpg",
          },
          address_summary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: "마포구",
          },
          review_summary: {
            total_count: 12,
            average_rating: 4.8,
          },
          is_in_wishlist: true,
        },
      ],
      page_info: { ...pageInfo, has_next: false, next_cursor: null },
    };

    expect(toWishlistDetail(wire)).toEqual({
      accommodations: [
        {
          wishlistAccommodationId: 91,
          memo: "창가 방",
          createdAt: "2026-07-02T00:00:00Z",
          accommodation: {
            id: 31,
            name: "서울 하우스",
            thumbnailUrl: "/stay.jpg",
          },
          addressSummary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: "마포구",
          },
          reviewSummary: { totalCount: 12, averageRating: 4.8 },
          isInWishlist: true,
        },
      ],
      pageInfo: { hasNext: false, nextCursor: null, currentSize: 1 },
    });
  });

  it("maps nullable recently viewed summaries to camelCase models", () => {
    const wire: RecentlyViewedCollectionWire = {
      accommodations: [
        {
          viewed_at: "2026-07-03T00:00:00Z",
          accommodation_id: 31,
          accommodation_name: "서울 하우스",
          thumbnail_url: null,
          address_summary: null,
          review_summary: null,
          is_in_wishlist: false,
        },
      ],
      total_count: 1,
    };

    expect(toRecentlyViewedCollection(wire)).toEqual({
      accommodations: [
        {
          viewedAt: "2026-07-03T00:00:00Z",
          accommodationId: 31,
          accommodationName: "서울 하우스",
          thumbnailUrl: null,
          addressSummary: null,
          reviewSummary: null,
          isInWishlist: false,
        },
      ],
      totalCount: 1,
    });
  });
});

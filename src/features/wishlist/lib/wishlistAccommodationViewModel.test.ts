import type { RecentlyViewedAccommodationInfo } from "../../../types/recentlyViewed";
import type { WishlistAccommodationInfo } from "../../../types/wishlist";
import type { WishlistInfo } from "../../../types/wishlist";
import {
  getRecentlyViewedSummaryLabel,
  toRecentlyViewedAccommodationCardViewModel,
  toWishlistAccommodationCardViewModel,
  toWishlistIndexCardViewModel,
  toWishlistModalItemViewModel,
  toWishlistAccommodationMemoTarget,
} from "./wishlistAccommodationViewModel";

const wishlistAccommodationFixture = (
  overrides: Partial<WishlistAccommodationInfo> = {},
): WishlistAccommodationInfo => ({
  wishlist_accommodation_id: 501,
  accommodation: {
    id: 201,
    name: "Lake cabin",
    thumbnail_url: "/lake-cabin.jpg",
  },
  address_summary: {
    country: "대한민국",
    state: null,
    city: "춘천",
    district: "남산면",
  },
  created_at: "2026-07-01T00:00:00Z",
  is_in_wishlist: true,
  memo: "Bring coffee",
  review_summary: {
    average_rating: 4.5,
    total_count: 8,
  },
  ...overrides,
});

const wishlistFixture = (overrides: Partial<WishlistInfo> = {}): WishlistInfo => ({
  id: 42,
  name: "Weekend saves",
  created_at: "2026-07-01T00:00:00Z",
  is_contained: null,
  thumbnail_image_url: "/weekend.jpg",
  wishlist_accommodation_id: null,
  wishlist_item_count: 2,
  ...overrides,
});

const recentlyViewedFixture = (
  overrides: Partial<RecentlyViewedAccommodationInfo> = {},
): RecentlyViewedAccommodationInfo => ({
  accommodation_id: 101,
  accommodation_name: "Ocean house",
  address_summary: {
    country: "대한민국",
    state: null,
    city: "부산",
    district: "해운대구",
  },
  is_in_wishlist: true,
  review_summary: {
    average_rating: 4.75,
    total_count: 12,
  },
  thumbnail_url: "/ocean-house.jpg",
  viewed_at: "2026-07-04T00:00:00+09:00",
  ...overrides,
});

describe("wishlist accommodation view model", () => {
  it("maps wishlist API fields into card display fields", () => {
    expect(
      toWishlistAccommodationCardViewModel(wishlistAccommodationFixture()),
    ).toEqual({
      wishlistAccommodationId: 501,
      accommodationId: 201,
      name: "Lake cabin",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/lake-cabin.jpg",
      locationLabel: "춘천, 남산면",
      showReview: true,
      reviewRatingLabel: "4.5",
      reviewCountLabel: "(8)",
      memo: "Bring coffee",
    });
  });

  it("passes only memo editing fields to modal state", () => {
    const accommodation = toWishlistAccommodationCardViewModel(
      wishlistAccommodationFixture(),
    );

    expect(toWishlistAccommodationMemoTarget(accommodation)).toEqual({
      wishlistAccommodationId: 501,
      memo: "Bring coffee",
    });
  });

  it("maps wishlist index fields into card display fields", () => {
    expect(toWishlistIndexCardViewModel(wishlistFixture())).toEqual({
      id: 42,
      name: "Weekend saves",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/weekend.jpg",
      itemCountLabel: "저장된 항목 2개",
    });
  });

  it("maps contained wishlist fields into modal item display fields", () => {
    expect(
      toWishlistModalItemViewModel(
        wishlistFixture({
          is_contained: true,
          wishlist_accommodation_id: 777,
        }),
      ),
    ).toEqual({
      id: 42,
      name: "Weekend saves",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/weekend.jpg",
      itemCountLabel: "저장된 항목 2개",
      isContained: true,
      wishlistAccommodationId: 777,
    });
  });

  it("maps uncontained wishlist modal thumbnails to explicit null", () => {
    expect(
      toWishlistModalItemViewModel(
        wishlistFixture({
          thumbnail_image_url: null,
          is_contained: false,
          wishlist_accommodation_id: null,
        }),
      ),
    ).toMatchObject({
      thumbnailUrl: null,
      isContained: false,
      wishlistAccommodationId: null,
    });
  });

  it("maps recently viewed API fields into card display fields", () => {
    expect(
      toRecentlyViewedAccommodationCardViewModel(recentlyViewedFixture()),
    ).toEqual({
      accommodationId: 101,
      name: "Ocean house",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/ocean-house.jpg",
      locationLabel: "부산, 해운대구",
      showReview: true,
      reviewRatingLabel: "4.8",
      reviewCountLabel: "(12)",
      isInWishlist: true,
      viewedAt: "2026-07-04T00:00:00+09:00",
    });
  });

  it("provides recently viewed index summary labels from display items", () => {
    const item = toRecentlyViewedAccommodationCardViewModel(
      recentlyViewedFixture({ viewed_at: new Date().toISOString() }),
    );

    expect(getRecentlyViewedSummaryLabel([item])).toBe("오늘");
    expect(getRecentlyViewedSummaryLabel([])).toBe("항목 없음");
  });

  it("keeps nullable recently viewed display fields explicit", () => {
    const viewModel = toRecentlyViewedAccommodationCardViewModel(
      recentlyViewedFixture({
        address_summary: null,
        review_summary: null,
        thumbnail_url: null,
      }),
    );

    expect(viewModel.thumbnailUrl).toBeNull();
    expect(viewModel.locationLabel).toBe("");
    expect(viewModel.showReview).toBe(false);
    expect(viewModel.reviewRatingLabel).toBe("0.0");
    expect(viewModel.reviewCountLabel).toBe("(0)");
  });
});

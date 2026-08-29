import type {
  RecentlyViewedAccommodation,
  WishlistAccommodation,
  WishlistSummary,
} from "../model";
import {
  getRecentlyViewedSummaryLabel,
  toRecentlyViewedAccommodationCardViewModel,
  toWishlistAccommodationCardViewModel,
  toWishlistAccommodationMemoTarget,
  toWishlistIndexCardViewModel,
  toWishlistModalItemViewModel,
} from "./wishlistAccommodationViewModel";

const wishlistAccommodationFixture = (
  overrides: Partial<WishlistAccommodation> = {},
): WishlistAccommodation => ({
  wishlistAccommodationId: 501,
  accommodation: {
    id: 201,
    name: "Lake cabin",
    thumbnailUrl: "/lake-cabin.jpg",
  },
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "춘천",
    district: "남산면",
  },
  createdAt: "2026-07-01T00:00:00Z",
  isInWishlist: true,
  memo: "Bring coffee",
  reviewSummary: {
    averageRating: 4.5,
    totalCount: 8,
  },
  ...overrides,
});

const wishlistFixture = (
  overrides: Partial<WishlistSummary> = {},
): WishlistSummary => ({
  id: 42,
  name: "Weekend saves",
  createdAt: "2026-07-01T00:00:00Z",
  containsAccommodation: null,
  thumbnailImageUrl: "/weekend.jpg",
  wishlistAccommodationId: null,
  itemCount: 2,
  ...overrides,
});

const recentlyViewedFixture = (
  overrides: Partial<RecentlyViewedAccommodation> = {},
): RecentlyViewedAccommodation => ({
  accommodationId: 101,
  accommodationName: "Ocean house",
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "부산",
    district: "해운대구",
  },
  isInWishlist: true,
  reviewSummary: {
    averageRating: 4.75,
    totalCount: 12,
  },
  thumbnailUrl: "/ocean-house.jpg",
  viewedAt: "2026-07-04T00:00:00+09:00",
  ...overrides,
});

describe("wishlist accommodation view model", () => {
  it("maps feature domain fields into card display fields", () => {
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
          containsAccommodation: true,
          wishlistAccommodationId: 777,
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
          thumbnailImageUrl: null,
          containsAccommodation: false,
          wishlistAccommodationId: null,
        }),
      ),
    ).toMatchObject({
      thumbnailUrl: null,
      isContained: false,
      wishlistAccommodationId: null,
    });
  });

  it("maps recently viewed domain fields into card display fields", () => {
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
      recentlyViewedFixture({ viewedAt: new Date().toISOString() }),
    );

    expect(getRecentlyViewedSummaryLabel([item])).toBe("오늘");
    expect(getRecentlyViewedSummaryLabel([])).toBe("항목 없음");
  });

  it("keeps nullable recently viewed display fields explicit", () => {
    const viewModel = toRecentlyViewedAccommodationCardViewModel(
      recentlyViewedFixture({
        addressSummary: null,
        reviewSummary: null,
        thumbnailUrl: null,
      }),
    );

    expect(viewModel.thumbnailUrl).toBeNull();
    expect(viewModel.locationLabel).toBe("");
    expect(viewModel.showReview).toBe(false);
    expect(viewModel.reviewRatingLabel).toBe("0.0");
    expect(viewModel.reviewCountLabel).toBe("(0)");
  });
});

import type { AccommodationSearchInfo } from "../../../types/accommodation";
import {
  getSearchAccommodationPriceDisplay,
  toSearchAccommodationCardViewModel,
  toSearchAccommodationMapViewModel,
} from "./searchAccommodationViewModel";

const searchAccommodationFixture = (
  overrides: Partial<AccommodationSearchInfo> = {},
): AccommodationSearchInfo => ({
  id: 7,
  name: "성수 숙소",
  accommodation_thumbnail_url: "/rooms/7.jpg",
  base_price: 100000,
  currency: "KRW",
  type: "APARTMENT",
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  review_summary: {
    total_count: 12,
    average_rating: 4.75,
  },
  is_in_wishlist: true,
  ...overrides,
});

describe("search accommodation view model", () => {
  it("maps API field names into card display fields", () => {
    expect(
      toSearchAccommodationCardViewModel(searchAccommodationFixture()),
    ).toEqual({
      id: 7,
      name: "성수 숙소",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/rooms/7.jpg",
      locationLabel: "Seoul의 아파트",
      showReview: true,
      reviewRatingLabel: "4.8",
      reviewCountLabel: "(12)",
      basePrice: 100000,
      currency: "KRW",
      isInWishlist: true,
    });
  });

  it("keeps price and stay-night display out of card rendering", () => {
    const accommodation = toSearchAccommodationCardViewModel(
      searchAccommodationFixture(),
    );

    expect(getSearchAccommodationPriceDisplay(accommodation)).toEqual({
      amountLabel: "₩100,000",
      unitLabel: "1박",
    });
    expect(
      getSearchAccommodationPriceDisplay(
        accommodation,
        "2026-07-10",
        "2026-07-12",
      ),
    ).toEqual({
      amountLabel: "₩200,000",
      unitLabel: "2박",
    });
  });

  it("maps API field names into map display fields", () => {
    expect(
      toSearchAccommodationMapViewModel(searchAccommodationFixture()),
    ).toEqual({
      id: 7,
      name: "성수 숙소",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/rooms/7.jpg",
      locationLabel: "Seoul",
      showReview: true,
      reviewRatingLabel: "4.8",
      reviewCountLabel: "(12)",
      basePrice: 100000,
      currency: "KRW",
      isInWishlist: true,
      coordinate: {
        latitude: 37.5,
        longitude: 127,
      },
    });
  });
});

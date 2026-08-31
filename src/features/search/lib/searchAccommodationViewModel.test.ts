import type { SearchAccommodation } from "../model/search";
import {
  getSearchAccommodationPriceDisplay,
  toSearchAccommodationCardViewModel,
  toSearchAccommodationMapViewModel,
} from "./searchAccommodationViewModel";

const searchAccommodationFixture = (
  overrides: Partial<SearchAccommodation> = {},
): SearchAccommodation => ({
  id: 7,
  name: "성수 숙소",
  thumbnailUrl: "/rooms/7.jpg",
  basePrice: 100000,
  currency: "KRW",
  type: "APARTMENT",
  addressSummary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  reviewSummary: {
    totalCount: 12,
    averageRating: 4.75,
  },
  isInWishlist: true,
  ...overrides,
});

describe("search accommodation view model", () => {
  it("maps the search model into card display fields", () => {
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

  it("maps the search model into map display fields", () => {
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

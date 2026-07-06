import type { AccommodationDetail } from "../../../types/accommodation";
import { toReservationModalAccommodationViewModel } from "./reservationModalViewModel";

const accommodationDetailFixture = (
  overrides: Partial<AccommodationDetail> = {},
): AccommodationDetail => ({
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "ENTIRE_PLACE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
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
  host: {
    id: 1,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: [],
  images: [{ id: 1, image_url: "/stay.jpg" }],
  review_summary: {
    total_count: 12,
    average_rating: 4.85,
  },
  ...overrides,
});

describe("reservation modal view model", () => {
  it("maps accommodation detail DTO fields into modal summary data", () => {
    expect(
      toReservationModalAccommodationViewModel(accommodationDetailFixture()),
    ).toEqual({
      basePrice: 100000,
      id: 7,
      name: "테스트 숙소",
      primaryImageUrl: "/stay.jpg",
      rating: {
        averageRating: 4.85,
        reviewCount: 12,
      },
    });
  });

  it("uses null when the accommodation has no modal image", () => {
    expect(
      toReservationModalAccommodationViewModel(
        accommodationDetailFixture({ images: [] }),
      ).primaryImageUrl,
    ).toBeNull();
  });
});

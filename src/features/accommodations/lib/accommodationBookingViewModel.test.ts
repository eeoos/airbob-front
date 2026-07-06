import type { AccommodationDetail } from "../../../types/accommodation";
import { toAccommodationBookingViewModel } from "./accommodationBookingViewModel";

const accommodationDetailFixture = (
  overrides: Partial<AccommodationDetail> = {},
): AccommodationDetail => ({
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "APARTMENT",
  base_price: 120000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: ["2026-07-10", "2026-07-11"],
  is_in_wishlist: false,
  address_summary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "중구",
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
    max_occupancy: 5,
    infant_occupancy: 2,
    pet_occupancy: 1,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  ...overrides,
});

describe("accommodation booking view model", () => {
  it("maps booking DTO fields into display-oriented booking data", () => {
    expect(
      toAccommodationBookingViewModel(accommodationDetailFixture()),
    ).toEqual({
      basePrice: 120000,
      basePriceLabel: "₩120,000",
      unavailableDates: ["2026-07-10", "2026-07-11"],
      guestLimits: {
        maxAdultsAndChildren: 5,
        maxInfants: 2,
        maxPets: 1,
      },
    });
  });
});

import type { AccommodationDetail } from "../model/accommodationDetail";
import { toAccommodationBookingViewModel } from "./accommodationBookingViewModel";

const accommodationDetailFixture = (
  overrides: Partial<AccommodationDetail> = {},
): AccommodationDetail => ({
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "APARTMENT",
  basePrice: 120000,
  currency: "KRW",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  timeZoneId: "Asia/Seoul",
  isInWishlist: false,
  addressSummary: {
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
    thumbnailImageUrl: null,
  },
  policy: {
    maxOccupancy: 5,
    infantOccupancy: 2,
    petOccupancy: 1,
  },
  amenities: [],
  images: [],
  reviewSummary: {
    totalCount: 0,
    averageRating: 0,
  },
  ...overrides,
});

describe("accommodation booking view model", () => {
  it("maps booking DTO fields into display-oriented booking data", () => {
    expect(
      toAccommodationBookingViewModel(accommodationDetailFixture(), {
        accommodationId: 7,
        bookingWindowStartInclusive: "2026-07-10",
        bookingWindowEndExclusive: "2027-07-10",
        unavailableRanges: [
          { startDate: "2026-07-10", endDateExclusive: "2026-07-12" },
        ],
      }),
    ).toEqual({
      basePrice: 120000,
      basePriceLabel: "₩120,000",
      availability: {
        selectionWindow: {
          startInclusive: "2026-07-10",
          endExclusive: "2027-07-10",
        },
        disabledRanges: [
          { startInclusive: "2026-07-10", endExclusive: "2026-07-12" },
        ],
      },
      guestLimits: {
        maxAdultsAndChildren: 5,
        maxInfants: 2,
        maxPets: 1,
      },
    });
  });
});

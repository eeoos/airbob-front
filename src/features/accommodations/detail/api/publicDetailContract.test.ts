import contract from "./__fixtures__/public-accommodation-detail.json";
import { toAccommodationDetail } from "./mappers";
import { toAccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import { toAccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";

describe("public accommodation backend contract", () => {
  it("preserves display, photos, amenities, and booking limits after query projection", () => {
    const detail = toAccommodationDetail(contract);
    const view = toAccommodationDetailViewModel(detail, (path) => path ?? "", {
      resolve: (code) => ({ isKnown: true, label: code }),
    });
    expect(view).toMatchObject({
      id: 30,
      title: "공개 상세 계약 숙소",
      description: "창가에서 쉬어가는 숙소입니다.",
      typeLabel: "아파트",
      locationLabel: "서울, 대한민국",
      hostSummary: {
        id: 20,
        name: "공개 상세 호스트",
        avatarUrl: "/contract/public-host.jpg",
      },
      counts: { guests: 4, infants: 1, pets: 0 },
      rating: { averageRating: 4.5, reviewCount: 4, hasReviews: true },
      labels: { checkIn: "체크인 15:30", checkOut: "체크아웃 11:00" },
      isInWishlist: false,
      coordinate: { latitude: 37.55, longitude: 126.92 },
    });
    expect(view.heroImages.map(({ id, url }) => ({ id, url }))).toEqual([
      { id: 60, url: "/contract/public-first.jpg" },
      { id: 62, url: "/contract/public-second.jpg" },
    ]);
    expect(view.amenities.map(({ type, count }) => ({ type, count }))).toEqual([
      { type: "WIFI", count: 1 },
      { type: "TV", count: 2 },
    ]);
    expect(detail.timeZoneId).toBe("Asia/Seoul");
    expect(toAccommodationBookingViewModel(detail, null)).toEqual({
      basePrice: 150000,
      basePriceLabel: "₩150,000",
      availability: { selectionWindow: null, disabledRanges: [] },
      guestLimits: { maxAdultsAndChildren: 4, maxInfants: 1, maxPets: 0 },
    });
  });

  it("takes availability and personal wishlist state from their separate inputs", () => {
    const detail = toAccommodationDetail({ ...contract, is_in_wishlist: true });
    const booking = toAccommodationBookingViewModel(detail, {
      accommodationId: contract.id,
      bookingWindowStartInclusive: "2026-09-01",
      bookingWindowEndExclusive: "2026-12-01",
      unavailableRanges: [
        { startDate: "2026-10-01", endDateExclusive: "2026-10-03" },
      ],
    });
    expect(detail.isInWishlist).toBe(true);
    expect(booking.availability).toEqual({
      selectionWindow: {
        startInclusive: "2026-09-01",
        endExclusive: "2026-12-01",
      },
      disabledRanges: [
        { startInclusive: "2026-10-01", endExclusive: "2026-10-03" },
      ],
    });
    expect(contract.is_in_wishlist).toBe(false);
  });
});

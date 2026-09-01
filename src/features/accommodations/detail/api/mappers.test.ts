import type {
  AccommodationDetailWire,
  CouponCollectionWire,
} from "./contracts";
import {
  toAccommodationAvailability,
  toAccommodationDetail,
  toCouponCollection,
} from "./mappers";

describe("accommodation API mappers", () => {
  it("maps every accommodation-detail wire field into the owned model", () => {
    const wire: AccommodationDetailWire = {
      id: 31,
      name: "한강 전망 숙소",
      description: "조용한 숙소",
      type: "APARTMENT",
      base_price: 125000,
      currency: "KRW",
      check_in_time: "15:00:00",
      check_out_time: "11:00:00",
      time_zone_id: "Asia/Seoul",
      is_in_wishlist: true,
      address_summary: {
        country: "대한민국",
        state: "서울특별시",
        city: "서울",
        district: "마포구",
      },
      coordinate: { latitude: 37.55, longitude: 126.91 },
      host: {
        id: 7,
        nickname: "호스트",
        thumbnail_image_url: "/host.png",
      },
      policy: {
        max_occupancy: 4,
        infant_occupancy: 1,
        pet_occupancy: 2,
      },
      amenities: [
        { type: "WIFI", count: 1 },
        { type: "BED", count: 2 },
      ],
      images: [{ id: 51, image_url: "/stay.png" }],
      review_summary: { total_count: 12, average_rating: 4.75 },
    };

    expect(toAccommodationDetail(wire)).toEqual({
      id: 31,
      name: "한강 전망 숙소",
      description: "조용한 숙소",
      type: "APARTMENT",
      basePrice: 125000,
      currency: "KRW",
      checkInTime: "15:00:00",
      checkOutTime: "11:00:00",
      timeZoneId: "Asia/Seoul",
      isInWishlist: true,
      addressSummary: {
        country: "대한민국",
        state: "서울특별시",
        city: "서울",
        district: "마포구",
      },
      coordinate: { latitude: 37.55, longitude: 126.91 },
      host: {
        id: 7,
        nickname: "호스트",
        thumbnailImageUrl: "/host.png",
      },
      policy: {
        maxOccupancy: 4,
        infantOccupancy: 1,
        petOccupancy: 2,
      },
      amenities: [
        { type: "WIFI", count: 1 },
        { type: "BED", count: 2 },
      ],
      images: [{ id: 51, imageUrl: "/stay.png" }],
      reviewSummary: { totalCount: 12, averageRating: 4.75 },
    });
  });

  it.each(["", "   "])("rejects an empty detail timeZoneId", (timeZoneId) => {
    const wire = {
      id: 31,
      name: "한강 전망 숙소",
      description: "조용한 숙소",
      type: "APARTMENT",
      base_price: 125000,
      currency: "KRW",
      check_in_time: "15:00:00",
      check_out_time: "11:00:00",
      time_zone_id: timeZoneId,
      is_in_wishlist: false,
      address_summary: {
        country: "대한민국",
        state: null,
        city: "서울",
        district: null,
      },
      coordinate: { latitude: null, longitude: null },
      host: { id: 7, nickname: "호스트", thumbnail_image_url: null },
      policy: { max_occupancy: 4, infant_occupancy: 1, pet_occupancy: 0 },
      amenities: [],
      images: [],
      review_summary: { total_count: 0, average_rating: 0 },
    } satisfies AccommodationDetailWire;

    expect(() => toAccommodationDetail(wire)).toThrow(
      "Accommodation detail timeZoneId is invalid.",
    );
  });

  it("maps canonical availability ranges and binds route identity", () => {
    expect(
      toAccommodationAvailability(
        {
          booking_window_start_inclusive: "2026-09-01",
          booking_window_end_exclusive: "2027-09-01",
          unavailable_ranges: [
            {
              start_date: "2026-09-10",
              end_date_exclusive: "2026-09-12",
            },
          ],
        },
        31,
      ),
    ).toEqual({
      accommodationId: 31,
      bookingWindowStartInclusive: "2026-09-01",
      bookingWindowEndExclusive: "2027-09-01",
      unavailableRanges: [
        { startDate: "2026-09-10", endDateExclusive: "2026-09-12" },
      ],
    });
  });

  it("maps every coupon wire field and renames the collection boundary", () => {
    const wire: CouponCollectionWire = {
      infos: [
        {
          id: 9,
          name: "가을 할인",
          description: null,
          discount_type: "FIXED_AMOUNT",
          discount_value: 10000,
          min_payment_price: 50000,
          max_discount_amount: null,
          start_date: "2026-09-01",
          end_date: "2026-09-30",
          total_quantity: 100,
          issued_quantity: 12,
        },
      ],
    };

    expect(toCouponCollection(wire)).toEqual({
      coupons: [
        {
          id: 9,
          name: "가을 할인",
          description: null,
          discountType: "FIXED_AMOUNT",
          discountValue: 10000,
          minPaymentPrice: 50000,
          maxDiscountAmount: null,
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          totalQuantity: 100,
          issuedQuantity: 12,
        },
      ],
    });
  });
});

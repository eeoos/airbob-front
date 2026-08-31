import type {
  AccommodationDetailWire,
  CouponCollectionWire,
} from "./contracts";
import { toAccommodationDetail, toCouponCollection } from "./mappers";

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
      unavailable_dates: ["2026-09-10"],
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
      unavailableDates: ["2026-09-10"],
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

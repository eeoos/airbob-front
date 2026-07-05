import { ReservationStatus } from "../../../types/enums";
import type {
  HostReservationInfo,
  MyReservationInfo,
} from "../../../types/reservation";
import {
  toGuestTripCardViewModel,
  toHostReservationRowViewModel,
} from "./reservationListViewModel";

const guestReservationFixture = (
  overrides: Partial<MyReservationInfo> = {},
): MyReservationInfo => ({
  reservation_id: 11,
  reservation_uid: "guest-reservation-11",
  check_in_date: "2026-07-10",
  check_out_date: "2026-07-12",
  created_at: "2026-07-01T00:00:00",
  accommodation: {
    id: 7,
    name: "게스트 숙소",
    thumbnail_url: "/rooms/7.jpg",
  },
  ...overrides,
});

const hostReservationFixture = (
  overrides: Partial<HostReservationInfo> = {},
): HostReservationInfo => ({
  reservation_uid: "host-reservation-7",
  reservation_code: "HOST-CODE-7",
  total_price: 240000,
  currency: "KRW",
  guest_count: 3,
  check_in_date: "2026-07-10",
  check_out_date: "2026-07-12",
  status: ReservationStatus.PAYMENT_COMPLETED,
  created_at: "2026-07-01",
  guest: {
    id: 2,
    nickname: "예약 게스트",
    thumbnail_image_url: null,
  },
  accommodation: {
    id: 7,
    name: "호스트 숙소",
    thumbnail_url: null,
  },
  ...overrides,
});

describe("reservation list view model", () => {
  it("maps guest trip DTO fields into card display fields", () => {
    expect(toGuestTripCardViewModel(guestReservationFixture())).toEqual({
      id: 11,
      reservationUid: "guest-reservation-11",
      accommodationName: "게스트 숙소",
      thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/rooms/7.jpg",
      dateRangeLabel: "2026년 7월 10일 ~ 12일",
    });
  });

  it("maps host reservation DTO fields into row display fields", () => {
    expect(toHostReservationRowViewModel(hostReservationFixture())).toEqual({
      reservationUid: "host-reservation-7",
      statusLabel: "결제 완료",
      statusTone: "success",
      guestName: "예약 게스트",
      guestCountLabel: "3명",
      checkInLabel: "2026년 7월 10일",
      checkOutLabel: "2026년 7월 12일",
      createdAtLabel: "2026년 7월 1일",
      accommodationName: "호스트 숙소",
      reservationCodeLabel: "HOST-CODE-7",
      totalPriceLabel: "₩240,000",
    });
  });
});

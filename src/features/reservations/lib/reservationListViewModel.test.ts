import type {
  GuestReservationListItem,
  HostReservationListItem,
} from "../model/reservationRead";
import {
  toGuestTripCardViewModel,
  toHostReservationRowViewModel,
} from "./reservationListViewModel";

const guestReservationFixture = (
  overrides: Partial<GuestReservationListItem> = {},
): GuestReservationListItem => ({
  audience: "guest",
  reservationId: 11,
  reservationUid: "guest-reservation-11",
  checkInDate: "2026-07-10",
  checkOutDate: "2026-07-12",
  createdAt: "2026-07-01T00:00:00",
  accommodation: {
    id: 7,
    name: "게스트 숙소",
    thumbnailUrl: "/rooms/7.jpg",
  },
  ...overrides,
});

const hostReservationFixture = (
  overrides: Partial<HostReservationListItem> = {},
): HostReservationListItem => ({
  audience: "host",
  reservationUid: "host-reservation-7",
  reservationCode: "HOST-CODE-7",
  totalPrice: 240000,
  currency: "KRW",
  guestCount: 3,
  checkInDate: "2026-07-10",
  checkOutDate: "2026-07-12",
  status: "PAYMENT_COMPLETED",
  createdAt: "2026-07-01",
  guest: {
    id: 2,
    nickname: "예약 게스트",
    thumbnailImageUrl: null,
  },
  accommodation: {
    id: 7,
    name: "호스트 숙소",
    thumbnailUrl: null,
  },
  ...overrides,
});

describe("reservation list view model", () => {
  it("maps guest trip DTO fields into card display fields", () => {
    expect(toGuestTripCardViewModel(guestReservationFixture())).toEqual({
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

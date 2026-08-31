import type {
  GuestReservationDetailWire,
  GuestReservationPageWire,
  HostReservationDetailWire,
  HostReservationPageWire,
} from "./reservationReadContracts";
import {
  toGuestReservationDetail,
  toGuestReservationPage,
  toHostReservationDetail,
  toHostReservationPage,
} from "./reservationReadMappers";

const pageInfo = {
  current_size: 1,
  has_next: true,
  next_cursor: "cursor-2",
} as const;

const accommodation = {
  id: 7,
  name: "테스트 숙소",
  thumbnail_url: "/room.jpg",
} as const;

const member = {
  id: 9,
  nickname: "테스트 회원",
  thumbnail_image_url: "/member.jpg",
} as const;

const address = {
  country: "대한민국",
  state: "서울특별시",
  city: "서울",
  district: "마포구",
  street: "와우산로",
  detail: "101호",
  postal_code: "04000",
} as const;

const payment = {
  order_id: "order-1",
  payment_key: "payment-1",
  method: "CARD",
  total_amount: 240000,
  balance_amount: 220000,
  status: "PARTIAL_CANCELED",
  requested_at: "2026-07-01T10:00:00Z",
  approved_at: "2026-07-01T10:01:00Z",
  cancels: [
    {
      cancel_amount: 20000,
      cancel_reason: "일정 변경",
      canceled_at: "2026-07-02T10:00:00Z",
    },
  ],
  virtual_account: {
    account_number: "1234567890",
    bank_code: "088",
    customer_name: "게스트",
    due_date: "2026-07-03T23:59:59Z",
  },
} as const;

describe("reservation read wire mappers", () => {
  it("maps guest and host list pages without leaking snake_case fields", () => {
    const guestWire: GuestReservationPageWire = {
      page_info: pageInfo,
      reservations: [
        {
          reservation_id: 11,
          reservation_uid: "guest-reservation-11",
          check_in_date: "2026-07-10",
          check_out_date: "2026-07-12",
          created_at: "2026-07-01T00:00:00Z",
          accommodation,
        },
      ],
    };
    const hostWire: HostReservationPageWire = {
      page_info: pageInfo,
      reservations: [
        {
          reservation_uid: "host-reservation-21",
          reservation_code: "R-21",
          total_price: 240000,
          currency: "KRW",
          guest_count: 2,
          check_in_date: "2026-07-10",
          check_out_date: "2026-07-12",
          status: "CONFIRMED",
          created_at: "2026-07-01T00:00:00Z",
          guest: member,
          accommodation,
        },
      ],
    };

    expect(toGuestReservationPage(guestWire)).toEqual({
      audience: "guest",
      pageInfo: {
        currentSize: 1,
        hasNext: true,
        nextCursor: "cursor-2",
      },
      reservations: [
        {
          audience: "guest",
          reservationId: 11,
          reservationUid: "guest-reservation-11",
          checkInDate: "2026-07-10",
          checkOutDate: "2026-07-12",
          createdAt: "2026-07-01T00:00:00Z",
          accommodation: {
            id: 7,
            name: "테스트 숙소",
            thumbnailUrl: "/room.jpg",
          },
        },
      ],
    });
    expect(toHostReservationPage(hostWire)).toEqual({
      audience: "host",
      pageInfo: {
        currentSize: 1,
        hasNext: true,
        nextCursor: "cursor-2",
      },
      reservations: [
        {
          audience: "host",
          reservationUid: "host-reservation-21",
          reservationCode: "R-21",
          totalPrice: 240000,
          currency: "KRW",
          guestCount: 2,
          checkInDate: "2026-07-10",
          checkOutDate: "2026-07-12",
          status: "CONFIRMED",
          createdAt: "2026-07-01T00:00:00Z",
          guest: {
            id: 9,
            nickname: "테스트 회원",
            thumbnailImageUrl: "/member.jpg",
          },
          accommodation: {
            id: 7,
            name: "테스트 숙소",
            thumbnailUrl: "/room.jpg",
          },
        },
      ],
    });
  });

  it("maps the complete guest detail projection including payment metadata", () => {
    const wire: GuestReservationDetailWire = {
      reservation_uid: "guest-reservation-11",
      reservation_code: "G-11",
      status: "COMPLETED",
      created_at: "2026-07-01T00:00:00Z",
      guest_count: 2,
      check_in_date_time: "2026-07-10T15:00:00Z",
      check_out_date_time: "2026-07-12T11:00:00Z",
      check_in_time: "15:00:00",
      check_out_time: "11:00:00",
      can_write_review: true,
      accommodation,
      address,
      coordinate: { latitude: 37.55, longitude: 126.92 },
      host: member,
      payment,
    };

    expect(toGuestReservationDetail(wire)).toEqual({
      audience: "guest",
      reservationUid: "guest-reservation-11",
      reservationCode: "G-11",
      status: "COMPLETED",
      createdAt: "2026-07-01T00:00:00Z",
      guestCount: 2,
      checkInDateTime: "2026-07-10T15:00:00Z",
      checkOutDateTime: "2026-07-12T11:00:00Z",
      checkInTime: "15:00:00",
      checkOutTime: "11:00:00",
      canWriteReview: true,
      accommodation: {
        id: 7,
        name: "테스트 숙소",
        thumbnailUrl: "/room.jpg",
      },
      address: {
        country: "대한민국",
        state: "서울특별시",
        city: "서울",
        district: "마포구",
        street: "와우산로",
        detail: "101호",
        postalCode: "04000",
      },
      coordinate: { latitude: 37.55, longitude: 126.92 },
      host: {
        id: 9,
        nickname: "테스트 회원",
        thumbnailImageUrl: "/member.jpg",
      },
      payment: {
        orderId: "order-1",
        paymentKey: "payment-1",
        method: "CARD",
        totalAmount: 240000,
        balanceAmount: 220000,
        status: "PARTIAL_CANCELED",
        requestedAt: "2026-07-01T10:00:00Z",
        approvedAt: "2026-07-01T10:01:00Z",
        cancels: [
          {
            cancelAmount: 20000,
            cancelReason: "일정 변경",
            canceledAt: "2026-07-02T10:00:00Z",
          },
        ],
        virtualAccount: {
          accountNumber: "1234567890",
          bankCode: "088",
          customerName: "게스트",
          dueDate: "2026-07-03T23:59:59Z",
        },
      },
    });
  });

  it("maps host detail and normalizes omitted optional payment fields", () => {
    const wire: HostReservationDetailWire = {
      reservation_uid: "host-reservation-21",
      reservation_code: "H-21",
      status: "PAYMENT_COMPLETED",
      created_at: "2026-07-01T00:00:00Z",
      guest_count: 2,
      check_in_date_time: "2026-07-10T15:00:00Z",
      check_out_date_time: "2026-07-12T11:00:00Z",
      accommodation,
      address,
      guest: member,
      payment: {
        order_id: "order-2",
        total_amount: 240000,
        status: "DONE",
        requested_at: "2026-07-01T10:00:00Z",
      },
    };

    expect(toHostReservationDetail(wire)).toMatchObject({
      audience: "host",
      reservationUid: "host-reservation-21",
      guest: {
        id: 9,
        nickname: "테스트 회원",
        thumbnailImageUrl: "/member.jpg",
      },
      payment: {
        orderId: "order-2",
        paymentKey: null,
        method: null,
        totalAmount: 240000,
        balanceAmount: null,
        approvedAt: null,
        cancels: [],
        virtualAccount: null,
      },
    });
  });
});

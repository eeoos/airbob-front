import { PaymentStatus, ReservationStatus } from "../../../types/enums";
import type { GuestReservationDetail } from "../../../types/reservation";
import { toReservationDetailViewModel } from "./reservationDetailViewModel";

const reservationFixture = (
  overrides: Partial<GuestReservationDetail> = {},
): GuestReservationDetail => ({
  reservation_uid: "reservation-123",
  reservation_code: "CODE-123",
  status: ReservationStatus.CONFIRMED,
  created_at: "2026-07-01T00:00:00",
  guest_count: 2,
  check_in_date_time: "2020-07-10T15:00:00",
  check_out_date_time: "2020-07-12T11:00:00",
  check_in_time: "15:00",
  check_out_time: "11:00",
  can_write_review: true,
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnail_url: "/rooms/7.jpg",
  },
  address: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo",
    street: "와우산로",
    detail: null,
    postal_code: "04000",
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  host: {
    id: 1,
    nickname: "호스트",
    thumbnail_image_url: "/hosts/1.jpg",
  },
  payment: null,
  ...overrides,
});

describe("reservation detail view model", () => {
  it("maps guest reservation detail fields into route display fields", () => {
    expect(toReservationDetailViewModel(reservationFixture())).toMatchObject({
      reservationUid: "reservation-123",
      reservationCode: "CODE-123",
      guestCountLabel: "게스트 2명",
      accommodation: {
        id: 7,
        name: "테스트 숙소",
        thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/rooms/7.jpg",
      },
      addressLabel: "KR Seoul Mapo 와우산로",
      checkIn: {
        dateLabel: "7월 10일 (금)",
        timeLabel: "오후 3:00",
      },
      checkOut: {
        dateLabel: "7월 12일 (일)",
        timeLabel: "오전 11:00",
      },
      host: {
        nickname: "호스트",
        displayName: "호스트 님",
        avatarUrl: "https://d1wivnghydqg7i.cloudfront.net/hosts/1.jpg",
        avatarInitial: "호",
      },
      status: {
        label: "확정됨",
        tone: "success",
      },
      canReview: true,
      payment: null,
      mapCoordinate: {
        latitude: 37.5,
        longitude: 127,
      },
    });
  });

  it("maps virtual account payment details without exposing payment DTO names", () => {
    const viewModel = toReservationDetailViewModel(
      reservationFixture({
        payment: {
          order_id: "order-123",
          method: "가상계좌",
          total_amount: 120000,
          status: PaymentStatus.WAITING_FOR_DEPOSIT,
          requested_at: "2026-07-01T00:00:00",
          approved_at: null,
          virtual_account: {
            account_number: "123-456",
            bank_code: "04",
            customer_name: "홍길동",
            due_date: "2026-07-02T23:59:00",
          },
        },
      }),
    );

    expect(viewModel.payment).toEqual({
      methodLabel: "가상계좌",
      amountLabel: "₩120,000",
      approvedAtLabel: null,
      statusLabel: "입금 대기",
      statusTone: "warning",
      virtualAccount: {
        bankName: "KB국민은행",
        accountNumber: "123-456",
        customerName: "홍길동",
        dueDateLabel: expect.stringContaining("2026년 7월 2일"),
      },
    });
  });

  it("preserves zero-valued map coordinates", () => {
    expect(
      toReservationDetailViewModel(
        reservationFixture({
          coordinate: {
            latitude: 0,
            longitude: 127,
          },
        }),
      ).mapCoordinate,
    ).toEqual({
      latitude: 0,
      longitude: 127,
    });

    expect(
      toReservationDetailViewModel(
        reservationFixture({
          coordinate: {
            latitude: 37.5,
            longitude: null,
          },
        }),
      ).mapCoordinate,
    ).toBeNull();
  });
});

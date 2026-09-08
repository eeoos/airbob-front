import guestDetailContract from "../api/__fixtures__/guest-reservation-detail-payment.json";
import { toGuestReservationDetail } from "../api/reservationReadMappers";
import type { GuestReservationDetail } from "../model/reservationRead";
import { toReservationDetailViewModel } from "./reservationDetailViewModel";

const reservationFixture = (
  overrides: Partial<GuestReservationDetail> = {},
): GuestReservationDetail => ({
  audience: "guest",
  reservationUid: "reservation-123",
  reservationCode: "CODE-123",
  status: "CONFIRMED",
  createdAt: "2026-07-01T00:00:00",
  guestCount: 2,
  checkInDateTime: "2020-07-10T15:00:00",
  checkOutDateTime: "2020-07-12T11:00:00",
  timeZoneId: "Asia/Seoul",
  paymentAllowed: false,
  holdExpiresAt: null,
  serverTime: "2026-07-01T00:00:00Z",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  canWriteReview: true,
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnailUrl: "/rooms/7.jpg",
  },
  address: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo",
    street: "와우산로",
    detail: null,
    postalCode: "04000",
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  host: {
    id: 1,
    nickname: "호스트",
    thumbnailImageUrl: "/hosts/1.jpg",
  },
  payment: null,
  ...overrides,
});

describe("reservation detail view model", () => {
  it("keeps payment amount, host, map, and local stay dates from the backend contract", () => {
    const detail = toGuestReservationDetail({
      ...guestDetailContract,
      payment: { ...guestDetailContract.payment, status: "PARTIAL_CANCELED" },
    });
    const view = toReservationDetailViewModel(detail);
    expect(view.payment).toMatchObject({
      methodLabel: "카드",
      amountLabel: "₩100,001",
      statusLabel: "부분 취소",
    });
    expect(view.payment?.approvedAtLabel).toBeTruthy();
    expect(view.host.nickname).toBe("테스트 호스트");
    expect(view.mapCoordinate).toEqual({ latitude: 40.7, longitude: -74 });
    expect(view.canReview).toBe(false);
    expect(view.checkIn.dateLabel).toContain("11월 1일");
    expect(view.checkOut.dateLabel).toContain("11월 3일");
  });

  it.each(["CONFIRMED", "CANCELLATION_FAILED"] as const)(
    "uses the server review permission for %s even when the device clock is behind",
    (status) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2020-07-12T01:59:59Z"));
      try {
        const viewModel = toReservationDetailViewModel(
          reservationFixture({
            status,
            canWriteReview: true,
            serverTime: "2020-07-12T02:00:00Z",
          }),
        );
        expect(viewModel.canReview).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each([
    "CONFIRMED",
    "CANCELLATION_FAILED",
    "CANCELLATION_PENDING",
  ] as const)(
    "does not grant review permission for %s when the server denies it",
    (status) => {
      expect(
        toReservationDetailViewModel(
          reservationFixture({ status, canWriteReview: false }),
        ).canReview,
      ).toBe(false);
    },
  );

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

  it("maps card payment details without exposing payment DTO names", () => {
    const viewModel = toReservationDetailViewModel(
      reservationFixture({
        payment: {
          method: "카드",
          totalAmount: 120000,
          status: "DONE",
          approvedAt: null,
        },
      }),
    );

    expect(viewModel.payment).toEqual({
      methodLabel: "카드",
      amountLabel: "₩120,000",
      approvedAtLabel: null,
      statusLabel: "결제 완료",
      statusTone: "success",
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

  it.each([
    ["PAYMENT_PROCESSING", "결제 처리 중"],
    ["CANCELLATION_PENDING", "취소 처리 중"],
  ] as const)(
    "renders %s as status-only recovery without inventing a payment action",
    (status, label) => {
      const viewModel = toReservationDetailViewModel(
        reservationFixture({
          status,
          paymentAllowed: false,
          holdExpiresAt: null,
          payment: null,
        }),
      );

      expect(viewModel.status).toEqual({ label, tone: "warning" });
      expect(viewModel.payment).toBeNull();
      expect(viewModel).not.toHaveProperty("paymentAction");
    },
  );
});

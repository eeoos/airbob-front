import type { HostReservationDetail } from "../model/reservationRead";
import { toHostReservationDetailViewModel } from "./hostReservationDetailViewModel";
import hostStayContract from "../api/__fixtures__/host-reservation-stay-payment.json";
import { toHostReservationDetail } from "../api/reservationReadMappers";
import type { HostReservationDetailWire } from "../api/reservationReadContracts";

const hostReservationDetailFixture = (
  overrides: Partial<HostReservationDetail> = {},
): HostReservationDetail => ({
  audience: "host",
  reservationUid: "host-reservation-1",
  reservationCode: "HOST-CODE-1",
  status: "CONFIRMED",
  createdAt: "2026-07-01T00:00:00",
  guestCount: 2,
  checkInDateTime: "2026-07-10T15:00:00",
  checkOutDateTime: "2026-07-12T11:00:00",
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
  guest: {
    id: 2,
    nickname: "게스트",
    thumbnailImageUrl: "/guests/2.jpg",
  },
  payment: {
    orderId: "order-1",
    method: null,
    totalAmount: 240000,
    balanceAmount: null,
    status: "DONE",
    requestedAt: "2026-07-01T00:00:00",
    approvedAt: null,
    cancels: [],
  },
  timeZoneId: "Asia/Seoul",
  ...overrides,
});

describe("host reservation detail view model", () => {
  it("consumes the backend local-stay and discounted payment contract", () => {
    const reservation = toHostReservationDetail(
      hostStayContract as HostReservationDetailWire,
    );

    expect(toHostReservationDetailViewModel(reservation)).toMatchObject({
      guestStaySummaryLabel: "2게스트 • 2박 • ₩100,001",
      checkInDateLabel: "2026년 11월 1일 (일)",
      checkOutDateLabel: "2026년 11월 3일 (화)",
      payment: { nights: 2, totalAmountLabel: "₩100,001" },
    });
  });

  it.each([
    ["2026-11-01T00:00:00", "2026-11-02T00:00:00", 1],
    ["2026-03-07T00:00:00", "2026-03-09T00:00:00", 2],
    ["2026-07-10T09:00:00", "2026-07-11T18:00:00", 1],
    ["2028-02-28T15:00:00", "2028-03-01T11:00:00", 2],
  ])(
    "counts local stay dates from %s to %s as %i nights",
    (checkInDateTime, checkOutDateTime, nights) => {
      const view = toHostReservationDetailViewModel(
        hostReservationDetailFixture({
          checkInDateTime,
          checkOutDateTime,
          timeZoneId: "Asia/Seoul",
        }),
      );

      expect(view.payment?.nights).toBe(nights);
      expect(view.guestStaySummaryLabel).toContain(`${nights}박`);
    },
  );

  it("preserves an indivisible original payment amount without reconstructing a nightly rate", () => {
    const reservation = hostReservationDetailFixture();
    if (!reservation.payment)
      throw new Error("Expected a paid reservation fixture");
    const view = toHostReservationDetailViewModel({
      ...reservation,
      payment: {
        ...reservation.payment,
        totalAmount: 100001,
        balanceAmount: 0,
        status: "CANCELED",
      },
    });

    expect(view.payment).toEqual({ nights: 2, totalAmountLabel: "₩100,001" });
  });

  it("maps host reservation API fields into display fields", () => {
    expect(
      toHostReservationDetailViewModel(hostReservationDetailFixture()),
    ).toEqual({
      reservationCode: "HOST-CODE-1",
      statusLabel: "확정됨",
      statusTone: "success",
      guest: {
        nickname: "게스트",
        avatarUrl: "https://d1wivnghydqg7i.cloudfront.net/guests/2.jpg",
        avatarInitial: "게",
      },
      guestStaySummaryLabel: "2게스트 • 2박 • ₩240,000",
      accommodation: {
        id: 7,
        name: "테스트 숙소",
        thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/rooms/7.jpg",
      },
      addressLabel: "KR Seoul Mapo 와우산로",
      guestCountLabel: "2명",
      checkInDateLabel: "2026년 7월 10일 (금)",
      checkOutDateLabel: "2026년 7월 12일 (일)",
      createdAtDateLabel: "2026년 7월 1일 (수)",
      payment: {
        nights: 2,
        totalAmountLabel: "₩240,000",
      },
    });
  });

  it("omits optional image and payment display fields when absent", () => {
    const viewModel = toHostReservationDetailViewModel(
      hostReservationDetailFixture({
        accommodation: {
          id: 7,
          name: "테스트 숙소",
          thumbnailUrl: null,
        },
        guest: {
          id: 2,
          nickname: "Guest",
          thumbnailImageUrl: null,
        },
        payment: null,
      }),
    );

    expect(viewModel.guest.avatarUrl).toBeNull();
    expect(viewModel.guest.avatarInitial).toBe("G");
    expect(viewModel.accommodation.thumbnailUrl).toBeNull();
    expect(viewModel.guestStaySummaryLabel).toBe("2게스트 • 2박");
    expect(viewModel.payment).toBeNull();
  });

  it("keeps same-day or reversed stays at one display night", () => {
    const viewModel = toHostReservationDetailViewModel(
      hostReservationDetailFixture({
        checkInDateTime: "2026-07-10T15:00:00",
        checkOutDateTime: "2026-07-10T11:00:00",
      }),
    );

    expect(viewModel.payment?.nights).toBe(1);
  });

  it("renders cancellation processing as a current backend status", () => {
    expect(
      toHostReservationDetailViewModel(
        hostReservationDetailFixture({ status: "CANCELLATION_PENDING" }),
      ),
    ).toMatchObject({
      statusLabel: "취소 처리 중",
      statusTone: "warning",
    });
  });
});

import type { HostReservationDetail } from "../model/reservationRead";
import { toHostReservationDetailViewModel } from "./hostReservationDetailViewModel";

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
    virtualAccount: null,
  },
  timeZoneId: "Asia/Seoul",
  ...overrides,
});

describe("host reservation detail view model", () => {
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
        pricePerNightLabel: "₩120,000",
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

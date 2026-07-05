import { PaymentStatus, ReservationStatus } from "../../../types/enums";
import type { HostReservationDetail } from "../../../types/reservation";
import {
  calculateHostReservationNights,
  toHostReservationDetailViewModel,
} from "./hostReservationDetailViewModel";

const hostReservationDetailFixture = (
  overrides: Partial<HostReservationDetail> = {},
): HostReservationDetail => ({
  reservation_uid: "host-reservation-1",
  reservation_code: "HOST-CODE-1",
  status: ReservationStatus.CONFIRMED,
  created_at: "2026-07-01T00:00:00",
  guest_count: 2,
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
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
  guest: {
    id: 2,
    nickname: "게스트",
    thumbnail_image_url: "/guests/2.jpg",
  },
  payment: {
    order_id: "order-1",
    total_amount: 240000,
    status: PaymentStatus.DONE,
    requested_at: "2026-07-01T00:00:00",
  },
  ...overrides,
});

describe("host reservation detail view model", () => {
  it("maps host reservation API fields into display fields", () => {
    expect(
      toHostReservationDetailViewModel(hostReservationDetailFixture()),
    ).toEqual({
      reservationCode: "HOST-CODE-1",
      statusLabel: "확정됨",
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
          thumbnail_url: null,
        },
        guest: {
          id: 2,
          nickname: "Guest",
          thumbnail_image_url: null,
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
    expect(
      calculateHostReservationNights(
        "2026-07-10T15:00:00",
        "2026-07-10T11:00:00",
      ),
    ).toBe(1);
  });
});

import type { ReviewableReservationWire } from "./reviewableReservationContracts";
import {
  createReviewableReservationApi,
  type ReviewableReservationApiTransport,
} from "./reviewableReservationApi";

const reservationWire: ReviewableReservationWire = {
  reservation_uid: "reservation-123",
  can_write_review: true,
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnail_url: "/room.jpg",
  },
  address: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "마포구",
    street: "와우산로",
    detail: null,
  },
};

describe("reviewable reservation API adapter", () => {
  it("preserves the guest-detail endpoint and signal while mapping only review fields", async () => {
    const transport = jest.fn().mockResolvedValue(reservationWire);
    const api = createReviewableReservationApi(
      transport as ReviewableReservationApiTransport,
    );
    const signal = new AbortController().signal;

    await expect(
      api.getReviewableReservation("reservation-123", { signal }),
    ).resolves.toEqual({
      reservationUid: "reservation-123",
      canWriteReview: true,
      checkInDateTime: "2026-07-10T15:00:00",
      checkOutDateTime: "2026-07-12T11:00:00",
      accommodation: {
        id: 7,
        name: "테스트 숙소",
        thumbnailUrl: "/room.jpg",
      },
      address: {
        country: "대한민국",
        state: null,
        city: "서울",
        district: "마포구",
        street: "와우산로",
        detail: null,
      },
    });
    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: "/profile/guest/reservations/reservation-123",
      signal,
    });
    expect(transport.mock.calls[0][0]).not.toHaveProperty("body");
    expect(transport.mock.calls[0][0]).not.toHaveProperty("params");
  });
});

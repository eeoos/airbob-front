import { requestApiData } from "../../../platform/http/request";
import type { ReviewableReservationWire } from "./reviewableReservationContracts";
import { reviewableReservationApi } from "./reviewableReservationApi";

vi.mock("../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);

const RESERVATION_UID = "reservation-123";

const reservationWire: ReviewableReservationWire = {
  reservation_uid: RESERVATION_UID,
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
  beforeEach(() => {
    mockRequestApiData.mockReset();
  });

  it("preserves the guest-detail endpoint and signal while mapping only review fields", async () => {
    mockRequestApiData.mockResolvedValue(reservationWire);
    const signal = new AbortController().signal;

    await expect(
      reviewableReservationApi.getReviewableReservation(RESERVATION_UID, {
        signal,
      }),
    ).resolves.toEqual({
      reservationUid: RESERVATION_UID,
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
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: `/profile/guest/reservations/${RESERVATION_UID}`,
      signal,
    });
    expect(mockRequestApiData.mock.calls.at(0)?.at(0)).not.toHaveProperty(
      "body",
    );
    expect(mockRequestApiData.mock.calls.at(0)?.at(0)).not.toHaveProperty(
      "params",
    );
  });

  it("rejects an encoded separator before transport", async () => {
    await expect(
      reviewableReservationApi.getReviewableReservation("..%2Fadmin"),
    ).rejects.toMatchObject({ code: "INVALID_OPAQUE_PATH_SEGMENT" });
    expect(mockRequestApiData).not.toHaveBeenCalled();
  });
});

import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type { ReviewableReservation } from "../model/reviewableReservation";
import type { ReviewableReservationApiPort } from "../ports/reviewableReservationApiPort";
import { createReviewableReservationQueryOptions } from "./reviewableReservationQuery";

const scope = {
  subject: "subject:member_7",
  epoch: 4,
} as AuthenticatedSessionScope;

const reservation = (reservationUid: string): ReviewableReservation => ({
  reservationUid,
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

describe("reviewable reservation read query", () => {
  const api = {
    getReviewableReservation: jest.fn(),
  } as unknown as ReviewableReservationApiPort;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes the protected detail read and forwards query cancellation", async () => {
    const signal = new AbortController().signal;
    const options = createReviewableReservationQueryOptions(
      { reservationUid: "reservation-123", scope },
      api,
    );
    (api.getReviewableReservation as jest.Mock).mockResolvedValue(
      reservation("reservation-123"),
    );

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "reservations",
      "read",
      "reviewable",
      "reservation-123",
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
    expect(api.getReviewableReservation).toHaveBeenCalledWith(
      "reservation-123",
      { signal },
    );
    expect(options.retry).toBe(false);
    expect(options.throwOnError).toBe(false);
  });

  it("stays network-inert without both the resource id and an authenticated session", () => {
    const missingId = createReviewableReservationQueryOptions(
      { reservationUid: null, scope },
      api,
    );
    const anonymous = createReviewableReservationQueryOptions(
      { reservationUid: "reservation-123", scope: null },
      api,
    );

    expect(missingId.enabled).toBe(false);
    expect(anonymous.enabled).toBe(false);
    expect(anonymous.queryKey).toEqual([
      "reservations",
      "read",
      "reviewable",
      "reservation-123",
      { session: null },
    ]);
    expect(anonymous).not.toHaveProperty("meta");
    expect(() =>
      anonymous.queryFn({ signal: new AbortController().signal }),
    ).toThrow("authenticated session is required");
    expect(api.getReviewableReservation).not.toHaveBeenCalled();
  });

  it("suppresses a response for a different reservation identity", () => {
    const options = createReviewableReservationQueryOptions(
      { reservationUid: "reservation-123", scope },
      api,
    );

    expect(options.select(reservation("reservation-123"))).toEqual(
      reservation("reservation-123"),
    );
    expect(options.select(reservation("reservation-stale"))).toBeNull();
  });

  it("changes cache identity when either the subject or epoch changes", () => {
    const current = createReviewableReservationQueryOptions(
      { reservationUid: "reservation-123", scope },
      api,
    );
    const nextEpoch = createReviewableReservationQueryOptions(
      { reservationUid: "reservation-123", scope: { ...scope, epoch: 5 } },
      api,
    );
    const nextSubject = createReviewableReservationQueryOptions(
      {
        reservationUid: "reservation-123",
        scope: {
          ...scope,
          subject: "subject:member_8" as AuthenticatedSessionScope["subject"],
        },
      },
      api,
    );

    expect(nextEpoch.queryKey).not.toEqual(current.queryKey);
    expect(nextSubject.queryKey).not.toEqual(current.queryKey);
  });
});

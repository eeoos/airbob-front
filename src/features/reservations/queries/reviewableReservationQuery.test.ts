import { useQuery } from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { requireDefined } from "../../../test/assertions";
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import { reviewableReservationApi } from "../api/reviewableReservationApi";
import type { ReviewableReservation } from "../model/reviewableReservation";
import { useReviewableReservationReadQuery } from "./reviewableReservationQuery";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return { ...actual, useQuery: vi.fn() };
});

interface CapturedQueryOptions {
  readonly queryKey: readonly unknown[];
  readonly queryFn: (context: {
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
  readonly enabled: boolean;
  readonly select: (
    resource: ReviewableReservation,
  ) => ReviewableReservation | null;
  readonly meta?: unknown;
  readonly retry: false;
  readonly throwOnError: false;
}

const mockUseQuery = vi.mocked(useQuery);

const getCapturedOptions = (): CapturedQueryOptions =>
  requireDefined(
    mockUseQuery.mock.calls.at(-1),
    "useQuery call",
  )[0] as unknown as CapturedQueryOptions;

const scope = {
  subject: "subject:member_7",
  epoch: 4,
  runtimeLeaseId: testSessionRuntimeLeaseId,
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
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({} as ReturnType<typeof useQuery>);
    vi.restoreAllMocks();
  });

  it("scopes the protected detail read and forwards query cancellation", async () => {
    const signal = new AbortController().signal;
    const getReviewableReservation = vi
      .spyOn(reviewableReservationApi, "getReviewableReservation")
      .mockResolvedValue(reservation("reservation-123"));
    useReviewableReservationReadQuery({
      reservationUid: "reservation-123",
      scope,
    });
    const options = getCapturedOptions();

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "reservations",
      "read",
      "reviewable",
      "reservation-123",
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({
      session: { epoch: scope.epoch, subject: scope.subject },
    });
    expect(getReviewableReservation).toHaveBeenCalledWith("reservation-123", {
      signal,
    });
    expect(options.retry).toBe(false);
    expect(options.throwOnError).toBe(false);
  });

  it("stays network-inert without both the resource id and an authenticated session", () => {
    const getReviewableReservation = vi.spyOn(
      reviewableReservationApi,
      "getReviewableReservation",
    );
    useReviewableReservationReadQuery({ reservationUid: null, scope });
    const missingId = getCapturedOptions();
    useReviewableReservationReadQuery({
      reservationUid: "reservation-123",
      scope: null,
    });
    const anonymous = getCapturedOptions();

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
    expect(getReviewableReservation).not.toHaveBeenCalled();
  });

  it("suppresses a response for a different reservation identity", () => {
    useReviewableReservationReadQuery({
      reservationUid: "reservation-123",
      scope,
    });
    const options = getCapturedOptions();

    expect(options.select(reservation("reservation-123"))).toEqual(
      reservation("reservation-123"),
    );
    expect(options.select(reservation("reservation-stale"))).toBeNull();
  });

  it("changes cache identity when either the subject or epoch changes", () => {
    useReviewableReservationReadQuery({
      reservationUid: "reservation-123",
      scope,
    });
    const current = getCapturedOptions();
    useReviewableReservationReadQuery({
      reservationUid: "reservation-123",
      scope: { ...scope, epoch: 5 },
    });
    const nextEpoch = getCapturedOptions();
    useReviewableReservationReadQuery({
      reservationUid: "reservation-123",
      scope: {
        ...scope,
        subject: "subject:member_8" as AuthenticatedSessionScope["subject"],
      },
    });
    const nextSubject = getCapturedOptions();

    expect(nextEpoch.queryKey).not.toEqual(current.queryKey);
    expect(nextSubject.queryKey).not.toEqual(current.queryKey);
  });
});

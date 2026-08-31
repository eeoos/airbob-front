import { act, renderHook, waitFor } from "@testing-library/react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { useReservationCreateCommand } from "./useReservationCreateCommand";

const mockCreateWorkflow = vi.fn();
const mockStartReservation = vi.fn();
const mockDisposeWorkflow = vi.fn();

vi.mock("../../workflows/booking-payment/reservation-create", async () => ({
  ...(await vi.importActual<
    typeof import("../../workflows/booking-payment/reservation-create")
  >("../../workflows/booking-payment/reservation-create")),
  createReservationCreateWorkflow: (...args: unknown[]) =>
    mockCreateWorkflow(...args),
  reservationCreateTransport: {},
}));

const accommodation = {
  id: 7,
  basePrice: 100000,
  policy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 1,
  },
};
const availability = {
  accommodationId: 7,
  bookingWindowStartInclusive: "2026-07-10",
  bookingWindowEndExclusive: "2027-07-10",
  unavailableRanges: [],
};
const authenticatedScope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 2,
};
const checkoutHandoff = {
  preflight: vi.fn(() => ({ status: "ready" as const })),
  commit: vi.fn(),
};
const session = {
  captureAuthenticatedSession: () => authenticatedScope,
  isCurrentSession: () => true,
};

describe("useReservationCreateCommand", () => {
  beforeEach(() => {
    mockCreateWorkflow.mockReset();
    mockStartReservation.mockReset();
    mockDisposeWorkflow.mockReset();
    mockCreateWorkflow.mockReturnValue({
      dispose: mockDisposeWorkflow,
      start: mockStartReservation,
    });
  });

  it("fails closed before the workflow when no matching availability snapshot exists", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useReservationCreateCommand({
        accommodation,
        availability: null,
        bookingDates: {
          checkIn: new Date("2026-07-20T00:00:00"),
          checkOut: new Date("2026-07-22T00:00:00"),
          totalPrice: 200000,
        },
        checkoutHandoff,
        guestCounts: {
          adultCount: 2,
          childCount: 0,
          infantCount: 0,
          petCount: 0,
        },
        onError,
        requestAuthentication: vi.fn(),
        routeLease: { isCurrent: () => true },
        scope: authenticatedScope,
        selectedCoupon: null,
        session,
      }),
    );

    await act(async () => void (await result.current.startReservation()));

    expect(mockStartReservation).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "예약 가능한 날짜를 다시 불러와주세요.",
    );
  });

  it("terminal-locks an in-flight reservation across an exact route replacement", async () => {
    let resolveReservation!: (result: { status: "stale" }) => void;
    const pending = new Promise<{ status: "stale" }>((resolve) => {
      resolveReservation = resolve;
    });
    mockStartReservation.mockReturnValue(pending);
    let firstRouteIsCurrent = true;
    const onError = vi.fn();
    const requestAuthentication = vi.fn();
    const { result, rerender } = renderHook(
      ({ routeLease }) =>
        useReservationCreateCommand({
          accommodation,
          availability,
          bookingDates: {
            checkIn: new Date("2026-07-20T00:00:00"),
            checkOut: new Date("2026-07-22T00:00:00"),
            totalPrice: 200000,
          },
          checkoutHandoff,
          guestCounts: {
            adultCount: 2,
            childCount: 0,
            infantCount: 0,
            petCount: 0,
          },
          onError,
          requestAuthentication,
          routeLease,
          scope: authenticatedScope,
          selectedCoupon: null,
          session,
        }),
      {
        initialProps: {
          routeLease: { isCurrent: () => firstRouteIsCurrent },
        },
      },
    );

    act(() => void result.current.startReservation());
    expect(mockStartReservation).toHaveBeenCalledTimes(1);
    expect(result.current.isReserving).toBe(true);

    firstRouteIsCurrent = false;
    rerender({ routeLease: { isCurrent: () => true } });
    await waitFor(() => expect(result.current.isReserving).toBe(false));
    expect(onError).toHaveBeenLastCalledWith(
      "예약 처리 결과를 확인할 수 없습니다. 예약 내역에서 확인해주세요.",
    );

    act(() => void result.current.startReservation());
    expect(mockStartReservation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveReservation({ status: "stale" });
      await pending;
    });
  });

  it.each([
    [
      "an ambiguous result",
      { status: "ambiguous" as const, error: new Error("unknown outcome") },
    ],
    [
      "an existing ambiguous terminal",
      { status: "locked" as const, terminal: "ambiguous" as const },
    ],
  ])(
    "keeps %s locked across workflow generation changes",
    async (_case, workflowResult) => {
      mockStartReservation.mockResolvedValue(workflowResult);
      const onError = vi.fn();
      const requestAuthentication = vi.fn();
      const { result, rerender } = renderHook(
        ({ routeLease }) =>
          useReservationCreateCommand({
            accommodation,
            availability,
            bookingDates: {
              checkIn: new Date("2026-07-20T00:00:00"),
              checkOut: new Date("2026-07-22T00:00:00"),
              totalPrice: 200000,
            },
            checkoutHandoff,
            guestCounts: {
              adultCount: 2,
              childCount: 0,
              infantCount: 0,
              petCount: 0,
            },
            onError,
            requestAuthentication,
            routeLease,
            scope: authenticatedScope,
            selectedCoupon: null,
            session,
          }),
        {
          initialProps: {
            routeLease: { isCurrent: () => true },
          },
        },
      );

      await act(async () => {
        await result.current.startReservation();
      });

      expect(result.current.isReservationLocked).toBe(true);
      expect(result.current.isReserving).toBe(false);
      expect(onError).toHaveBeenLastCalledWith(
        "예약 처리 결과를 확인할 수 없습니다. 예약 내역에서 확인해주세요.",
      );

      rerender({ routeLease: { isCurrent: () => true } });
      expect(result.current.isReservationLocked).toBe(true);

      await act(async () => {
        await result.current.startReservation();
      });
      expect(mockStartReservation).toHaveBeenCalledTimes(1);
    },
  );
});

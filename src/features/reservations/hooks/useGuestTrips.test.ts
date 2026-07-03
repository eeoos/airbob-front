import { act, renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { ReservationFilterType } from "../../../types/reservation";
import { useGuestTrips } from "./useGuestTrips";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  reservationApi: {
    getMyReservations: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

const createGuestReservation = (reservationId: number) =>
  ({
    reservation_id: reservationId,
    reservation_uid: `guest-${reservationId}`,
    check_in_date: "2026-07-10",
    check_out_date: "2026-07-12",
    created_at: "2026-07-01",
    accommodation: {
      id: reservationId,
      name: `숙소 ${reservationId}`,
      thumbnail_url: null,
    },
  } as any);

describe("useGuestTrips", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(reservationApi.getMyReservations).mockReset();
  });

  it("fetches the first guest reservation page for the selected filter", async () => {
    const firstReservation = createGuestReservation(1);
    jest.mocked(reservationApi.getMyReservations).mockResolvedValue({
      page_info: {
        has_next: true,
        next_cursor: "cursor-1",
      },
      reservations: [firstReservation],
    } as any);

    const { result } = renderHook(() => useGuestTrips("UPCOMING"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getMyReservations).toHaveBeenCalledWith({
      filterType: "UPCOMING",
      size: 20,
    });
    expect(result.current.reservations).toEqual([firstReservation]);
    expect(result.current.hasNext).toBe(true);
  });

  it("appends the next guest reservation page when loadMore is called", async () => {
    const firstReservation = createGuestReservation(1);
    const secondReservation = createGuestReservation(2);
    jest
      .mocked(reservationApi.getMyReservations)
      .mockResolvedValueOnce({
        page_info: {
          has_next: true,
          next_cursor: "cursor-1",
        },
        reservations: [firstReservation],
      } as any)
      .mockResolvedValueOnce({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [secondReservation],
      } as any);

    const { result } = renderHook(() => useGuestTrips("PAST"));

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(reservationApi.getMyReservations).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      filterType: "PAST",
      size: 20,
    });
    expect(result.current.reservations).toEqual([
      firstReservation,
      secondReservation,
    ]);
    expect(result.current.hasNext).toBe(false);
  });

  it("routes fetch errors through the shared API error hook", async () => {
    const error = new Error("guest reservations failed");
    jest.mocked(reservationApi.getMyReservations).mockRejectedValue(error);

    const { result } = renderHook(() => useGuestTrips("CANCELLED"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
  });

  it("keeps the latest filter results when an older request resolves last", async () => {
    let resolveUpcoming!: (response: unknown) => void;
    let resolvePast!: (response: unknown) => void;

    const upcomingRequest = new Promise((resolve) => {
      resolveUpcoming = resolve;
    });
    const pastRequest = new Promise((resolve) => {
      resolvePast = resolve;
    });

    jest
      .mocked(reservationApi.getMyReservations)
      .mockReturnValueOnce(upcomingRequest as never)
      .mockReturnValueOnce(pastRequest as never);

    const { result, rerender } = renderHook(
      ({ filterType }: { filterType: ReservationFilterType }) =>
        useGuestTrips(filterType),
      { initialProps: { filterType: "UPCOMING" as ReservationFilterType } }
    );

    rerender({ filterType: "PAST" as ReservationFilterType });

    await act(async () => {
      resolvePast({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(2)],
      });
    });

    await waitFor(() =>
      expect(result.current.reservations[0]?.reservation_uid).toBe("guest-2")
    );

    await act(async () => {
      resolveUpcoming({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(1)],
      });
    });

    expect(result.current.reservations[0]?.reservation_uid).toBe("guest-2");
  });

  it("ignores an older rejected first-page request after the filter changes", async () => {
    let rejectUpcoming!: (error: Error) => void;
    let resolvePast!: (response: unknown) => void;

    const upcomingRequest = new Promise((_, reject) => {
      rejectUpcoming = reject;
    });
    const pastRequest = new Promise((resolve) => {
      resolvePast = resolve;
    });

    jest
      .mocked(reservationApi.getMyReservations)
      .mockReturnValueOnce(upcomingRequest as never)
      .mockReturnValueOnce(pastRequest as never);

    const { result, rerender } = renderHook(
      ({ filterType }: { filterType: ReservationFilterType }) =>
        useGuestTrips(filterType),
      { initialProps: { filterType: "UPCOMING" as ReservationFilterType } }
    );

    rerender({ filterType: "PAST" as ReservationFilterType });

    await act(async () => {
      resolvePast({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(2)],
      });
    });

    await waitFor(() =>
      expect(result.current.reservations[0]?.reservation_uid).toBe("guest-2")
    );

    await act(async () => {
      rejectUpcoming(new Error("stale first page failed"));
      await Promise.resolve();
    });

    expect(mockHandleError).not.toHaveBeenCalled();
    expect(result.current.reservations[0]?.reservation_uid).toBe("guest-2");
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores an older load-more response after the filter changes", async () => {
    let resolveLoadMore!: (response: unknown) => void;
    let resolvePast!: (response: unknown) => void;

    const loadMoreRequest = new Promise((resolve) => {
      resolveLoadMore = resolve;
    });
    const pastRequest = new Promise((resolve) => {
      resolvePast = resolve;
    });

    jest
      .mocked(reservationApi.getMyReservations)
      .mockResolvedValueOnce({
        page_info: {
          has_next: true,
          next_cursor: "cursor-1",
        },
        reservations: [createGuestReservation(1)],
      } as any)
      .mockReturnValueOnce(loadMoreRequest as never)
      .mockReturnValueOnce(pastRequest as never);

    const { result, rerender } = renderHook(
      ({ filterType }: { filterType: ReservationFilterType }) =>
        useGuestTrips(filterType),
      { initialProps: { filterType: "UPCOMING" as ReservationFilterType } }
    );

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    let loadMorePromise!: Promise<void>;
    await act(async () => {
      loadMorePromise = result.current.loadMore();
      await Promise.resolve();
    });

    rerender({ filterType: "PAST" as ReservationFilterType });

    await act(async () => {
      resolvePast({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(3)],
      });
    });

    await waitFor(() =>
      expect(result.current.reservations[0]?.reservation_uid).toBe("guest-3")
    );

    await act(async () => {
      resolveLoadMore({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(2)],
      });
      await loadMorePromise;
    });

    expect(result.current.reservations.map((reservation) => reservation.reservation_uid)).toEqual([
      "guest-3",
    ]);
  });

  it("ignores an older rejected load-more request after the filter changes", async () => {
    let rejectLoadMore!: (error: Error) => void;
    let resolvePast!: (response: unknown) => void;

    const loadMoreRequest = new Promise((_, reject) => {
      rejectLoadMore = reject;
    });
    const pastRequest = new Promise((resolve) => {
      resolvePast = resolve;
    });

    jest
      .mocked(reservationApi.getMyReservations)
      .mockResolvedValueOnce({
        page_info: {
          has_next: true,
          next_cursor: "cursor-1",
        },
        reservations: [createGuestReservation(1)],
      } as any)
      .mockReturnValueOnce(loadMoreRequest as never)
      .mockReturnValueOnce(pastRequest as never);

    const { result, rerender } = renderHook(
      ({ filterType }: { filterType: ReservationFilterType }) =>
        useGuestTrips(filterType),
      { initialProps: { filterType: "UPCOMING" as ReservationFilterType } }
    );

    await waitFor(() => expect(result.current.hasNext).toBe(true));
    mockHandleError.mockClear();

    let loadMorePromise!: Promise<void>;
    await act(async () => {
      loadMorePromise = result.current.loadMore();
      await Promise.resolve();
    });

    rerender({ filterType: "PAST" as ReservationFilterType });

    await act(async () => {
      resolvePast({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(3)],
      });
    });

    await waitFor(() =>
      expect(result.current.reservations[0]?.reservation_uid).toBe("guest-3")
    );

    await act(async () => {
      rejectLoadMore(new Error("stale load-more failed"));
      await loadMorePromise;
    });

    expect(mockHandleError).not.toHaveBeenCalled();
    expect(result.current.reservations.map((reservation) => reservation.reservation_uid)).toEqual([
      "guest-3",
    ]);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("does not start duplicate load-more requests for the same cursor", async () => {
    let resolveLoadMore!: (response: unknown) => void;

    const loadMoreRequest = new Promise((resolve) => {
      resolveLoadMore = resolve;
    });

    jest
      .mocked(reservationApi.getMyReservations)
      .mockResolvedValueOnce({
        page_info: {
          has_next: true,
          next_cursor: "cursor-1",
        },
        reservations: [createGuestReservation(1)],
      } as any)
      .mockReturnValue(loadMoreRequest as never);

    const { result } = renderHook(() => useGuestTrips("UPCOMING"));

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    act(() => {
      void result.current.loadMore();
      void result.current.loadMore();
    });

    expect(reservationApi.getMyReservations).toHaveBeenCalledTimes(2);
    expect(reservationApi.getMyReservations).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      filterType: "UPCOMING",
      size: 20,
    });

    await act(async () => {
      resolveLoadMore({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createGuestReservation(2)],
      });
    });

    expect(result.current.reservations.map((reservation) => reservation.reservation_uid)).toEqual([
      "guest-1",
      "guest-2",
    ]);
  });
});

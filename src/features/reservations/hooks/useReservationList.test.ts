import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { ReservationFilterType } from "../../../types/reservation";
import { useReservationList } from "./useReservationList";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  reservationApi: {
    getHostReservations: jest.fn(),
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

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function QueryClientTestWrapper({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
};

interface TestReservation {
  reservation_uid: string;
}

const createReservation = (reservationId: number): TestReservation => ({
  reservation_uid: `reservation-${reservationId}`,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("useReservationList", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
  });

  it("fetches the first reservation page through TanStack Query", async () => {
    const fetchReservationPage = jest.fn().mockResolvedValue({
      page_info: {
        has_next: true,
        next_cursor: "cursor-1",
      },
      reservations: [createReservation(1)],
    });

    const { result } = renderHook(
      () =>
        useReservationList<TestReservation>(
          "UPCOMING" as ReservationFilterType,
          fetchReservationPage,
        ),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchReservationPage).toHaveBeenCalledWith({
      filterType: "UPCOMING",
      size: 20,
    });
    expect(result.current.reservations).toEqual([createReservation(1)]);
    expect(result.current.hasNext).toBe(true);
  });

  it("appends additional pages and suppresses duplicate load-more requests", async () => {
    let resolveLoadMore!: (response: unknown) => void;
    const loadMoreRequest = new Promise((resolve) => {
      resolveLoadMore = resolve;
    });
    const fetchReservationPage = jest
      .fn()
      .mockResolvedValueOnce({
        page_info: {
          has_next: true,
          next_cursor: "cursor-1",
        },
        reservations: [createReservation(1)],
      })
      .mockReturnValue(loadMoreRequest);

    const { result } = renderHook(
      () =>
        useReservationList<TestReservation>(
          "PAST" as ReservationFilterType,
          fetchReservationPage,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    act(() => {
      void result.current.loadMore();
      void result.current.loadMore();
    });

    expect(fetchReservationPage).toHaveBeenCalledTimes(2);
    expect(fetchReservationPage).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      filterType: "PAST",
      size: 20,
    });

    await act(async () => {
      resolveLoadMore({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createReservation(2)],
      });
    });

    await waitFor(() =>
      expect(result.current.reservations).toEqual([
        createReservation(1),
        createReservation(2),
      ])
    );
    expect(
      result.current.reservations.map(
        (reservation) => reservation.reservation_uid,
      ),
    ).toEqual(["reservation-1", "reservation-2"]);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("keeps the latest filter result when an older first-page request resolves last", async () => {
    let resolveUpcoming!: (response: unknown) => void;
    let resolvePast!: (response: unknown) => void;
    const upcomingRequest = new Promise((resolve) => {
      resolveUpcoming = resolve;
    });
    const pastRequest = new Promise((resolve) => {
      resolvePast = resolve;
    });
    const fetchReservationPage = jest
      .fn()
      .mockReturnValueOnce(upcomingRequest)
      .mockReturnValueOnce(pastRequest);

    const { result, rerender } = renderHook(
      ({ filterType }: { filterType: ReservationFilterType }) =>
        useReservationList<TestReservation>(filterType, fetchReservationPage),
      {
        initialProps: { filterType: "UPCOMING" as ReservationFilterType },
        wrapper: createWrapper(),
      },
    );

    rerender({ filterType: "PAST" as ReservationFilterType });

    await act(async () => {
      resolvePast({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createReservation(2)],
      });
    });

    await waitFor(() =>
      expect(result.current.reservations[0]?.reservation_uid).toBe(
        "reservation-2",
      ),
    );

    await act(async () => {
      resolveUpcoming({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createReservation(1)],
      });
    });

    expect(result.current.reservations[0]?.reservation_uid).toBe(
      "reservation-2",
    );
  });

  it("does not share cached results between custom anonymous fetchers without a scope", async () => {
    const secondRequest = createDeferred<{
      page_info: { has_next: boolean; next_cursor: string | null };
      reservations: TestReservation[];
    }>();
    const firstFetcher = jest.fn().mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [createReservation(1)],
    });
    const secondFetcher = jest.fn().mockReturnValue(secondRequest.promise);
    const wrapper = createWrapper();

    const { result: firstResult } = renderHook(
      () =>
        useReservationList<TestReservation>(
          "UPCOMING" as ReservationFilterType,
          firstFetcher,
        ),
      { wrapper },
    );

    await waitFor(() =>
      expect(firstResult.current.reservations).toEqual([createReservation(1)])
    );

    const { result: secondResult } = renderHook(
      () =>
        useReservationList<TestReservation>(
          "UPCOMING" as ReservationFilterType,
          secondFetcher,
        ),
      { wrapper },
    );

    await waitFor(() => expect(secondFetcher).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(secondResult.current.reservations).toEqual([]);

    await act(async () => {
      secondRequest.resolve({
        page_info: {
          has_next: false,
          next_cursor: null,
        },
        reservations: [createReservation(2)],
      });
    });

    await waitFor(() =>
      expect(secondResult.current.reservations).toEqual([createReservation(2)])
    );
  });

  it("keeps a custom fetcher on a stable cache scope when its identity changes", async () => {
    const fetchReservationPage = jest.fn().mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [createReservation(1)],
    });
    const firstInlineFetcher = (params: {
      size?: number;
      cursor?: string;
      filterType?: ReservationFilterType;
    }) => fetchReservationPage(params);
    const secondInlineFetcher = (params: {
      size?: number;
      cursor?: string;
      filterType?: ReservationFilterType;
    }) => fetchReservationPage(params);

    const { result, rerender } = renderHook(
      ({ fetcher }) =>
        useReservationList<TestReservation>(
          "UPCOMING" as ReservationFilterType,
          fetcher,
        ),
      {
        initialProps: { fetcher: firstInlineFetcher },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() =>
      expect(result.current.reservations).toEqual([createReservation(1)])
    );
    expect(fetchReservationPage).toHaveBeenCalledTimes(1);

    rerender({ fetcher: secondInlineFetcher });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.reservations).toEqual([createReservation(1)]);
    expect(fetchReservationPage).toHaveBeenCalledTimes(1);
  });

  it("routes first-page errors through the shared API error hook", async () => {
    const error = new Error("reservations failed");
    const fetchReservationPage = jest.fn().mockRejectedValue(error);

    const { result } = renderHook(
      () =>
        useReservationList<TestReservation>(
          "CANCELLED" as ReservationFilterType,
          fetchReservationPage,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
  });
});

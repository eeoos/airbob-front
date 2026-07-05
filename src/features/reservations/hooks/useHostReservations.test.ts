import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reservationApi } from "../../../api";
import { ReservationStatus } from "../../../types/enums";
import { useHostReservations } from "./useHostReservations";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  reservationApi: {
    getHostReservations: jest.fn(),
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

const createHostReservation = (reservationId: number, checkInDate: string) =>
  ({
    reservation_uid: `host-${reservationId}`,
    reservation_code: `CODE-${reservationId}`,
    total_price: 100000 + reservationId,
    currency: "KRW",
    guest_count: 2,
    check_in_date: checkInDate,
    check_out_date: "2026-07-12",
    created_at: "2026-07-01",
    status: ReservationStatus.CONFIRMED,
    guest: {
      id: reservationId,
      nickname: `게스트 ${reservationId}`,
    },
    accommodation: {
      id: reservationId,
      name: `숙소 ${reservationId}`,
    },
  } as any);

describe("useHostReservations", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(reservationApi.getHostReservations).mockReset();
  });

  it("fetches the first host reservation page for the selected filter", async () => {
    const firstReservation = createHostReservation(1, "2026-07-10");
    jest.mocked(reservationApi.getHostReservations).mockResolvedValue({
      page_info: {
        has_next: true,
        next_cursor: "cursor-1",
      },
      reservations: [firstReservation],
    } as any);

    const { result } = renderHook(() => useHostReservations("UPCOMING"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getHostReservations).toHaveBeenCalledWith({
      filterType: "UPCOMING",
      size: 20,
    });
    expect(result.current.reservations).toEqual([firstReservation]);
    expect(result.current.hasNext).toBe(true);
  });

  it("appends the next host reservation page when loadMore is called", async () => {
    const firstReservation = createHostReservation(1, "2026-07-10");
    const secondReservation = createHostReservation(2, "2026-07-15");
    jest
      .mocked(reservationApi.getHostReservations)
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

    const { result } = renderHook(() => useHostReservations("PAST"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(reservationApi.getHostReservations).toHaveBeenLastCalledWith({
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
    const error = new Error("host reservations failed");
    jest.mocked(reservationApi.getHostReservations).mockRejectedValue(error);

    const { result } = renderHook(() => useHostReservations("CANCELLED"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
  });
});

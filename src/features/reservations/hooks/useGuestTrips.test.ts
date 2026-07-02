import { act, renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
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
});

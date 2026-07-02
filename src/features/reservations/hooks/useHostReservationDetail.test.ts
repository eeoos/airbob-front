import { renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { ReservationStatus } from "../../../types/enums";
import { useHostReservationDetail } from "./useHostReservationDetail";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  reservationApi: {
    getHostReservationDetail: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

const createHostReservationDetail = (reservationUid = "host-reservation-1") =>
  ({
    reservation_uid: reservationUid,
    reservation_code: "HOST-CODE-1",
    status: ReservationStatus.CONFIRMED,
    created_at: "2026-07-01T00:00:00",
    guest_count: 2,
    check_in_date_time: "2026-07-10T15:00:00",
    check_out_date_time: "2026-07-12T11:00:00",
    accommodation: {
      id: 7,
      name: "테스트 숙소",
      thumbnail_url: null,
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
      thumbnail_image_url: null,
    },
    payment: null,
  } as any);

describe("useHostReservationDetail", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(reservationApi.getHostReservationDetail).mockReset();
  });

  it("loads host reservation detail when uid is provided", async () => {
    const reservation = createHostReservationDetail("host-reservation-123");
    jest
      .mocked(reservationApi.getHostReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(() =>
      useHostReservationDetail("host-reservation-123")
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getHostReservationDetail).toHaveBeenCalledWith(
      "host-reservation-123"
    );
    expect(result.current.reservation).toEqual(reservation);
  });

  it("does not call the API when uid is missing", async () => {
    const { result } = renderHook(() => useHostReservationDetail(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getHostReservationDetail).not.toHaveBeenCalled();
    expect(result.current.reservation).toBeNull();
  });

  it("routes load errors through the shared API error hook", async () => {
    const error = new Error("host reservation failed");
    jest
      .mocked(reservationApi.getHostReservationDetail)
      .mockRejectedValue(error);

    const { result } = renderHook(() =>
      useHostReservationDetail("host-reservation-1")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
    expect(result.current.reservation).toBeNull();
  });
});

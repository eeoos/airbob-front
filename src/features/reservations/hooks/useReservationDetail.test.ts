import { renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { ReservationStatus } from "../../../types/enums";
import { useReservationDetail } from "./useReservationDetail";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  reservationApi: {
    getMyReservationDetail: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

const createReservationDetail = (reservationUid = "reservation-1") =>
  ({
    reservation_uid: reservationUid,
    reservation_code: "CODE-1",
    status: ReservationStatus.CONFIRMED,
    created_at: "2026-07-01T00:00:00",
    guest_count: 2,
    check_in_date_time: "2026-07-10T15:00:00",
    check_out_date_time: "2026-07-12T11:00:00",
    check_in_time: "15:00",
    check_out_time: "11:00",
    can_write_review: true,
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
    coordinate: {
      latitude: 37.5,
      longitude: 127,
    },
    host: {
      id: 1,
      nickname: "호스트",
      thumbnail_image_url: null,
    },
    payment: null,
  } as any);

describe("useReservationDetail", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(reservationApi.getMyReservationDetail).mockReset();
  });

  it("loads guest reservation detail when uid is provided", async () => {
    const reservation = createReservationDetail("reservation-123");
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(() =>
      useReservationDetail("reservation-123")
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getMyReservationDetail).toHaveBeenCalledWith(
      "reservation-123"
    );
    expect(mockClearError).toHaveBeenCalled();
    expect(result.current.reservation).toEqual(reservation);
  });

  it("does not call the API when uid is missing", async () => {
    const { result } = renderHook(() => useReservationDetail(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getMyReservationDetail).not.toHaveBeenCalled();
    expect(result.current.reservation).toBeNull();
  });

  it("routes load errors through the shared API error hook", async () => {
    const error = new Error("reservation failed");
    jest.mocked(reservationApi.getMyReservationDetail).mockRejectedValue(error);

    const { result } = renderHook(() => useReservationDetail("reservation-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
    expect(result.current.reservation).toBeNull();
  });
});

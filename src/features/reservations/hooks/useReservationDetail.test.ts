import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reservationApi } from "../../../api";
import { ApiClientError } from "../../../api/response";
import { ReservationStatus } from "../../../types/enums";
import { useReservationDetail } from "./useReservationDetail";

let queryClient: QueryClient;

const createWrapper = () => {
  queryClient = new QueryClient({
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

jest.mock("../../../api", () => ({
  reservationApi: {
    getMyReservationDetail: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => {
  const React = require("react") as typeof import("react");
  const reservationErrorMessages: Record<string, string> = {
    R008: "해당 예약에 대한 접근 권한이 없습니다.",
  };

  return {
    useApiError: () => {
      const [error, setError] = React.useState<string | null>(null);
      const clearError = React.useCallback(() => setError(null), []);
      const handleError = React.useCallback((err: unknown) => {
        const message =
          err &&
          typeof err === "object" &&
          "code" in err &&
          typeof err.code === "string"
            ? reservationErrorMessages[err.code] ??
              (err instanceof Error ? err.message : "오류가 발생했습니다.")
            : err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다.";

        setError(message);
        return message;
      }, []);

      return {
        clearError,
        error,
        handleError,
      };
    },
  };
});

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
    jest.mocked(reservationApi.getMyReservationDetail).mockReset();
    queryClient?.clear();
  });

  it("loads guest reservation detail when uid is provided", async () => {
    const reservation = createReservationDetail("reservation-123");
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(
      () => useReservationDetail("reservation-123"),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getMyReservationDetail).toHaveBeenCalledWith(
      "reservation-123"
    );
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reservation).toEqual(reservation);
  });

  it("does not call the API when uid is missing", async () => {
    const { result } = renderHook(() => useReservationDetail(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getMyReservationDetail).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(false);
    expect(result.current.reservation).toBeNull();
  });

  it("routes load errors through the shared API error hook", async () => {
    const error = new ApiClientError({
      code: "R008",
      message: "backend reservation access denied",
      status: 403,
    });
    jest.mocked(reservationApi.getMyReservationDetail).mockRejectedValue(error);

    const { result } = renderHook(
      () => useReservationDetail("reservation-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(result.current.error).toBe("해당 예약에 대한 접근 권한이 없습니다."),
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.reservation).toBeNull();
  });

  it("clears cached reservation data when reload fails after a success", async () => {
    const reservation = createReservationDetail("reservation-1");
    const error = new Error("reload failed");
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValueOnce(reservation)
      .mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useReservationDetail("reservation-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.reservation).toEqual(reservation));

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.reservation).toBeNull());
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe("reload failed");
  });
});

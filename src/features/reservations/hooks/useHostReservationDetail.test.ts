import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reservationApi } from "../../../api";
import { ApiClientError } from "../../../api/response";
import { ReservationStatus } from "../../../types/enums";
import { useHostReservationDetail } from "./useHostReservationDetail";

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
    getHostReservationDetail: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => {
  const React = require("react") as typeof import("react");
  const reservationErrorMessages: Record<string, string> = {
    R001: "존재하지 않는 예약입니다.",
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
    jest.mocked(reservationApi.getHostReservationDetail).mockReset();
    queryClient?.clear();
  });

  it("loads host reservation detail when uid is provided", async () => {
    const reservation = createHostReservationDetail("host-reservation-123");
    jest
      .mocked(reservationApi.getHostReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(
      () => useHostReservationDetail("host-reservation-123"),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getHostReservationDetail).toHaveBeenCalledWith(
      "host-reservation-123"
    );
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reservation).toEqual(reservation);
  });

  it("does not call the API when uid is missing", async () => {
    const { result } = renderHook(() => useHostReservationDetail(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getHostReservationDetail).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(false);
    expect(result.current.reservation).toBeNull();
  });

  it("routes load errors through the shared API error hook", async () => {
    const error = new ApiClientError({
      code: "R001",
      message: "backend reservation missing",
      status: 404,
    });
    jest
      .mocked(reservationApi.getHostReservationDetail)
      .mockRejectedValue(error);

    const { result } = renderHook(
      () => useHostReservationDetail("host-reservation-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(result.current.error).toBe("존재하지 않는 예약입니다."),
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.reservation).toBeNull();
  });

  it("clears cached reservation data when reload fails after a success", async () => {
    const reservation = createHostReservationDetail("host-reservation-1");
    const error = new Error("host reload failed");
    jest
      .mocked(reservationApi.getHostReservationDetail)
      .mockResolvedValueOnce(reservation)
      .mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useHostReservationDetail("host-reservation-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.reservation).toEqual(reservation));

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.reservation).toBeNull());
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe("host reload failed");
  });
});

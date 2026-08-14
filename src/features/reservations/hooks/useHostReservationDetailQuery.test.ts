import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reservationApi } from "../../../api";
import { ReservationStatus } from "../../../types/enums";
import { useHostReservationDetailQuery } from "./useHostReservationDetailQuery";

jest.mock("../../../api", () => ({
  reservationApi: {
    getHostReservationDetail: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function QueryClientTestWrapper({
    children,
  }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
};

const reservation = {
  reservation_uid: "host-reservation-1",
  reservation_code: "HOST-CODE-1",
  status: ReservationStatus.CONFIRMED,
} as any;

describe("useHostReservationDetailQuery", () => {
  beforeEach(() => {
    jest.mocked(reservationApi.getHostReservationDetail).mockReset();
  });

  it("loads host reservation detail through the reservation API", async () => {
    jest
      .mocked(reservationApi.getHostReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(
      () => useHostReservationDetailQuery("host-reservation-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(reservationApi.getHostReservationDetail).toHaveBeenCalledWith(
      "host-reservation-1",
    );
    expect(result.current.data).toEqual(reservation);
  });

  it("does not call the API when the reservation uid is missing", async () => {
    const { result } = renderHook(
      () => useHostReservationDetailQuery(undefined),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getHostReservationDetail).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});

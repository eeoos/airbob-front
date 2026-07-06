import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reservationApi } from "../../../api";
import { ReservationStatus } from "../../../types/enums";
import { ReservationDetailInfo } from "../../../types/reservation";
import { reservationQueryKeys } from "../queryKeys";
import { useReservationDetailQuery } from "./useReservationDetailQuery";

jest.mock("../../../api", () => ({
  reservationApi: {
    getMyReservationDetail: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
};

const createReservationDetail = (
  reservationUid = "reservation-1",
): ReservationDetailInfo => ({
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
});

describe("useReservationDetailQuery", () => {
  beforeEach(() => {
    jest.mocked(reservationApi.getMyReservationDetail).mockReset();
  });

  it("loads guest reservation detail under the shared query key", async () => {
    const reservation = createReservationDetail("reservation-123");
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => useReservationDetailQuery("reservation-123"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(reservationApi.getMyReservationDetail).toHaveBeenCalledWith(
      "reservation-123",
    );
    expect(
      queryClient.getQueryData(
        reservationQueryKeys.guestReservationDetail("reservation-123"),
      ),
    ).toEqual(reservation);
  });

  it("does not fetch when uid is missing", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useReservationDetailQuery(undefined), {
      wrapper,
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

    expect(reservationApi.getMyReservationDetail).not.toHaveBeenCalled();
  });
});

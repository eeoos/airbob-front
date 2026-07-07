import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { reservationApi } from "../../../../api";
import type { AccommodationDetail } from "../../../../types/accommodation";
import { toReservationModalAccommodationViewModel } from "../../lib/reservationModalViewModel";
import ReservationModal from "./ReservationModal";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true },
);

jest.mock("../../../../api", () => ({
  reservationApi: {
    create: jest.fn(),
  },
}));

jest.mock("../../../../hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

jest.mock("../../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    handleError: jest.fn(),
    clearError: jest.fn(),
  }),
}));

const accommodationDetail: AccommodationDetail = {
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "ENTIRE_PLACE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
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
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};
const accommodation = toReservationModalAccommodationViewModel(
  accommodationDetail,
);

describe("ReservationModal", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockNavigate.mockReset();
    jest.mocked(reservationApi.create).mockReset();
  });

  it("renders reservation content inside the shared accessible dialog", () => {
    render(
      <ReservationModal
        isOpen={true}
        onClose={jest.fn()}
        accommodation={accommodation}
        checkIn={new Date(2026, 6, 10)}
        checkOut={new Date(2026, 6, 12)}
        adultCount={2}
        childCount={0}
        infantCount={0}
        petCount={0}
      />
    );

    expect(
      screen.getByRole("dialog", { name: "예약 확인" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("creates checkout state and routes payment through the confirm page", async () => {
    jest.mocked(reservationApi.create).mockResolvedValue({
      reservation_uid: "res-123",
      order_name: "테스트 숙소",
      amount: 200000,
      customer_email: "user@example.com",
      customer_name: "홍길동",
    });

    render(
      <ReservationModal
        isOpen={true}
        onClose={jest.fn()}
        accommodation={accommodation}
        checkIn={new Date(2026, 6, 10)}
        checkOut={new Date(2026, 6, 12)}
        adultCount={2}
        childCount={0}
        infantCount={0}
        petCount={0}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "확인 및 결제" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/accommodations/7/confirm", {
        state: expect.objectContaining({
          reservationUid: "res-123",
          orderName: "테스트 숙소",
          amount: 200000,
          customerEmail: "user@example.com",
          customerName: "홍길동",
          checkIn: "2026-07-10",
          checkOut: "2026-07-12",
          adultOccupancy: 2,
          childOccupancy: 0,
          infantOccupancy: 0,
          petOccupancy: 0,
        }),
      });
    });

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-10",
      check_out_date: "2026-07-12",
      guest_count: 2,
    });
    expect(
      JSON.parse(sessionStorage.getItem("airbob:reservation-checkout:7") ?? "{}")
    ).toEqual(
      expect.objectContaining({
        reservationUid: "res-123",
        customerEmail: "user@example.com",
      })
    );
  });
});

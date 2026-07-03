import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { reservationApi } from "../../../../api";
import { AccommodationDetail } from "../../../../types/accommodation";
import ReservationModal from "./ReservationModal";

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

const accommodation: AccommodationDetail = {
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

describe("ReservationModal", () => {
  const originalClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;

  beforeEach(() => {
    jest.mocked(reservationApi.create).mockReset();
    process.env.REACT_APP_TOSS_CLIENT_KEY = "test_ck_123";
  });

  afterEach(() => {
    process.env.REACT_APP_TOSS_CLIENT_KEY = originalClientKey;
    delete (window as any).TossPayments;
    document
      .querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
      .forEach((script) => script.remove());
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

  it("mounts the Toss payment widget container before rendering payment methods", async () => {
    let widgetContainerAtRender: Element | null = null;
    const renderPaymentMethods = jest.fn().mockImplementation(() => {
      widgetContainerAtRender = document.querySelector("#payment-widget");
      return Promise.resolve();
    });
    const requestPayment = jest.fn();
    const widgets = jest.fn(() => ({ renderPaymentMethods }));
    (window as any).TossPayments = jest.fn(() => ({
      widgets,
      requestPayment,
    }));
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

    await waitFor(() => expect(renderPaymentMethods).toHaveBeenCalled());

    expect(widgetContainerAtRender).not.toBeNull();
  });
});

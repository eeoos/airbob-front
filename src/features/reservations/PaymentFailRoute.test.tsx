import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { PaymentFailRoute } from "./PaymentFailRoute";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockClearReservationCheckoutStateByReservationUid = jest.fn();

jest.mock("./lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentFailRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
  });

  it("clears checkout state when failure reason is missing", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("keeps checkout state when confirmation failed retryably", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reason="confirm-failed"
        reservationUid="reservation-123"
      />,
    );

    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });

  it("clears checkout state when the callback was invalid", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reason="invalid-callback"
        reservationUid="reservation-123"
      />,
    );

    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("routes users back to profile or reservation detail from the failure page", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "프로필로 이동" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 상세 보기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/profile");
    expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123");
  });
});

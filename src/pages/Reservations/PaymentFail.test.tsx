import React from "react";
import { render } from "@testing-library/react";
import PaymentFail from "./PaymentFail";

const mockNavigate = jest.fn();
const mockClearReservationCheckoutStateByReservationUid = jest.fn();
let mockReservationUid: string | undefined = "reservation-123";
let mockSearchParams = new URLSearchParams();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: mockReservationUid }),
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock("../../features/reservations/lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentFail", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
    mockReservationUid = "reservation-123";
    mockSearchParams = new URLSearchParams();
  });

  it("clears checkout state when failure reason is missing", () => {
    render(<PaymentFail />);

    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123"
    );
  });

  it("keeps checkout state when confirmation failed retryably", () => {
    mockSearchParams = new URLSearchParams("reason=confirm-failed");

    render(<PaymentFail />);

    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });

  it("clears checkout state when the callback was invalid", () => {
    mockSearchParams = new URLSearchParams("reason=invalid-callback");

    render(<PaymentFail />);

    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123"
    );
  });
});

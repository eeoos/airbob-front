import React from "react";
import { render } from "@testing-library/react";
import PaymentFail from "./PaymentFail";

const mockNavigate = jest.fn();
const mockPaymentFailRoute = jest.fn((_props: unknown) => null);
let mockReservationUid: string | undefined = "reservation-123";
let mockSearchParams = new URLSearchParams();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: mockReservationUid }),
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock("../../features/reservations", () => ({
  PaymentFailRoute: (props: unknown) => mockPaymentFailRoute(props),
}));

describe("PaymentFail", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPaymentFailRoute.mockClear();
    mockReservationUid = "reservation-123";
    mockSearchParams = new URLSearchParams();
  });

  it("passes router primitives to the payment failure feature route", () => {
    mockSearchParams = new URLSearchParams("reason=confirm-failed");

    render(<PaymentFail />);

    expect(mockPaymentFailRoute).toHaveBeenCalledWith({
      navigate: mockNavigate,
      reason: "confirm-failed",
      reservationUid: "reservation-123",
    });
  });

  it("passes undefined reason when no failure reason is present", () => {
    render(<PaymentFail />);

    expect(mockPaymentFailRoute).toHaveBeenCalledWith({
      navigate: mockNavigate,
      reason: undefined,
      reservationUid: "reservation-123",
    });
  });
});

import React from "react";
import { render } from "@testing-library/react";
import PaymentSuccess from "./PaymentSuccess";

const mockNavigate = jest.fn();
const mockPaymentSuccessRoute = jest.fn((_props: unknown) => null);
let mockReservationUid: string | undefined = "reservation-123";
let mockSearchParams = new URLSearchParams({
  amount: "120000",
  orderId: "reservation-123",
  paymentKey: "payment-key-1",
});

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: mockReservationUid }),
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock("../../features/reservations", () => ({
  PaymentSuccessRoute: (props: unknown) => mockPaymentSuccessRoute(props),
}));

describe("PaymentSuccess", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPaymentSuccessRoute.mockClear();
    mockReservationUid = "reservation-123";
    mockSearchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });
  });

  it("passes router primitives to the payment success feature route", () => {
    mockReservationUid = undefined;

    render(<PaymentSuccess />);

    expect(mockPaymentSuccessRoute).toHaveBeenCalledWith({
      navigate: mockNavigate,
      reservationUid: undefined,
      searchParams: mockSearchParams,
    });
  });
});

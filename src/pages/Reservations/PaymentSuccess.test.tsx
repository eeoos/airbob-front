import React from "react";
import { render, waitFor } from "@testing-library/react";
import PaymentSuccess from "./PaymentSuccess";

const mockNavigate = jest.fn();
const mockUsePaymentConfirmation = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: "reservation-123" }),
  useSearchParams: () => [
    new URLSearchParams({
      amount: "120000x",
      orderId: "order-1",
      paymentKey: "payment-key-1",
    }),
  ],
}), { virtual: true });

jest.mock("../../features/reservations", () => ({
  usePaymentConfirmation: (options: unknown) =>
    mockUsePaymentConfirmation(options),
}));

describe("PaymentSuccess", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUsePaymentConfirmation.mockReset();
  });

  it("routes malformed payment confirmation results to the failure page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "invalid",
      },
    });

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail"
      );
    });
  });
});

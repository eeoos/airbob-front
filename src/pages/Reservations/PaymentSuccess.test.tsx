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

  it("routes confirmed payment confirmation to the reservation detail page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "confirmed",
      },
    });

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123");
    });
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

  it("routes failed payment confirmation to the failure page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: new Error("confirm failed"),
        status: "failed",
      },
    });

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail"
      );
    });
  });

  it("routes skipped payment confirmation to the failure page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "skipped",
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

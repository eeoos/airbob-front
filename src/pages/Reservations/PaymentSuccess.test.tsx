import React from "react";
import { render, waitFor } from "@testing-library/react";
import PaymentSuccess from "./PaymentSuccess";

const mockNavigate = jest.fn();
const mockUsePaymentConfirmation = jest.fn();
let mockReservationUid: string | undefined = "reservation-123";
let mockSearchParams = new URLSearchParams({
  amount: "120000x",
  orderId: "order-1",
  paymentKey: "payment-key-1",
});

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: mockReservationUid }),
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock("../../features/reservations", () => ({
  usePaymentConfirmation: (options: unknown) =>
    mockUsePaymentConfirmation(options),
}));

describe("PaymentSuccess", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUsePaymentConfirmation.mockReset();
    mockReservationUid = "reservation-123";
    mockSearchParams = new URLSearchParams({
      amount: "120000x",
      orderId: "order-1",
      paymentKey: "payment-key-1",
    });
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

  it("disables confirmation and routes to failure when Toss success query is incomplete", async () => {
    mockSearchParams = new URLSearchParams({
      amount: "120000",
      orderId: "order-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      result: null,
    });

    render(<PaymentSuccess />);

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: null,
      enabled: false,
      orderId: null,
      paymentKey: null,
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail"
      );
    });
  });
});

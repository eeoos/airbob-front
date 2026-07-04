import React from "react";
import { render, waitFor } from "@testing-library/react";
import PaymentSuccess from "./PaymentSuccess";

const mockNavigate = jest.fn();
const mockUsePaymentConfirmation = jest.fn();
const mockClearReservationCheckoutStateByReservationUid = jest.fn();
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
  usePaymentConfirmation: (options: unknown) =>
    mockUsePaymentConfirmation(options),
}));

jest.mock("../../features/reservations/lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentSuccess", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUsePaymentConfirmation.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
    mockReservationUid = "reservation-123";
    mockSearchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-123",
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

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: "120000",
      enabled: true,
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123", {
        replace: true,
      });
    });
  });

  it("routes confirmed payment confirmation even if checkout cleanup throws", async () => {
    mockClearReservationCheckoutStateByReservationUid.mockImplementation(() => {
      throw new Error("cleanup failed");
    });
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "confirmed",
      },
    });

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123", {
        replace: true,
      });
    });
  });

  it("routes malformed payment confirmation results to the failure page", async () => {
    mockSearchParams = new URLSearchParams({
      amount: "120000x",
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "invalid",
      },
    });

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail",
        { replace: true }
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
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail",
        { replace: true }
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
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail",
        { replace: true }
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
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail",
        { replace: true }
      );
    });
  });

  it("disables confirmation and routes to failure when Toss orderId mismatches the route reservationUid", async () => {
    mockSearchParams = new URLSearchParams({
      amount: "120000",
      orderId: "other-reservation",
      paymentKey: "payment-key-1",
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
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123"
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail",
        { replace: true }
      );
    });
  });

  it("routes missing reservationUid to profile with replacement history", async () => {
    mockReservationUid = undefined;
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
      expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/profile", {
        replace: true,
      });
    });
  });
});

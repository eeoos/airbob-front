import React from "react";
import { render, waitFor } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { PaymentSuccessRoute } from "./PaymentSuccessRoute";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockUsePaymentConfirmation = jest.fn();
const mockClearReservationCheckoutStateByReservationUid = jest.fn();
let searchParams = new URLSearchParams({
  amount: "120000",
  orderId: "reservation-123",
  paymentKey: "payment-key-1",
});

jest.mock("./hooks/usePaymentConfirmation", () => ({
  usePaymentConfirmation: (options: unknown) =>
    mockUsePaymentConfirmation(options),
}));

jest.mock("./lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentSuccessRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUsePaymentConfirmation.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });
  });

  const renderRoute = (reservationUid?: string) =>
    render(
      <PaymentSuccessRoute
        navigate={mockNavigate}
        reservationUid={reservationUid ?? "reservation-123"}
        searchParams={searchParams}
      />,
    );

  it("routes confirmed payment confirmation to the reservation detail page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "confirmed",
      },
    });

    renderRoute();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: "120000",
      enabled: true,
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
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

    renderRoute();

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
      );
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123", {
        replace: true,
      });
    });
  });

  it("routes malformed payment confirmation results to the invalid callback failure page", async () => {
    searchParams = new URLSearchParams({
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

    renderRoute();

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      );
    });
  });

  it("preserves checkout state and routes retryable confirmation failures to the confirm failed page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: new Error("confirm failed"),
        retryable: true,
        status: "failed",
      },
    });

    renderRoute();

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=confirm-failed",
        { replace: true },
      );
    });
  });

  it("clears checkout state and routes non-retryable confirmation failures to the confirm failed page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: new Error("confirm failed"),
        retryable: false,
        status: "failed",
      },
    });

    renderRoute();

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=confirm-failed",
        { replace: true },
      );
    });
  });

  it("routes skipped payment confirmation to the invalid callback failure page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: {
        error: null,
        status: "skipped",
      },
    });

    renderRoute();

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      );
    });
  });

  it("disables confirmation and routes to failure when Toss success query is incomplete", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "order-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      result: null,
    });

    renderRoute();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: null,
      enabled: false,
      orderId: null,
      paymentKey: null,
    });

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      );
    });
  });

  it("disables confirmation and routes to failure when Toss orderId mismatches the route reservationUid", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "other-reservation",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      result: null,
    });

    renderRoute();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: null,
      enabled: false,
      orderId: null,
      paymentKey: null,
    });

    await waitFor(() => {
      expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
        "reservation-123",
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      );
    });
  });

  it("routes missing reservationUid to profile with replacement history", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      result: null,
    });

    render(
      <PaymentSuccessRoute
        navigate={mockNavigate}
        reservationUid={undefined}
        searchParams={searchParams}
      />,
    );

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

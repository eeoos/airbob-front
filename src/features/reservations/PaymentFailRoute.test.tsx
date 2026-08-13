import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  type NavigateFunction,
} from "react-router-dom";
import { ROUTE_PATHS } from "../../routes/paths";
import { PaymentFailRoute } from "./PaymentFailRoute";
import { PaymentSuccessRoute } from "./PaymentSuccessRoute";
import type { usePaymentConfirmation } from "./hooks/usePaymentConfirmation";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockClearReservationCheckoutStateByReservationUid = jest.fn();
const mockUsePaymentConfirmation = jest.fn<
  ReturnType<typeof usePaymentConfirmation>,
  Parameters<typeof usePaymentConfirmation>
>();

jest.mock("./hooks/usePaymentConfirmation", () => ({
  usePaymentConfirmation: (
    options: Parameters<typeof usePaymentConfirmation>[0],
  ) => mockUsePaymentConfirmation(options),
}));

jest.mock("./lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentFailRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
    mockUsePaymentConfirmation.mockReset();
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: true,
      result: null,
    });
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

  it("routes a retryable confirmation failure back to the success callback with preserved values", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reason="confirm-failed"
        reservationUid="reservation-123"
        searchParams={
          new URLSearchParams({
            amount: "120000",
            orderId: "reservation-123",
            paymentKey: "payment-key-1",
          })
        }
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "결제 승인 다시 시도" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/reservations/reservation-123/success?paymentKey=payment-key-1&orderId=reservation-123&amount=120000",
    );
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });

  it("preserves retry values through the real fail-to-success router handoff", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            "/reservations/reservation-123/fail?reason=confirm-failed&paymentKey=payment-key-1&orderId=reservation-123&amount=120000",
          ]}
        >
          <Routes>
            <Route path={ROUTE_PATHS.paymentFail} element={<PaymentFailRoute />} />
            <Route
              path={ROUTE_PATHS.paymentSuccess}
              element={<PaymentSuccessRoute />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "결제 승인 다시 시도" }),
    );

    await waitFor(() =>
      expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
        amount: "120000",
        enabled: true,
        orderId: "reservation-123",
        paymentKey: "payment-key-1",
      }),
    );
  });

  it("does not offer confirmation retry when the preserved orderId mismatches the reservation", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reason="confirm-failed"
        reservationUid="reservation-123"
        searchParams={
          new URLSearchParams({
            amount: "120000",
            orderId: "another-reservation",
            paymentKey: "payment-key-1",
          })
        }
      />,
    );

    expect(
      screen.queryByRole("button", { name: "결제 승인 다시 시도" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer confirmation retry for an invalid callback failure", () => {
    render(
      <PaymentFailRoute
        navigate={mockNavigate}
        reason="invalid-callback"
        reservationUid="reservation-123"
        searchParams={
          new URLSearchParams({
            amount: "120000",
            orderId: "reservation-123",
            paymentKey: "payment-key-1",
          })
        }
      />,
    );

    expect(
      screen.queryByRole("button", { name: "결제 승인 다시 시도" }),
    ).not.toBeInTheDocument();
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

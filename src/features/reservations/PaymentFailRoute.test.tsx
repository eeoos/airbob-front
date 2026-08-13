import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { PaymentFailRoute } from "./PaymentFailRoute";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockClearReservationCheckoutStateByReservationUid = jest.fn();
const mockCheckPaymentStatus = jest.fn();

jest.mock("./hooks/usePaymentStatus", () => ({
  usePaymentStatus: () => ({
    checkPaymentStatus: mockCheckPaymentStatus,
  }),
}));

jest.mock("./lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentFailRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
    mockCheckPaymentStatus.mockReset();
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

  it("reconciles a retryable confirmation failure and redirects only after payment is done", async () => {
    mockCheckPaymentStatus.mockResolvedValue("done");

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
      screen.getByRole("button", { name: "결제 상태 확인" }),
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123",
      ),
    );
    expect(mockCheckPaymentStatus).toHaveBeenCalledWith({
      amount: 120000,
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("keeps checkout state when payment is still processing", async () => {
    mockCheckPaymentStatus.mockResolvedValue("pending");

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

    fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));

    await waitFor(() =>
      expect(
        screen.getByText("결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요."),
      ).toBeVisible(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });

  it("keeps checkout state and reports a status lookup failure", async () => {
    mockCheckPaymentStatus.mockRejectedValue(new Error("status lookup failed"));

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

    fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));

    await waitFor(() =>
      expect(
        screen.getByText("결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요."),
      ).toBeVisible(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });

  it("ignores a late status result after the callback session changes", async () => {
    let resolveStatus: (status: "done" | "pending" | "error") => void = () => {
      return undefined;
    };
    mockCheckPaymentStatus.mockReturnValue(
      new Promise<"done" | "pending" | "error">((resolve) => {
        resolveStatus = resolve;
      }),
    );

    const view = render(
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

    fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));
    view.rerender(
      <PaymentFailRoute
        navigate={mockNavigate}
        reason="confirm-failed"
        reservationUid="reservation-456"
        searchParams={
          new URLSearchParams({
            amount: "120000",
            orderId: "reservation-456",
            paymentKey: "payment-key-2",
          })
        }
      />,
    );

    await act(async () => {
      resolveStatus("done");
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
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
      screen.queryByRole("button", { name: "결제 상태 확인" }),
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
      screen.queryByRole("button", { name: "결제 상태 확인" }),
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

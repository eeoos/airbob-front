import { fireEvent, render, screen } from "@testing-library/react";
import { PaymentResultScreen } from "./PaymentResultScreen";

describe("PaymentResultScreen", () => {
  it("renders processing without an authority-changing action", () => {
    render(<PaymentResultScreen mode="processing" />);

    expect(
      screen.getByRole("heading", {
        name: "결제 상태를 확인하고 있습니다...",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders non-secret recovery identifiers for a review result", () => {
    render(
      <PaymentResultScreen
        identifiers={{
          operationId: "operation-safe-id",
          reservationUid: "reservation-safe-id",
        }}
        mode="review"
        onOpenReservation={() => undefined}
      />,
    );

    expect(screen.getByText("operation-safe-id")).toBeVisible();
    expect(screen.getByText("reservation-safe-id")).toBeVisible();
    expect(screen.queryByText(/paymentKey/i)).not.toBeInTheDocument();
  });

  it("delegates explicit retry and acknowledgement actions", () => {
    const onRetry = vi.fn();
    const onAcknowledge = vi.fn();
    const { rerender } = render(
      <PaymentResultScreen mode="recovery-unavailable" onRetry={onRetry} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <PaymentResultScreen mode="success" onAcknowledge={onAcknowledge} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "확인하고 예약 보기" }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("disables a busy recovery action", () => {
    render(
      <PaymentResultScreen
        isBusy
        mode="recovery-unavailable"
        onRetry={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "결제 상태 확인 중..." }),
    ).toBeDisabled();
  });
});

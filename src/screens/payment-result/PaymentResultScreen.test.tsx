import { fireEvent, render, screen } from "@testing-library/react";
import { PaymentResultScreen } from "./PaymentResultScreen";

describe("PaymentResultScreen", () => {
  it("renders the processing state without failure actions", () => {
    render(<PaymentResultScreen mode="processing" />);

    expect(
      screen.getByRole("heading", { name: "결제를 처리하고 있습니다..." }),
    ).toBeVisible();
    expect(screen.getByText("예약 상세 페이지로 이동합니다.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the failure state and delegates navigation actions", () => {
    const onOpenProfile = vi.fn();
    const onOpenReservation = vi.fn();

    render(
      <PaymentResultScreen
        mode="failure"
        onOpenProfile={onOpenProfile}
        onOpenReservation={onOpenReservation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "프로필로 이동" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 상세 보기" }));

    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    expect(onOpenReservation).toHaveBeenCalledTimes(1);
  });

  it("renders a retryable status message and delegates reconciliation", () => {
    const onReconcile = vi.fn();

    render(
      <PaymentResultScreen
        mode="failure"
        statusMessage="결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요."
        onOpenProfile={() => undefined}
        onReconcile={onReconcile}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));
    expect(onReconcile).toHaveBeenCalledTimes(1);
  });

  it("disables the reconciliation action while checking", () => {
    render(
      <PaymentResultScreen
        mode="failure"
        isReconciling
        onOpenProfile={() => undefined}
        onReconcile={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "결제 상태 확인 중..." }),
    ).toBeDisabled();
  });
});

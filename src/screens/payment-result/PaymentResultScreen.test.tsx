import { fireEvent, render, screen } from "@testing-library/react";
import {
  PaymentResultScreen,
  type PaymentResultScreenProps,
} from "./PaymentResultScreen";

describe("PaymentResultScreen", () => {
  it("announces processing as busy without an authority-changing action", () => {
    render(
      <PaymentResultScreen
        mode="processing"
        statusMessage="결제 승인 대기 중입니다."
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "결제 상태를 확인하고 있습니다...",
      }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "결제 승인 대기 중입니다.",
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    expect(
      screen.getByRole("region", {
        name: "결제 상태를 확인하고 있습니다...",
      }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("승인 상태 확인")).toBeVisible();
    expect(screen.getByTestId("payment-state-mark")).toHaveAttribute(
      "data-state",
      "processing",
    );
    expect(screen.getByTestId("payment-state-mark")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each<{
    mode: PaymentResultScreenProps["mode"];
    role: "alert" | "status";
    stage: string;
    title: string;
  }>([
    {
      mode: "failure",
      role: "alert",
      stage: "예약 상태 확인",
      title: "결제가 완료되지 않았습니다",
    },
    {
      mode: "success",
      role: "status",
      stage: "예약 내역 열기",
      title: "결제가 완료되었습니다",
    },
    {
      mode: "review",
      role: "status",
      stage: "결제 결과 재확인",
      title: "결제 확인이 필요합니다",
    },
    {
      mode: "recovery-unavailable",
      role: "status",
      stage: "예약 상태로 돌아가기",
      title: "결제 상태를 복구하지 못했습니다",
    },
  ])(
    "renders the $mode ledger state with its stable heading and stage",
    ({ mode, role, stage, title }) => {
      render(<PaymentResultScreen mode={mode} />);

      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(screen.getByRole(role)).toHaveAttribute(
        "aria-live",
        role === "alert" ? "assertive" : "polite",
      );
      expect(screen.getByText(stage)).toBeVisible();
      expect(screen.getByTestId("payment-state-mark")).toHaveAttribute(
        "data-state",
        mode,
      );
      ["✅", "❌", "⚠️"].forEach((emoji) => {
        expect(screen.queryByText(emoji)).not.toBeInTheDocument();
      });
    },
  );

  it("renders non-secret recovery identifiers as a separate payment record", () => {
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

    expect(
      screen.getByRole("heading", { name: "결제 확인 기록" }),
    ).toBeVisible();
    expect(screen.getByText("복구용 식별자")).toBeVisible();
    expect(screen.getByText("operation-safe-id")).toBeVisible();
    expect(screen.getByText("reservation-safe-id")).toBeVisible();
    expect(screen.queryByText(/paymentKey/i)).not.toBeInTheDocument();
  });

  it("delegates primary retry and secondary navigation actions in order", () => {
    const onRetry = vi.fn();
    const onOpenReservation = vi.fn();
    const onOpenProfile = vi.fn();
    render(
      <PaymentResultScreen
        mode="recovery-unavailable"
        onOpenProfile={onOpenProfile}
        onOpenReservation={onOpenReservation}
        onRetry={onRetry}
      />,
    );

    const actions = screen.getAllByRole("button");
    expect(actions.map((action) => action.textContent)).toEqual([
      "결제 상태 다시 확인",
      "예약 상세 보기",
      "프로필로 이동",
    ]);
    actions.forEach((action) =>
      expect(action).toHaveAttribute("type", "button"),
    );

    fireEvent.click(actions[0]!);
    fireEvent.click(actions[1]!);
    fireEvent.click(actions[2]!);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOpenReservation).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it("delegates the preserved success acknowledgement action", () => {
    const onAcknowledge = vi.fn();
    render(
      <PaymentResultScreen mode="success" onAcknowledge={onAcknowledge} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "확인하고 예약 보기" }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("marks a busy recovery action at both screen and control levels", () => {
    render(
      <PaymentResultScreen
        isBusy
        mode="recovery-unavailable"
        onRetry={() => undefined}
      />,
    );

    const retryButton = screen.getByRole("button", {
      name: "결제 상태 확인 중...",
    });
    expect(
      screen.getByRole("region", {
        name: "결제 상태를 복구하지 못했습니다",
      }),
    ).toHaveAttribute("aria-busy", "true");
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute("aria-busy", "true");
  });
});

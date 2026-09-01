import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderApp } from "../../test/renderApp";
import type {
  BookingPaymentConfirmationResumeReferenceState,
  BookingPaymentOperationReference,
  BookingPaymentRecoveryWorkflow,
} from "../../workflows/booking-payment/transaction/recovery";
import {
  PaymentResultController,
  type PaymentRecoveryStart,
} from "./PaymentResultController";

const flowId = "10000000-0000-4000-8000-000000000001";
const reservationUid = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";

const confirmationReference: BookingPaymentConfirmationResumeReferenceState = {
  purpose: "booking-payment-flow-reference",
  version: 2,
  flowId,
  locator: { kind: "reservation", reservationUid },
};

const operationReference: BookingPaymentOperationReference = {
  flowId,
  operationId,
  reservationUid,
};

const nextFlowId = "40000000-0000-4000-8000-000000000004";
const nextReservationUid = "50000000-0000-4000-8000-000000000005";
const nextOperationId = "60000000-0000-4000-8000-000000000006";

const nextOperationReference: BookingPaymentOperationReference = {
  flowId: nextFlowId,
  operationId: nextOperationId,
  reservationUid: nextReservationUid,
};

const confirmationStart: PaymentRecoveryStart = {
  kind: "confirmation",
  reference: confirmationReference,
};

const operationStart: PaymentRecoveryStart = {
  kind: "operation",
  reference: operationReference,
};

const operationSucceeded = () =>
  ({
    status: "succeeded",
    reference: operationReference,
    observation: {
      status: "SUCCEEDED",
      updatedAt: "2026-09-01T10:01:00Z",
      nextAction: "NONE",
      retryAfterSeconds: null,
      userFailureCode: null,
      serverTime: "2026-09-01T10:01:01Z",
    },
  }) as const;

const operationFailed = () =>
  ({
    status: "failed",
    reference: operationReference,
    observation: {
      status: "FAILED",
      updatedAt: "2026-09-01T10:02:00Z",
      nextAction: "START_NEW_CHECKOUT",
      retryAfterSeconds: null,
      userFailureCode: "PAYMENT_DECLINED",
      serverTime: "2026-09-01T10:02:01Z",
    },
  }) as const;

const createWorkflow = (
  overrides: Partial<BookingPaymentRecoveryWorkflow> = {},
): BookingPaymentRecoveryWorkflow => ({
  claimCallback: vi.fn().mockReturnValue({ status: "invalid-callback" }),
  recoverClaimedCallback: vi
    .fn()
    .mockReturnValue({ status: "invalid-callback" }),
  resumeConfirmation: vi.fn().mockResolvedValue({
    status: "operation-accepted",
    reference: operationReference,
    cleanup: "complete",
  }),
  pollOperation: vi.fn().mockResolvedValue(operationSucceeded()),
  acknowledgeTerminal: vi.fn().mockReturnValue({ status: "acknowledged" }),
  dispose: vi.fn(),
  ...overrides,
});

const createCallbacks = () => ({
  onOperationAccepted: vi.fn().mockReturnValue(true),
  onRecoveryVerified: vi.fn(),
  onTerminalAcknowledged: vi.fn(),
  onOpenProfile: vi.fn(),
  onOpenReservation: vi.fn(),
});

const setup = ({
  autoStart = true,
  callbacks = createCallbacks(),
  routeLease = { isCurrent: () => true },
  start = confirmationStart,
  workflow = createWorkflow(),
}: {
  readonly autoStart?: boolean;
  readonly callbacks?: ReturnType<typeof createCallbacks>;
  readonly routeLease?: { isCurrent(): boolean };
  readonly start?: PaymentRecoveryStart;
  readonly workflow?: BookingPaymentRecoveryWorkflow;
} = {}) => {
  const view = renderApp(
    <PaymentResultController
      autoStart={autoStart}
      routeLease={routeLease}
      start={start}
      workflow={workflow}
      {...callbacks}
    />,
  );

  return { callbacks, view, workflow };
};

describe("PaymentResultController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resumes confirmation only from the credential-free flow reference", async () => {
    const { callbacks, workflow } = setup();

    await waitFor(() =>
      expect(workflow.resumeConfirmation).toHaveBeenCalledWith(
        confirmationReference,
      ),
    );
    expect(callbacks.onOperationAccepted).toHaveBeenCalledWith(
      operationReference,
    );
    expect(callbacks.onRecoveryVerified).toHaveBeenCalledTimes(1);
    expect(workflow.pollOperation).not.toHaveBeenCalled();
  });

  it("does not touch the workflow until the user explicitly retries a fenced recovery", async () => {
    const { workflow } = setup({ autoStart: false });

    expect(workflow.resumeConfirmation).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );

    await waitFor(() =>
      expect(workflow.resumeConfirmation).toHaveBeenCalledWith(
        confirmationReference,
      ),
    );
  });

  it("starts the same recovery reference when auto-start becomes enabled", async () => {
    const workflow = createWorkflow();
    const callbacks = createCallbacks();
    const routeLease = { isCurrent: () => true };
    const view = renderApp(
      <PaymentResultController
        autoStart={false}
        routeLease={routeLease}
        start={operationStart}
        workflow={workflow}
        {...callbacks}
      />,
    );

    expect(workflow.pollOperation).not.toHaveBeenCalled();
    view.rerender(
      <PaymentResultController
        autoStart
        routeLease={routeLease}
        start={operationStart}
        workflow={workflow}
        {...callbacks}
      />,
    );

    await waitFor(() =>
      expect(workflow.pollOperation).toHaveBeenCalledWith(operationReference),
    );
    expect(
      await screen.findByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
  });

  it("cancels the same recovery reference when auto-start becomes disabled", async () => {
    let resolvePoll:
      | ((
          result: Awaited<
            ReturnType<BookingPaymentRecoveryWorkflow["pollOperation"]>
          >,
        ) => void)
      | undefined;
    const workflow = createWorkflow({
      pollOperation: vi.fn(
        () =>
          new Promise<
            Awaited<ReturnType<BookingPaymentRecoveryWorkflow["pollOperation"]>>
          >((resolve) => {
            resolvePoll = resolve;
          }),
      ),
    });
    const callbacks = createCallbacks();
    const routeLease = { isCurrent: () => true };
    const view = renderApp(
      <PaymentResultController
        autoStart
        routeLease={routeLease}
        start={operationStart}
        workflow={workflow}
        {...callbacks}
      />,
    );

    await waitFor(() =>
      expect(workflow.pollOperation).toHaveBeenCalledWith(operationReference),
    );
    view.rerender(
      <PaymentResultController
        autoStart={false}
        routeLease={routeLease}
        start={operationStart}
        workflow={workflow}
        {...callbacks}
      />,
    );
    expect(
      await screen.findByText(
        "이전 복구 시도에서 저장된 결제 정보를 확인하지 못했습니다.",
      ),
    ).toBeVisible();

    await act(async () => {
      resolvePoll?.(operationSucceeded());
    });

    expect(
      screen.queryByRole("heading", { name: "결제가 완료되었습니다" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "이전 복구 시도에서 저장된 결제 정보를 확인하지 못했습니다.",
      ),
    ).toBeVisible();
  });

  it("shows recovery identifiers while review polling converges to a newer terminal result", async () => {
    vi.useFakeTimers();
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce({
          status: "unresolved",
          reference: operationReference,
          observation: {
            status: "REQUIRES_REVIEW",
            updatedAt: "2026-09-01T10:31:00Z",
            nextAction: "CONTACT_SUPPORT",
            retryAfterSeconds: 30,
            userFailureCode: "PAYMENT_REVIEW_REQUIRED",
            serverTime: "2026-09-01T10:31:01Z",
          },
        })
        .mockResolvedValueOnce({
          status: "succeeded",
          reference: operationReference,
          observation: {
            status: "SUCCEEDED",
            updatedAt: "2026-09-01T10:31:30Z",
            nextAction: "NONE",
            retryAfterSeconds: null,
            userFailureCode: null,
            serverTime: "2026-09-01T10:31:31Z",
          },
        }),
    });
    setup({ start: operationStart, workflow });

    await act(async () => undefined);
    expect(
      screen.getByRole("heading", {
        name: "결제 확인이 필요합니다",
      }),
    ).toBeVisible();
    expect(screen.getByText(reservationUid)).toBeVisible();
    expect(screen.getByText(operationId)).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(1);
    expect(workflow.acknowledgeTerminal).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(
      screen.getByRole("heading", {
        name: "결제가 완료되었습니다",
      }),
    ).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
  });

  it("keeps polling a review receipt until the backend reports failure", async () => {
    vi.useFakeTimers();
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce({
          status: "unresolved",
          reference: operationReference,
          observation: {
            status: "REQUIRES_REVIEW",
            updatedAt: "2026-09-01T10:31:00Z",
            nextAction: "CONTACT_SUPPORT",
            retryAfterSeconds: 2,
            userFailureCode: "PAYMENT_REVIEW_REQUIRED",
            serverTime: "2026-09-01T10:31:01Z",
          },
        })
        .mockResolvedValueOnce({
          status: "failed",
          reference: operationReference,
          observation: {
            status: "FAILED",
            updatedAt: "2026-09-01T10:31:02Z",
            nextAction: "START_NEW_CHECKOUT",
            retryAfterSeconds: null,
            userFailureCode: "PAYMENT_DECLINED",
            serverTime: "2026-09-01T10:31:03Z",
          },
        }),
    });
    setup({ start: operationStart, workflow });

    await act(async () => undefined);
    expect(
      screen.getByRole("heading", {
        name: "결제 확인이 필요합니다",
      }),
    ).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(
      screen.getByRole("heading", {
        name: "결제가 완료되지 않았습니다",
      }),
    ).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
    expect(workflow.acknowledgeTerminal).not.toHaveBeenCalled();
  });

  it.each([
    ["PROCESSING", "결제 승인을 처리하고 있습니다."],
    ["PENDING", "결제 승인 대기 중입니다."],
  ] as const)(
    "keeps polling an unresolved %s operation",
    async (status, expectedMessage) => {
      vi.useFakeTimers();
      const workflow = createWorkflow({
        pollOperation: vi
          .fn()
          .mockResolvedValueOnce({
            status: "unresolved",
            reference: operationReference,
            observation: {
              status,
              updatedAt: "2026-09-01T10:20:00Z",
              nextAction: "POLL",
              retryAfterSeconds: 3,
              userFailureCode: null,
              serverTime: "2026-09-01T10:20:01Z",
            },
          })
          .mockResolvedValueOnce(operationSucceeded()),
      });
      const { callbacks } = setup({ start: operationStart, workflow });

      await act(async () => undefined);
      expect(screen.getByRole("status")).toHaveTextContent(expectedMessage);
      expect(workflow.pollOperation).toHaveBeenCalledTimes(1);
      expect(callbacks.onRecoveryVerified).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });

      expect(
        screen.getByRole("heading", { name: "결제가 완료되었습니다" }),
      ).toBeVisible();
      expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
      expect(callbacks.onRecoveryVerified).toHaveBeenCalledTimes(2);
    },
  );

  it("automatically retries a transient operation poll failure", async () => {
    vi.useFakeTimers();
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce({
          status: "retryable",
          reference: operationReference,
          retryAfterSeconds: 5,
        })
        .mockResolvedValueOnce(operationSucceeded()),
    });
    const { callbacks } = setup({ start: operationStart, workflow });

    await act(async () => undefined);
    expect(screen.getByRole("status")).toHaveTextContent(
      "일시적으로 결제 상태를 확인하지 못했습니다. 자동으로 다시 확인합니다.",
    );
    expect(callbacks.onRecoveryVerified).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(
      screen.getByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
    expect(callbacks.onRecoveryVerified).toHaveBeenCalledOnce();
  });

  it("allows an explicit retry after a busy operation poll", async () => {
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce({ status: "busy" })
        .mockResolvedValueOnce(operationSucceeded()),
    });
    setup({ start: operationStart, workflow });

    expect(
      await screen.findByText("다른 결제 상태 확인이 진행 중입니다."),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );

    expect(
      await screen.findByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["auth-required", "로그인 상태를 확인한 뒤 다시 시도해주세요."],
    ["invalid-reference", "결제 복구 식별자가 올바르지 않습니다."],
  ] as const)(
    "fences an operation %s result without offering a retry",
    async (status, expectedMessage) => {
      const workflow = createWorkflow({
        pollOperation: vi.fn().mockResolvedValue({ status }),
      });
      setup({ start: operationStart, workflow });

      expect(await screen.findByText(expectedMessage)).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "결제 상태 다시 확인" }),
      ).not.toBeInTheDocument();
      expect(workflow.pollOperation).toHaveBeenCalledOnce();
    },
  );

  it("offers an explicit retry when operation recovery storage is unavailable", async () => {
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce({
          status: "recovery-unavailable",
          fallback: { kind: "reservation-detail", reservationUid },
        })
        .mockResolvedValueOnce(operationSucceeded()),
    });
    setup({ start: operationStart, workflow });

    expect(
      await screen.findByText(
        "저장된 결제 정보를 안전하게 확인하지 못했습니다.",
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );

    expect(
      await screen.findByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
  });

  it("does not publish a stale operation result", async () => {
    const workflow = createWorkflow({
      pollOperation: vi.fn().mockResolvedValue({ status: "stale" }),
    });
    const { callbacks } = setup({ start: operationStart, workflow });

    await waitFor(() => expect(workflow.pollOperation).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "결제 처리 결과를 확인하고 있습니다.",
    );
    expect(callbacks.onRecoveryVerified).not.toHaveBeenCalled();
  });

  it("retries a review operation immediately and cancels its scheduled poll", async () => {
    vi.useFakeTimers();
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce({
          status: "unresolved",
          reference: operationReference,
          observation: {
            status: "REQUIRES_REVIEW",
            updatedAt: "2026-09-01T10:31:00Z",
            nextAction: "CONTACT_SUPPORT",
            retryAfterSeconds: 30,
            userFailureCode: "PAYMENT_REVIEW_REQUIRED",
            serverTime: "2026-09-01T10:31:01Z",
          },
        })
        .mockResolvedValueOnce(operationSucceeded()),
    });
    setup({ start: operationStart, workflow });

    await act(async () => undefined);
    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );

    await act(async () => undefined);
    expect(
      screen.getByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["storage", "결제 복구 정보를 읽지 못했습니다.", 0],
    ["confirm", "결제 승인 접수 결과를 확인하지 못했습니다.", 1],
  ] as const)(
    "retries a %s confirmation failure with the correct verification fence",
    async (stage, expectedMessage, verificationCount) => {
      const workflow = createWorkflow({
        resumeConfirmation: vi
          .fn()
          .mockResolvedValueOnce({
            status: "retryable",
            stage,
            fallback: { kind: "reservation-detail", reservationUid },
          })
          .mockResolvedValueOnce({
            status: "operation-accepted",
            reference: operationReference,
            cleanup: "complete",
          }),
      });
      const { callbacks } = setup({ workflow });

      expect(await screen.findByText(expectedMessage)).toBeVisible();
      expect(callbacks.onRecoveryVerified).toHaveBeenCalledTimes(
        verificationCount,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "결제 상태 다시 확인" }),
      );
      await waitFor(() =>
        expect(workflow.resumeConfirmation).toHaveBeenCalledTimes(2),
      );

      expect(callbacks.onOperationAccepted).toHaveBeenCalledWith(
        operationReference,
      );
      expect(callbacks.onRecoveryVerified).toHaveBeenCalledTimes(
        verificationCount + 1,
      );
    },
  );

  it("allows an explicit retry after a busy confirmation resume", async () => {
    const workflow = createWorkflow({
      resumeConfirmation: vi
        .fn()
        .mockResolvedValueOnce({ status: "busy" })
        .mockResolvedValueOnce({
          status: "operation-accepted",
          reference: operationReference,
          cleanup: "complete",
        }),
    });
    const { callbacks } = setup({ workflow });

    expect(
      await screen.findByText("다른 결제 승인 확인이 진행 중입니다."),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );

    await waitFor(() =>
      expect(callbacks.onOperationAccepted).toHaveBeenCalledWith(
        operationReference,
      ),
    );
    expect(workflow.resumeConfirmation).toHaveBeenCalledTimes(2);
  });

  it("treats terminal confirmation failure as verified and non-retryable", async () => {
    const workflow = createWorkflow({
      resumeConfirmation: vi.fn().mockResolvedValue({
        status: "terminal-failure",
        reason: "conflict",
        fallback: { kind: "reservation-detail", reservationUid },
      }),
    });
    const { callbacks } = setup({ workflow });

    expect(
      await screen.findByText(
        "결제 승인을 이어서 처리할 수 없습니다. 예약 상세에서 상태를 확인해주세요.",
      ),
    ).toBeVisible();
    expect(callbacks.onRecoveryVerified).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "결제 상태 다시 확인" }),
    ).not.toBeInTheDocument();
  });

  it("keeps an authoritative confirmation receipt non-retryable", async () => {
    const workflow = createWorkflow({
      resumeConfirmation: vi.fn().mockResolvedValue({
        status: "receipt-authoritative",
        fallback: { kind: "reservation-detail", reservationUid },
      }),
    });
    setup({ workflow });

    expect(
      await screen.findByText(
        "결제 처리는 접수되었지만 이 화면에서 상태를 이어서 확인할 수 없습니다.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "결제 상태 다시 확인" }),
    ).not.toBeInTheDocument();
  });

  it("offers an explicit retry when confirmation recovery is unavailable", async () => {
    const workflow = createWorkflow({
      resumeConfirmation: vi
        .fn()
        .mockResolvedValueOnce({
          status: "recovery-unavailable",
          fallback: { kind: "reservation-detail", reservationUid },
        })
        .mockResolvedValueOnce({
          status: "operation-accepted",
          reference: operationReference,
          cleanup: "complete",
        }),
    });
    const { callbacks } = setup({ workflow });

    expect(
      await screen.findByText(
        "저장된 결제 정보를 안전하게 확인하지 못했습니다.",
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "결제 상태 다시 확인" }),
    );

    await waitFor(() =>
      expect(callbacks.onOperationAccepted).toHaveBeenCalledWith(
        operationReference,
      ),
    );
    expect(workflow.resumeConfirmation).toHaveBeenCalledTimes(2);
  });

  it("does not publish a stale confirmation result", async () => {
    const workflow = createWorkflow({
      resumeConfirmation: vi.fn().mockResolvedValue({ status: "stale" }),
    });
    const { callbacks } = setup({ workflow });

    await waitFor(() =>
      expect(workflow.resumeConfirmation).toHaveBeenCalledOnce(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "결제 승인을 안전하게 접수하고 있습니다.",
    );
    expect(callbacks.onRecoveryVerified).not.toHaveBeenCalled();
  });

  it("keeps a terminal receipt until the user explicitly acknowledges it", async () => {
    const { callbacks, workflow } = setup({ start: operationStart });

    expect(
      await screen.findByRole("heading", {
        name: "결제가 완료되었습니다",
      }),
    ).toBeVisible();
    expect(workflow.acknowledgeTerminal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "확인하고 예약 보기" }));

    expect(workflow.acknowledgeTerminal).toHaveBeenCalledWith(
      operationReference,
    );
    await waitFor(() =>
      expect(callbacks.onTerminalAcknowledged).toHaveBeenCalledWith(
        operationReference,
      ),
    );
  });

  it("re-polls when an acknowledgement discovers a non-terminal operation", async () => {
    const workflow = createWorkflow({
      pollOperation: vi
        .fn()
        .mockResolvedValueOnce(operationSucceeded())
        .mockResolvedValueOnce(operationFailed()),
      acknowledgeTerminal: vi.fn().mockReturnValue({
        status: "not-terminal",
      }),
    });
    const { callbacks } = setup({ start: operationStart, workflow });

    expect(
      await screen.findByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 예약 보기" }));

    expect(
      await screen.findByRole("heading", {
        name: "결제가 완료되지 않았습니다",
      }),
    ).toBeVisible();
    expect(workflow.pollOperation).toHaveBeenCalledTimes(2);
    expect(callbacks.onTerminalAcknowledged).not.toHaveBeenCalled();
  });

  it("does not acknowledge a terminal result after its route lease is lost", async () => {
    let routeCurrent = true;
    const routeLease = { isCurrent: () => routeCurrent };
    const { callbacks, workflow } = setup({
      routeLease,
      start: operationStart,
    });

    expect(
      await screen.findByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
    routeCurrent = false;
    fireEvent.click(screen.getByRole("button", { name: "확인하고 예약 보기" }));

    expect(workflow.acknowledgeTerminal).not.toHaveBeenCalled();
    expect(callbacks.onTerminalAcknowledged).not.toHaveBeenCalled();
  });

  it.each([
    ["retryable", "결제 처리 정보를 정리하지 못했습니다. 다시 확인해주세요."],
    [
      "recovery-unavailable",
      "이 결제 처리를 확인할 수 없습니다. 예약 상세에서 상태를 확인해주세요.",
    ],
  ] as const)(
    "keeps a terminal receipt when acknowledgement is %s",
    async (status, expectedMessage) => {
      const workflow = createWorkflow({
        acknowledgeTerminal: vi.fn().mockReturnValue({
          status,
          fallback: { kind: "reservation-detail", reservationUid },
        }),
      });
      const { callbacks } = setup({ start: operationStart, workflow });

      expect(
        await screen.findByRole("heading", {
          name: "결제가 완료되었습니다",
        }),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: "확인하고 예약 보기" }),
      );

      expect(await screen.findByText(expectedMessage)).toBeVisible();
      expect(screen.getByText(operationId)).toBeVisible();
      expect(callbacks.onTerminalAcknowledged).not.toHaveBeenCalled();
    },
  );

  it("never polls when operation-state persistence fails", async () => {
    const workflow = createWorkflow();
    const callbacks = {
      onOperationAccepted: vi.fn().mockReturnValue(false),
      onRecoveryVerified: vi.fn(),
      onTerminalAcknowledged: vi.fn(),
      onOpenProfile: vi.fn(),
      onOpenReservation: vi.fn(),
    };
    renderApp(
      <PaymentResultController
        autoStart
        routeLease={{ isCurrent: () => true }}
        start={confirmationStart}
        workflow={workflow}
        {...callbacks}
      />,
    );

    expect(
      await screen.findByText(
        "결제 처리 식별자를 화면 복구 정보에 저장하지 못했습니다.",
      ),
    ).toBeVisible();
    expect(workflow.pollOperation).not.toHaveBeenCalled();
  });

  it("shows verified expired identifiers without retrying payment commands", async () => {
    const workflow = createWorkflow({
      pollOperation: vi.fn().mockResolvedValue({
        status: "verified-expired",
        reference: operationReference,
        fallback: { kind: "reservation-detail", reservationUid },
      }),
    });
    const callbacks = {
      onOperationAccepted: vi.fn().mockReturnValue(true),
      onRecoveryVerified: vi.fn(),
      onTerminalAcknowledged: vi.fn(),
      onOpenProfile: vi.fn(),
      onOpenReservation: vi.fn(),
    };
    renderApp(
      <PaymentResultController
        autoStart
        routeLease={{ isCurrent: () => true }}
        start={operationStart}
        workflow={workflow}
        {...callbacks}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "결제 상태를 복구하지 못했습니다",
      }),
    ).toBeVisible();
    expect(screen.getByText(reservationUid)).toBeVisible();
    expect(screen.getByText(operationId)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "결제 상태 다시 확인" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "확인하고 예약 보기" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "예약 상세 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "프로필로 이동" }));

    expect(callbacks.onOpenReservation).toHaveBeenCalledOnce();
    expect(callbacks.onOpenProfile).toHaveBeenCalledOnce();
    expect(callbacks.onRecoveryVerified).toHaveBeenCalledOnce();
    expect(workflow.resumeConfirmation).not.toHaveBeenCalled();
    expect(workflow.pollOperation).toHaveBeenCalledOnce();
  });

  it("starts the latest route reference while an older poll is still in flight", async () => {
    let resolveFirstPoll:
      | ((
          result: Awaited<
            ReturnType<BookingPaymentRecoveryWorkflow["pollOperation"]>
          >,
        ) => void)
      | undefined;
    const firstWorkflow = createWorkflow({
      pollOperation: vi.fn(
        () =>
          new Promise<
            Awaited<ReturnType<BookingPaymentRecoveryWorkflow["pollOperation"]>>
          >((resolve) => {
            resolveFirstPoll = resolve;
          }),
      ),
    });
    const nextWorkflow = createWorkflow({
      pollOperation: vi.fn().mockResolvedValue({
        status: "succeeded",
        reference: nextOperationReference,
        observation: {
          status: "SUCCEEDED",
          updatedAt: "2026-09-01T11:01:00Z",
          nextAction: "NONE",
          retryAfterSeconds: null,
          userFailureCode: null,
          serverTime: "2026-09-01T11:01:01Z",
        },
      }),
    });
    const callbacks = {
      onOperationAccepted: vi.fn().mockReturnValue(true),
      onRecoveryVerified: vi.fn(),
      onTerminalAcknowledged: vi.fn(),
      onOpenProfile: vi.fn(),
      onOpenReservation: vi.fn(),
    };
    let currentReservationUid = reservationUid;
    const firstRouteLease = {
      isCurrent: () => currentReservationUid === reservationUid,
    };
    const nextRouteLease = {
      isCurrent: () => currentReservationUid === nextReservationUid,
    };
    const view = renderApp(
      <PaymentResultController
        autoStart
        routeLease={firstRouteLease}
        start={operationStart}
        workflow={firstWorkflow}
        {...callbacks}
      />,
    );

    await waitFor(() =>
      expect(firstWorkflow.pollOperation).toHaveBeenCalledWith(
        operationReference,
      ),
    );

    currentReservationUid = nextReservationUid;
    view.rerender(
      <PaymentResultController
        autoStart
        routeLease={nextRouteLease}
        start={{ kind: "operation", reference: nextOperationReference }}
        workflow={nextWorkflow}
        {...callbacks}
      />,
    );

    await waitFor(() =>
      expect(nextWorkflow.pollOperation).toHaveBeenCalledWith(
        nextOperationReference,
      ),
    );
    expect(nextWorkflow.pollOperation).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible();
    expect(screen.getByText(nextOperationId)).toBeVisible();

    await act(async () => {
      resolveFirstPoll?.({
        status: "succeeded",
        reference: operationReference,
        observation: {
          status: "SUCCEEDED",
          updatedAt: "2026-09-01T11:02:00Z",
          nextAction: "NONE",
          retryAfterSeconds: null,
          userFailureCode: null,
          serverTime: "2026-09-01T11:02:01Z",
        },
      });
    });

    expect(screen.getByText(nextOperationId)).toBeVisible();
    expect(screen.queryByText(operationId)).not.toBeInTheDocument();

    view.rerender(
      <PaymentResultController
        autoStart
        routeLease={nextRouteLease}
        start={{
          kind: "operation",
          reference: { ...nextOperationReference },
        }}
        workflow={nextWorkflow}
        {...callbacks}
      />,
    );
    await act(async () => undefined);

    expect(nextWorkflow.pollOperation).toHaveBeenCalledTimes(1);
  });
});

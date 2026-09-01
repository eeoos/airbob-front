import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BookingPaymentConfirmationResumeReferenceState,
  BookingPaymentOperationReference,
  BookingPaymentRecoveryRouteLease,
  BookingPaymentRecoveryWorkflow,
} from "../../workflows/booking-payment/transaction/recovery";
import { PaymentResultScreen } from "./PaymentResultScreen";

export type PaymentRecoveryStart =
  | {
      readonly kind: "confirmation";
      readonly reference: BookingPaymentConfirmationResumeReferenceState;
    }
  | {
      readonly kind: "operation";
      readonly reference: BookingPaymentOperationReference;
    };

export interface PaymentResultControllerProps {
  readonly autoStart: boolean;
  readonly start: PaymentRecoveryStart;
  readonly routeLease: BookingPaymentRecoveryRouteLease;
  readonly workflow: BookingPaymentRecoveryWorkflow;
  readonly onOperationAccepted: (
    reference: BookingPaymentOperationReference,
  ) => boolean;
  readonly onRecoveryVerified: () => void;
  readonly onTerminalAcknowledged: (
    reference: BookingPaymentOperationReference,
  ) => void | Promise<void>;
  readonly onOpenProfile: () => void;
  readonly onOpenReservation: () => void;
}

type PaymentRecoveryViewState =
  | {
      readonly status: "processing";
      readonly message: string | null;
    }
  | {
      readonly status: "confirmation-retry";
      readonly reference: BookingPaymentConfirmationResumeReferenceState;
      readonly message: string;
    }
  | {
      readonly status: "operation-retry";
      readonly reference: BookingPaymentOperationReference;
      readonly message: string;
    }
  | {
      readonly status: "review";
      readonly reference: BookingPaymentOperationReference;
    }
  | {
      readonly status: "verified-expired";
      readonly reference: BookingPaymentOperationReference;
    }
  | {
      readonly status: "succeeded" | "failed";
      readonly reference: BookingPaymentOperationReference;
      readonly acknowledgementMessage: string | null;
    }
  | {
      readonly status: "recovery-unavailable";
      readonly message: string;
      readonly retry: PaymentRecoveryStart | null;
    };

const startKey = (start: PaymentRecoveryStart): string =>
  start.kind === "confirmation"
    ? [
        start.kind,
        start.reference.flowId,
        start.reference.locator.reservationUid,
      ].join(":")
    : [
        start.kind,
        start.reference.flowId,
        start.reference.operationId,
        start.reference.reservationUid,
      ].join(":");

const toUnavailableMessage = (status: string): string => {
  switch (status) {
    case "auth-required":
      return "로그인 상태를 확인한 뒤 다시 시도해주세요.";
    case "invalid-reference":
      return "결제 복구 식별자가 올바르지 않습니다.";
    case "receipt-authoritative":
      return "결제 처리는 접수되었지만 이 화면에서 상태를 이어서 확인할 수 없습니다.";
    default:
      return "저장된 결제 정보를 안전하게 확인하지 못했습니다.";
  }
};

export function PaymentResultController({
  autoStart,
  start,
  routeLease,
  workflow,
  onOperationAccepted,
  onRecoveryVerified,
  onTerminalAcknowledged,
  onOpenProfile,
  onOpenReservation,
}: PaymentResultControllerProps) {
  const [view, setView] = useState<PaymentRecoveryViewState>({
    status: "processing",
    message: null,
  });
  const [isBusy, setIsBusy] = useState(false);
  const generationRef = useRef(0);
  const inFlightRef = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationRunnerRef = useRef<
    (reference: BookingPaymentOperationReference) => void
  >(() => undefined);
  const startedRunRef = useRef<{
    readonly autoStart: boolean;
    readonly key: string;
    readonly routeLease: BookingPaymentRecoveryRouteLease;
    readonly workflow: BookingPaymentRecoveryWorkflow;
  } | null>(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      globalThis.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const scheduleOperationPoll = useCallback(
    (
      reference: BookingPaymentOperationReference,
      retryAfterSeconds: number,
    ) => {
      pollTimeoutRef.current = globalThis.setTimeout(() => {
        pollTimeoutRef.current = null;
        operationRunnerRef.current(reference);
      }, retryAfterSeconds * 1_000);
    },
    [],
  );

  const cancelActiveRun = useCallback(() => {
    generationRef.current += 1;
    inFlightRef.current = false;
    clearPollTimer();
  }, [clearPollTimer]);

  useEffect(
    () => () => {
      cancelActiveRun();
      startedRunRef.current = null;
    },
    [cancelActiveRun],
  );

  const runOperation = useCallback(
    async (reference: BookingPaymentOperationReference) => {
      if (inFlightRef.current || !routeLease.isCurrent()) return;
      clearPollTimer();
      const generation = ++generationRef.current;
      inFlightRef.current = true;
      setIsBusy(true);
      setView({
        status: "processing",
        message: "결제 처리 결과를 확인하고 있습니다.",
      });

      const result = await workflow.pollOperation(reference);
      if (generationRef.current !== generation) return;
      inFlightRef.current = false;
      if (!routeLease.isCurrent()) return;
      setIsBusy(false);

      switch (result.status) {
        case "unresolved":
          onRecoveryVerified();
          if (result.observation.status === "REQUIRES_REVIEW") {
            setView({ status: "review", reference: result.reference });
            scheduleOperationPoll(
              result.reference,
              result.observation.retryAfterSeconds,
            );
            return;
          }
          setView({
            status: "processing",
            message:
              result.observation.status === "PROCESSING"
                ? "결제 승인을 처리하고 있습니다."
                : "결제 승인 대기 중입니다.",
          });
          scheduleOperationPoll(
            result.reference,
            result.observation.retryAfterSeconds,
          );
          return;
        case "succeeded":
        case "failed":
          onRecoveryVerified();
          setView({
            status: result.status,
            reference: result.reference,
            acknowledgementMessage: null,
          });
          return;
        case "retryable":
          setView({
            status: "processing",
            message:
              "일시적으로 결제 상태를 확인하지 못했습니다. 자동으로 다시 확인합니다.",
          });
          scheduleOperationPoll(result.reference, result.retryAfterSeconds);
          return;
        case "verified-expired":
          onRecoveryVerified();
          setView({
            status: "verified-expired",
            reference: result.reference,
          });
          return;
        case "busy":
          setView({
            status: "operation-retry",
            reference,
            message: "다른 결제 상태 확인이 진행 중입니다.",
          });
          return;
        case "auth-required":
        case "invalid-reference":
        case "recovery-unavailable":
          setView({
            status: "recovery-unavailable",
            message: toUnavailableMessage(result.status),
            retry:
              result.status === "recovery-unavailable"
                ? { kind: "operation", reference }
                : null,
          });
          return;
        case "stale":
          return;
      }
    },
    [
      clearPollTimer,
      onRecoveryVerified,
      routeLease,
      scheduleOperationPoll,
      workflow,
    ],
  );

  useEffect(() => {
    operationRunnerRef.current = (reference) => {
      void runOperation(reference);
    };
  }, [runOperation]);

  const runConfirmation = useCallback(
    async (reference: BookingPaymentConfirmationResumeReferenceState) => {
      if (inFlightRef.current || !routeLease.isCurrent()) return;
      clearPollTimer();
      const generation = ++generationRef.current;
      inFlightRef.current = true;
      setIsBusy(true);
      setView({
        status: "processing",
        message: "결제 승인을 안전하게 접수하고 있습니다.",
      });

      const result = await workflow.resumeConfirmation(reference);
      if (generationRef.current !== generation) return;
      inFlightRef.current = false;
      if (!routeLease.isCurrent()) return;
      setIsBusy(false);

      switch (result.status) {
        case "operation-accepted":
          onRecoveryVerified();
          if (!onOperationAccepted(result.reference)) {
            setView({
              status: "recovery-unavailable",
              message:
                "결제 처리 식별자를 화면 복구 정보에 저장하지 못했습니다.",
              retry: null,
            });
            return;
          }
          setView({
            status: "processing",
            message: "결제 처리가 접수되었습니다.",
          });
          return;
        case "retryable":
          if (result.stage !== "storage") onRecoveryVerified();
          setView({
            status: "confirmation-retry",
            reference,
            message:
              result.stage === "storage"
                ? "결제 복구 정보를 읽지 못했습니다."
                : "결제 승인 접수 결과를 확인하지 못했습니다.",
          });
          return;
        case "busy":
          setView({
            status: "confirmation-retry",
            reference,
            message: "다른 결제 승인 확인이 진행 중입니다.",
          });
          return;
        case "terminal-failure":
          onRecoveryVerified();
          setView({
            status: "recovery-unavailable",
            message:
              "결제 승인을 이어서 처리할 수 없습니다. 예약 상세에서 상태를 확인해주세요.",
            retry: null,
          });
          return;
        case "receipt-authoritative":
        case "auth-required":
        case "invalid-reference":
        case "recovery-unavailable":
          setView({
            status: "recovery-unavailable",
            message: toUnavailableMessage(result.status),
            retry:
              result.status === "recovery-unavailable"
                ? { kind: "confirmation", reference }
                : null,
          });
          return;
        case "stale":
          return;
      }
    },
    [
      clearPollTimer,
      onOperationAccepted,
      onRecoveryVerified,
      routeLease,
      workflow,
    ],
  );

  const run = useCallback(
    (candidate: PaymentRecoveryStart) => {
      if (candidate.kind === "confirmation") {
        void runConfirmation(candidate.reference);
      } else {
        void runOperation(candidate.reference);
      }
    },
    [runConfirmation, runOperation],
  );

  useEffect(() => {
    const key = startKey(start);
    const previousRun = startedRunRef.current;
    if (
      previousRun?.autoStart === autoStart &&
      previousRun?.key === key &&
      previousRun.routeLease === routeLease &&
      previousRun.workflow === workflow
    ) {
      return;
    }
    startedRunRef.current = { autoStart, key, routeLease, workflow };
    cancelActiveRun();
    if (autoStart) {
      run(start);
      return;
    }
    setIsBusy(false);
    setView({
      status: "recovery-unavailable",
      message: "이전 복구 시도에서 저장된 결제 정보를 확인하지 못했습니다.",
      retry: start,
    });
  }, [autoStart, cancelActiveRun, routeLease, run, start, workflow]);

  const acknowledge = useCallback(async () => {
    if (
      (view.status !== "succeeded" && view.status !== "failed") ||
      isBusy ||
      !routeLease.isCurrent()
    ) {
      return;
    }

    setIsBusy(true);
    const result = workflow.acknowledgeTerminal(view.reference);
    if (!routeLease.isCurrent()) return;

    if (result.status === "acknowledged") {
      await onTerminalAcknowledged(view.reference);
      return;
    }
    setIsBusy(false);
    if (result.status === "not-terminal") {
      void runOperation(view.reference);
      return;
    }
    setView({
      ...view,
      acknowledgementMessage:
        result.status === "retryable"
          ? "결제 처리 정보를 정리하지 못했습니다. 다시 확인해주세요."
          : "이 결제 처리를 확인할 수 없습니다. 예약 상세에서 상태를 확인해주세요.",
    });
  }, [
    isBusy,
    onTerminalAcknowledged,
    routeLease,
    runOperation,
    view,
    workflow,
  ]);

  if (view.status === "processing") {
    return (
      <PaymentResultScreen mode="processing" statusMessage={view.message} />
    );
  }

  if (
    view.status === "confirmation-retry" ||
    view.status === "operation-retry"
  ) {
    const retry: PaymentRecoveryStart =
      view.status === "confirmation-retry"
        ? { kind: "confirmation", reference: view.reference }
        : { kind: "operation", reference: view.reference };
    return (
      <PaymentResultScreen
        mode="recovery-unavailable"
        isBusy={isBusy}
        statusMessage={view.message}
        onOpenProfile={onOpenProfile}
        onOpenReservation={onOpenReservation}
        onRetry={() => run(retry)}
      />
    );
  }

  if (view.status === "recovery-unavailable") {
    return (
      <PaymentResultScreen
        mode="recovery-unavailable"
        isBusy={isBusy}
        statusMessage={view.message}
        onOpenProfile={onOpenProfile}
        onOpenReservation={onOpenReservation}
        {...(view.retry ? { onRetry: () => run(view.retry!) } : {})}
      />
    );
  }

  if (view.status === "review") {
    return (
      <PaymentResultScreen
        mode="review"
        identifiers={view.reference}
        isBusy={isBusy}
        onOpenReservation={onOpenReservation}
        onRetry={() => void runOperation(view.reference)}
      />
    );
  }

  if (view.status === "verified-expired") {
    return (
      <PaymentResultScreen
        identifiers={view.reference}
        mode="recovery-unavailable"
        statusMessage="저장된 결제 복구 기간이 만료되었습니다. 아래 식별자로 예약 상세에서 현재 상태를 확인해주세요."
        onOpenProfile={onOpenProfile}
        onOpenReservation={onOpenReservation}
      />
    );
  }

  return (
    <PaymentResultScreen
      mode={view.status === "succeeded" ? "success" : "failure"}
      identifiers={view.reference}
      isBusy={isBusy}
      statusMessage={view.acknowledgementMessage}
      onAcknowledge={() => void acknowledge()}
      onOpenReservation={onOpenReservation}
    />
  );
}

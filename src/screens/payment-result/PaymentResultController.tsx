import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  checkoutOwnershipApi as defaultCheckoutOwnershipApi,
  paymentApi as defaultPaymentApi,
  type CheckoutOwnershipApiPort,
  type PaymentApiPort,
} from "../../features/reservations/payment/public";
import { useStrictModeSafeDisposable } from "../../shared/lib/useStrictModeSafeDisposable";
import type {
  CallbackData,
  CallbackPhase,
} from "../../workflows/booking-payment/checkout";
import {
  createInitialPaymentMachineState,
  createPaymentConfirmationWorkflow,
  paymentMachineReducer,
  type PaymentConfirmationCommand,
  type PaymentConfirmationResult,
  type PaymentConfirmationRouteLease,
  type PaymentConfirmationSessionPort,
  type PaymentCallbackDocument,
} from "../../workflows/booking-payment/confirmation";
import { PaymentResultScreen } from "./PaymentResultScreen";

export interface PaymentResultControllerProps {
  readonly callback: CallbackData | null;
  readonly document: PaymentCallbackDocument | null;
  readonly mode: "success" | "failure";
  readonly shouldConfirm: boolean;
  readonly routeLease: PaymentConfirmationRouteLease;
  readonly session: PaymentConfirmationSessionPort;
  readonly paymentApi?: PaymentApiPort;
  readonly ownershipApi?: CheckoutOwnershipApiPort;
  readonly onCallbackPhaseChange: (phase: CallbackPhase) => boolean;
  readonly onConfirmed: () => void | Promise<void>;
  readonly onInvalid: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenReservation?: () => void;
  readonly onRecoverable: () => void;
  readonly onTerminalFailure: () => void;
}

const joinedDocuments = (
  document: PaymentCallbackDocument | null,
  callback: CallbackData | null,
): boolean =>
  document !== null &&
  callback !== null &&
  document.operationId === callback.operationId &&
  document.reservationUid === callback.reservationUid &&
  callback.orderId === callback.reservationUid &&
  document.amount === callback.amount;

const toCommand = (
  document: PaymentCallbackDocument,
  callback: CallbackData,
  routeLease: PaymentConfirmationRouteLease,
  markConfirming: () => boolean,
): PaymentConfirmationCommand => ({
  amount: callback.amount,
  orderId: callback.orderId,
  paymentKey: callback.paymentKey,
  reservationUid: callback.reservationUid,
  ownership: {
    operationId: document.operationId,
    accommodationId: document.accommodationId,
    checkIn: document.checkIn,
    checkOut: document.checkOut,
    guestCount: document.guestCount,
  },
  routeLease,
  markConfirming,
});

export function PaymentResultController({
  callback,
  document,
  mode,
  shouldConfirm,
  routeLease,
  session,
  paymentApi = defaultPaymentApi,
  ownershipApi = defaultCheckoutOwnershipApi,
  onCallbackPhaseChange,
  onConfirmed,
  onInvalid,
  onOpenProfile,
  onOpenReservation,
  onRecoverable,
  onTerminalFailure,
}: PaymentResultControllerProps) {
  const [machine, dispatch] = useReducer(
    paymentMachineReducer,
    undefined,
    createInitialPaymentMachineState,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const operationCounterRef = useRef(0);
  const activeOperationRef = useRef<number | null>(null);
  const autoStartedRef = useRef<string | null>(null);
  const workflow = useMemo(
    () =>
      createPaymentConfirmationWorkflow({
        api: paymentApi,
        ownershipApi,
        session: {
          captureAuthenticatedSession: session.captureAuthenticatedSession,
          isCurrentSession: session.isCurrentSession,
        },
      }),
    [
      ownershipApi,
      paymentApi,
      session.captureAuthenticatedSession,
      session.isCurrentSession,
    ],
  );
  useStrictModeSafeDisposable(workflow);

  const handleResult = useCallback(
    async (
      result: PaymentConfirmationResult,
      operationId: number,
      source: "success" | "failure",
    ) => {
      if (!routeLease.isCurrent()) return;

      switch (result.status) {
        case "confirmed":
          dispatch({ type: "PAYMENT_CONFIRMED", operationId });
          await onConfirmed();
          return;
        case "pending":
          dispatch({ type: "PAYMENT_PENDING", operationId });
          if (source === "success") {
            if (onCallbackPhaseChange("reconciling")) onRecoverable();
            else onInvalid();
          } else {
            setStatusMessage(
              "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
            );
          }
          return;
        case "preflight-retryable-error":
          dispatch({ type: "PAYMENT_RETRYABLE_FAILURE", operationId });
          if (source === "success") {
            onRecoverable();
          } else {
            setStatusMessage(
              "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
          }
          return;
        case "retryable-error":
          dispatch({ type: "PAYMENT_RETRYABLE_FAILURE", operationId });
          if (source === "success") {
            if (onCallbackPhaseChange("reconciling")) onRecoverable();
            else onInvalid();
          } else {
            setStatusMessage(
              "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
          }
          return;
        case "invalid":
          dispatch({ type: "PAYMENT_INVALID", operationId });
          onInvalid();
          return;
        case "terminal-failure":
          dispatch({ type: "PAYMENT_TERMINAL_FAILURE", operationId });
          onTerminalFailure();
          return;
        case "stale":
          dispatch({ type: "PAYMENT_STALE", operationId });
          return;
        case "locked":
          return;
      }
    },
    [
      onCallbackPhaseChange,
      onConfirmed,
      onInvalid,
      onRecoverable,
      onTerminalFailure,
      routeLease,
    ],
  );

  const run = useCallback(
    (kind: "confirm" | "reconcile", source: "success" | "failure") => {
      if (activeOperationRef.current !== null) return;
      if (!document || !callback || !joinedDocuments(document, callback)) {
        onInvalid();
        return;
      }
      if (
        kind === "reconcile" &&
        !onCallbackPhaseChange("reconciling")
      ) {
        onInvalid();
        return;
      }

      const operationId = ++operationCounterRef.current;
      activeOperationRef.current = operationId;
      dispatch({
        type:
          kind === "confirm"
            ? "CONFIRM_STARTED"
            : "RECONCILIATION_STARTED",
        operationId,
      });
      setStatusMessage(null);
      const command = toCommand(
        document,
        callback,
        routeLease,
        () => onCallbackPhaseChange("confirming"),
      );
      const pending =
        kind === "confirm"
          ? workflow.confirm(command)
          : workflow.reconcile(command);
      void pending
        .then((result) => {
          if (activeOperationRef.current !== operationId) return;
          return handleResult(result, operationId, source);
        })
        .finally(() => {
          if (activeOperationRef.current === operationId) {
            activeOperationRef.current = null;
          }
        });
    },
    [
      callback,
      document,
      handleResult,
      onCallbackPhaseChange,
      onInvalid,
      routeLease,
      workflow,
    ],
  );

  useEffect(() => {
    if (mode !== "success") return;
    if (!document || !callback || !joinedDocuments(document, callback)) {
      onInvalid();
      return;
    }

    const autoKey = [
      callback.operationId,
      callback.reservationUid,
      callback.paymentKey,
      callback.amount,
      shouldConfirm ? "confirm" : "reconcile",
    ].join(":");
    if (autoStartedRef.current === autoKey) return;
    autoStartedRef.current = autoKey;
    run(shouldConfirm ? "confirm" : "reconcile", "success");
  }, [callback, document, mode, onInvalid, run, shouldConfirm]);

  if (mode === "success") {
    return <PaymentResultScreen mode="processing" />;
  }

  return (
    <PaymentResultScreen
      mode="failure"
      isReconciling={machine.status === "reconciling"}
      statusMessage={statusMessage}
      onOpenProfile={onOpenProfile}
      onOpenReservation={onOpenReservation}
      onReconcile={
        document && callback && joinedDocuments(document, callback)
          ? () =>
              run(
                shouldConfirm ? "confirm" : "reconcile",
                "failure",
              )
          : undefined
      }
    />
  );
}

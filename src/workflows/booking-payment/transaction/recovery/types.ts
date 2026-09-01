import type { PaymentOperationApiPort } from "../../../../features/reservations/payment/public";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type { createBookingPaymentJournalRepository } from "../../journal";

export interface BookingPaymentRecoveryRouteLease {
  isCurrent(): boolean;
}

interface BookingPaymentRecoverySessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export interface BookingPaymentSuccessCallback {
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly firstCapturedAt: number;
}

/**
 * The only credential-free pre-Accepted recovery handle accepted by the
 * workflow. Its shape intentionally matches the router's exact v2 flow-state
 * codec so it is safe to retain in same-tab history state.
 */
export interface BookingPaymentConfirmationResumeReferenceState {
  readonly purpose: "booking-payment-flow-reference";
  readonly version: 2;
  readonly flowId: string;
  readonly locator: {
    readonly kind: "reservation";
    readonly reservationUid: string;
  };
}

export interface BookingPaymentOperationReference {
  readonly flowId: string;
  readonly operationId: string;
  readonly reservationUid: string;
}

interface BookingPaymentReservationDetailFallback {
  readonly kind: "reservation-detail";
  readonly reservationUid: string;
}

type BookingPaymentRecoveryTerminalReason =
  "conflict" | "identity" | "invariant";

type BookingPaymentConfirmationCommandResult =
  | {
      readonly status: "operation-accepted";
      readonly reference: BookingPaymentOperationReference;
      readonly cleanup: "complete" | "pending";
    }
  | {
      readonly status: "receipt-authoritative";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "auth-required" }
  | {
      readonly status: "recovery-unavailable";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | {
      readonly status: "retryable";
      readonly stage: "confirm" | "receipt-handoff" | "storage";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | {
      readonly status: "terminal-failure";
      readonly reason: BookingPaymentRecoveryTerminalReason;
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "stale" }
  | { readonly status: "busy" };

export type BookingPaymentCallbackClaimResult =
  | {
      readonly status: "confirmation-ready";
      readonly reference: BookingPaymentConfirmationResumeReferenceState;
    }
  | {
      readonly status: "receipt-authoritative";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "auth-required" }
  | { readonly status: "invalid-callback" }
  | {
      readonly status: "recovery-unavailable";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | {
      readonly status: "retryable";
      readonly stage: "storage";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | {
      readonly status: "terminal-failure";
      readonly reason: BookingPaymentRecoveryTerminalReason;
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "stale" };

export type BookingPaymentConfirmationResumeResult =
  | BookingPaymentConfirmationCommandResult
  | { readonly status: "invalid-reference" };

export type BookingPaymentSafeOperationObservation =
  | {
      readonly status: "PENDING" | "PROCESSING";
      readonly updatedAt: string;
      readonly nextAction: "POLL";
      readonly retryAfterSeconds: number;
      readonly userFailureCode: null;
      readonly serverTime: string;
    }
  | {
      readonly status: "REQUIRES_REVIEW";
      readonly updatedAt: string;
      readonly nextAction: "CONTACT_SUPPORT";
      readonly retryAfterSeconds: number;
      readonly userFailureCode: "PAYMENT_REVIEW_REQUIRED";
      readonly serverTime: string;
    }
  | {
      readonly status: "SUCCEEDED";
      readonly updatedAt: string;
      readonly nextAction: "NONE";
      readonly retryAfterSeconds: null;
      readonly userFailureCode: null;
      readonly serverTime: string;
    }
  | {
      readonly status: "FAILED";
      readonly updatedAt: string;
      readonly nextAction: "NONE" | "START_NEW_CHECKOUT";
      readonly retryAfterSeconds: null;
      readonly userFailureCode: "PAYMENT_DECLINED";
      readonly serverTime: string;
    };

export type BookingPaymentOperationRecoveryResult =
  | {
      readonly status: "unresolved";
      readonly reference: BookingPaymentOperationReference;
      readonly observation: Extract<
        BookingPaymentSafeOperationObservation,
        { readonly status: "PENDING" | "PROCESSING" | "REQUIRES_REVIEW" }
      >;
    }
  | {
      readonly status: "succeeded";
      readonly reference: BookingPaymentOperationReference;
      readonly observation: Extract<
        BookingPaymentSafeOperationObservation,
        { readonly status: "SUCCEEDED" }
      >;
    }
  | {
      readonly status: "failed";
      readonly reference: BookingPaymentOperationReference;
      readonly observation: Extract<
        BookingPaymentSafeOperationObservation,
        { readonly status: "FAILED" }
      >;
    }
  | {
      readonly status: "retryable";
      readonly reference: BookingPaymentOperationReference;
      readonly retryAfterSeconds: number;
    }
  | {
      readonly status: "verified-expired";
      readonly reference: BookingPaymentOperationReference;
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "auth-required" }
  | { readonly status: "invalid-reference" }
  | {
      readonly status: "recovery-unavailable";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "stale" }
  | { readonly status: "busy" };

export type BookingPaymentTerminalAcknowledgementResult =
  | { readonly status: "acknowledged" }
  | { readonly status: "auth-required" }
  | { readonly status: "invalid-reference" }
  | { readonly status: "not-terminal" }
  | {
      readonly status: "retryable";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | {
      readonly status: "recovery-unavailable";
      readonly fallback: BookingPaymentReservationDetailFallback;
    }
  | { readonly status: "stale" };

export interface BookingPaymentRecoveryWorkflow {
  claimCallback(
    callback: BookingPaymentSuccessCallback,
  ): BookingPaymentCallbackClaimResult;
  recoverClaimedCallback(
    reservationUid: string,
  ): BookingPaymentCallbackClaimResult;
  resumeConfirmation(
    reference: BookingPaymentConfirmationResumeReferenceState,
  ): Promise<BookingPaymentConfirmationResumeResult>;
  pollOperation(
    reference: BookingPaymentOperationReference,
  ): Promise<BookingPaymentOperationRecoveryResult>;
  acknowledgeTerminal(
    reference: BookingPaymentOperationReference,
  ): BookingPaymentTerminalAcknowledgementResult;
  dispose(): void;
}

export interface BookingPaymentRecoveryWorkflowDependencies {
  readonly api: PaymentOperationApiPort;
  readonly repository: ReturnType<typeof createBookingPaymentJournalRepository>;
  readonly routeLease: BookingPaymentRecoveryRouteLease;
  readonly session: BookingPaymentRecoverySessionPort;
}

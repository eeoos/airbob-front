type PaymentCurrency = "KRW";

export const RESERVATION_PAYMENT_STATUSES = [
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "CANCELLATION_PENDING",
  "CANCELLED",
  "CANCELLATION_FAILED",
  "EXPIRED",
] as const;

export type ReservationPaymentStatus =
  (typeof RESERVATION_PAYMENT_STATUSES)[number];

export interface PaymentAttempt {
  readonly paymentAttemptId: string;
  readonly orderId: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly holdExpiresAt: string;
  readonly remainingSeconds: number;
  readonly serverTime: string;
}

export interface ReservationHoldRelease {
  readonly reservationUid: string;
  readonly status: ReservationPaymentStatus;
  readonly releasedNow: boolean;
  readonly serverTime: string;
}

export interface PaymentOperationConfirmation {
  readonly paymentKey: string;
  readonly orderId: string;
  readonly amount: number;
  readonly paymentAttemptId: string;
}

export interface PaymentOperationAccepted {
  readonly operationId: string;
}

export type PaymentOperationStatus =
  "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REQUIRES_REVIEW";

export type PaymentOperationNextAction =
  "POLL" | "START_NEW_CHECKOUT" | "CONTACT_SUPPORT" | "NONE";

type PaymentOperationUserFailureCode =
  "PAYMENT_DECLINED" | "PAYMENT_REVIEW_REQUIRED";

export interface PaymentOperationDetail {
  readonly operationId: string;
  readonly orderId: string;
  readonly status: PaymentOperationStatus;
  readonly updatedAt: string;
  readonly nextAction: PaymentOperationNextAction;
  /** Raw backend hint. The workflow owns the 2..30 second clamp policy. */
  readonly retryAfterSeconds: number | null;
  readonly serverTime: string;
  readonly userFailureCode: PaymentOperationUserFailureCode | null;
}

export interface PaymentCommandOptions {
  readonly signal?: AbortSignal;
}

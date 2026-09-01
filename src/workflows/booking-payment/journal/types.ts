import type { StorageAccessError } from "../../../platform/storage/sessionStorageDriver";

type BookingPaymentReservationStatus =
  | "PAYMENT_PENDING"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "CANCELLATION_PENDING"
  | "CANCELLED"
  | "CANCELLATION_FAILED"
  | "EXPIRED";

export interface BookingPaymentRuntimeLease {
  readonly runtimeLeaseId: string;
  readonly sessionEpoch: number;
}

export interface BookingPaymentServerIntent {
  readonly accommodationId: number;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly guestCount: number;
  readonly couponId: number | null;
}

export interface BookingPaymentPresentationIntent {
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
}

export interface BookingPaymentQuote {
  readonly quoteUid: string;
  readonly accommodationId: number;
  readonly orderName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly nightlyPrice: number;
  readonly nights: number;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly amount: number;
  readonly currency: string;
  readonly paymentRequired: boolean;
  readonly inventoryHeld: boolean;
  readonly quoteExpiresAt: string;
  readonly serverTime: string;
}

export interface BookingPaymentCheckout {
  readonly method: "POST";
  readonly resource: "/api/v1/reservations";
  readonly body: {
    readonly quoteUid: string;
    readonly requestMessage: null;
  };
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface BookingPaymentReady {
  readonly reservationUid: string;
  readonly orderName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly amount: number;
  readonly currency: string;
  readonly status: BookingPaymentReservationStatus;
  readonly paymentRequired: boolean;
  readonly paymentAllowed: boolean;
  readonly holdExpiresAt: string | null;
  readonly serverTime: string;
}

export interface BookingPaymentAttempt {
  readonly paymentAttemptId: string;
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly holdExpiresAt: string;
  readonly remainingSeconds: number;
  readonly serverTime: string;
}

export interface BookingPaymentRelease {
  readonly reservationUid: string;
  readonly status: BookingPaymentReservationStatus;
  readonly releasedNow: boolean;
  readonly serverTime: string;
}

interface BookingPaymentJournalDataBase {
  readonly flowId: string;
  readonly serverIntent: BookingPaymentServerIntent;
  readonly presentationIntent: BookingPaymentPresentationIntent;
  readonly recoveryExpiresAt: number;
  readonly quote: BookingPaymentQuote;
}

interface BookingPaymentCheckoutData extends BookingPaymentJournalDataBase {
  readonly checkout: BookingPaymentCheckout;
}

interface BookingPaymentReadyData extends BookingPaymentCheckoutData {
  readonly ready: BookingPaymentReady;
}

interface BookingPaymentAttemptData extends BookingPaymentReadyData {
  readonly attempt: BookingPaymentAttempt;
}

interface BookingPaymentQuotedData extends BookingPaymentJournalDataBase {
  readonly phase: "quoted";
}

interface BookingPaymentCheckoutPreparedData extends BookingPaymentCheckoutData {
  readonly phase: "checkout-prepared";
}

interface BookingPaymentCheckoutSubmittingData extends BookingPaymentCheckoutData {
  readonly phase: "checkout-submitting";
}

interface BookingPaymentComplimentaryObservedData extends BookingPaymentReadyData {
  readonly phase: "complimentary-observed";
}

interface BookingPaymentReservationReadyData extends BookingPaymentReadyData {
  readonly phase: "reservation-ready";
}

interface BookingPaymentReservationStatusObservedData extends BookingPaymentReadyData {
  readonly phase: "reservation-status-observed";
}

interface BookingPaymentAttemptRequestingData extends BookingPaymentReadyData {
  readonly phase: "attempt-requesting";
}

interface BookingPaymentAttemptReadyData extends BookingPaymentAttemptData {
  readonly phase: "attempt-ready";
}

interface BookingPaymentCallbackReceivedData extends BookingPaymentAttemptData {
  readonly phase: "callback-received";
}

interface BookingPaymentConfirmSubmittingData extends BookingPaymentAttemptData {
  readonly phase: "confirm-submitting";
}

interface BookingPaymentHoldReleaseRequestingBeforeAttemptData extends BookingPaymentReadyData {
  readonly phase: "hold-release-requesting";
}

interface BookingPaymentHoldReleaseRequestingAfterAttemptData extends BookingPaymentAttemptData {
  readonly phase: "hold-release-requesting";
}

interface BookingPaymentHoldReleasedBeforeAttemptData extends BookingPaymentReadyData {
  readonly phase: "hold-released";
  readonly release: BookingPaymentRelease;
}

interface BookingPaymentHoldReleasedAfterAttemptData extends BookingPaymentAttemptData {
  readonly phase: "hold-released";
  readonly release: BookingPaymentRelease;
}

export type BookingPaymentJournalData =
  | BookingPaymentQuotedData
  | BookingPaymentCheckoutPreparedData
  | BookingPaymentCheckoutSubmittingData
  | BookingPaymentComplimentaryObservedData
  | BookingPaymentReservationReadyData
  | BookingPaymentReservationStatusObservedData
  | BookingPaymentAttemptRequestingData
  | BookingPaymentAttemptReadyData
  | BookingPaymentCallbackReceivedData
  | BookingPaymentConfirmSubmittingData
  | BookingPaymentHoldReleaseRequestingBeforeAttemptData
  | BookingPaymentHoldReleaseRequestingAfterAttemptData
  | BookingPaymentHoldReleasedBeforeAttemptData
  | BookingPaymentHoldReleasedAfterAttemptData;

export type BookingPaymentJournalPhase = BookingPaymentJournalData["phase"];

export interface BookingPaymentJournalEnvelope {
  readonly purpose: "booking-payment-journal";
  readonly version: 2;
  readonly privacyClass: "sensitive";
  readonly containsPii: false;
  readonly owner: string;
  readonly createdAt: number;
  readonly hardExpiresAt: number;
  readonly lease: BookingPaymentRuntimeLease;
  readonly data: BookingPaymentJournalData;
}

export type BookingPaymentRecoveryLocator =
  | {
      readonly kind: "accommodation";
      readonly accommodationId: number;
    }
  | { readonly kind: "reservation"; readonly reservationUid: string };

export type BookingPaymentNamespaceInspectionResult =
  | { readonly status: "ready" }
  | {
      readonly status: "blocked";
      readonly reason: "v2-state-present";
    }
  | {
      readonly status: "blocked";
      readonly reason: "storage-error";
      readonly error: StorageAccessError;
    };

export type BookingPaymentJournalReadResult =
  | { readonly status: "found"; readonly record: BookingPaymentJournalEnvelope }
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "malformed"
        | "foreign-owner"
        | "expired"
        | "invalid-clock"
        | "stale-lease"
        | "flow-mismatch"
        | "locator-mismatch";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type BookingPaymentJournalWriteResult =
  | {
      readonly status: "written";
      readonly record: BookingPaymentJournalEnvelope;
    }
  | { readonly status: "unchanged" }
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "existing-journal"
        | "active-journal"
        | "foreign-journal"
        | "opaque-v2-state"
        | "cleanup-not-verified"
        | "missing-journal"
        | "malformed"
        | "foreign-owner"
        | "expired"
        | "invalid-clock"
        | "invalid-data"
        | "stale-lease"
        | "flow-mismatch"
        | "locator-mismatch"
        | "phase-mismatch"
        | "illegal-transition"
        | "immutable-group-change"
        | "serialization-error"
        | "write-not-verified";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type BookingPaymentJournalAcknowledgeResult =
  | { readonly status: "cleared" }
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "malformed"
        | "foreign-owner"
        | "expired"
        | "invalid-clock"
        | "stale-lease"
        | "flow-mismatch"
        | "locator-mismatch"
        | "phase-mismatch"
        | "not-terminal"
        | "remove-not-verified";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type BookingPaymentUnheldFlowCloseReason =
  | { readonly type: "quote-abandoned" }
  | {
      readonly type: "checkout-definitively-rejected";
      readonly code: "R017" | "R018" | "R019";
    };

export type BookingPaymentUnheldFlowCloseResult =
  | { readonly status: "cleared" }
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "missing-journal"
        | "malformed"
        | "foreign-owner"
        | "expired"
        | "invalid-clock"
        | "stale-lease"
        | "flow-mismatch"
        | "locator-mismatch"
        | "phase-mismatch"
        | "invalid-close-reason"
        | "opaque-v2-state"
        | "remove-not-verified";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type BookingPaymentCandidateReconciliationResult =
  | { readonly status: "ready" }
  | { readonly status: "recovery-required" }
  | { readonly status: "recovery-unavailable" }
  | {
      readonly status: "blocked";
      readonly reason:
        | "unknown-v2-state"
        | "newer-version"
        | "malformed-unknown-version"
        | "cleanup-not-verified"
        | "invalid-clock";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

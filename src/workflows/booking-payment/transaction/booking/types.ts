import type {
  ReservationBookingApiPort,
  ReservationBookingStatus,
} from "../../../../features/reservations/booking/public";
import type { PaymentOperationApiPort } from "../../../../features/reservations/payment/public";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type {
  PaymentGatewayError,
  PaymentGatewayPort,
} from "../../checkout/paymentGateway";
import type { createBookingPaymentJournalRepository } from "../../journal/repository";
import type {
  BookingPaymentJournalPhase,
  BookingPaymentRecoveryLocator,
} from "../../journal/types";

export type BookingTransactionValidationCode =
  | "INVALID_ACCOMMODATION"
  | "INVALID_DATE"
  | "INVALID_DATE_RANGE"
  | "INVALID_AVAILABILITY"
  | "OUTSIDE_BOOKING_WINDOW"
  | "UNAVAILABLE_DATE"
  | "INVALID_OCCUPANCY"
  | "INVALID_COUPON";

export interface BookingTransactionStartIntent {
  readonly type: "reservation.start";
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
  readonly couponId: number | null;
}

interface BookingTransactionAccommodationSnapshot {
  readonly id: number;
  readonly maxOccupancy: number;
  readonly maxInfants: number;
  readonly maxPets: number;
}

interface BookingTransactionAvailabilitySnapshot {
  readonly accommodationId: number;
  readonly bookingWindowStartInclusive: string;
  readonly bookingWindowEndExclusive: string;
  readonly unavailableRanges: readonly {
    readonly startDate: string;
    readonly endDateExclusive: string;
  }[];
}

export interface BookingTransactionAppliedCoupon {
  readonly id: number;
  readonly name: string;
  readonly discount: number;
}

export interface BookingTransactionRouteLease {
  isCurrent(): boolean;
}

export interface BookingTransactionSessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export interface BookingTransactionHandle {
  readonly flowId: string;
  readonly locator: BookingPaymentRecoveryLocator;
}

export interface BookingTransactionSnapshot {
  readonly phase: BookingPaymentJournalPhase;
  readonly flowId: string;
  readonly accommodationId: number;
  readonly reservationUid: string | null;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
  readonly orderName: string;
  readonly nightlyPrice: number;
  readonly nights: number;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly amount: number;
  readonly currency: string;
  readonly couponDisplayName: string | null;
  readonly quoteExpiresAt: string;
  readonly serverTime: string;
  readonly paymentRequired: boolean;
  readonly reservationStatus: ReservationBookingStatus | null;
  readonly paymentAllowed: boolean;
  readonly holdExpiresAt: string | null;
  readonly canCheckout: boolean;
  readonly canPay: boolean;
  readonly canRetryPayment: boolean;
  readonly canReleaseHold: boolean;
}

export interface BookingTransactionReservationStatusObservation {
  readonly reservationUid: string;
  readonly status: ReservationBookingStatus;
  readonly paymentAllowed: boolean;
  readonly holdExpiresAt: string | null;
  readonly serverTime: string;
}

export interface BookingTransactionRequestFailure {
  readonly code: string;
  readonly retryable: boolean;
}

export interface BookingTransactionQuoteInput {
  readonly intent: BookingTransactionStartIntent;
  readonly accommodation: BookingTransactionAccommodationSnapshot;
  readonly availability: BookingTransactionAvailabilitySnapshot | null;
  readonly appliedCoupon: BookingTransactionAppliedCoupon | null;
  readonly publishPreparedHandle: (handle: BookingTransactionHandle) => boolean;
  readonly routeLease: BookingTransactionRouteLease;
}

export interface BookingTransactionAuthorityInput {
  readonly handle: BookingTransactionHandle;
  readonly routeLease: BookingTransactionRouteLease;
}

interface BookingTransactionCustomer {
  readonly email: string;
  readonly name: string;
}

export interface BookingTransactionPayInput extends BookingTransactionAuthorityInput {
  readonly customer: BookingTransactionCustomer;
  readonly successUrl: string;
  readonly failUrl: string;
}

export type BookingTransactionAccessFailure =
  | { readonly status: "auth-required" }
  | { readonly status: "stale" }
  | { readonly status: "missing" }
  | {
      readonly status: "blocked";
      readonly reason:
        | "invalid-authority"
        | "storage-unavailable"
        | "persistence-unavailable"
        | "recovery-required";
    }
  | { readonly status: "locked"; readonly terminal: "disposed" };

export type BookingTransactionQuoteResult =
  | {
      readonly status: "invalid";
      readonly error: Error & {
        readonly code: BookingTransactionValidationCode;
      };
    }
  | {
      readonly status: "auth-required";
      readonly intent: BookingTransactionStartIntent;
    }
  | {
      readonly status: "quoted";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "definitive-failure";
      readonly failure: BookingTransactionRequestFailure;
    }
  | {
      readonly status: "retryable-error";
      readonly stage: "quote";
      readonly failure: BookingTransactionRequestFailure;
    }
  | { readonly status: "stale" }
  | { readonly status: "busy" }
  | {
      readonly status: "blocked";
      readonly reason:
        | "retired-state-cleanup"
        | "recovery-required"
        | "storage-unavailable"
        | "persistence-unavailable"
        | "cryptography-unavailable";
    }
  | { readonly status: "locked"; readonly terminal: "disposed" };

export type BookingTransactionLoadResult =
  | {
      readonly status: "ready";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | BookingTransactionAccessFailure;

export type BookingTransactionCheckoutResult =
  | {
      readonly status: "complimentary" | "payment-ready" | "reservation-status";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "current";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "unsupported-payment";
      readonly reason: "currency" | "amount";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "definitive-failure";
      readonly failure: BookingTransactionRequestFailure;
    }
  | {
      readonly status: "conflict";
      readonly code: "R016" | "R020";
    }
  | {
      readonly status: "retryable-error";
      readonly stage: "checkout";
      readonly failure: BookingTransactionRequestFailure;
    }
  | { readonly status: "busy" }
  | BookingTransactionAccessFailure;

export type BookingTransactionPrepareResult =
  | { readonly status: "ready" }
  | { readonly status: "gateway-error"; readonly error: PaymentGatewayError }
  | { readonly status: "busy" }
  | BookingTransactionAccessFailure;

export type BookingTransactionPayResult =
  | {
      readonly status: "gateway-requested";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "gateway-cancelled" | "gateway-error";
      readonly error: PaymentGatewayError;
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "attempt-unavailable";
      readonly failure: BookingTransactionRequestFailure;
    }
  | {
      readonly status: "retryable-error";
      readonly stage: "attempt";
      readonly failure: BookingTransactionRequestFailure;
    }
  | { readonly status: "invalid-payment-request" }
  | { readonly status: "not-payable" }
  | { readonly status: "busy" }
  | BookingTransactionAccessFailure;

export type BookingTransactionReleaseResult =
  | {
      readonly status: "released";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | {
      readonly status: "retryable-error";
      readonly stage: "release";
      readonly failure: BookingTransactionRequestFailure;
    }
  | { readonly status: "not-releasable" }
  | { readonly status: "busy" }
  | BookingTransactionAccessFailure;

export type BookingTransactionAcknowledgementResult =
  | { readonly status: "acknowledged" }
  | { readonly status: "not-terminal" }
  | BookingTransactionAccessFailure;

export type BookingTransactionStatusDriftAcknowledgementResult =
  | { readonly status: "acknowledged" }
  | { readonly status: "not-converged" }
  | BookingTransactionAccessFailure;

export type BookingTransactionAbandonResult =
  | { readonly status: "abandoned" }
  | { readonly status: "not-abandonable" }
  | BookingTransactionAccessFailure;

export interface BookingTransactionWorkflow {
  quote(
    input: BookingTransactionQuoteInput,
  ): Promise<BookingTransactionQuoteResult>;
  load(input: BookingTransactionAuthorityInput): BookingTransactionLoadResult;
  checkout(
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionCheckoutResult>;
  prepareGateway(
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionPrepareResult>;
  pay(input: BookingTransactionPayInput): Promise<BookingTransactionPayResult>;
  releaseHold(
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionReleaseResult>;
  acknowledgeTerminal(
    input: BookingTransactionAuthorityInput,
  ): BookingTransactionAcknowledgementResult;
  acknowledgeReservationStatusDrift(
    input: BookingTransactionAuthorityInput & {
      readonly observation: BookingTransactionReservationStatusObservation;
    },
  ): BookingTransactionStatusDriftAcknowledgementResult;
  abandonUnheld(
    input: BookingTransactionAuthorityInput,
  ): BookingTransactionAbandonResult;
  dispose(): void;
}

type BookingPaymentJournalRepository = ReturnType<
  typeof createBookingPaymentJournalRepository
>;

export interface BookingTransactionWorkflowDependencies {
  readonly bookingApi: ReservationBookingApiPort;
  readonly paymentApi: Pick<
    PaymentOperationApiPort,
    "beginPaymentAttempt" | "releaseHold"
  >;
  readonly gateway: PaymentGatewayPort;
  readonly session: BookingTransactionSessionPort;
  readonly journal?: BookingPaymentJournalRepository;
  readonly clearRetiredState?: () =>
    | { readonly status: "cleared"; readonly removed: number }
    | {
        readonly status: "partial";
        readonly removed: number;
        readonly failed: number;
      }
    | { readonly status: "storage-error" };
  readonly createUuid?: () => string;
  readonly fingerprint?: (exactBody: string) => Promise<string>;
}

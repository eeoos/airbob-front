import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type {
  SessionStorageDriver,
  StorageAccessError,
} from "../../../platform/storage/sessionStorageDriver";
import type { VersionedStorageRejectionReason } from "../../../platform/storage/versionedSessionStorage";

declare const bookingPaymentOperationIdBrand: unique symbol;

export type BookingPaymentOperationId = string & {
  readonly [bookingPaymentOperationIdBrand]: "BookingPaymentOperationId";
};

export interface CheckoutData {
  readonly operationId: BookingPaymentOperationId;
  readonly accommodationId: number;
  readonly reservationUid: string;
  readonly orderName: string;
  readonly amount: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adultOccupancy: number;
  readonly childOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
  readonly couponName: string | null;
  readonly couponDiscount: number | null;
}

export type CheckoutWriteData = Omit<CheckoutData, "operationId">;

export interface CheckoutHandoffState {
  readonly checkoutHandoff: {
    readonly purpose: "reservation-checkout";
    readonly version: 1;
    readonly operationId: BookingPaymentOperationId;
  };
}

export type CallbackPhase = "received" | "confirming" | "reconciling";

export interface CallbackData {
  readonly operationId: BookingPaymentOperationId;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly phase: CallbackPhase;
}

export interface BookingPaymentRepositoryDependencies {
  readonly driver?: SessionStorageDriver;
  readonly now?: () => number;
  readonly getEpoch: () => string | number;
  readonly createOperationId?: () => string;
}

export interface SubjectOwnedWriteInput<T> {
  readonly scope: AuthenticatedSessionScope;
  readonly data: T;
  readonly isCurrent: () => boolean;
}

export type SubjectOwnedWriteResult<T, Extra extends object = object> =
  | ({ readonly status: "written"; readonly data: T } & Extra)
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "invalid-owner"
        | "invalid-data"
        | "invalid-operation-id"
        | "invalid-clock"
        | "serialization-error";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type SubjectOwnedReadRejectionReason =
  | VersionedStorageRejectionReason
  | "invalid-owner"
  | "clock-error"
  | "stale-session"
  | "invalid-route"
  | "invalid-handoff"
  | "operation-mismatch"
  | "reservation-mismatch"
  | "accommodation-mismatch";

export type SubjectOwnedReadResult<T> =
  | { readonly status: "found"; readonly data: T }
  | { readonly status: "missing" }
  | {
      readonly status: "rejected";
      readonly reason: SubjectOwnedReadRejectionReason;
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type SubjectOwnedClearResult =
  | { readonly status: "cleared" }
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason: SubjectOwnedReadRejectionReason;
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export interface LegacyCheckoutVerificationInput {
  readonly accommodationId: number;
  readonly reservationUid: string;
  readonly orderName: string;
  readonly amount: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
}

export type LegacyCheckoutVerificationResult =
  | { readonly status: "verified" }
  | { readonly status: "mismatch" }
  | { readonly status: "retryable-error" };

export type VerifyLegacyCheckout = (
  candidate: LegacyCheckoutVerificationInput,
) => Promise<LegacyCheckoutVerificationResult>;

export interface LegacyCheckoutMigrationInput {
  readonly scope: AuthenticatedSessionScope;
  readonly accommodationId: number;
  readonly rawLegacyLocationCandidate?: unknown;
  readonly verify: VerifyLegacyCheckout;
  readonly isCurrent: () => boolean;
}

export type LegacyCheckoutMigrationResult =
  | {
      readonly status: "migrated" | "target-wins";
      readonly data: CheckoutData;
      readonly handle: CheckoutHandoffState;
    }
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | { readonly status: "verification-retryable" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "invalid-route"
        | "invalid-legacy-data"
        | "index-mismatch"
        | "verification-failed"
        | "cleanup-failed";
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export interface CheckoutRepository {
  write(
    input: SubjectOwnedWriteInput<CheckoutWriteData>,
  ): SubjectOwnedWriteResult<
    CheckoutData,
    { readonly handle: CheckoutHandoffState }
  >;
  read(input: {
    readonly scope: AuthenticatedSessionScope;
    readonly accommodationId: number;
    readonly locationState?: unknown;
  }): SubjectOwnedReadResult<CheckoutData>;
  readForCallback(input: {
    readonly scope: AuthenticatedSessionScope;
    readonly reservationUid: string;
  }): SubjectOwnedReadResult<CheckoutData>;
  clear(input: {
    readonly scope: AuthenticatedSessionScope;
    readonly isCurrent?: () => boolean;
  }): SubjectOwnedClearResult;
  migrateLegacy(
    input: LegacyCheckoutMigrationInput,
  ): Promise<LegacyCheckoutMigrationResult>;
}

export interface CallbackRepository {
  write(
    input: SubjectOwnedWriteInput<CallbackData>,
  ): SubjectOwnedWriteResult<CallbackData>;
  read(input: {
    readonly scope: AuthenticatedSessionScope;
    readonly operationId?: BookingPaymentOperationId;
  }): SubjectOwnedReadResult<CallbackData>;
  clear(input: {
    readonly scope: AuthenticatedSessionScope;
    readonly isCurrent?: () => boolean;
  }): SubjectOwnedClearResult;
  consumeLegacyConfirmedPaymentHint(input: {
    readonly orderId: string;
    readonly paymentKey: string;
    readonly amount: number;
  }):
    | { readonly status: "hint"; readonly shouldReconcile: boolean }
    | { readonly status: "rejected" }
    | { readonly status: "storage-error"; readonly error: StorageAccessError };
}

export type ClearBookingPaymentBrowserStateResult =
  | { readonly status: "cleared"; readonly removed: number }
  | {
      readonly status: "partial";
      readonly removed: number;
      readonly failed: number;
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

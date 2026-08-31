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

type CheckoutWriteData = Omit<CheckoutData, "operationId">;

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

interface SubjectOwnedWriteInput<T> {
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

type SubjectOwnedReadRejectionReason =
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
}

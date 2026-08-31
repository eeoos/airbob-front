import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { type SessionStorageDriver } from "../../../platform/storage/sessionStorageDriver";
import { bookingPaymentStorageDriver } from "../../../platform/storage/bookingPaymentStorageDriver";
import {
  createVersionedSessionStorage,
  type VersionedSessionStorage,
  type VersionedStorageReadResult,
  type VersionedStorageWriteResult,
} from "../../../platform/storage/versionedSessionStorage";
import type {
  BookingPaymentOperationId,
  BookingPaymentRepositoryDependencies,
  CallbackData,
  CallbackRepository,
  CheckoutData,
  CheckoutHandoffState,
  CheckoutRepository,
  ClearBookingPaymentBrowserStateResult,
  SubjectOwnedClearResult,
  SubjectOwnedReadResult,
  SubjectOwnedWriteResult,
} from "./types";
import { isOpaqueIdentifier } from "../../../shared/lib/opaqueIdentifier";
import {
  callbackDataKeys,
  checkoutDataKeys,
  isBookingPaymentOperationId,
  isCallbackData,
  isCheckoutData,
  isCheckoutHandoffState,
} from "./validation";

const namespace = "airbob:booking-payment-v1";
const checkoutSlot = "checkout";
const callbackSlot = "callback";
const retiredBookingPaymentPrefixes = Object.freeze([
  "airbob:reservation-checkout:",
  "airbob:reservation-checkout-index:",
  "airbob:payment-confirmed:",
]);
const checkoutTtlMs = 60 * 60 * 1000;
const callbackTtlMs = 15 * 60 * 1000;

const defaultOperationId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) return randomUUID();

  return `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 14)}`;
};

const safeCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const isScopeCurrent = (
  scope: AuthenticatedSessionScope,
  getEpoch: () => string | number,
  isCurrent: () => boolean,
): boolean =>
  safeCheck(isCurrent) && safeCheck(() => getEpoch() === scope.epoch);

const isReadScopeCurrent = (
  scope: AuthenticatedSessionScope,
  getEpoch: () => string | number,
): boolean => safeCheck(() => getEpoch() === scope.epoch);

const toHandoff = (
  operationId: BookingPaymentOperationId,
): CheckoutHandoffState =>
  Object.freeze({
    checkoutHandoff: Object.freeze({
      purpose: "reservation-checkout" as const,
      version: 1 as const,
      operationId,
    }),
  });

const createCheckoutStorage = (
  driver: SessionStorageDriver,
  now: () => number,
): VersionedSessionStorage<CheckoutData> =>
  createVersionedSessionStorage<CheckoutData>({
    namespace,
    slot: checkoutSlot,
    purpose: "reservation-checkout",
    version: 1,
    privacyClass: "personal",
    containsPii: false,
    ttlMs: checkoutTtlMs,
    dataKeys: checkoutDataKeys,
    validateData: isCheckoutData,
    driver,
    now,
  });

const createCallbackStorage = (
  driver: SessionStorageDriver,
  now: () => number,
): VersionedSessionStorage<CallbackData> =>
  createVersionedSessionStorage<CallbackData>({
    namespace,
    slot: callbackSlot,
    purpose: "payment-callback",
    version: 1,
    privacyClass: "sensitive",
    containsPii: false,
    ttlMs: callbackTtlMs,
    dataKeys: callbackDataKeys,
    validateData: isCallbackData,
    driver,
    now,
  });

const mapReadResult = <T extends object>(
  result: VersionedStorageReadResult<T>,
): SubjectOwnedReadResult<T> => {
  switch (result.status) {
    case "found":
      return { status: "found", data: result.record.data };
    case "missing":
      return result;
    case "invalid-owner":
      return { status: "rejected", reason: "invalid-owner" };
    case "clock-error":
      return { status: "rejected", reason: "clock-error" };
    case "rejected":
      return { status: "rejected", reason: result.reason };
    case "storage-error":
      return result;
  }
};

const mapWriteResult = <T>(
  result: VersionedStorageWriteResult,
  data: T,
): SubjectOwnedWriteResult<T> => {
  switch (result.status) {
    case "written":
      return { status: "written", data };
    case "stale":
      return result;
    case "invalid-owner":
    case "invalid-data":
    case "invalid-clock":
    case "serialization-error":
      return { status: "rejected", reason: result.status };
    case "storage-error":
      return result;
  }
};

const mapClearRead = <T>(
  result: SubjectOwnedReadResult<T>,
): SubjectOwnedClearResult | null => {
  switch (result.status) {
    case "found":
      return null;
    case "missing":
      return result;
    case "rejected":
      return result;
    case "storage-error":
      return result;
  }
};

const retryNamespaceCleanup = (
  cleanup: () => ClearBookingPaymentBrowserStateResult,
): {
  readonly final: ClearBookingPaymentBrowserStateResult;
  readonly removed: number;
} => {
  const first = cleanup();
  const firstRemoved =
    first.status === "cleared" || first.status === "partial"
      ? first.removed
      : 0;
  if (first.status === "cleared") {
    return { final: first, removed: firstRemoved };
  }

  const second = cleanup();
  const secondRemoved =
    second.status === "cleared" || second.status === "partial"
      ? second.removed
      : 0;
  return {
    final: second,
    removed: firstRemoved + secondRemoved,
  };
};

const clearRetiredBookingPaymentKeys = (
  driver: SessionStorageDriver,
): ClearBookingPaymentBrowserStateResult => {
  const keys = driver.keys();
  if (!keys.ok) return { status: "storage-error", error: keys.error };

  let removed = 0;
  let failed = 0;
  keys.value.forEach((key) => {
    if (
      !retiredBookingPaymentPrefixes.some((prefix) => key.startsWith(prefix))
    ) {
      return;
    }

    if (driver.removeItem(key).ok) removed += 1;
    else failed += 1;
  });

  return failed === 0
    ? { status: "cleared", removed }
    : { status: "partial", removed, failed };
};

export const createBookingPaymentCheckoutRepository = ({
  driver = bookingPaymentStorageDriver,
  now = Date.now,
  getEpoch,
  createOperationId = defaultOperationId,
}: BookingPaymentRepositoryDependencies): CheckoutRepository => {
  const storage = createCheckoutStorage(driver, now);

  const write: CheckoutRepository["write"] = ({ scope, data, isCurrent }) => {
    if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
      return { status: "stale" };
    }

    let rawOperationId: string;
    try {
      rawOperationId = createOperationId();
    } catch {
      return { status: "rejected", reason: "invalid-operation-id" };
    }
    if (!isBookingPaymentOperationId(rawOperationId)) {
      return { status: "rejected", reason: "invalid-operation-id" };
    }

    const checkoutData = Object.freeze({
      ...data,
      operationId: rawOperationId,
    }) as CheckoutData;
    const result = storage.write({
      owner: scope.subject,
      data: checkoutData,
      isCurrent: () => isScopeCurrent(scope, getEpoch, isCurrent),
    });
    const mapped = mapWriteResult(result, checkoutData);

    return mapped.status === "written"
      ? { ...mapped, handle: toHandoff(checkoutData.operationId) }
      : mapped;
  };

  const read: CheckoutRepository["read"] = ({
    scope,
    accommodationId,
    locationState,
  }) => {
    if (!isReadScopeCurrent(scope, getEpoch)) {
      return { status: "rejected", reason: "stale-session" };
    }
    if (!Number.isSafeInteger(accommodationId) || accommodationId <= 0) {
      return { status: "rejected", reason: "invalid-route" };
    }

    const hasHandoff = locationState !== null && locationState !== undefined;
    if (hasHandoff && !isCheckoutHandoffState(locationState)) {
      return { status: "rejected", reason: "invalid-handoff" };
    }

    const result = mapReadResult(storage.read(scope.subject));
    if (result.status !== "found") return result;
    if (result.data.accommodationId !== accommodationId) {
      return { status: "rejected", reason: "accommodation-mismatch" };
    }
    if (
      hasHandoff &&
      isCheckoutHandoffState(locationState) &&
      locationState.checkoutHandoff.operationId !== result.data.operationId
    ) {
      return { status: "rejected", reason: "operation-mismatch" };
    }

    return result;
  };

  const readForCallback: CheckoutRepository["readForCallback"] = ({
    scope,
    reservationUid,
  }) => {
    if (!isReadScopeCurrent(scope, getEpoch)) {
      return { status: "rejected", reason: "stale-session" };
    }
    if (!isOpaqueIdentifier(reservationUid)) {
      return { status: "rejected", reason: "invalid-route" };
    }

    const result = mapReadResult(storage.read(scope.subject));
    if (
      result.status === "found" &&
      result.data.reservationUid !== reservationUid
    ) {
      return { status: "rejected", reason: "reservation-mismatch" };
    }

    return result;
  };

  const clear: CheckoutRepository["clear"] = ({
    scope,
    isCurrent = () => true,
  }) => {
    if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
      return { status: "stale" };
    }

    const current = mapReadResult(storage.read(scope.subject));
    const blocked = mapClearRead(current);
    if (blocked) return blocked;
    if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
      return { status: "stale" };
    }

    return storage.clear();
  };

  return { write, read, readForCallback, clear };
};

export const createBookingPaymentCallbackRepository = ({
  driver = bookingPaymentStorageDriver,
  now = Date.now,
  getEpoch,
}: BookingPaymentRepositoryDependencies): CallbackRepository => {
  const storage = createCallbackStorage(driver, now);
  const checkoutStorage = createCheckoutStorage(driver, now);

  return {
    write({ scope, data, isCurrent }) {
      if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
        return { status: "stale" };
      }
      if (!isCallbackData(data)) {
        return { status: "rejected", reason: "invalid-data" };
      }

      const checkout = mapReadResult(checkoutStorage.read(scope.subject));
      if (checkout.status === "storage-error") return checkout;
      if (
        checkout.status !== "found" ||
        checkout.data.operationId !== data.operationId ||
        checkout.data.reservationUid !== data.reservationUid ||
        checkout.data.reservationUid !== data.orderId ||
        checkout.data.amount !== data.amount
      ) {
        return { status: "rejected", reason: "invalid-data" };
      }
      if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
        return { status: "stale" };
      }

      // A callback is unusable without its joined checkout. Refreshing the
      // longer-lived checkout first guarantees every successful callback write
      // expires before the checkout it needs for recovery.
      const checkoutRefresh = mapWriteResult(
        checkoutStorage.write({
          owner: scope.subject,
          data: checkout.data,
          isCurrent: () => isScopeCurrent(scope, getEpoch, isCurrent),
        }),
        data,
      );
      if (checkoutRefresh.status !== "written") return checkoutRefresh;

      return mapWriteResult(
        storage.write({
          owner: scope.subject,
          data,
          isCurrent: () => isScopeCurrent(scope, getEpoch, isCurrent),
        }),
        data,
      );
    },

    read({ scope, operationId }) {
      if (!isReadScopeCurrent(scope, getEpoch)) {
        return { status: "rejected", reason: "stale-session" };
      }
      if (
        operationId !== undefined &&
        !isBookingPaymentOperationId(operationId)
      ) {
        return { status: "rejected", reason: "invalid-handoff" };
      }

      const result = mapReadResult(storage.read(scope.subject));
      if (
        result.status === "found" &&
        operationId !== undefined &&
        result.data.operationId !== operationId
      ) {
        return { status: "rejected", reason: "operation-mismatch" };
      }

      return result;
    },

    clear({ scope, isCurrent = () => true }) {
      if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
        return { status: "stale" };
      }

      const current = mapReadResult(storage.read(scope.subject));
      const blocked = mapClearRead(current);
      if (blocked) return blocked;
      if (!isScopeCurrent(scope, getEpoch, isCurrent)) {
        return { status: "stale" };
      }

      return storage.clear();
    },
  };
};

export const clearBookingPaymentBrowserState = ({
  driver = bookingPaymentStorageDriver,
}: Pick<
  BookingPaymentRepositoryDependencies,
  "driver"
> = {}): ClearBookingPaymentBrowserStateResult => {
  const currentStorage = createVersionedSessionStorage<CheckoutData>({
    namespace,
    slot: checkoutSlot,
    purpose: "reservation-checkout",
    version: 1,
    privacyClass: "personal",
    containsPii: false,
    ttlMs: checkoutTtlMs,
    dataKeys: checkoutDataKeys,
    validateData: isCheckoutData,
    driver,
  });

  const current = retryNamespaceCleanup(() => currentStorage.clearNamespace());
  const retired = retryNamespaceCleanup(() =>
    clearRetiredBookingPaymentKeys(driver),
  );

  if (current.final.status === "storage-error") return current.final;
  if (retired.final.status === "storage-error") return retired.final;

  const removed = current.removed + retired.removed;
  const failed =
    (current.final.status === "partial" ? current.final.failed : 0) +
    (retired.final.status === "partial" ? retired.final.failed : 0);

  return failed === 0
    ? { status: "cleared", removed }
    : { status: "partial", removed, failed };
};

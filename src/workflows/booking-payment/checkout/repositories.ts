import type {
  AuthenticatedSessionScope,
} from "../../../platform/session/sessionScope";
import {
  createLegacyBookingPaymentStorage,
  type LegacyBookingPaymentCleanupResult,
} from "../../../platform/storage/legacyBookingPaymentStorage";
import {
  type SessionStorageDriver,
} from "../../../platform/storage/sessionStorageDriver";
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
  LegacyCheckoutMigrationResult,
  LegacyCheckoutVerificationResult,
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
  parseLegacyCheckoutCandidate,
} from "./validation";

const namespace = "airbob:booking-payment-v1";
const checkoutSlot = "checkout";
const callbackSlot = "callback";
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
  getEpoch: () => string | number,
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
    getEpoch,
  });

const createCallbackStorage = (
  driver: SessionStorageDriver,
  now: () => number,
  getEpoch: () => string | number,
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
    getEpoch,
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

const isCleanupComplete = (
  result: LegacyBookingPaymentCleanupResult,
): boolean => result.status === "cleared";

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

export const createBookingPaymentCheckoutRepository = ({
  driver = bookingPaymentStorageDriver,
  now = Date.now,
  getEpoch,
  createOperationId = defaultOperationId,
}: BookingPaymentRepositoryDependencies): CheckoutRepository => {
  const storage = createCheckoutStorage(driver, now, getEpoch);
  const legacy = createLegacyBookingPaymentStorage(driver);

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

    const result = storage.clear();
    return result.status === "cleared" ? result : result;
  };

  const cleanupLegacyForTargetOrFailClosed = (
    scope: AuthenticatedSessionScope,
    accommodationId: number,
    targetReservationUid: string,
  ): boolean => {
    const primary = legacy.readCheckout(accommodationId);
    let cleanupResults: LegacyBookingPaymentCleanupResult[];

    if (primary.status === "storage-error") {
      cleanupResults = [primary];
    } else if (primary.status === "found") {
      const candidate = parseLegacyCheckoutCandidate(
        primary.raw,
        accommodationId,
      );
      if (candidate) {
        cleanupResults = [
          legacy.clearCheckout(accommodationId, candidate.reservationUid),
        ];
        if (candidate.reservationUid !== targetReservationUid) {
          cleanupResults.push(
            legacy.clearCheckoutIndex(targetReservationUid),
          );
        }
      } else {
        cleanupResults = [
          legacy.clearCheckoutPrimary(accommodationId),
          legacy.clearCheckoutIndex(targetReservationUid),
        ];
      }
    } else {
      cleanupResults = [legacy.clearCheckoutIndex(targetReservationUid)];
    }

    if (cleanupResults.every(isCleanupComplete)) return true;

    const current = storage.read(scope.subject);
    if (current.status === "found") storage.clear();
    return false;
  };

  const migrateLegacy: CheckoutRepository["migrateLegacy"] = async ({
    scope,
    accommodationId,
    rawLegacyLocationCandidate,
    verify,
    isCurrent,
  }): Promise<LegacyCheckoutMigrationResult> => {
    if (!Number.isSafeInteger(accommodationId) || accommodationId <= 0) {
      return { status: "rejected", reason: "invalid-route" };
    }
    const capturedEpoch = scope.epoch;
    const migrationIsCurrent = () =>
      scope.epoch === capturedEpoch &&
      isScopeCurrent(scope, getEpoch, isCurrent);
    if (!migrationIsCurrent()) return { status: "stale" };

    const locationCandidate =
      rawLegacyLocationCandidate !== undefined
        ? parseLegacyCheckoutCandidate(
            rawLegacyLocationCandidate,
            accommodationId,
          )
        : null;
    if (
      rawLegacyLocationCandidate !== undefined &&
      locationCandidate === null
    ) {
      const cleanup = legacy.clearCheckoutPrimary(accommodationId);
      if (cleanup.status === "storage-error") return cleanup;
      return isCleanupComplete(cleanup)
        ? { status: "rejected", reason: "invalid-legacy-data" }
        : { status: "rejected", reason: "cleanup-failed" };
    }

    const target = mapReadResult(storage.read(scope.subject));
    if (target.status === "storage-error") return target;
    if (target.status === "found") {
      if (
        !cleanupLegacyForTargetOrFailClosed(
          scope,
          accommodationId,
          target.data.reservationUid,
        )
      ) {
        return { status: "rejected", reason: "cleanup-failed" };
      }

      return {
        status: "target-wins",
        data: target.data,
        handle: toHandoff(target.data.operationId),
      };
    }

    let source: "location" | "storage";
    let rawSource: unknown;
    if (rawLegacyLocationCandidate !== undefined) {
      source = "location";
      rawSource = rawLegacyLocationCandidate;
    } else {
      source = "storage";
      const stored = legacy.readCheckout(accommodationId);
      if (stored.status === "storage-error") return stored;
      if (stored.status === "missing") return stored;
      if (stored.status === "invalid-key") {
        return { status: "rejected", reason: "invalid-route" };
      }
      rawSource = stored.raw;
    }

    const candidate =
      source === "location"
        ? locationCandidate
        : parseLegacyCheckoutCandidate(rawSource, accommodationId);
    if (!candidate) {
      const cleanup = legacy.clearCheckoutPrimary(accommodationId);
      if (cleanup.status === "storage-error") return cleanup;
      return isCleanupComplete(cleanup)
        ? { status: "rejected", reason: "invalid-legacy-data" }
        : { status: "rejected", reason: "cleanup-failed" };
    }

    if (source === "storage") {
      const index = legacy.readCheckoutIndex(candidate.reservationUid);
      if (index.status === "storage-error") return index;
      if (index.status !== "found" || index.raw !== String(accommodationId)) {
        const cleanup = legacy.clearCheckout(
          accommodationId,
          candidate.reservationUid,
        );
        if (cleanup.status === "storage-error") return cleanup;
        return isCleanupComplete(cleanup)
          ? { status: "rejected", reason: "index-mismatch" }
          : { status: "rejected", reason: "cleanup-failed" };
      }
    }

    let verification: LegacyCheckoutVerificationResult;
    try {
      verification = await verify({
        accommodationId,
        reservationUid: candidate.reservationUid,
        orderName: candidate.orderName,
        amount: candidate.amount,
        checkIn: candidate.checkIn,
        checkOut: candidate.checkOut,
        guestCount:
          candidate.adultOccupancy + candidate.childOccupancy,
      });
    } catch {
      verification = { status: "retryable-error" };
    }
    if (!migrationIsCurrent()) return { status: "stale" };

    if (source === "storage") {
      const latestRecord = legacy.readCheckout(accommodationId);
      if (latestRecord.status === "storage-error") return latestRecord;
      const latestIndex = legacy.readCheckoutIndex(candidate.reservationUid);
      if (latestIndex.status === "storage-error") return latestIndex;
      if (
        latestRecord.status !== "found" ||
        latestRecord.raw !== rawSource ||
        latestIndex.status !== "found" ||
        latestIndex.raw !== String(accommodationId)
      ) {
        return { status: "stale" };
      }
    }

    if (verification.status === "retryable-error") {
      return { status: "verification-retryable" };
    }

    if (verification.status === "mismatch") {
      const cleanup = legacy.clearCheckout(
        accommodationId,
        candidate.reservationUid,
      );
      if (cleanup.status === "storage-error") return cleanup;
      return isCleanupComplete(cleanup)
        ? { status: "rejected", reason: "verification-failed" }
        : { status: "rejected", reason: "cleanup-failed" };
    }

    const concurrentTarget = mapReadResult(storage.read(scope.subject));
    if (concurrentTarget.status === "storage-error") return concurrentTarget;
    if (concurrentTarget.status === "found") {
      if (
        !cleanupLegacyForTargetOrFailClosed(
          scope,
          accommodationId,
          concurrentTarget.data.reservationUid,
        )
      ) {
        return { status: "rejected", reason: "cleanup-failed" };
      }

      return {
        status: "target-wins",
        data: concurrentTarget.data,
        handle: toHandoff(concurrentTarget.data.operationId),
      };
    }

    const writeResult = write({
      scope,
      isCurrent: migrationIsCurrent,
      data: {
        accommodationId,
        reservationUid: candidate.reservationUid,
        orderName: candidate.orderName,
        amount: candidate.amount,
        checkIn: candidate.checkIn,
        checkOut: candidate.checkOut,
        adultOccupancy: candidate.adultOccupancy,
        childOccupancy: candidate.childOccupancy,
        infantOccupancy: candidate.infantOccupancy,
        petOccupancy: candidate.petOccupancy,
        couponName: candidate.couponName,
        couponDiscount: candidate.couponDiscount,
      },
    });
    if (writeResult.status === "stale") return writeResult;
    if (writeResult.status === "storage-error") return writeResult;
    if (writeResult.status !== "written") {
      return { status: "rejected", reason: "invalid-legacy-data" };
    }

    if (
      !cleanupLegacyForTargetOrFailClosed(
        scope,
        accommodationId,
        writeResult.data.reservationUid,
      )
    ) {
      return { status: "rejected", reason: "cleanup-failed" };
    }

    return {
      status: "migrated",
      data: writeResult.data,
      handle: writeResult.handle,
    };
  };

  return { write, read, readForCallback, clear, migrateLegacy };
};

export const createBookingPaymentCallbackRepository = ({
  driver = bookingPaymentStorageDriver,
  now = Date.now,
  getEpoch,
}: BookingPaymentRepositoryDependencies): CallbackRepository => {
  const storage = createCallbackStorage(driver, now, getEpoch);
  const checkoutStorage = createCheckoutStorage(driver, now, getEpoch);
  const legacy = createLegacyBookingPaymentStorage(driver);

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

    consumeLegacyConfirmedPaymentHint(input) {
      const result = legacy.consumeConfirmedPaymentHint(input);
      if (result.status === "invalid-key") return { status: "rejected" };
      return result;
    },
  };
};

export const clearBookingPaymentBrowserState = ({
  driver = bookingPaymentStorageDriver,
}: Pick<BookingPaymentRepositoryDependencies, "driver"> = {}): ClearBookingPaymentBrowserStateResult => {
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

  const current = retryNamespaceCleanup(() =>
    currentStorage.clearNamespace(),
  );

  const legacyStorage = createLegacyBookingPaymentStorage(driver);
  const legacy = retryNamespaceCleanup(() => {
    const result = legacyStorage.clearAll();
    return result.status === "invalid-key"
      ? { status: "partial", removed: 0, failed: 1 }
      : result;
  });

  if (current.final.status === "storage-error") return current.final;
  if (legacy.final.status === "storage-error") return legacy.final;

  const currentFailed =
    current.final.status === "partial" ? current.final.failed : 0;
  const legacyFailed =
    legacy.final.status === "partial" ? legacy.final.failed : 0;
  const removed = current.removed + legacy.removed;
  const failed = currentFailed + legacyFailed;

  return failed === 0
    ? { status: "cleared", removed }
    : { status: "partial", removed, failed };
};

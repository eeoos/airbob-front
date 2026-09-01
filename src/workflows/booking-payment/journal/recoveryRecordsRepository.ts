import { bookingPaymentStorageDriver } from "../../../platform/storage/bookingPaymentStorageDriver";
import { claimBookingPaymentCandidateCallbackCredential } from "./candidateCallbackCredential";
import type {
  SessionStorageDriver,
  StorageAccessError,
} from "../../../platform/storage/sessionStorageDriver";
import {
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_NAMESPACE_PREFIX,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  isBookingPaymentV2KnownKey,
  orderBookingPaymentCleanupKeys,
  peekBookingPaymentRecordVersion,
} from "./namespace";
import type {
  BookingPaymentCallbackCredentialEnvelope,
  BookingPaymentOperationIdentity,
  BookingPaymentOperationObservation,
  BookingPaymentOperationReceiptEnvelope,
} from "./recoveryRecordsTypes";
import { bookingPaymentRecoveryRecordValidation } from "./recoveryRecordsValidation";
import { BOOKING_PAYMENT_RETIRED_STATE_PREFIXES } from "./retiredState";
import type {
  BookingPaymentJournalEnvelope,
  BookingPaymentRuntimeLease,
} from "./types";
import {
  isBookingPaymentJournalEnvelope,
  isBookingPaymentOwner,
  isBookingPaymentRuntimeLease,
  isBookingPaymentUuid,
  parseBookingPaymentJournalEnvelope,
} from "./validation";

interface RecoveryRecordsRepositoryOptions {
  readonly driver?: SessionStorageDriver;
  readonly now?: () => number;
}

interface LiveCommandInput {
  readonly owner: string;
  readonly isCurrent: () => boolean;
}

interface ClaimCallbackCredentialInput extends LiveCommandInput {
  readonly lease: BookingPaymentRuntimeLease;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly amount: number;
  readonly paymentKey: string;
  /** The memory-only callback boundary's original URL capture time. */
  readonly firstCapturedAt: number;
}

interface BookingPaymentCallbackCredentialAuthority {
  readonly owner: string;
  readonly lease: BookingPaymentRuntimeLease;
  readonly phase: "attempt-ready" | "callback-received" | "confirm-submitting";
  readonly flowId: string;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentAttemptId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly currency: "KRW";
}

interface CallbackCredentialAuthorityInput extends LiveCommandInput {
  readonly lease: BookingPaymentRuntimeLease;
  readonly flowId: string;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentAttemptId: string;
  readonly amount: number;
  readonly currency: "KRW";
}

interface ClaimStoredCallbackCredentialInput extends LiveCommandInput {
  readonly lease: BookingPaymentRuntimeLease;
  readonly flowId: string;
  readonly reservationUid: string;
}

interface ClaimStoredCallbackCredentialByReservationInput extends LiveCommandInput {
  readonly lease: BookingPaymentRuntimeLease;
  readonly reservationUid: string;
}

interface AcceptedReceiptHandoffInput extends LiveCommandInput {
  readonly lease: BookingPaymentRuntimeLease;
  readonly flowId: string;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentAttemptId: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly operationId: string;
}

interface ReceiptAuthorityInput extends LiveCommandInput {
  readonly lease: BookingPaymentRuntimeLease;
  readonly flowId: string;
  readonly operationId: string;
  readonly reservationUid: string;
}

interface ClaimReceiptLeaseInput extends Omit<ReceiptAuthorityInput, "lease"> {
  readonly lease: BookingPaymentRuntimeLease;
}

interface ReplaceReceiptObservationInput extends ReceiptAuthorityInput {
  readonly observation: BookingPaymentOperationObservation;
}

interface BookingPaymentReceiptAuthority {
  readonly owner: string;
  readonly lease: BookingPaymentRuntimeLease;
  readonly createdAt: number;
  readonly hardExpiresAt: number;
  readonly flowId: string;
  readonly operation: BookingPaymentOperationIdentity;
  readonly observation: BookingPaymentOperationObservation | null;
}

type RecoveryRejectReason =
  | "receipt-present"
  | "opaque-v2-state"
  | "missing-journal"
  | "missing-credential"
  | "missing-receipt"
  | "malformed"
  | "foreign-owner"
  | "expired"
  | "invalid-clock"
  | "stale-lease"
  | "flow-mismatch"
  | "locator-mismatch"
  | "tuple-mismatch"
  | "phase-mismatch"
  | "conflicting-credential"
  | "observation-conflict"
  | "not-terminal"
  | "invalid-data"
  | "write-not-verified"
  | "cleanup-not-verified";

type RecoveryFailureResult =
  | { readonly status: "stale" }
  | { readonly status: "rejected"; readonly reason: RecoveryRejectReason }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

type CallbackCredentialResult =
  | {
      readonly status: "claimed" | "unchanged" | "found";
      readonly authority: BookingPaymentCallbackCredentialAuthority;
    }
  | RecoveryFailureResult;

type ReceiptAuthorityResult =
  | {
      readonly status: "claimed" | "unchanged" | "found" | "replaced";
      readonly authority: BookingPaymentReceiptAuthority;
    }
  | { readonly status: "verified-expired" }
  | RecoveryFailureResult;

type AcceptedReceiptHandoffResult =
  | {
      readonly status: "handed-off";
      readonly authority: BookingPaymentReceiptAuthority;
      readonly cleanup: "complete" | "pending";
    }
  | RecoveryFailureResult;

type ReceiptAcknowledgementResult =
  { readonly status: "cleared" } | RecoveryFailureResult;

interface BookingPaymentRecoveryRecordsRepository {
  claimCallbackCredential(
    input: ClaimCallbackCredentialInput,
  ): CallbackCredentialResult;
  readCallbackCredentialAuthority(
    input: CallbackCredentialAuthorityInput,
  ): CallbackCredentialResult;
  claimStoredCallbackCredentialByReservation(
    input: ClaimStoredCallbackCredentialByReservationInput,
  ): CallbackCredentialResult;
  claimCallbackCredentialForResume(
    input: ClaimStoredCallbackCredentialInput,
  ): CallbackCredentialResult;
  handoffAcceptedReceipt(
    input: AcceptedReceiptHandoffInput,
  ): AcceptedReceiptHandoffResult;
  claimReceiptLease(input: ClaimReceiptLeaseInput): ReceiptAuthorityResult;
  readReceiptAuthority(input: ReceiptAuthorityInput): ReceiptAuthorityResult;
  replaceReceiptObservation(
    input: ReplaceReceiptObservationInput,
  ): ReceiptAuthorityResult;
  acknowledgeTerminalReceipt(
    input: ReceiptAuthorityInput,
  ): ReceiptAcknowledgementResult;
}

const safeIsCurrent = (isCurrent: () => boolean): boolean => {
  try {
    return isCurrent();
  } catch {
    return false;
  }
};

const safeCurrentTime = (now: () => number): number | null => {
  try {
    const value = now();
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
};

const exactLease = (
  left: BookingPaymentRuntimeLease,
  right: BookingPaymentRuntimeLease,
): boolean =>
  left.runtimeLeaseId === right.runtimeLeaseId &&
  left.sessionEpoch === right.sessionEpoch;

const exactJsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const serialize = (value: unknown): string | null => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const opaqueOrMalformed = (raw: string): RecoveryFailureResult =>
  peekBookingPaymentRecordVersion(raw) !== 2
    ? { status: "rejected", reason: "opaque-v2-state" }
    : { status: "rejected", reason: "malformed" };

const inspectKnownNamespace = (
  driver: SessionStorageDriver,
):
  | { readonly status: "ready"; readonly keys: readonly string[] }
  | RecoveryFailureResult => {
  const keys = driver.keys();
  if (!keys.ok) return { status: "storage-error", error: keys.error };
  const v2Keys = keys.value.filter((key) =>
    key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
  );
  return v2Keys.every(isBookingPaymentV2KnownKey)
    ? { status: "ready", keys: v2Keys }
    : { status: "rejected", reason: "opaque-v2-state" };
};

const getRaw = (
  driver: SessionStorageDriver,
  key: string,
):
  | { readonly status: "found"; readonly raw: string }
  | { readonly status: "missing" }
  | RecoveryFailureResult => {
  const result = driver.getItem(key);
  if (!result.ok) return { status: "storage-error", error: result.error };
  return result.value === null
    ? { status: "missing" }
    : { status: "found", raw: result.value };
};

const writeRawAndVerify = (
  driver: SessionStorageDriver,
  key: string,
  raw: string,
): { readonly status: "verified" } | RecoveryFailureResult => {
  const written = driver.setItem(key, raw);
  if (!written.ok) return { status: "storage-error", error: written.error };
  const readBack = driver.getItem(key);
  if (!readBack.ok) return { status: "storage-error", error: readBack.error };
  return readBack.value === raw
    ? { status: "verified" }
    : { status: "rejected", reason: "write-not-verified" };
};

const removeAndVerify = (
  driver: SessionStorageDriver,
  key: string,
): { readonly status: "removed" } | RecoveryFailureResult => {
  const removed = driver.removeItem(key);
  if (!removed.ok) return { status: "storage-error", error: removed.error };
  const readBack = driver.getItem(key);
  if (!readBack.ok) return { status: "storage-error", error: readBack.error };
  return readBack.value === null
    ? { status: "removed" }
    : { status: "rejected", reason: "cleanup-not-verified" };
};

type AttemptJournal = BookingPaymentJournalEnvelope & {
  readonly data: Extract<
    BookingPaymentJournalEnvelope["data"],
    {
      readonly phase:
        "attempt-ready" | "callback-received" | "confirm-submitting";
    }
  >;
};

const asAttemptJournal = (
  journal: BookingPaymentJournalEnvelope,
): AttemptJournal | null =>
  journal.data.phase === "attempt-ready" ||
  journal.data.phase === "callback-received" ||
  journal.data.phase === "confirm-submitting"
    ? (journal as AttemptJournal)
    : null;

const readAttemptJournalRaw = (
  driver: SessionStorageDriver,
):
  | {
      readonly status: "found";
      readonly raw: string;
      readonly journal: AttemptJournal;
    }
  | RecoveryFailureResult => {
  const raw = getRaw(driver, BOOKING_PAYMENT_V2_JOURNAL_KEY);
  if (raw.status === "missing") {
    return { status: "rejected", reason: "missing-journal" };
  }
  if (raw.status !== "found") return raw;
  const journal = parseBookingPaymentJournalEnvelope(raw.raw);
  if (!journal) return opaqueOrMalformed(raw.raw);
  const attemptJournal = asAttemptJournal(journal);
  return attemptJournal
    ? { status: "found", raw: raw.raw, journal: attemptJournal }
    : { status: "rejected", reason: "phase-mismatch" };
};

const journalIsLive = (
  journal: BookingPaymentJournalEnvelope,
  currentTime: number,
): boolean =>
  currentTime >= journal.createdAt &&
  currentTime < journal.hardExpiresAt &&
  currentTime < journal.data.recoveryExpiresAt;

const credentialIsLive = (
  credential: BookingPaymentCallbackCredentialEnvelope,
  currentTime: number,
): boolean =>
  currentTime >= credential.createdAt && currentTime < credential.hardExpiresAt;

const receiptIsLive = (
  receipt: BookingPaymentOperationReceiptEnvelope,
  currentTime: number,
): boolean =>
  currentTime >= receipt.createdAt && currentTime < receipt.hardExpiresAt;

const callbackAuthority = (
  journal: AttemptJournal,
  credential: BookingPaymentCallbackCredentialEnvelope,
): BookingPaymentCallbackCredentialAuthority => ({
  owner: journal.owner,
  lease: journal.lease,
  phase: journal.data.phase,
  flowId: journal.data.flowId,
  reservationUid: credential.data.reservationUid,
  orderId: credential.data.orderId,
  paymentAttemptId: credential.data.paymentAttemptId,
  paymentKey: credential.data.paymentKey,
  amount: credential.data.amount,
  currency: credential.data.currency,
});

const receiptAuthority = (
  receipt: BookingPaymentOperationReceiptEnvelope,
): BookingPaymentReceiptAuthority => ({
  owner: receipt.owner,
  lease: receipt.lease,
  createdAt: receipt.createdAt,
  hardExpiresAt: receipt.hardExpiresAt,
  flowId: receipt.data.flowId,
  operation: receipt.data.operation,
  observation: receipt.data.observation,
});

const callbackHandleMatches = (
  input: CallbackCredentialAuthorityInput,
  journal: AttemptJournal,
  credential: BookingPaymentCallbackCredentialEnvelope,
): RecoveryRejectReason | null => {
  if (journal.owner !== input.owner || credential.owner !== input.owner) {
    return "foreign-owner";
  }
  if (!exactLease(journal.lease, input.lease)) return "stale-lease";
  if (journal.data.flowId !== input.flowId) return "flow-mismatch";
  if (
    credential.data.reservationUid !== input.reservationUid ||
    credential.data.orderId !== input.orderId
  ) {
    return "locator-mismatch";
  }
  return credential.data.paymentAttemptId === input.paymentAttemptId &&
    credential.data.amount === input.amount &&
    credential.data.currency === input.currency
    ? null
    : "tuple-mismatch";
};

const receiptHandleMatches = (
  input: ReceiptAuthorityInput,
  receipt: BookingPaymentOperationReceiptEnvelope,
): RecoveryRejectReason | null => {
  if (receipt.owner !== input.owner) return "foreign-owner";
  if (!exactLease(receipt.lease, input.lease)) return "stale-lease";
  if (receipt.data.flowId !== input.flowId) return "flow-mismatch";
  if (receipt.data.operation.reservationUid !== input.reservationUid) {
    return "locator-mismatch";
  }
  return receipt.data.operation.operationId === input.operationId
    ? null
    : "tuple-mismatch";
};

const readReceiptRaw = (
  driver: SessionStorageDriver,
):
  | {
      readonly status: "found";
      readonly raw: string;
      readonly receipt: BookingPaymentOperationReceiptEnvelope;
    }
  | RecoveryFailureResult => {
  const raw = getRaw(driver, BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY);
  if (raw.status === "missing") {
    return { status: "rejected", reason: "missing-receipt" };
  }
  if (raw.status !== "found") return raw;
  const receipt =
    bookingPaymentRecoveryRecordValidation.parseBookingPaymentOperationReceiptEnvelope(
      raw.raw,
    );
  return receipt
    ? { status: "found", raw: raw.raw, receipt }
    : opaqueOrMalformed(raw.raw);
};

const readCredentialRaw = (
  driver: SessionStorageDriver,
):
  | {
      readonly status: "found";
      readonly raw: string;
      readonly credential: BookingPaymentCallbackCredentialEnvelope;
    }
  | RecoveryFailureResult => {
  const raw = getRaw(driver, BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY);
  if (raw.status === "missing") {
    return { status: "rejected", reason: "missing-credential" };
  }
  if (raw.status !== "found") return raw;
  const credential =
    bookingPaymentRecoveryRecordValidation.parseBookingPaymentCallbackCredentialEnvelope(
      raw.raw,
    );
  return credential
    ? { status: "found", raw: raw.raw, credential }
    : opaqueOrMalformed(raw.raw);
};

const validOwnerAndLease = (
  owner: string,
  lease: BookingPaymentRuntimeLease,
): boolean =>
  isBookingPaymentOwner(owner) && isBookingPaymentRuntimeLease(lease);

const cleanupLowerAuthority = (
  driver: SessionStorageDriver,
  expectedReceiptRaw: string,
): "complete" | "pending" => {
  for (const key of [
    BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
    BOOKING_PAYMENT_V2_JOURNAL_KEY,
  ]) {
    const removed = removeAndVerify(driver, key);
    if (removed.status !== "removed") return "pending";
  }
  const namespace = inspectKnownNamespace(driver);
  if (
    namespace.status !== "ready" ||
    namespace.keys.some(
      (key) => key !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    )
  ) {
    return "pending";
  }
  const receipt = getRaw(driver, BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY);
  return receipt.status === "found" && receipt.raw === expectedReceiptRaw
    ? "complete"
    : "pending";
};

const exactReceiptRemains = (
  driver: SessionStorageDriver,
  expectedReceiptRaw: string,
): boolean => {
  const receipt = getRaw(driver, BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY);
  return receipt.status === "found" && receipt.raw === expectedReceiptRaw;
};

const isRetiredBookingPaymentKey = (key: string): boolean =>
  BOOKING_PAYMENT_RETIRED_STATE_PREFIXES.some((prefix) =>
    key.startsWith(prefix),
  );

const isTerminalCleanupTarget = (key: string): boolean =>
  isRetiredBookingPaymentKey(key) ||
  key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX);

const isKnownLowerTerminalAuthority = (key: string): boolean =>
  isRetiredBookingPaymentKey(key) ||
  key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY ||
  key === BOOKING_PAYMENT_V2_JOURNAL_KEY;

const enumerateTerminalCleanupTargets = (
  driver: SessionStorageDriver,
):
  | { readonly status: "found"; readonly keys: readonly string[] }
  | RecoveryFailureResult => {
  const keys = driver.keys();
  if (!keys.ok) return { status: "storage-error", error: keys.error };
  return {
    status: "found",
    keys: keys.value.filter(isTerminalCleanupTarget),
  };
};

/**
 * Purges only known lower authorities. Unknown/newer v2 records remain a
 * barrier and are never interpreted or destroyed by a terminal UI command.
 */
const prepareWholeTargetTerminalCleanup = (
  driver: SessionStorageDriver,
  expectedReceiptRaw: string,
  isCurrent: () => boolean,
): { readonly status: "ready" } | RecoveryFailureResult => {
  for (let pass = 0; pass < 2; pass += 1) {
    const initial = enumerateTerminalCleanupTargets(driver);
    if (initial.status !== "found") {
      if (pass === 0) continue;
      return initial;
    }
    if (!initial.keys.includes(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)) {
      return { status: "rejected", reason: "write-not-verified" };
    }
    if (
      initial.keys.some(
        (key) =>
          key !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY &&
          !isKnownLowerTerminalAuthority(key),
      )
    ) {
      return { status: "rejected", reason: "cleanup-not-verified" };
    }

    for (const key of orderBookingPaymentCleanupKeys(
      initial.keys.filter(isKnownLowerTerminalAuthority),
    )) {
      // Payload-blind by construction. Removal status is not authoritative;
      // the fresh enumeration below is the only success proof.
      driver.removeItem(key);
    }

    const verification = enumerateTerminalCleanupTargets(driver);
    if (verification.status !== "found") {
      if (pass === 0) continue;
      return verification;
    }
    const lowerKeys = verification.keys.filter(
      (key) => key !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (lowerKeys.length > 0) {
      if (pass === 0) continue;
      return { status: "rejected", reason: "cleanup-not-verified" };
    }
    if (
      verification.keys.length !== 1 ||
      verification.keys[0] !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY
    ) {
      return { status: "rejected", reason: "write-not-verified" };
    }

    const exactReceipt = getRaw(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (
      exactReceipt.status !== "found" ||
      exactReceipt.raw !== expectedReceiptRaw
    ) {
      return { status: "rejected", reason: "write-not-verified" };
    }
    if (!safeIsCurrent(isCurrent)) return { status: "stale" };
    // This is deliberately a separate, final enumeration so a lower key
    // inserted during receipt verification cannot race receipt deletion.
    const immediatelyBeforeReceipt = enumerateTerminalCleanupTargets(driver);
    if (immediatelyBeforeReceipt.status !== "found") {
      return immediatelyBeforeReceipt;
    }
    if (
      immediatelyBeforeReceipt.keys.length !== 1 ||
      immediatelyBeforeReceipt.keys[0] !==
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY
    ) {
      return { status: "rejected", reason: "cleanup-not-verified" };
    }
    return { status: "ready" };
  }

  return { status: "rejected", reason: "cleanup-not-verified" };
};

const clearPreparedReceiptLast = (
  driver: SessionStorageDriver,
  expectedReceiptRaw: string,
  isCurrent: () => boolean,
): { readonly status: "cleared" } | RecoveryFailureResult => {
  const prepared = prepareWholeTargetTerminalCleanup(
    driver,
    expectedReceiptRaw,
    isCurrent,
  );
  if (prepared.status !== "ready") return prepared;
  const removedReceipt = removeAndVerify(
    driver,
    BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  );
  if (removedReceipt.status !== "removed") return removedReceipt;
  const finalTargets = enumerateTerminalCleanupTargets(driver);
  if (finalTargets.status !== "found") return finalTargets;
  return finalTargets.keys.length === 0
    ? { status: "cleared" }
    : { status: "rejected", reason: "cleanup-not-verified" };
};

/**
 * Command-authorizing storage capability. It intentionally stays below the
 * workflow root: callers can only obtain it through the production journal
 * repository until the v2 booking owner becomes active.
 */
export const createBookingPaymentRecoveryRecordsRepository = ({
  driver = bookingPaymentStorageDriver,
  now = Date.now,
}: RecoveryRecordsRepositoryOptions = {}): BookingPaymentRecoveryRecordsRepository => {
  const claimCallbackCredential = (
    input: ClaimCallbackCredentialInput,
  ): CallbackCredentialResult =>
    claimBookingPaymentCandidateCallbackCredential(input, { driver, now });

  const readCallbackCredentialAuthority = (
    input: CallbackCredentialAuthorityInput,
  ): CallbackCredentialResult => {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const currentTime = safeCurrentTime(now);
    if (currentTime === null) {
      return { status: "rejected", reason: "invalid-clock" };
    }
    const namespace = inspectKnownNamespace(driver);
    if (namespace.status !== "ready") return namespace;
    if (namespace.keys.includes(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)) {
      return { status: "rejected", reason: "receipt-present" };
    }
    const journal = readAttemptJournalRaw(driver);
    if (journal.status !== "found") return journal;
    const credential = readCredentialRaw(driver);
    if (credential.status !== "found") return credential;
    if (
      !journalIsLive(journal.journal, currentTime) ||
      !credentialIsLive(credential.credential, currentTime)
    ) {
      return currentTime < journal.journal.createdAt ||
        currentTime < credential.credential.createdAt
        ? { status: "rejected", reason: "invalid-clock" }
        : { status: "rejected", reason: "expired" };
    }
    if (
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentCallbackCredentialJoinedWithJournal(
        credential.credential,
        journal.journal,
      )
    ) {
      return { status: "rejected", reason: "tuple-mismatch" };
    }
    const mismatch = callbackHandleMatches(
      input,
      journal.journal,
      credential.credential,
    );
    if (mismatch) return { status: "rejected", reason: mismatch };
    const finalReceiptBarrier = getRaw(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (finalReceiptBarrier.status === "found") {
      return { status: "rejected", reason: "receipt-present" };
    }
    if (finalReceiptBarrier.status !== "missing") return finalReceiptBarrier;
    return safeIsCurrent(input.isCurrent)
      ? {
          status: "found",
          authority: callbackAuthority(journal.journal, credential.credential),
        }
      : { status: "stale" };
  };

  const claimStoredCallbackCredential = (
    input: ClaimStoredCallbackCredentialByReservationInput,
    expectedFlowId: string | null,
    allowedPhases: ReadonlySet<AttemptJournal["data"]["phase"]>,
  ): CallbackCredentialResult => {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    if (
      !validOwnerAndLease(input.owner, input.lease) ||
      (expectedFlowId !== null && !isBookingPaymentUuid(expectedFlowId)) ||
      !isBookingPaymentUuid(input.reservationUid)
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const currentTime = safeCurrentTime(now);
    if (currentTime === null) {
      return { status: "rejected", reason: "invalid-clock" };
    }
    const namespace = inspectKnownNamespace(driver);
    if (namespace.status !== "ready") return namespace;
    if (namespace.keys.includes(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)) {
      return { status: "rejected", reason: "receipt-present" };
    }

    const journal = readAttemptJournalRaw(driver);
    if (journal.status !== "found") return journal;
    if (!allowedPhases.has(journal.journal.data.phase)) {
      return { status: "rejected", reason: "phase-mismatch" };
    }
    const credential = readCredentialRaw(driver);
    if (credential.status !== "found") return credential;
    if (
      !journalIsLive(journal.journal, currentTime) ||
      !credentialIsLive(credential.credential, currentTime)
    ) {
      return currentTime < journal.journal.createdAt ||
        currentTime < credential.credential.createdAt
        ? { status: "rejected", reason: "invalid-clock" }
        : { status: "rejected", reason: "expired" };
    }
    if (
      journal.journal.owner !== input.owner ||
      credential.credential.owner !== input.owner
    ) {
      return { status: "rejected", reason: "foreign-owner" };
    }
    if (
      expectedFlowId !== null &&
      (journal.journal.data.flowId !== expectedFlowId ||
        credential.credential.data.flowId !== expectedFlowId)
    ) {
      return { status: "rejected", reason: "flow-mismatch" };
    }
    if (
      journal.journal.data.ready.reservationUid !== input.reservationUid ||
      credential.credential.data.reservationUid !== input.reservationUid ||
      credential.credential.data.orderId !== input.reservationUid
    ) {
      return { status: "rejected", reason: "locator-mismatch" };
    }
    if (
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentCallbackCredentialJoinedWithJournal(
        credential.credential,
        journal.journal,
      )
    ) {
      return { status: "rejected", reason: "tuple-mismatch" };
    }

    const nextJournal = { ...journal.journal, lease: input.lease };
    const nextJournalRaw = serialize(nextJournal);
    if (
      nextJournalRaw === null ||
      !isBookingPaymentJournalEnvelope(nextJournal)
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const leaseChanged = !exactLease(journal.journal.lease, input.lease);
    if (leaseChanged) {
      if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
      const written = writeRawAndVerify(
        driver,
        BOOKING_PAYMENT_V2_JOURNAL_KEY,
        nextJournalRaw,
      );
      if (written.status !== "verified") return written;
    }

    const finalJournal = readAttemptJournalRaw(driver);
    const finalCredential = readCredentialRaw(driver);
    if (
      finalJournal.status !== "found" ||
      finalCredential.status !== "found" ||
      finalJournal.raw !== nextJournalRaw ||
      finalCredential.raw !== credential.raw ||
      !allowedPhases.has(finalJournal.journal.data.phase) ||
      (expectedFlowId !== null &&
        (finalJournal.journal.data.flowId !== expectedFlowId ||
          finalCredential.credential.data.flowId !== expectedFlowId)) ||
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentCallbackCredentialJoinedWithJournal(
        finalCredential.credential,
        finalJournal.journal,
      )
    ) {
      return { status: "rejected", reason: "write-not-verified" };
    }

    // This fixed-slot read is deliberately last. Any receipt, including an
    // opaque one, is higher authority and blocks a pre-Accepted replay.
    const receiptBarrier = getRaw(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (receiptBarrier.status === "found") {
      return { status: "rejected", reason: "receipt-present" };
    }
    if (receiptBarrier.status !== "missing") return receiptBarrier;
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    return {
      status: leaseChanged ? "claimed" : "unchanged",
      authority: callbackAuthority(
        finalJournal.journal,
        finalCredential.credential,
      ),
    };
  };

  const claimStoredCallbackCredentialByReservation = (
    input: ClaimStoredCallbackCredentialByReservationInput,
  ): CallbackCredentialResult =>
    claimStoredCallbackCredential(
      input,
      null,
      new Set(["attempt-ready", "callback-received", "confirm-submitting"]),
    );

  const claimCallbackCredentialForResume = (
    input: ClaimStoredCallbackCredentialInput,
  ): CallbackCredentialResult =>
    claimStoredCallbackCredential(
      input,
      input.flowId,
      new Set(["confirm-submitting"]),
    );

  const handoffAcceptedReceipt = (
    input: AcceptedReceiptHandoffInput,
  ): AcceptedReceiptHandoffResult => {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    if (
      !validOwnerAndLease(input.owner, input.lease) ||
      !isBookingPaymentUuid(input.operationId)
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const currentTime = safeCurrentTime(now);
    if (currentTime === null) {
      return { status: "rejected", reason: "invalid-clock" };
    }
    const namespace = inspectKnownNamespace(driver);
    if (namespace.status !== "ready") return namespace;
    const receiptSlot = getRaw(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (receiptSlot.status === "found") {
      return { status: "rejected", reason: "receipt-present" };
    }
    if (receiptSlot.status !== "missing") return receiptSlot;

    const journal = readAttemptJournalRaw(driver);
    if (journal.status !== "found") return journal;
    if (journal.journal.data.phase !== "confirm-submitting") {
      return { status: "rejected", reason: "phase-mismatch" };
    }
    const credential = readCredentialRaw(driver);
    if (credential.status !== "found") return credential;
    if (
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentCallbackCredentialJoinedWithJournal(
        credential.credential,
        journal.journal,
      )
    ) {
      return { status: "rejected", reason: "tuple-mismatch" };
    }
    const mismatch = callbackHandleMatches(
      input,
      journal.journal,
      credential.credential,
    );
    if (mismatch) return { status: "rejected", reason: mismatch };

    const receipt: BookingPaymentOperationReceiptEnvelope = {
      purpose: "booking-payment-operation-receipt",
      version: 2,
      privacyClass: "personal",
      containsPii: false,
      owner: input.owner,
      createdAt: currentTime,
      hardExpiresAt:
        currentTime +
        bookingPaymentRecoveryRecordValidation.BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS,
      lease: input.lease,
      data: {
        flowId: input.flowId,
        operation: {
          operationId: input.operationId,
          reservationUid: input.reservationUid,
          orderId: input.orderId,
          paymentAttemptId: input.paymentAttemptId,
          amount: input.amount,
          currency: input.currency,
        },
        observation: null,
      },
    };
    if (
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
        receipt,
        journal.journal,
        credential.credential,
      )
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const raw = serialize(receipt);
    if (raw === null) return { status: "rejected", reason: "invalid-data" };

    const finalSlotCheck = getRaw(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (finalSlotCheck.status === "found") {
      return { status: "rejected", reason: "receipt-present" };
    }
    if (finalSlotCheck.status !== "missing") return finalSlotCheck;
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const written = writeRawAndVerify(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
      raw,
    );
    if (written.status !== "verified") return written;
    const verified = readReceiptRaw(driver);
    if (
      verified.status !== "found" ||
      verified.raw !== raw ||
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
        verified.receipt,
        journal.journal,
        credential.credential,
      )
    ) {
      return { status: "rejected", reason: "write-not-verified" };
    }

    return {
      status: "handed-off",
      authority: receiptAuthority(verified.receipt),
      cleanup: cleanupLowerAuthority(driver, raw),
    };
  };

  const readReceiptAuthority = (
    input: ReceiptAuthorityInput,
  ): ReceiptAuthorityResult => {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const currentTime = safeCurrentTime(now);
    if (currentTime === null) {
      return { status: "rejected", reason: "invalid-clock" };
    }
    const namespace = inspectKnownNamespace(driver);
    if (namespace.status !== "ready") return namespace;
    const receipt = readReceiptRaw(driver);
    if (receipt.status !== "found") return receipt;
    if (!receiptIsLive(receipt.receipt, currentTime)) {
      return currentTime < receipt.receipt.createdAt
        ? { status: "rejected", reason: "invalid-clock" }
        : { status: "rejected", reason: "expired" };
    }
    const mismatch = receiptHandleMatches(input, receipt.receipt);
    if (mismatch) return { status: "rejected", reason: mismatch };
    return safeIsCurrent(input.isCurrent)
      ? { status: "found", authority: receiptAuthority(receipt.receipt) }
      : { status: "stale" };
  };

  const claimReceiptLease = (
    input: ClaimReceiptLeaseInput,
  ): ReceiptAuthorityResult => {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    if (!validOwnerAndLease(input.owner, input.lease)) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const currentTime = safeCurrentTime(now);
    if (currentTime === null) {
      return { status: "rejected", reason: "invalid-clock" };
    }
    const namespace = inspectKnownNamespace(driver);
    if (namespace.status !== "ready") return namespace;
    const current = readReceiptRaw(driver);
    if (current.status !== "found") return current;
    const handleWithoutLease: ReceiptAuthorityInput = {
      ...input,
      lease: current.receipt.lease,
    };
    const mismatch = receiptHandleMatches(handleWithoutLease, current.receipt);
    if (mismatch && mismatch !== "stale-lease") {
      return { status: "rejected", reason: mismatch };
    }
    if (!receiptIsLive(current.receipt, currentTime)) {
      if (currentTime < current.receipt.createdAt) {
        return { status: "rejected", reason: "invalid-clock" };
      }
      if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
      const cleared = clearPreparedReceiptLast(
        driver,
        current.raw,
        input.isCurrent,
      );
      return cleared.status === "cleared"
        ? { status: "verified-expired" }
        : cleared;
    }
    if (exactLease(current.receipt.lease, input.lease)) {
      if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
      cleanupLowerAuthority(driver, current.raw);
      if (!exactReceiptRemains(driver, current.raw)) {
        return { status: "rejected", reason: "write-not-verified" };
      }
      return safeIsCurrent(input.isCurrent)
        ? { status: "unchanged", authority: receiptAuthority(current.receipt) }
        : { status: "stale" };
    }
    const next = { ...current.receipt, lease: input.lease };
    const raw = serialize(next);
    if (
      raw === null ||
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentOperationReceiptEnvelope(
        next,
      )
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const written = writeRawAndVerify(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
      raw,
    );
    if (written.status !== "verified") return written;
    const verified = readReceiptRaw(driver);
    if (
      verified.status !== "found" ||
      verified.raw !== raw ||
      !exactJsonEqual(verified.receipt, next)
    ) {
      return { status: "rejected", reason: "write-not-verified" };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    cleanupLowerAuthority(driver, raw);
    if (!exactReceiptRemains(driver, raw)) {
      return { status: "rejected", reason: "write-not-verified" };
    }
    return safeIsCurrent(input.isCurrent)
      ? { status: "claimed", authority: receiptAuthority(verified.receipt) }
      : { status: "stale" };
  };

  const replaceReceiptObservation = (
    input: ReplaceReceiptObservationInput,
  ): ReceiptAuthorityResult => {
    const current = readReceiptAuthority(input);
    if (current.status !== "found") return current;
    const decision =
      bookingPaymentRecoveryRecordValidation.classifyBookingPaymentOperationObservationReplacement(
        current.authority.observation,
        input.observation,
      );
    if (decision === "reject") {
      return { status: "rejected", reason: "observation-conflict" };
    }
    if (decision === "unchanged") {
      return { status: "unchanged", authority: current.authority };
    }
    const rawCurrent = readReceiptRaw(driver);
    if (rawCurrent.status !== "found") return rawCurrent;
    const mismatch = receiptHandleMatches(input, rawCurrent.receipt);
    if (mismatch) return { status: "rejected", reason: mismatch };
    if (
      !exactJsonEqual(receiptAuthority(rawCurrent.receipt), current.authority)
    ) {
      return { status: "rejected", reason: "observation-conflict" };
    }
    const next: BookingPaymentOperationReceiptEnvelope = {
      ...rawCurrent.receipt,
      data: { ...rawCurrent.receipt.data, observation: input.observation },
    };
    const raw = serialize(next);
    if (
      raw === null ||
      !bookingPaymentRecoveryRecordValidation.isBookingPaymentOperationReceiptEnvelope(
        next,
      )
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const written = writeRawAndVerify(
      driver,
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
      raw,
    );
    if (written.status !== "verified") return written;
    const verified = readReceiptRaw(driver);
    if (
      verified.status !== "found" ||
      verified.raw !== raw ||
      !exactJsonEqual(verified.receipt, next)
    ) {
      return { status: "rejected", reason: "write-not-verified" };
    }
    return safeIsCurrent(input.isCurrent)
      ? { status: "replaced", authority: receiptAuthority(verified.receipt) }
      : { status: "stale" };
  };

  const acknowledgeTerminalReceipt = (
    input: ReceiptAuthorityInput,
  ): ReceiptAcknowledgementResult => {
    const current = readReceiptAuthority(input);
    if (current.status !== "found") {
      return current.status === "stale" ||
        current.status === "rejected" ||
        current.status === "storage-error"
        ? current
        : { status: "rejected", reason: "invalid-data" };
    }
    if (
      current.authority.observation?.status !== "SUCCEEDED" &&
      current.authority.observation?.status !== "FAILED"
    ) {
      return { status: "rejected", reason: "not-terminal" };
    }
    const expected = readReceiptRaw(driver);
    if (expected.status !== "found") return expected;
    if (
      !exactJsonEqual(receiptAuthority(expected.receipt), current.authority)
    ) {
      return { status: "rejected", reason: "observation-conflict" };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    return clearPreparedReceiptLast(driver, expected.raw, input.isCurrent);
  };

  return {
    claimCallbackCredential,
    readCallbackCredentialAuthority,
    claimStoredCallbackCredentialByReservation,
    claimCallbackCredentialForResume,
    handoffAcceptedReceipt,
    claimReceiptLease,
    readReceiptAuthority,
    replaceReceiptObservation,
    acknowledgeTerminalReceipt,
  };
};

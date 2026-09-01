import { bookingPaymentStorageDriver } from "../../../platform/storage/bookingPaymentStorageDriver";
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
  peekBookingPaymentRecordVersion,
} from "./namespace";
import type { BookingPaymentCallbackCredentialEnvelope } from "./recoveryRecordsTypes";
import { bookingPaymentRecoveryRecordValidation } from "./recoveryRecordsValidation";
import type {
  BookingPaymentJournalEnvelope,
  BookingPaymentRuntimeLease,
} from "./types";
import {
  isBookingPaymentJournalEnvelope,
  isBookingPaymentOwner,
  isBookingPaymentRuntimeLease,
  isBookingPaymentUuid,
  isSupportedBookingPaymentCardAmount,
  parseBookingPaymentJournalEnvelope,
} from "./validation";

interface CandidateCallbackCredentialOptions {
  readonly driver?: SessionStorageDriver;
  readonly now?: () => number;
}

export interface ClaimCallbackCredentialInput {
  readonly owner: string;
  readonly lease: BookingPaymentRuntimeLease;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly amount: number;
  readonly paymentKey: string;
  readonly firstCapturedAt: number;
  readonly isCurrent: () => boolean;
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

export type CallbackCredentialResult =
  | {
      readonly status: "claimed" | "unchanged" | "found";
      readonly authority: BookingPaymentCallbackCredentialAuthority;
    }
  | RecoveryFailureResult;

type AttemptJournal = BookingPaymentJournalEnvelope & {
  readonly data: Extract<
    BookingPaymentJournalEnvelope["data"],
    {
      readonly phase:
        "attempt-ready" | "callback-received" | "confirm-submitting";
    }
  >;
};

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

const asAttemptJournal = (
  journal: BookingPaymentJournalEnvelope,
): AttemptJournal | null =>
  journal.data.phase === "attempt-ready" ||
  journal.data.phase === "callback-received" ||
  journal.data.phase === "confirm-submitting"
    ? (journal as AttemptJournal)
    : null;

const readAttemptJournal = (
  driver: SessionStorageDriver,
):
  | { readonly status: "found"; readonly journal: AttemptJournal }
  | RecoveryFailureResult => {
  const raw = getRaw(driver, BOOKING_PAYMENT_V2_JOURNAL_KEY);
  if (raw.status === "missing") {
    return { status: "rejected", reason: "missing-journal" };
  }
  if (raw.status !== "found") return raw;
  const parsed = parseBookingPaymentJournalEnvelope(raw.raw);
  if (!parsed) return opaqueOrMalformed(raw.raw);
  const journal = asAttemptJournal(parsed);
  return journal
    ? { status: "found", journal }
    : { status: "rejected", reason: "phase-mismatch" };
};

const readCredential = (
  driver: SessionStorageDriver,
):
  | {
      readonly status: "found";
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
    ? { status: "found", credential }
    : opaqueOrMalformed(raw.raw);
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

export const claimBookingPaymentCandidateCallbackCredential = (
  input: ClaimCallbackCredentialInput,
  {
    driver = bookingPaymentStorageDriver,
    now = Date.now,
  }: CandidateCallbackCredentialOptions = {},
): CallbackCredentialResult => {
  if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
  if (
    !isBookingPaymentOwner(input.owner) ||
    !isBookingPaymentRuntimeLease(input.lease) ||
    !isBookingPaymentUuid(input.reservationUid) ||
    input.orderId !== input.reservationUid ||
    !isSupportedBookingPaymentCardAmount(input.amount) ||
    typeof input.paymentKey !== "string" ||
    input.paymentKey.length < 1 ||
    input.paymentKey.length > 200 ||
    input.paymentKey.trim().length === 0 ||
    !Number.isSafeInteger(input.firstCapturedAt) ||
    input.firstCapturedAt < 0
  ) {
    return { status: "rejected", reason: "invalid-data" };
  }
  const currentTime = safeCurrentTime(now);
  if (currentTime === null || input.firstCapturedAt > currentTime) {
    return { status: "rejected", reason: "invalid-clock" };
  }
  const namespace = inspectKnownNamespace(driver);
  if (namespace.status !== "ready") return namespace;
  if (namespace.keys.includes(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)) {
    return { status: "rejected", reason: "receipt-present" };
  }

  const journalResult = readAttemptJournal(driver);
  if (journalResult.status !== "found") return journalResult;
  const { journal } = journalResult;
  if (journal.owner !== input.owner) {
    return { status: "rejected", reason: "foreign-owner" };
  }
  if (
    currentTime < journal.createdAt ||
    currentTime >= journal.hardExpiresAt ||
    currentTime >= journal.data.recoveryExpiresAt
  ) {
    return currentTime < journal.createdAt
      ? { status: "rejected", reason: "invalid-clock" }
      : { status: "rejected", reason: "expired" };
  }
  if (
    journal.data.ready.reservationUid !== input.reservationUid ||
    journal.data.attempt.orderId !== input.orderId
  ) {
    return { status: "rejected", reason: "locator-mismatch" };
  }
  if (
    journal.data.ready.amount !== input.amount ||
    journal.data.attempt.amount !== input.amount ||
    journal.data.ready.currency !== "KRW" ||
    journal.data.attempt.currency !== "KRW"
  ) {
    return { status: "rejected", reason: "tuple-mismatch" };
  }

  const hardExpiresAt = Math.min(
    input.firstCapturedAt +
      bookingPaymentRecoveryRecordValidation.BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
    journal.data.recoveryExpiresAt,
  );
  if (!Number.isSafeInteger(hardExpiresAt) || currentTime >= hardExpiresAt) {
    return { status: "rejected", reason: "expired" };
  }
  const credential: BookingPaymentCallbackCredentialEnvelope = {
    purpose: "booking-payment-callback-credential",
    version: 2,
    privacyClass: "sensitive",
    containsPii: false,
    owner: input.owner,
    createdAt: input.firstCapturedAt,
    hardExpiresAt,
    data: {
      flowId: journal.data.flowId,
      reservationUid: input.reservationUid,
      orderId: input.orderId,
      paymentAttemptId: journal.data.attempt.paymentAttemptId,
      paymentKey: input.paymentKey,
      amount: input.amount,
      currency: "KRW",
    },
  };
  if (
    !bookingPaymentRecoveryRecordValidation.isBookingPaymentCallbackCredentialJoinedWithJournal(
      credential,
      journal,
    )
  ) {
    return { status: "rejected", reason: "invalid-data" };
  }

  const existing = getRaw(driver, BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY);
  let duplicate = false;
  if (existing.status === "found") {
    const parsed =
      bookingPaymentRecoveryRecordValidation.parseBookingPaymentCallbackCredentialEnvelope(
        existing.raw,
      );
    if (!parsed) return opaqueOrMalformed(existing.raw);
    if (!exactJsonEqual(parsed, credential)) {
      return { status: "rejected", reason: "conflicting-credential" };
    }
    duplicate = true;
  } else if (existing.status !== "missing") {
    return existing;
  }

  const nextJournal = { ...journal, lease: input.lease };
  const nextJournalRaw = serialize(nextJournal);
  if (
    nextJournalRaw === null ||
    !isBookingPaymentJournalEnvelope(nextJournal)
  ) {
    return { status: "rejected", reason: "invalid-data" };
  }
  if (!exactLease(journal.lease, input.lease)) {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const leaseWrite = writeRawAndVerify(
      driver,
      BOOKING_PAYMENT_V2_JOURNAL_KEY,
      nextJournalRaw,
    );
    if (leaseWrite.status !== "verified") return leaseWrite;
  }

  const receiptBarrier = getRaw(
    driver,
    BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  );
  if (receiptBarrier.status === "found") {
    return { status: "rejected", reason: "receipt-present" };
  }
  if (receiptBarrier.status !== "missing") return receiptBarrier;
  if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };

  if (!duplicate) {
    const raw = serialize(credential);
    if (raw === null) return { status: "rejected", reason: "invalid-data" };
    const credentialWrite = writeRawAndVerify(
      driver,
      BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
      raw,
    );
    if (credentialWrite.status !== "verified") return credentialWrite;
  }

  const finalReceipt = getRaw(driver, BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY);
  if (finalReceipt.status === "found") {
    return { status: "rejected", reason: "receipt-present" };
  }
  if (finalReceipt.status !== "missing") return finalReceipt;
  const finalJournal = readAttemptJournal(driver);
  const finalCredential = readCredential(driver);
  if (
    finalJournal.status !== "found" ||
    finalCredential.status !== "found" ||
    !exactLease(finalJournal.journal.lease, input.lease) ||
    !bookingPaymentRecoveryRecordValidation.isBookingPaymentCallbackCredentialJoinedWithJournal(
      finalCredential.credential,
      finalJournal.journal,
    ) ||
    !exactJsonEqual(finalCredential.credential, credential)
  ) {
    return { status: "rejected", reason: "write-not-verified" };
  }
  if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
  return {
    status:
      duplicate && exactLease(journal.lease, input.lease)
        ? "unchanged"
        : "claimed",
    authority: callbackAuthority(
      finalJournal.journal,
      finalCredential.credential,
    ),
  };
};

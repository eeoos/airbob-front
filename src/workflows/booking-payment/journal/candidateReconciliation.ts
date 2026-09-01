import type { SessionStorageDriver } from "../../../platform/storage/sessionStorageDriver";
import type { BookingPaymentCallbackCredentialEnvelope } from "./recoveryRecordsTypes";
import { bookingPaymentRecoveryRecordValidation } from "./recoveryRecordsValidation";
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
  BookingPaymentCandidateReconciliationResult,
  BookingPaymentJournalEnvelope,
} from "./types";
import { clearTerminalBookingPaymentBrowserState } from "./retiredState";
import { parseBookingPaymentJournalEnvelope } from "./validation";

const {
  isBookingPaymentCallbackCredentialJoinedWithJournal,
  parseBookingPaymentCallbackCredentialEnvelope,
  parseBookingPaymentOperationReceiptEnvelope,
} = bookingPaymentRecoveryRecordValidation;

interface CandidateReconciliationInput {
  readonly driver: SessionStorageDriver;
  readonly now: () => number;
  readonly owner: string;
}

type ParsedRecord<T> =
  | { readonly status: "valid"; readonly record: T }
  | { readonly status: "cleanup-safe" }
  | {
      readonly status: "blocked";
      readonly result: BookingPaymentCandidateReconciliationResult;
    };

type RawRecordResult =
  | { readonly status: "found"; readonly raw: string }
  | {
      readonly status: "failed";
      readonly result: BookingPaymentCandidateReconciliationResult;
    };

const blocked = (
  reason:
    | "unknown-v2-state"
    | "newer-version"
    | "malformed-unknown-version"
    | "cleanup-not-verified"
    | "invalid-clock",
): BookingPaymentCandidateReconciliationResult => ({
  status: "blocked",
  reason,
});

const parseKnownRecord = <T>(
  raw: string,
  parser: (value: string) => T | null,
): ParsedRecord<T> => {
  const record = parser(raw);
  if (record !== null) return { status: "valid", record };

  const version = peekBookingPaymentRecordVersion(raw);
  if (version === 2) return { status: "cleanup-safe" };
  return {
    status: "blocked",
    result: blocked(
      version !== null && version > 2
        ? "newer-version"
        : "malformed-unknown-version",
    ),
  };
};

const readRaw = (
  driver: SessionStorageDriver,
  key: string,
): RawRecordResult => {
  const result = driver.getItem(key);
  if (!result.ok) {
    return {
      status: "failed",
      result: { status: "storage-error", error: result.error },
    };
  }
  return result.value === null
    ? { status: "failed", result: blocked("unknown-v2-state") }
    : { status: "found", raw: result.value };
};

const safeCurrentTime = (now: () => number): number | null => {
  try {
    const value = now();
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
};

const clearLegacyStateBelowV2Authority = (
  driver: SessionStorageDriver,
): BookingPaymentCandidateReconciliationResult | null => {
  const result = clearTerminalBookingPaymentBrowserState({ driver });
  if (result.status === "cleared") return null;
  if (result.status === "storage-error") {
    return { status: "storage-error", error: result.error };
  }
  return blocked("cleanup-not-verified");
};

const removeAndVerify = (
  driver: SessionStorageDriver,
  keys: readonly string[],
): BookingPaymentCandidateReconciliationResult | null => {
  for (const key of orderBookingPaymentCleanupKeys(keys)) {
    const removed = driver.removeItem(key);
    if (!removed.ok) {
      return { status: "storage-error", error: removed.error };
    }

    const verified = driver.getItem(key);
    if (!verified.ok) {
      return { status: "storage-error", error: verified.error };
    }
    if (verified.value !== null) return blocked("cleanup-not-verified");
  }
  return null;
};

const classifyExtraKnownRecord = (
  driver: SessionStorageDriver,
  key: string,
): BookingPaymentCandidateReconciliationResult | null => {
  const raw = readRaw(driver, key);
  if (raw.status === "failed") return raw.result;
  const parsed =
    key === BOOKING_PAYMENT_V2_JOURNAL_KEY
      ? parseKnownRecord(raw.raw, parseBookingPaymentJournalEnvelope)
      : parseKnownRecord(
          raw.raw,
          parseBookingPaymentCallbackCredentialEnvelope,
        );
  return parsed.status === "blocked" ? parsed.result : null;
};

const reconcileAfterCleanup = (
  input: CandidateReconciliationInput,
  depth: number,
  mapReadyToUnavailable: boolean,
): BookingPaymentCandidateReconciliationResult => {
  const result = reconcileCandidateOwnerInternal(input, depth + 1);
  return mapReadyToUnavailable && result.status === "ready"
    ? { status: "recovery-unavailable" }
    : result;
};

const reconcileReceiptBarrier = (
  input: CandidateReconciliationInput,
  observedKnownKeys: readonly string[],
  depth: number,
): BookingPaymentCandidateReconciliationResult => {
  const { driver, now, owner } = input;
  const receiptRaw = readRaw(driver, BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY);
  if (receiptRaw.status === "failed") return receiptRaw.result;

  for (const key of observedKnownKeys) {
    if (key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) continue;
    const extra = classifyExtraKnownRecord(driver, key);
    if (extra !== null) return extra;
  }

  const receipt = parseKnownRecord(
    receiptRaw.raw,
    parseBookingPaymentOperationReceiptEnvelope,
  );
  if (receipt.status === "blocked") return receipt.result;
  if (receipt.status === "cleanup-safe") {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, true);
  }

  if (receipt.record.owner !== owner) {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, false);
  }

  const currentTime = safeCurrentTime(now);
  if (currentTime === null) return blocked("invalid-clock");
  if (currentTime < receipt.record.createdAt) {
    return blocked("invalid-clock");
  }
  if (currentTime >= receipt.record.hardExpiresAt) {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, true);
  }

  const lowerAuthorityKeys = observedKnownKeys.filter(
    (key) => key !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  );
  if (lowerAuthorityKeys.length > 0) {
    const removal = removeAndVerify(driver, lowerAuthorityKeys);
    if (removal !== null) return removal;

    const preservedReceipt = driver.getItem(
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    );
    if (!preservedReceipt.ok) {
      return { status: "storage-error", error: preservedReceipt.error };
    }
    if (preservedReceipt.value !== receiptRaw.raw) {
      return blocked("cleanup-not-verified");
    }
    return reconcileAfterCleanup(input, depth, false);
  }

  return { status: "recovery-required" };
};

const reconcilePreAcceptedRecords = (
  input: CandidateReconciliationInput,
  observedKnownKeys: readonly string[],
  depth: number,
): BookingPaymentCandidateReconciliationResult => {
  const { driver, now, owner } = input;
  const hasJournal = observedKnownKeys.includes(BOOKING_PAYMENT_V2_JOURNAL_KEY);
  const hasCredential = observedKnownKeys.includes(
    BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  );

  let journal: ParsedRecord<BookingPaymentJournalEnvelope> | undefined;
  let credential:
    ParsedRecord<BookingPaymentCallbackCredentialEnvelope> | undefined;

  if (hasJournal) {
    const raw = readRaw(driver, BOOKING_PAYMENT_V2_JOURNAL_KEY);
    if (raw.status === "failed") return raw.result;
    journal = parseKnownRecord(raw.raw, parseBookingPaymentJournalEnvelope);
    if (journal.status === "blocked") return journal.result;
  }
  if (hasCredential) {
    const raw = readRaw(driver, BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY);
    if (raw.status === "failed") return raw.result;
    credential = parseKnownRecord(
      raw.raw,
      parseBookingPaymentCallbackCredentialEnvelope,
    );
    if (credential.status === "blocked") return credential.result;
  }

  if (journal === undefined) {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, false);
  }
  if (journal.status === "blocked") return journal.result;
  if (journal.status === "cleanup-safe") {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, false);
  }

  const journalRecord = journal.record;
  if (journalRecord.owner !== owner) {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, false);
  }

  const currentTime = safeCurrentTime(now);
  if (currentTime === null) return blocked("invalid-clock");
  if (currentTime < journalRecord.createdAt) {
    return blocked("invalid-clock");
  }
  if (
    currentTime >= journalRecord.hardExpiresAt ||
    currentTime >= journalRecord.data.recoveryExpiresAt
  ) {
    const removal = removeAndVerify(driver, observedKnownKeys);
    if (removal !== null) return removal;
    return reconcileAfterCleanup(input, depth, false);
  }

  if (credential === undefined) return { status: "recovery-required" };
  if (
    credential.status === "valid" &&
    credential.record.owner === owner &&
    currentTime < credential.record.createdAt
  ) {
    return blocked("invalid-clock");
  }
  const credentialCanRemain =
    credential.status === "valid" &&
    credential.record.owner === owner &&
    currentTime < credential.record.hardExpiresAt &&
    isBookingPaymentCallbackCredentialJoinedWithJournal(
      credential.record,
      journalRecord,
    );
  if (credentialCanRemain) return { status: "recovery-required" };

  const removal = removeAndVerify(driver, [
    BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  ]);
  if (removal !== null) return removal;
  return reconcileAfterCleanup(input, depth, false);
};

const reconcileCandidateOwnerInternal = (
  input: CandidateReconciliationInput,
  depth: number,
): BookingPaymentCandidateReconciliationResult => {
  if (depth > 3) return blocked("cleanup-not-verified");

  const keys = input.driver.keys();
  if (!keys.ok) return { status: "storage-error", error: keys.error };
  const v2Keys = keys.value.filter((key) =>
    key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
  );
  if (v2Keys.length === 0) return { status: "ready" };

  // Any v2 slot outranks the retired v1 transaction. Purge and verify every
  // legacy callback/checkout before inspecting or removing the v2 barrier so
  // a later reload can never revive an old confirm-capable callback.
  const legacyCleanup = clearLegacyStateBelowV2Authority(input.driver);
  if (legacyCleanup !== null) return legacyCleanup;

  if (v2Keys.some((key) => !isBookingPaymentV2KnownKey(key))) {
    return blocked("unknown-v2-state");
  }
  const knownKeys = [...new Set(v2Keys)];

  return knownKeys.includes(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)
    ? reconcileReceiptBarrier(input, knownKeys, depth)
    : reconcilePreAcceptedRecords(input, knownKeys, depth);
};

export const reconcileBookingPaymentCandidateOwner = (
  input: CandidateReconciliationInput,
): BookingPaymentCandidateReconciliationResult =>
  reconcileCandidateOwnerInternal(input, 0);

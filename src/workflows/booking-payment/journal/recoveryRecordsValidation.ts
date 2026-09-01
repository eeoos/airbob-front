import type { BookingPaymentJournalData } from "./types";
import {
  isBookingPaymentOwner,
  isBookingPaymentJournalEnvelope,
  isBookingPaymentRuntimeLease,
  isSupportedBookingPaymentCardAmount,
  isBookingPaymentUuid,
  parseBookingPaymentUtcInstantNanoseconds,
} from "./validation";
import {
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
} from "./namespace";
import type {
  BookingPaymentCallbackCredentialData,
  BookingPaymentCallbackCredentialEnvelope,
  BookingPaymentObservationReplacementDecision,
  BookingPaymentOperationIdentity,
  BookingPaymentOperationObservation,
  BookingPaymentOperationReceiptData,
  BookingPaymentOperationReceiptEnvelope,
} from "./recoveryRecordsTypes";

const BOOKING_PAYMENT_CALLBACK_CREDENTIAL_STORAGE_KEY =
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY;
const BOOKING_PAYMENT_OPERATION_RECEIPT_STORAGE_KEY =
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY;
const BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS = 9 * 60 * 1000;
const BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS = 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isCallbackCredentialData = (
  value: unknown,
): value is BookingPaymentCallbackCredentialData =>
  isRecord(value) &&
  hasExactKeys(value, [
    "flowId",
    "reservationUid",
    "orderId",
    "paymentAttemptId",
    "paymentKey",
    "amount",
    "currency",
  ]) &&
  isBookingPaymentUuid(value.flowId) &&
  isBookingPaymentUuid(value.reservationUid) &&
  isBookingPaymentUuid(value.orderId) &&
  value.reservationUid === value.orderId &&
  isBookingPaymentUuid(value.paymentAttemptId) &&
  typeof value.paymentKey === "string" &&
  value.paymentKey.length >= 1 &&
  value.paymentKey.length <= 200 &&
  value.paymentKey.trim().length > 0 &&
  isSupportedBookingPaymentCardAmount(value.amount) &&
  value.currency === "KRW";

const isBookingPaymentCallbackCredentialEnvelope = (
  value: unknown,
): value is BookingPaymentCallbackCredentialEnvelope => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "purpose",
      "version",
      "privacyClass",
      "containsPii",
      "owner",
      "createdAt",
      "hardExpiresAt",
      "data",
    ]) ||
    value.purpose !== "booking-payment-callback-credential" ||
    value.version !== 2 ||
    value.privacyClass !== "sensitive" ||
    value.containsPii !== false ||
    !isBookingPaymentOwner(value.owner) ||
    !isNonNegativeSafeInteger(value.createdAt) ||
    !isNonNegativeSafeInteger(value.hardExpiresAt) ||
    !isCallbackCredentialData(value.data)
  ) {
    return false;
  }

  const latestHardExpiry =
    value.createdAt + BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS;
  return (
    Number.isSafeInteger(latestHardExpiry) &&
    value.hardExpiresAt > value.createdAt &&
    value.hardExpiresAt <= latestHardExpiry
  );
};

const parseBookingPaymentCallbackCredentialEnvelope = (
  raw: string,
): BookingPaymentCallbackCredentialEnvelope | null => {
  try {
    const value: unknown = JSON.parse(raw);
    return isBookingPaymentCallbackCredentialEnvelope(value) ? value : null;
  } catch {
    return null;
  }
};

type AttemptJournalData = Extract<
  BookingPaymentJournalData,
  {
    readonly phase:
      "attempt-ready" | "callback-received" | "confirm-submitting";
  }
>;

const isAttemptJournalData = (
  value: BookingPaymentJournalData,
): value is AttemptJournalData =>
  value.phase === "attempt-ready" ||
  value.phase === "callback-received" ||
  value.phase === "confirm-submitting";

const isBookingPaymentCallbackCredentialJoinedWithJournal = (
  credential: unknown,
  journal: unknown,
): boolean => {
  if (
    !isBookingPaymentCallbackCredentialEnvelope(credential) ||
    !isBookingPaymentJournalEnvelope(journal) ||
    !isAttemptJournalData(journal.data)
  ) {
    return false;
  }

  const expectedHardExpiry = Math.min(
    credential.createdAt + BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
    journal.data.recoveryExpiresAt,
  );

  return (
    credential.owner === journal.owner &&
    credential.createdAt >= journal.createdAt &&
    credential.data.flowId === journal.data.flowId &&
    credential.data.reservationUid === journal.data.ready.reservationUid &&
    credential.data.orderId === journal.data.attempt.orderId &&
    credential.data.paymentAttemptId ===
      journal.data.attempt.paymentAttemptId &&
    credential.data.amount === journal.data.ready.amount &&
    credential.data.amount === journal.data.attempt.amount &&
    credential.data.currency === journal.data.ready.currency &&
    credential.data.currency === journal.data.attempt.currency &&
    credential.hardExpiresAt === expectedHardExpiry
  );
};

const isOperationIdentity = (
  value: unknown,
): value is BookingPaymentOperationIdentity =>
  isRecord(value) &&
  hasExactKeys(value, [
    "operationId",
    "reservationUid",
    "orderId",
    "paymentAttemptId",
    "amount",
    "currency",
  ]) &&
  isBookingPaymentUuid(value.operationId) &&
  isBookingPaymentUuid(value.reservationUid) &&
  isBookingPaymentUuid(value.orderId) &&
  value.reservationUid === value.orderId &&
  isBookingPaymentUuid(value.paymentAttemptId) &&
  isSupportedBookingPaymentCardAmount(value.amount) &&
  value.currency === "KRW";

const isRetryAfterSeconds = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 2 && (value as number) <= 30;

const isBookingPaymentOperationObservation = (
  value: unknown,
): value is BookingPaymentOperationObservation => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "status",
      "updatedAt",
      "nextAction",
      "retryAfterSeconds",
      "userFailureCode",
      "serverTime",
    ])
  ) {
    return false;
  }

  const updatedAt = parseBookingPaymentUtcInstantNanoseconds(value.updatedAt);
  const serverTime = parseBookingPaymentUtcInstantNanoseconds(value.serverTime);
  if (updatedAt === null || serverTime === null || updatedAt > serverTime) {
    return false;
  }

  switch (value.status) {
    case "PENDING":
    case "PROCESSING":
      return (
        value.nextAction === "POLL" &&
        isRetryAfterSeconds(value.retryAfterSeconds) &&
        value.userFailureCode === null
      );
    case "SUCCEEDED":
      return (
        value.nextAction === "NONE" &&
        value.retryAfterSeconds === null &&
        value.userFailureCode === null
      );
    case "FAILED":
      return (
        (value.nextAction === "START_NEW_CHECKOUT" ||
          value.nextAction === "NONE") &&
        value.retryAfterSeconds === null &&
        value.userFailureCode === "PAYMENT_DECLINED"
      );
    case "REQUIRES_REVIEW":
      return (
        value.nextAction === "CONTACT_SUPPORT" &&
        isRetryAfterSeconds(value.retryAfterSeconds) &&
        value.userFailureCode === "PAYMENT_REVIEW_REQUIRED"
      );
    default:
      return false;
  }
};

const isOperationReceiptData = (
  value: unknown,
): value is BookingPaymentOperationReceiptData =>
  isRecord(value) &&
  hasExactKeys(value, ["flowId", "operation", "observation"]) &&
  isBookingPaymentUuid(value.flowId) &&
  isOperationIdentity(value.operation) &&
  (value.observation === null ||
    isBookingPaymentOperationObservation(value.observation));

const isBookingPaymentOperationReceiptEnvelope = (
  value: unknown,
): value is BookingPaymentOperationReceiptEnvelope => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "purpose",
      "version",
      "privacyClass",
      "containsPii",
      "owner",
      "createdAt",
      "hardExpiresAt",
      "lease",
      "data",
    ]) ||
    value.purpose !== "booking-payment-operation-receipt" ||
    value.version !== 2 ||
    value.privacyClass !== "personal" ||
    value.containsPii !== false ||
    !isBookingPaymentOwner(value.owner) ||
    !isNonNegativeSafeInteger(value.createdAt) ||
    !isNonNegativeSafeInteger(value.hardExpiresAt) ||
    !isBookingPaymentRuntimeLease(value.lease) ||
    !isOperationReceiptData(value.data)
  ) {
    return false;
  }

  const expectedHardExpiry =
    value.createdAt + BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS;
  return (
    Number.isSafeInteger(expectedHardExpiry) &&
    value.hardExpiresAt === expectedHardExpiry
  );
};

const parseBookingPaymentOperationReceiptEnvelope = (
  raw: string,
): BookingPaymentOperationReceiptEnvelope | null => {
  try {
    const value: unknown = JSON.parse(raw);
    return isBookingPaymentOperationReceiptEnvelope(value) ? value : null;
  } catch {
    return null;
  }
};

const observationsAreEqual = (
  left: BookingPaymentOperationObservation,
  right: BookingPaymentOperationObservation,
): boolean =>
  left.status === right.status &&
  left.updatedAt === right.updatedAt &&
  left.nextAction === right.nextAction &&
  left.retryAfterSeconds === right.retryAfterSeconds &&
  left.userFailureCode === right.userFailureCode &&
  left.serverTime === right.serverTime;

const observationStableIdentityIsEqual = (
  left: BookingPaymentOperationObservation,
  right: BookingPaymentOperationObservation,
): boolean =>
  left.status === right.status &&
  left.userFailureCode === right.userFailureCode &&
  left.updatedAt === right.updatedAt;

const isTerminalOperationStatus = (
  status: BookingPaymentOperationObservation["status"],
): boolean => status === "SUCCEEDED" || status === "FAILED";

const classifyBookingPaymentOperationObservationReplacement = (
  previous: unknown,
  next: unknown,
): BookingPaymentObservationReplacementDecision => {
  if (previous === null && next === null) return "unchanged";
  if (previous === null) {
    return isBookingPaymentOperationObservation(next) ? "replace" : "reject";
  }
  if (
    !isBookingPaymentOperationObservation(previous) ||
    !isBookingPaymentOperationObservation(next)
  ) {
    return "reject";
  }

  const previousUpdatedAt = parseBookingPaymentUtcInstantNanoseconds(
    previous.updatedAt,
  );
  const nextUpdatedAt = parseBookingPaymentUtcInstantNanoseconds(
    next.updatedAt,
  );
  if (previousUpdatedAt === null || nextUpdatedAt === null) return "reject";
  if (nextUpdatedAt < previousUpdatedAt) return "reject";
  if (nextUpdatedAt === previousUpdatedAt) {
    if (!observationStableIdentityIsEqual(previous, next)) return "reject";

    const previousServerTime = parseBookingPaymentUtcInstantNanoseconds(
      previous.serverTime,
    );
    const nextServerTime = parseBookingPaymentUtcInstantNanoseconds(
      next.serverTime,
    );
    if (previousServerTime === null || nextServerTime === null) return "reject";
    if (nextServerTime < previousServerTime) return "reject";
    if (nextServerTime === previousServerTime) {
      return observationsAreEqual(previous, next) ? "unchanged" : "reject";
    }
    if (previous.status === "FAILED") {
      return previous.nextAction === next.nextAction ? "unchanged" : "replace";
    }
    if (previous.nextAction !== next.nextAction) return "reject";
    return isTerminalOperationStatus(previous.status) ? "unchanged" : "replace";
  }
  return isTerminalOperationStatus(previous.status) ? "reject" : "replace";
};

const isBookingPaymentOperationReceiptJoinedWithPreAcceptedState = (
  receipt: unknown,
  journal: unknown,
  credential: unknown,
): boolean => {
  if (
    !isBookingPaymentOperationReceiptEnvelope(receipt) ||
    receipt.data.observation !== null ||
    !isBookingPaymentJournalEnvelope(journal) ||
    journal.data.phase !== "confirm-submitting" ||
    !isBookingPaymentCallbackCredentialEnvelope(credential) ||
    !isBookingPaymentCallbackCredentialJoinedWithJournal(credential, journal)
  ) {
    return false;
  }

  const operation = receipt.data.operation;
  return (
    receipt.owner === journal.owner &&
    receipt.owner === credential.owner &&
    receipt.data.flowId === journal.data.flowId &&
    receipt.data.flowId === credential.data.flowId &&
    operation.reservationUid === journal.data.ready.reservationUid &&
    operation.reservationUid === credential.data.reservationUid &&
    operation.orderId === journal.data.attempt.orderId &&
    operation.orderId === credential.data.orderId &&
    operation.paymentAttemptId === journal.data.attempt.paymentAttemptId &&
    operation.paymentAttemptId === credential.data.paymentAttemptId &&
    operation.amount === journal.data.attempt.amount &&
    operation.amount === credential.data.amount &&
    operation.currency === journal.data.attempt.currency &&
    operation.currency === credential.data.currency &&
    receipt.createdAt >= journal.createdAt &&
    receipt.createdAt >= credential.createdAt
  );
};

/**
 * Internal workflow capability. B2 candidate reconciliation consumes the
 * parsers now; later callback/receipt writers consume the remaining exact
 * transition predicates without widening the public booking-payment surface.
 */
export const bookingPaymentRecoveryRecordValidation = Object.freeze({
  BOOKING_PAYMENT_CALLBACK_CREDENTIAL_STORAGE_KEY,
  BOOKING_PAYMENT_OPERATION_RECEIPT_STORAGE_KEY,
  BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
  BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS,
  isBookingPaymentCallbackCredentialEnvelope,
  parseBookingPaymentCallbackCredentialEnvelope,
  isBookingPaymentCallbackCredentialJoinedWithJournal,
  isBookingPaymentOperationObservation,
  isBookingPaymentOperationReceiptEnvelope,
  parseBookingPaymentOperationReceiptEnvelope,
  classifyBookingPaymentOperationObservationReplacement,
  isBookingPaymentOperationReceiptJoinedWithPreAcceptedState,
});

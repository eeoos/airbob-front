import {
  RESERVATION_PAYMENT_STATUSES,
  type PaymentAttempt,
  type PaymentOperationAccepted,
  type PaymentOperationConfirmation,
  type PaymentOperationDetail,
  type PaymentOperationNextAction,
  type PaymentOperationStatus,
  type ReservationHoldRelease,
  type ReservationPaymentStatus,
} from "../model/payment";
import type {
  PaymentAttemptWire,
  PaymentOperationAcceptedWire,
  PaymentOperationConfirmationWireRequest,
  PaymentOperationDetailWire,
  ReservationHoldReleaseWire,
} from "./contracts";

const MINIMUM_CARD_AMOUNT = 100;
const MAXIMUM_CARD_AMOUNT = 2_147_483_647;
const MAXIMUM_PAYMENT_KEY_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;

const requireNonNegativeSafeInteger = (
  value: unknown,
  field: string,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer.`);
  }

  return value as number;
};

const requireSupportedCardAmount = (value: unknown, field: string): number => {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < MINIMUM_CARD_AMOUNT ||
    (value as number) > MAXIMUM_CARD_AMOUNT
  ) {
    throw new TypeError(`${field} must be a supported card amount.`);
  }

  return value as number;
};

const requireUuid = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a UUID.`);
  }

  return value;
};

export const toPaymentResourceId = (
  value: unknown,
  field = "resourceId",
): string => requireUuid(value, field);

const requirePaymentKey = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAXIMUM_PAYMENT_KEY_LENGTH
  ) {
    throw new TypeError("paymentKey must be between 1 and 200 characters.");
  }

  return value;
};

const isValidCalendarParts = (
  year: number,
  month: number,
  day: number,
): boolean => {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const parseUtcInstantNanoseconds = (value: unknown): bigint | null => {
  if (typeof value !== "string") return null;
  const match = UTC_INSTANT_PATTERN.exec(value);
  if (
    match === null ||
    !isValidCalendarParts(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ) ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59
  ) {
    return null;
  }

  const wholeSecond = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const wholeSecondMs = Date.parse(wholeSecond);
  if (!Number.isSafeInteger(wholeSecondMs) || wholeSecondMs < 0) return null;

  return (
    BigInt(wholeSecondMs) * 1_000_000n + BigInt((match[7] ?? "").padEnd(9, "0"))
  );
};

const requireUtcInstant = (value: unknown, field: string): string => {
  if (parseUtcInstantNanoseconds(value) === null) {
    throw new TypeError(`${field} must be a UTC instant.`);
  }

  return value as string;
};

const requireExactIdentity = (
  actual: string,
  expected: string,
  field: string,
): void => {
  if (actual !== expected) {
    throw new TypeError(`${field} does not match the requested resource.`);
  }
};

const isReservationPaymentStatus = (
  value: unknown,
): value is ReservationPaymentStatus =>
  typeof value === "string" &&
  RESERVATION_PAYMENT_STATUSES.some((status) => status === value);

const isPaymentOperationStatus = (
  value: unknown,
): value is PaymentOperationStatus =>
  value === "PENDING" ||
  value === "PROCESSING" ||
  value === "SUCCEEDED" ||
  value === "FAILED" ||
  value === "REQUIRES_REVIEW";

const isPaymentOperationNextAction = (
  value: unknown,
): value is PaymentOperationNextAction =>
  value === "POLL" ||
  value === "START_NEW_CHECKOUT" ||
  value === "CONTACT_SUPPORT" ||
  value === "NONE";

const requireRawRetryHint = (value: unknown): number => {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError("retryAfterSeconds must be an integer or null.");
  }

  return value as number;
};

export const toPaymentOperationConfirmationWireRequest = (
  input: PaymentOperationConfirmation,
): PaymentOperationConfirmationWireRequest => ({
  payment_key: requirePaymentKey(input.paymentKey),
  order_id: requireUuid(input.orderId, "orderId"),
  amount: requireSupportedCardAmount(input.amount, "amount"),
  payment_attempt_id: requireUuid(input.paymentAttemptId, "paymentAttemptId"),
});

export const toPaymentAttempt = (
  wire: PaymentAttemptWire,
  expectedReservationUid: string,
): PaymentAttempt => {
  const expectedOrderId = requireUuid(
    expectedReservationUid,
    "expectedReservationUid",
  );
  const orderId = requireUuid(wire.order_id, "orderId");
  requireExactIdentity(orderId, expectedOrderId, "orderId");

  if (wire.currency !== "KRW") {
    throw new TypeError("currency must be KRW.");
  }

  const holdExpiresAt = requireUtcInstant(
    wire.hold_expires_at,
    "holdExpiresAt",
  );
  const serverTime = requireUtcInstant(wire.server_time, "serverTime");
  const holdExpiresAtNs = parseUtcInstantNanoseconds(holdExpiresAt);
  const serverTimeNs = parseUtcInstantNanoseconds(serverTime);
  const remainingSeconds = requireNonNegativeSafeInteger(
    wire.remaining_seconds,
    "remainingSeconds",
  );
  if (
    holdExpiresAtNs === null ||
    serverTimeNs === null ||
    holdExpiresAtNs <= serverTimeNs ||
    remainingSeconds !==
      Number((holdExpiresAtNs - serverTimeNs) / 1_000_000_000n)
  ) {
    throw new TypeError("remainingSeconds must match the remaining hold time.");
  }

  return {
    paymentAttemptId: requireUuid(wire.payment_attempt_id, "paymentAttemptId"),
    orderId,
    amount: requireSupportedCardAmount(wire.amount, "amount"),
    currency: wire.currency,
    holdExpiresAt,
    remainingSeconds,
    serverTime,
  };
};

export const toReservationHoldRelease = (
  wire: ReservationHoldReleaseWire,
  expectedReservationUid: string,
): ReservationHoldRelease => {
  const expectedUid = requireUuid(
    expectedReservationUid,
    "expectedReservationUid",
  );
  const reservationUid = requireUuid(wire.reservation_uid, "reservationUid");
  requireExactIdentity(reservationUid, expectedUid, "reservationUid");

  if (!isReservationPaymentStatus(wire.status)) {
    throw new TypeError("status must be a known reservation status.");
  }
  if (typeof wire.released_now !== "boolean") {
    throw new TypeError("releasedNow must be a boolean.");
  }

  return {
    reservationUid,
    status: wire.status,
    releasedNow: wire.released_now,
    serverTime: requireUtcInstant(wire.server_time, "serverTime"),
  };
};

export const toPaymentOperationAccepted = (
  wire: PaymentOperationAcceptedWire,
): PaymentOperationAccepted => {
  if (!isPaymentOperationStatus(wire.status)) {
    throw new TypeError(
      "accepted payment operation status must be a known status.",
    );
  }

  return { operationId: requireUuid(wire.operation_id, "operationId") };
};

export const toPaymentOperationDetail = (
  wire: PaymentOperationDetailWire,
  expectedOperationId: string,
  expectedOrderId: string,
): PaymentOperationDetail => {
  const operationId = requireUuid(wire.operation_id, "operationId");
  const orderId = requireUuid(wire.order_id, "orderId");
  requireExactIdentity(
    operationId,
    requireUuid(expectedOperationId, "expectedOperationId"),
    "operationId",
  );
  requireExactIdentity(
    orderId,
    requireUuid(expectedOrderId, "expectedOrderId"),
    "orderId",
  );

  if (!isPaymentOperationStatus(wire.status)) {
    throw new TypeError("status must be a known payment operation status.");
  }
  if (!isPaymentOperationNextAction(wire.next_action)) {
    throw new TypeError("nextAction must be a known confirmation action.");
  }

  const updatedAt = requireUtcInstant(wire.updated_at, "updatedAt");
  const serverTime = requireUtcInstant(wire.server_time, "serverTime");
  const updatedAtNs = parseUtcInstantNanoseconds(updatedAt);
  const serverTimeNs = parseUtcInstantNanoseconds(serverTime);
  if (
    updatedAtNs === null ||
    serverTimeNs === null ||
    updatedAtNs > serverTimeNs
  ) {
    throw new TypeError("updatedAt must not be after serverTime.");
  }

  const retryAfterSeconds =
    wire.retry_after_seconds === null
      ? null
      : requireRawRetryHint(wire.retry_after_seconds);
  const userFailureCode = wire.user_failure_code;

  const hasValidCombination = (() => {
    switch (wire.status) {
      case "PENDING":
      case "PROCESSING":
        return (
          wire.next_action === "POLL" &&
          retryAfterSeconds !== null &&
          userFailureCode === null
        );
      case "SUCCEEDED":
        return (
          wire.next_action === "NONE" &&
          retryAfterSeconds === null &&
          userFailureCode === null
        );
      case "FAILED":
        return (
          (wire.next_action === "START_NEW_CHECKOUT" ||
            wire.next_action === "NONE") &&
          retryAfterSeconds === null &&
          userFailureCode === "PAYMENT_DECLINED"
        );
      case "REQUIRES_REVIEW":
        return (
          wire.next_action === "CONTACT_SUPPORT" &&
          retryAfterSeconds !== null &&
          userFailureCode === "PAYMENT_REVIEW_REQUIRED"
        );
    }
  })();
  if (!hasValidCombination) {
    throw new TypeError("payment operation fields form an invalid state.");
  }

  const validatedUserFailureCode =
    wire.status === "FAILED"
      ? "PAYMENT_DECLINED"
      : wire.status === "REQUIRES_REVIEW"
        ? "PAYMENT_REVIEW_REQUIRED"
        : null;

  return {
    operationId,
    orderId,
    status: wire.status,
    updatedAt,
    nextAction: wire.next_action,
    retryAfterSeconds,
    serverTime,
    userFailureCode: validatedUserFailureCode,
  };
};

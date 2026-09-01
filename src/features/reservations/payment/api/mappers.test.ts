import type {
  PaymentAttemptWire,
  PaymentOperationAcceptedWire,
  PaymentOperationDetailWire,
  ReservationHoldReleaseWire,
} from "./contracts";
import {
  toPaymentAttempt,
  toPaymentOperationAccepted,
  toPaymentOperationConfirmationWireRequest,
  toPaymentOperationDetail,
  toReservationHoldRelease,
} from "./mappers";
import { RESERVATION_PAYMENT_STATUSES } from "../model/payment";

const reservationUid = "10000000-0000-4000-8000-000000000001";
const otherReservationUid = "10000000-0000-4000-8000-000000000009";
const paymentAttemptId = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";

const validAttemptWire: PaymentAttemptWire = {
  payment_attempt_id: paymentAttemptId,
  order_id: reservationUid,
  amount: 120000,
  currency: "KRW",
  hold_expires_at: "2026-09-01T10:15:00.123456789Z",
  remaining_seconds: 900,
  server_time: "2026-09-01T10:00:00.123456789Z",
};

const validReleaseWire: ReservationHoldReleaseWire = {
  reservation_uid: reservationUid,
  status: "EXPIRED",
  released_now: true,
  server_time: "2026-09-01T10:01:00.123456789Z",
};

const validAcceptedWire: PaymentOperationAcceptedWire = {
  operation_id: operationId,
  status: "PENDING",
  status_url: `/api/v1/payment-operations/${operationId}`,
};

const validOperationWire: PaymentOperationDetailWire = {
  operation_id: operationId,
  order_id: reservationUid,
  status: "PENDING",
  failure_code: "private-provider-code",
  updated_at: "2026-09-01T10:02:00.123456789Z",
  next_action: "POLL",
  retry_after_seconds: 2,
  user_message: "backend-owned copy",
  server_time: "2026-09-01T10:02:01.123456789Z",
  user_failure_code: null,
};

describe("payment contract mappers", () => {
  it("maps an exact payment-attempt tuple while preserving nanosecond instants", () => {
    expect(toPaymentAttempt(validAttemptWire, reservationUid)).toEqual({
      paymentAttemptId,
      orderId: reservationUid,
      amount: 120000,
      currency: "KRW",
      holdExpiresAt: "2026-09-01T10:15:00.123456789Z",
      remainingSeconds: 900,
      serverTime: "2026-09-01T10:00:00.123456789Z",
    });
  });

  it.each([
    ["invalid requested reservation", validAttemptWire, "reservation-1"],
    [
      "order mismatch",
      { ...validAttemptWire, order_id: otherReservationUid },
      reservationUid,
    ],
    [
      "invalid attempt UUID",
      { ...validAttemptWire, payment_attempt_id: "attempt-1" },
      reservationUid,
    ],
    ["below card minimum", { ...validAttemptWire, amount: 99 }, reservationUid],
    [
      "above Java integer maximum",
      { ...validAttemptWire, amount: 2_147_483_648 },
      reservationUid,
    ],
    [
      "non-KRW currency",
      { ...validAttemptWire, currency: "USD" },
      reservationUid,
    ],
    [
      "non-UTC hold instant",
      { ...validAttemptWire, hold_expires_at: "2026-09-01T19:15:00+09:00" },
      reservationUid,
    ],
    [
      "more than nanosecond precision",
      {
        ...validAttemptWire,
        hold_expires_at: "2026-09-01T10:15:00.1234567890Z",
      },
      reservationUid,
    ],
    [
      "remaining time mismatch",
      { ...validAttemptWire, remaining_seconds: 899 },
      reservationUid,
    ],
  ])("rejects malformed payment attempt: %s", (_label, wire, expected) => {
    expect(() => toPaymentAttempt(wire, expected)).toThrow(TypeError);
  });

  it("accepts a legal replay with zero whole remaining seconds", () => {
    expect(
      toPaymentAttempt(
        {
          ...validAttemptWire,
          hold_expires_at: "2026-09-01T10:00:00.999999999Z",
          remaining_seconds: 0,
          server_time: "2026-09-01T10:00:00.123456789Z",
        },
        reservationUid,
      ).remainingSeconds,
    ).toBe(0);
  });

  it.each(RESERVATION_PAYMENT_STATUSES)(
    "accepts the known %s reservation release status",
    (status) => {
      expect(
        toReservationHoldRelease(
          { ...validReleaseWire, status },
          reservationUid,
        ).status,
      ).toBe(status);
    },
  );

  it.each([
    [
      "reservation mismatch",
      { ...validReleaseWire, reservation_uid: otherReservationUid },
    ],
    ["unknown status", { ...validReleaseWire, status: "REFUNDED" }],
    ["non-boolean result", { ...validReleaseWire, released_now: 1 }],
    ["invalid server instant", { ...validReleaseWire, server_time: "now" }],
  ])("rejects malformed hold release: %s", (_label, wire) => {
    expect(() => toReservationHoldRelease(wire, reservationUid)).toThrow(
      TypeError,
    );
  });

  it("creates the exact payment-operation confirm body", () => {
    expect(
      toPaymentOperationConfirmationWireRequest({
        paymentKey: " payment key remains byte-identical ",
        orderId: reservationUid,
        amount: 100,
        paymentAttemptId,
      }),
    ).toEqual({
      payment_key: " payment key remains byte-identical ",
      order_id: reservationUid,
      amount: 100,
      payment_attempt_id: paymentAttemptId,
    });
  });

  it.each([
    ["oversized payment key", { paymentKey: "x".repeat(201) }],
    ["blank payment key", { paymentKey: " \t" }],
    ["invalid order UUID", { orderId: "reservation-1" }],
    ["invalid attempt UUID", { paymentAttemptId: "attempt-1" }],
    ["unsupported amount", { amount: 99 }],
  ])("rejects malformed operation confirmation: %s", (_label, override) => {
    expect(() =>
      toPaymentOperationConfirmationWireRequest({
        paymentKey: "payment-key-1",
        orderId: reservationUid,
        amount: 120000,
        paymentAttemptId,
        ...override,
      }),
    ).toThrow(TypeError);
  });

  it.each(["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REQUIRES_REVIEW"])(
    "maps only the accepted operation identity for an exact replay in %s",
    (status) => {
      expect(
        toPaymentOperationAccepted({
          ...validAcceptedWire,
          status,
          status_url: "https://attacker.invalid/private?secret=value\r\n",
        }),
      ).toEqual({ operationId });
    },
  );

  it.each([
    ["invalid UUID", { ...validAcceptedWire, operation_id: "operation-1" }],
    ["unknown status", { ...validAcceptedWire, status: "QUEUED" }],
  ])("rejects malformed accepted operation: %s", (_label, wire) => {
    expect(() => toPaymentOperationAccepted(wire)).toThrow(TypeError);
  });

  it.each([
    ["PENDING", "POLL", 1, null],
    ["PROCESSING", "POLL", 31, null],
    ["SUCCEEDED", "NONE", null, null],
    ["FAILED", "START_NEW_CHECKOUT", null, "PAYMENT_DECLINED"],
    ["FAILED", "NONE", null, "PAYMENT_DECLINED"],
    ["REQUIRES_REVIEW", "CONTACT_SUPPORT", -5, "PAYMENT_REVIEW_REQUIRED"],
  ])(
    "accepts the current %s operation combination and leaves retry clamping to the workflow",
    (status, nextAction, retryAfterSeconds, userFailureCode) => {
      expect(
        toPaymentOperationDetail(
          {
            ...validOperationWire,
            status,
            next_action: nextAction,
            retry_after_seconds: retryAfterSeconds,
            user_failure_code: userFailureCode,
          },
          operationId,
          reservationUid,
        ),
      ).toMatchObject({
        status,
        nextAction,
        retryAfterSeconds,
        userFailureCode,
      });
    },
  );

  it("discards provider failure text and backend user copy from operation detail", () => {
    expect(
      toPaymentOperationDetail(
        {
          ...validOperationWire,
          failure_code: { raw: "sensitive" },
          user_message:
            "<script>alert('secret')</script>\r\nhttps://private.invalid",
        },
        operationId,
        reservationUid,
      ),
    ).toEqual({
      operationId,
      orderId: reservationUid,
      status: "PENDING",
      updatedAt: "2026-09-01T10:02:00.123456789Z",
      nextAction: "POLL",
      retryAfterSeconds: 2,
      serverTime: "2026-09-01T10:02:01.123456789Z",
      userFailureCode: null,
    });
  });

  it.each([
    [
      "operation mismatch",
      validOperationWire,
      otherReservationUid,
      reservationUid,
    ],
    ["order mismatch", validOperationWire, operationId, otherReservationUid],
    [
      "unknown status",
      { ...validOperationWire, status: "QUEUED" },
      operationId,
      reservationUid,
    ],
    [
      "cancellation-only action",
      { ...validOperationWire, next_action: "RETRY_CANCELLATION" },
      operationId,
      reservationUid,
    ],
    [
      "fractional retry hint",
      { ...validOperationWire, retry_after_seconds: 2.5 },
      operationId,
      reservationUid,
    ],
    [
      "pending without retry",
      { ...validOperationWire, retry_after_seconds: null },
      operationId,
      reservationUid,
    ],
    [
      "success with a user failure code",
      {
        ...validOperationWire,
        status: "SUCCEEDED",
        next_action: "NONE",
        retry_after_seconds: null,
        user_failure_code: "PAYMENT_DECLINED",
      },
      operationId,
      reservationUid,
    ],
    [
      "failed without allowlisted failure",
      {
        ...validOperationWire,
        status: "FAILED",
        next_action: "NONE",
        retry_after_seconds: null,
      },
      operationId,
      reservationUid,
    ],
    [
      "review with wrong action",
      {
        ...validOperationWire,
        status: "REQUIRES_REVIEW",
        retry_after_seconds: 30,
        user_failure_code: "PAYMENT_REVIEW_REQUIRED",
      },
      operationId,
      reservationUid,
    ],
    [
      "updated after server time",
      {
        ...validOperationWire,
        updated_at: "2026-09-01T10:02:02.000000001Z",
      },
      operationId,
      reservationUid,
    ],
  ])(
    "rejects invalid payment operation detail: %s",
    (_label, wire, expectedOperation, expectedOrder) => {
      expect(() =>
        toPaymentOperationDetail(wire, expectedOperation, expectedOrder),
      ).toThrow(TypeError);
    },
  );
});

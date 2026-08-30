import type { CheckoutOwnership } from "../model/checkoutOwnership";
import {
  PAYMENT_STATUSES,
  type PaymentConfirmation,
  type PaymentRecord,
  type PaymentStatus,
} from "../model/payment";
import type {
  CheckoutOwnershipAccommodationWire,
  CheckoutOwnershipWire,
  PaymentConfirmationWireRequest,
  PaymentRecordWire,
} from "./contracts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value;
};

const requirePositiveSafeInteger = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${field} must be a positive safe integer.`);
  }

  return value as number;
};

const requireCalendarDate = (value: unknown, field: string): string => {
  const raw = requireNonEmptyString(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(raw);
  if (!match) throw new TypeError(`${field} must start with a calendar date.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`${field} must start with a calendar date.`);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
};

const isPaymentStatus = (value: unknown): value is PaymentStatus =>
  typeof value === "string" &&
  PAYMENT_STATUSES.some((status) => status === value);

export const toPaymentConfirmationWireRequest = (
  input: PaymentConfirmation,
): PaymentConfirmationWireRequest => ({
  payment_key: requireNonEmptyString(input.paymentKey, "paymentKey"),
  order_id: requireNonEmptyString(input.orderId, "orderId"),
  amount: requirePositiveSafeInteger(input.amount, "amount"),
});

export const toPaymentRecord = (wire: PaymentRecordWire): PaymentRecord => {
  const paymentKey = wire.payment_key;

  if (
    paymentKey !== undefined &&
    paymentKey !== null &&
    (typeof paymentKey !== "string" || paymentKey.trim().length === 0)
  ) {
    throw new TypeError("paymentKey must be null or a non-empty string.");
  }

  if (!isPaymentStatus(wire.status)) {
    throw new TypeError("status must be a known payment status.");
  }

  return {
    orderId: requireNonEmptyString(wire.order_id, "orderId"),
    paymentKey: paymentKey ?? null,
    totalAmount: requirePositiveSafeInteger(wire.total_amount, "totalAmount"),
    status: wire.status,
  };
};

const toAccommodationId = (wire: unknown): number => {
  if (!isRecord(wire)) {
    throw new TypeError("accommodation must be an object.");
  }

  const accommodation = wire as unknown as CheckoutOwnershipAccommodationWire;
  return requirePositiveSafeInteger(
    accommodation.id,
    "accommodationId",
  );
};

const toOptionalPaymentRecord = (wire: unknown): PaymentRecord | null => {
  if (wire === null) {
    return null;
  }

  if (!isRecord(wire)) {
    throw new TypeError("payment must be null or an object.");
  }

  return toPaymentRecord(wire as unknown as PaymentRecordWire);
};

export const toCheckoutOwnership = (
  wire: CheckoutOwnershipWire,
  expectedReservationUid: string,
): CheckoutOwnership => {
  const reservationUid = requireNonEmptyString(
    wire.reservation_uid,
    "reservationUid",
  );

  if (reservationUid !== expectedReservationUid) {
    throw new TypeError("reservationUid does not match the requested reservation.");
  }

  const payment = toOptionalPaymentRecord(wire.payment);
  if (payment !== null && payment.orderId !== reservationUid) {
    throw new TypeError("payment orderId does not match the reservation.");
  }

  const checkIn = requireCalendarDate(wire.check_in_date_time, "checkIn");
  const checkOut = requireCalendarDate(wire.check_out_date_time, "checkOut");
  if (checkIn >= checkOut) {
    throw new TypeError("checkOut must be after checkIn.");
  }

  return {
    reservationUid,
    accommodationId: toAccommodationId(wire.accommodation),
    checkIn,
    checkOut,
    guestCount: requirePositiveSafeInteger(wire.guest_count, "guestCount"),
    payment,
  };
};

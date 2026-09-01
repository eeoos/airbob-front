import {
  calendarNightsBetween,
  isCanonicalCalendarLocalDate,
} from "../../../../shared/lib/calendarLocalDate";
import {
  RESERVATION_BOOKING_STATUSES,
  type ReservationBookingStatus,
  type ReservationCheckoutInput,
  type ReservationQuote,
  type ReservationQuoteInput,
  type ReservationReady,
} from "../model/booking";
import type {
  ReservationCheckoutWireRequest,
  ReservationQuoteWire,
  ReservationQuoteWireRequest,
  ReservationReadyWire,
} from "./contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const UTC_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const RESERVATION_QUOTE_KEYS = [
  "quoteUid",
  "accommodationId",
  "orderName",
  "checkIn",
  "checkOut",
  "guestCount",
  "nightlyPrice",
  "nights",
  "subtotal",
  "discountAmount",
  "amount",
  "currency",
  "paymentRequired",
  "inventoryHeld",
  "quoteExpiresAt",
  "serverTime",
] as const;

const invalidField = (field: string): never => {
  throw new TypeError(`Reservation booking ${field} is invalid.`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
};

const toPositiveSafeInteger = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    return invalidField(field);
  }

  return value as number;
};

const toNonNegativeSafeInteger = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return invalidField(field);
  }

  return value as number;
};

const toUuid = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return invalidField(field);
  }

  return value;
};

const toCalendarDate = (value: unknown, field: string): string => {
  if (!isCanonicalCalendarLocalDate(value)) return invalidField(field);
  return value;
};

const toNonEmptyText = (value: unknown, field: string): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 255 ||
    value.trim().length === 0
  ) {
    return invalidField(field);
  }

  return value;
};

const toCurrency = (value: unknown): string => {
  if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
    return invalidField("currency");
  }

  return value;
};

const toBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== "boolean") return invalidField(field);
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

const toUtcInstantNanoseconds = (value: unknown, field: string): bigint => {
  if (typeof value !== "string") return invalidField(field);
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
    return invalidField(field);
  }

  const wholeSecond = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const wholeSecondMs = Date.parse(wholeSecond);
  if (!Number.isSafeInteger(wholeSecondMs) || wholeSecondMs < 0) {
    return invalidField(field);
  }

  return (
    BigInt(wholeSecondMs) * 1_000_000n + BigInt((match[7] ?? "").padEnd(9, "0"))
  );
};

const toUtcInstant = (value: unknown, field: string): string => {
  toUtcInstantNanoseconds(value, field);
  return value as string;
};

const assertExactIdentity = (
  actual: string | number,
  expected: string | number,
  field: string,
): void => {
  if (actual !== expected) invalidField(`${field} identity`);
};

const assertMoneyIdentity = ({
  amount,
  discountAmount,
  subtotal,
}: Pick<
  ReservationQuote | ReservationReady,
  "amount" | "discountAmount" | "subtotal"
>): void => {
  if (discountAmount > subtotal || amount !== subtotal - discountAmount) {
    invalidField("money identity");
  }
};

const toReservationBookingStatus = (
  value: unknown,
): ReservationBookingStatus => {
  if (
    typeof value !== "string" ||
    !RESERVATION_BOOKING_STATUSES.some((status) => status === value)
  ) {
    return invalidField("status");
  }

  return value as ReservationBookingStatus;
};

const validateQuoteInput = (
  input: ReservationQuoteInput,
): ReservationQuoteInput => {
  const accommodationId = toPositiveSafeInteger(
    input.accommodationId,
    "accommodationId",
  );
  const checkInDate = toCalendarDate(input.checkInDate, "checkInDate");
  const checkOutDate = toCalendarDate(input.checkOutDate, "checkOutDate");
  const nights = calendarNightsBetween(checkInDate, checkOutDate);
  if (nights === null || nights <= 0) invalidField("stay dates");

  return {
    accommodationId,
    checkInDate,
    checkOutDate,
    guestCount: toPositiveSafeInteger(input.guestCount, "guestCount"),
    couponId:
      input.couponId === null
        ? null
        : toPositiveSafeInteger(input.couponId, "couponId"),
  };
};

export const validateReservationQuote = (value: unknown): ReservationQuote => {
  if (!isRecord(value) || !hasExactKeys(value, RESERVATION_QUOTE_KEYS)) {
    return invalidField("quote shape");
  }

  const quote: ReservationQuote = {
    quoteUid: toUuid(value.quoteUid, "quoteUid"),
    accommodationId: toPositiveSafeInteger(
      value.accommodationId,
      "accommodationId",
    ),
    orderName: toNonEmptyText(value.orderName, "orderName"),
    checkIn: toCalendarDate(value.checkIn, "checkIn"),
    checkOut: toCalendarDate(value.checkOut, "checkOut"),
    guestCount: toPositiveSafeInteger(value.guestCount, "guestCount"),
    nightlyPrice: toNonNegativeSafeInteger(value.nightlyPrice, "nightlyPrice"),
    nights: toPositiveSafeInteger(value.nights, "nights"),
    subtotal: toNonNegativeSafeInteger(value.subtotal, "subtotal"),
    discountAmount: toNonNegativeSafeInteger(
      value.discountAmount,
      "discountAmount",
    ),
    amount: toNonNegativeSafeInteger(value.amount, "amount"),
    currency: toCurrency(value.currency),
    paymentRequired: toBoolean(value.paymentRequired, "paymentRequired"),
    inventoryHeld:
      toBoolean(value.inventoryHeld, "inventoryHeld") === false
        ? false
        : invalidField("inventoryHeld"),
    quoteExpiresAt: toUtcInstant(value.quoteExpiresAt, "quoteExpiresAt"),
    serverTime: toUtcInstant(value.serverTime, "serverTime"),
  };

  const expectedNights = calendarNightsBetween(quote.checkIn, quote.checkOut);
  if (expectedNights === null) return invalidField("stay dates");
  if (expectedNights <= 0) invalidField("stay dates");
  assertExactIdentity(quote.nights, expectedNights, "nights");
  const rawSubtotal = quote.nightlyPrice * quote.nights;
  if (!Number.isSafeInteger(rawSubtotal) || quote.subtotal !== rawSubtotal) {
    invalidField("nightly price identity");
  }
  assertMoneyIdentity(quote);
  if (quote.paymentRequired !== quote.amount > 0) {
    invalidField("paymentRequired");
  }

  const quoteExpiresAtNs = toUtcInstantNanoseconds(
    quote.quoteExpiresAt,
    "quoteExpiresAt",
  );
  const serverTimeNs = toUtcInstantNanoseconds(quote.serverTime, "serverTime");
  if (quoteExpiresAtNs <= serverTimeNs) invalidField("quote expiry");

  return quote;
};

export const toReservationQuoteWireRequest = (
  input: ReservationQuoteInput,
): ReservationQuoteWireRequest => {
  const validated = validateQuoteInput(input);
  return {
    accommodation_id: validated.accommodationId,
    check_in_date: validated.checkInDate,
    check_out_date: validated.checkOutDate,
    guest_count: validated.guestCount,
    ...(validated.couponId === null ? {} : { coupon_id: validated.couponId }),
  };
};

export const toReservationQuote = (
  wire: ReservationQuoteWire,
  expectedInput: ReservationQuoteInput,
): ReservationQuote => {
  const input = validateQuoteInput(expectedInput);
  const quote = validateReservationQuote({
    quoteUid: toUuid(wire.quote_uid, "quoteUid"),
    accommodationId: toPositiveSafeInteger(
      wire.accommodation_id,
      "accommodationId",
    ),
    orderName: toNonEmptyText(wire.order_name, "orderName"),
    checkIn: toCalendarDate(wire.check_in, "checkIn"),
    checkOut: toCalendarDate(wire.check_out, "checkOut"),
    guestCount: toPositiveSafeInteger(wire.guest_count, "guestCount"),
    nightlyPrice: toNonNegativeSafeInteger(wire.nightly_price, "nightlyPrice"),
    nights: toPositiveSafeInteger(wire.nights, "nights"),
    subtotal: toNonNegativeSafeInteger(wire.subtotal, "subtotal"),
    discountAmount: toNonNegativeSafeInteger(
      wire.discount_amount,
      "discountAmount",
    ),
    amount: toNonNegativeSafeInteger(wire.amount, "amount"),
    currency: toCurrency(wire.currency),
    paymentRequired: toBoolean(wire.payment_required, "paymentRequired"),
    inventoryHeld:
      toBoolean(wire.inventory_held, "inventoryHeld") === false
        ? false
        : invalidField("inventoryHeld"),
    quoteExpiresAt: toUtcInstant(wire.quote_expires_at, "quoteExpiresAt"),
    serverTime: toUtcInstant(wire.server_time, "serverTime"),
  });

  assertExactIdentity(
    quote.accommodationId,
    input.accommodationId,
    "accommodationId",
  );
  assertExactIdentity(quote.checkIn, input.checkInDate, "checkIn");
  assertExactIdentity(quote.checkOut, input.checkOutDate, "checkOut");
  assertExactIdentity(quote.guestCount, input.guestCount, "guestCount");

  return quote;
};

export const toReservationCheckoutWireRequest = (
  input: ReservationCheckoutInput,
): ReservationCheckoutWireRequest => {
  const quote = validateReservationQuote(input.quote);
  return { quote_uid: quote.quoteUid, request_message: null };
};

export const toReservationCheckoutIdempotencyKey = (value: unknown): string => {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    return invalidField("idempotencyKey");
  }

  return value;
};

const assertReadyRecoveryInvariant = (ready: ReservationReady): void => {
  const serverTimeNs = toUtcInstantNanoseconds(ready.serverTime, "serverTime");
  const holdExpiresAtNs =
    ready.holdExpiresAt === null
      ? null
      : toUtcInstantNanoseconds(ready.holdExpiresAt, "holdExpiresAt");

  if (ready.status === "PAYMENT_PENDING") {
    if (
      ready.amount === 0 ||
      !ready.paymentAllowed ||
      holdExpiresAtNs === null ||
      holdExpiresAtNs <= serverTimeNs
    ) {
      invalidField("payment recovery state");
    }
    return;
  }

  if (ready.status === "EXPIRED") {
    if (
      ready.paymentAllowed ||
      (holdExpiresAtNs !== null && holdExpiresAtNs > serverTimeNs)
    ) {
      invalidField("payment recovery state");
    }
    return;
  }

  if (ready.paymentAllowed || ready.holdExpiresAt !== null) {
    invalidField("payment recovery state");
  }
};

export const toReservationReady = (
  wire: ReservationReadyWire,
  quote: ReservationQuote,
): ReservationReady => {
  const expectedQuote = validateReservationQuote(quote);
  const ready: ReservationReady = {
    reservationUid: toUuid(wire.reservation_uid, "reservationUid"),
    orderName: toNonEmptyText(wire.order_name, "orderName"),
    checkIn: toCalendarDate(wire.check_in, "checkIn"),
    checkOut: toCalendarDate(wire.check_out, "checkOut"),
    guestCount: toPositiveSafeInteger(wire.guest_count, "guestCount"),
    subtotal: toNonNegativeSafeInteger(wire.subtotal, "subtotal"),
    discountAmount: toNonNegativeSafeInteger(
      wire.discount_amount,
      "discountAmount",
    ),
    amount: toNonNegativeSafeInteger(wire.amount, "amount"),
    currency: toCurrency(wire.currency),
    status: toReservationBookingStatus(wire.status),
    paymentRequired: toBoolean(wire.payment_required, "paymentRequired"),
    paymentAllowed: toBoolean(wire.payment_allowed, "paymentAllowed"),
    holdExpiresAt:
      wire.hold_expires_at === null
        ? null
        : toUtcInstant(wire.hold_expires_at, "holdExpiresAt"),
    serverTime: toUtcInstant(wire.server_time, "serverTime"),
  };

  assertExactIdentity(ready.checkIn, expectedQuote.checkIn, "checkIn");
  assertExactIdentity(ready.checkOut, expectedQuote.checkOut, "checkOut");
  assertExactIdentity(ready.guestCount, expectedQuote.guestCount, "guestCount");
  assertExactIdentity(ready.subtotal, expectedQuote.subtotal, "subtotal");
  assertExactIdentity(
    ready.discountAmount,
    expectedQuote.discountAmount,
    "discountAmount",
  );
  assertExactIdentity(ready.amount, expectedQuote.amount, "amount");
  assertExactIdentity(ready.currency, expectedQuote.currency, "currency");
  assertMoneyIdentity(ready);
  if (
    ready.paymentRequired !== ready.amount > 0 ||
    ready.paymentRequired !== expectedQuote.paymentRequired
  ) {
    invalidField("paymentRequired");
  }
  if (
    toUtcInstantNanoseconds(ready.serverTime, "serverTime") <
    toUtcInstantNanoseconds(expectedQuote.serverTime, "quote serverTime")
  ) {
    invalidField("serverTime chronology");
  }

  assertReadyRecoveryInvariant(ready);
  return ready;
};

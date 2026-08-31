import type {
  BookingPaymentOperationId,
  CallbackData,
  CheckoutData,
  CheckoutHandoffState,
} from "./types";
import { isOpaqueIdentifier } from "../../../shared/lib/opaqueIdentifier";

const checkoutKeys = [
  "operationId",
  "accommodationId",
  "reservationUid",
  "orderName",
  "amount",
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
  "couponName",
  "couponDiscount",
] as const;

const callbackKeys = [
  "operationId",
  "reservationUid",
  "orderId",
  "paymentKey",
  "amount",
  "phase",
] as const;

export const checkoutDataKeys = checkoutKeys;
export const callbackDataKeys = callbackKeys;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
) => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();

  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
};

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maxLength &&
  value.trim() === value;

export const isBookingPaymentOperationId = (
  value: unknown,
): value is BookingPaymentOperationId =>
  typeof value === "string" &&
  /^[A-Za-z0-9_-]+$/.test(value) &&
  value.length <= 128;

const isStrictCalendarDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isNullableBoundedString = (value: unknown, maxLength: number) =>
  value === null || isBoundedString(value, maxLength);

const hasValidCheckoutValues = (value: Record<string, unknown>): boolean =>
  isBookingPaymentOperationId(value.operationId) &&
  isPositiveSafeInteger(value.accommodationId) &&
  isOpaqueIdentifier(value.reservationUid) &&
  isBoundedString(value.orderName, 256) &&
  isPositiveSafeInteger(value.amount) &&
  isStrictCalendarDate(value.checkIn) &&
  isStrictCalendarDate(value.checkOut) &&
  (value.checkIn as string) < (value.checkOut as string) &&
  isNonNegativeSafeInteger(value.adultOccupancy) &&
  isNonNegativeSafeInteger(value.childOccupancy) &&
  isNonNegativeSafeInteger(value.infantOccupancy) &&
  isNonNegativeSafeInteger(value.petOccupancy) &&
  (value.adultOccupancy as number) + (value.childOccupancy as number) >= 1 &&
  isNullableBoundedString(value.couponName, 128) &&
  (value.couponDiscount === null ||
    isNonNegativeSafeInteger(value.couponDiscount));

export const isCheckoutData = (value: unknown): value is CheckoutData =>
  isRecord(value) &&
  hasExactKeys(value, checkoutKeys) &&
  hasValidCheckoutValues(value);

const callbackPhases = new Set(["received", "confirming", "reconciling"]);

export const isCallbackData = (value: unknown): value is CallbackData =>
  isRecord(value) &&
  hasExactKeys(value, callbackKeys) &&
  isBookingPaymentOperationId(value.operationId) &&
  isOpaqueIdentifier(value.reservationUid) &&
  isOpaqueIdentifier(value.orderId) &&
  value.orderId === value.reservationUid &&
  isBoundedString(value.paymentKey, 512) &&
  isPositiveSafeInteger(value.amount) &&
  typeof value.phase === "string" &&
  callbackPhases.has(value.phase);

export const isCheckoutHandoffState = (
  value: unknown,
): value is CheckoutHandoffState => {
  if (!isRecord(value) || !hasExactKeys(value, ["checkoutHandoff"])) {
    return false;
  }

  const handoff = value.checkoutHandoff;
  return (
    isRecord(handoff) &&
    hasExactKeys(handoff, ["purpose", "version", "operationId"]) &&
    handoff.purpose === "reservation-checkout" &&
    handoff.version === 1 &&
    isBookingPaymentOperationId(handoff.operationId)
  );
};

import type {
  BookingPaymentAttempt,
  BookingPaymentCheckout,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentJournalPhase,
  BookingPaymentPresentationIntent,
  BookingPaymentQuote,
  BookingPaymentReady,
  BookingPaymentRelease,
  BookingPaymentRuntimeLease,
  BookingPaymentServerIntent,
} from "./types";

export const BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS = 60 * 60 * 1000;
const BOOKING_PAYMENT_MINIMUM_CARD_AMOUNT = 100;
const BOOKING_PAYMENT_MAXIMUM_CARD_AMOUNT = 2_147_483_647;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const OWNER_PATTERN = /^subject:[A-Za-z0-9_-]{3,128}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const FINGERPRINT_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

const RESERVATION_STATUSES = new Set([
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "CANCELLATION_PENDING",
  "CANCELLED",
  "CANCELLATION_FAILED",
  "EXPIRED",
]);

const TERMINAL_PHASES = new Set<BookingPaymentJournalPhase>([
  "complimentary-observed",
  "reservation-status-observed",
  "hold-released",
]);

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

const isPositiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

export const isSupportedBookingPaymentCardAmount = (
  value: unknown,
): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= BOOKING_PAYMENT_MINIMUM_CARD_AMOUNT &&
  (value as number) <= BOOKING_PAYMENT_MAXIMUM_CARD_AMOUNT;

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

export const isBookingPaymentUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export const isBookingPaymentOwner = (value: unknown): value is string =>
  typeof value === "string" && OWNER_PATTERN.test(value);

const isBookingPaymentCalendarDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DATE_PATTERN.exec(value);
  return (
    match !== null &&
    isValidCalendarParts(Number(match[1]), Number(match[2]), Number(match[3]))
  );
};

export const parseBookingPaymentUtcInstant = (
  value: unknown,
): number | null => {
  if (typeof value !== "string") return null;
  const match = UTC_INSTANT_PATTERN.exec(value);
  if (!match) return null;
  if (
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
  const fractionalMilliseconds = Number(
    (match[7] ?? "").padEnd(3, "0").slice(0, 3),
  );
  const timestamp = Date.parse(wholeSecond) + fractionalMilliseconds;
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
};

export const parseBookingPaymentUtcInstantNanoseconds = (
  value: unknown,
): bigint | null => {
  if (typeof value !== "string") return null;
  const match = UTC_INSTANT_PATTERN.exec(value);
  if (!match || parseBookingPaymentUtcInstant(value) === null) return null;
  const wholeSecond = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const wholeSecondMs = Date.parse(wholeSecond);
  if (!Number.isSafeInteger(wholeSecondMs) || wholeSecondMs < 0) return null;
  const fractionalNanoseconds = BigInt((match[7] ?? "").padEnd(9, "0"));
  return BigInt(wholeSecondMs) * 1_000_000n + fractionalNanoseconds;
};

const calendarDayNumber = (value: string): number => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / 86_400_000;
};

const isNonEmptyText = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 255 &&
  value.trim().length > 0;

const hasSafeMoneyIdentity = (value: Record<string, unknown>): boolean => {
  const { subtotal, discountAmount, amount } = value;
  return (
    isNonNegativeSafeInteger(subtotal) &&
    isNonNegativeSafeInteger(discountAmount) &&
    isNonNegativeSafeInteger(amount) &&
    subtotal >= discountAmount &&
    amount === subtotal - discountAmount
  );
};

export const isBookingPaymentRuntimeLease = (
  value: unknown,
): value is BookingPaymentRuntimeLease =>
  isRecord(value) &&
  hasExactKeys(value, ["runtimeLeaseId", "sessionEpoch"]) &&
  isBookingPaymentUuid(value.runtimeLeaseId) &&
  isNonNegativeSafeInteger(value.sessionEpoch);

const isBookingPaymentServerIntent = (
  value: unknown,
): value is BookingPaymentServerIntent =>
  isRecord(value) &&
  hasExactKeys(value, [
    "accommodationId",
    "checkInDate",
    "checkOutDate",
    "guestCount",
    "couponId",
  ]) &&
  isPositiveSafeInteger(value.accommodationId) &&
  isBookingPaymentCalendarDate(value.checkInDate) &&
  isBookingPaymentCalendarDate(value.checkOutDate) &&
  value.checkInDate < value.checkOutDate &&
  isPositiveSafeInteger(value.guestCount) &&
  (value.couponId === null || isPositiveSafeInteger(value.couponId));

const isBookingPaymentPresentationIntent = (
  value: unknown,
): value is BookingPaymentPresentationIntent =>
  isRecord(value) &&
  hasExactKeys(value, [
    "adultCount",
    "childCount",
    "infantCount",
    "petCount",
  ]) &&
  isNonNegativeSafeInteger(value.adultCount) &&
  isNonNegativeSafeInteger(value.childCount) &&
  isNonNegativeSafeInteger(value.infantCount) &&
  isNonNegativeSafeInteger(value.petCount) &&
  value.adultCount + value.childCount > 0 &&
  Number.isSafeInteger(value.adultCount + value.childCount);

const isBookingPaymentQuote = (
  value: unknown,
): value is BookingPaymentQuote => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
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
    ]) ||
    !isBookingPaymentUuid(value.quoteUid) ||
    !isPositiveSafeInteger(value.accommodationId) ||
    !isNonEmptyText(value.orderName) ||
    !isBookingPaymentCalendarDate(value.checkIn) ||
    !isBookingPaymentCalendarDate(value.checkOut) ||
    value.checkIn >= value.checkOut ||
    !isPositiveSafeInteger(value.guestCount) ||
    !isNonNegativeSafeInteger(value.nightlyPrice) ||
    !isPositiveSafeInteger(value.nights) ||
    !hasSafeMoneyIdentity(value) ||
    !CURRENCY_PATTERN.test(String(value.currency)) ||
    typeof value.paymentRequired !== "boolean" ||
    value.paymentRequired !== (value.amount as number) > 0 ||
    value.inventoryHeld !== false
  ) {
    return false;
  }

  const quoteExpiry = parseBookingPaymentUtcInstant(value.quoteExpiresAt);
  const serverTime = parseBookingPaymentUtcInstant(value.serverTime);
  const quoteExpiryNs = parseBookingPaymentUtcInstantNanoseconds(
    value.quoteExpiresAt,
  );
  const serverTimeNs = parseBookingPaymentUtcInstantNanoseconds(
    value.serverTime,
  );
  const calendarNights =
    calendarDayNumber(value.checkOut) - calendarDayNumber(value.checkIn);
  const rawSubtotal = value.nightlyPrice * value.nights;
  return (
    quoteExpiry !== null &&
    serverTime !== null &&
    quoteExpiryNs !== null &&
    serverTimeNs !== null &&
    quoteExpiryNs > serverTimeNs &&
    calendarNights === value.nights &&
    Number.isSafeInteger(rawSubtotal) &&
    rawSubtotal === value.subtotal
  );
};

const isBookingPaymentCheckout = (
  value: unknown,
): value is BookingPaymentCheckout =>
  isRecord(value) &&
  hasExactKeys(value, [
    "method",
    "resource",
    "body",
    "idempotencyKey",
    "requestFingerprint",
  ]) &&
  value.method === "POST" &&
  value.resource === "/api/v1/reservations" &&
  isRecord(value.body) &&
  hasExactKeys(value.body, ["quoteUid", "requestMessage"]) &&
  isBookingPaymentUuid(value.body.quoteUid) &&
  value.body.requestMessage === null &&
  typeof value.idempotencyKey === "string" &&
  IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey) &&
  typeof value.requestFingerprint === "string" &&
  FINGERPRINT_PATTERN.test(value.requestFingerprint);

const isBookingPaymentReady = (
  value: unknown,
): value is BookingPaymentReady => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "reservationUid",
      "orderName",
      "checkIn",
      "checkOut",
      "guestCount",
      "subtotal",
      "discountAmount",
      "amount",
      "currency",
      "status",
      "paymentRequired",
      "paymentAllowed",
      "holdExpiresAt",
      "serverTime",
    ]) ||
    !isBookingPaymentUuid(value.reservationUid) ||
    !isNonEmptyText(value.orderName) ||
    !isBookingPaymentCalendarDate(value.checkIn) ||
    !isBookingPaymentCalendarDate(value.checkOut) ||
    value.checkIn >= value.checkOut ||
    !isPositiveSafeInteger(value.guestCount) ||
    !hasSafeMoneyIdentity(value) ||
    !CURRENCY_PATTERN.test(String(value.currency)) ||
    typeof value.status !== "string" ||
    !RESERVATION_STATUSES.has(value.status) ||
    typeof value.paymentRequired !== "boolean" ||
    value.paymentRequired !== (value.amount as number) > 0 ||
    typeof value.paymentAllowed !== "boolean"
  ) {
    return false;
  }

  const serverTime = parseBookingPaymentUtcInstant(value.serverTime);
  const serverTimeNs = parseBookingPaymentUtcInstantNanoseconds(
    value.serverTime,
  );
  const holdExpiresAt =
    value.holdExpiresAt === null
      ? null
      : parseBookingPaymentUtcInstant(value.holdExpiresAt);
  const holdExpiresAtNs =
    value.holdExpiresAt === null
      ? null
      : parseBookingPaymentUtcInstantNanoseconds(value.holdExpiresAt);
  if (
    serverTime === null ||
    serverTimeNs === null ||
    (value.holdExpiresAt !== null &&
      (holdExpiresAt === null || holdExpiresAtNs === null))
  ) {
    return false;
  }

  if (value.status === "PAYMENT_PENDING") {
    return (
      (value.amount as number) > 0 &&
      value.paymentAllowed &&
      holdExpiresAt !== null &&
      holdExpiresAtNs !== null &&
      holdExpiresAtNs > serverTimeNs
    );
  }

  if (value.status === "EXPIRED") {
    return (
      !value.paymentAllowed &&
      (holdExpiresAt === null ||
        (holdExpiresAtNs !== null && holdExpiresAtNs <= serverTimeNs))
    );
  }

  return !value.paymentAllowed && holdExpiresAt === null;
};

const isSupportedBookingPaymentReadyForAttempt = (
  ready: BookingPaymentReady,
): boolean =>
  ready.status === "PAYMENT_PENDING" &&
  ready.paymentAllowed &&
  ready.currency === "KRW" &&
  isSupportedBookingPaymentCardAmount(ready.amount);

const isBookingPaymentAttempt = (
  value: unknown,
): value is BookingPaymentAttempt => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "paymentAttemptId",
      "orderId",
      "amount",
      "currency",
      "holdExpiresAt",
      "remainingSeconds",
      "serverTime",
    ]) ||
    !isBookingPaymentUuid(value.paymentAttemptId) ||
    !isBookingPaymentUuid(value.orderId) ||
    !isNonNegativeSafeInteger(value.amount) ||
    !CURRENCY_PATTERN.test(String(value.currency)) ||
    !isNonNegativeSafeInteger(value.remainingSeconds)
  ) {
    return false;
  }
  const holdExpiresAt = parseBookingPaymentUtcInstantNanoseconds(
    value.holdExpiresAt,
  );
  const serverTime = parseBookingPaymentUtcInstantNanoseconds(value.serverTime);
  if (
    holdExpiresAt === null ||
    serverTime === null ||
    holdExpiresAt <= serverTime
  ) {
    return false;
  }
  const exactRemainingSeconds = Number(
    (holdExpiresAt - serverTime) / 1_000_000_000n,
  );
  return value.remainingSeconds === exactRemainingSeconds;
};

const isBookingPaymentRelease = (
  value: unknown,
): value is BookingPaymentRelease =>
  isRecord(value) &&
  hasExactKeys(value, [
    "reservationUid",
    "status",
    "releasedNow",
    "serverTime",
  ]) &&
  isBookingPaymentUuid(value.reservationUid) &&
  value.status === "EXPIRED" &&
  typeof value.releasedNow === "boolean" &&
  parseBookingPaymentUtcInstant(value.serverTime) !== null;

const commonDataKeys = [
  "phase",
  "flowId",
  "serverIntent",
  "presentationIntent",
  "recoveryExpiresAt",
  "quote",
] as const;

const checkoutDataKeys = [...commonDataKeys, "checkout"] as const;
const readyDataKeys = [...checkoutDataKeys, "ready"] as const;
const attemptDataKeys = [...readyDataKeys, "attempt"] as const;

const phaseUsesKeys = (
  value: Record<string, unknown>,
  phase: string,
): boolean => {
  switch (phase) {
    case "quoted":
      return hasExactKeys(value, commonDataKeys);
    case "checkout-prepared":
    case "checkout-submitting":
      return hasExactKeys(value, checkoutDataKeys);
    case "complimentary-observed":
    case "reservation-ready":
    case "reservation-status-observed":
    case "attempt-requesting":
      return hasExactKeys(value, readyDataKeys);
    case "attempt-ready":
    case "callback-received":
    case "confirm-submitting":
      return hasExactKeys(value, attemptDataKeys);
    case "hold-release-requesting":
      return (
        hasExactKeys(value, readyDataKeys) ||
        hasExactKeys(value, attemptDataKeys)
      );
    case "hold-released":
      return (
        hasExactKeys(value, [...readyDataKeys, "release"]) ||
        hasExactKeys(value, [...attemptDataKeys, "release"])
      );
    default:
      return false;
  }
};

const exactJsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const dataGroupsAreConsistent = (value: Record<string, unknown>): boolean => {
  const serverIntent = value.serverIntent as BookingPaymentServerIntent;
  const presentationIntent =
    value.presentationIntent as BookingPaymentPresentationIntent;
  const quote = value.quote as BookingPaymentQuote;
  if (
    serverIntent.guestCount !==
      presentationIntent.adultCount + presentationIntent.childCount ||
    quote.accommodationId !== serverIntent.accommodationId ||
    quote.checkIn !== serverIntent.checkInDate ||
    quote.checkOut !== serverIntent.checkOutDate ||
    quote.guestCount !== serverIntent.guestCount
  ) {
    return false;
  }

  if ("checkout" in value) {
    const checkout = value.checkout as BookingPaymentCheckout;
    if (checkout.body.quoteUid !== quote.quoteUid) return false;
    if (
      (value.phase === "checkout-prepared" ||
        value.phase === "checkout-submitting") &&
      quote.amount > 0 &&
      (quote.currency !== "KRW" ||
        !isSupportedBookingPaymentCardAmount(quote.amount))
    ) {
      return false;
    }
  }

  if ("ready" in value) {
    const ready = value.ready as BookingPaymentReady;
    if (
      ready.checkIn !== quote.checkIn ||
      ready.checkOut !== quote.checkOut ||
      ready.guestCount !== quote.guestCount ||
      ready.subtotal !== quote.subtotal ||
      ready.discountAmount !== quote.discountAmount ||
      ready.amount !== quote.amount ||
      ready.currency !== quote.currency ||
      ready.paymentRequired !== quote.paymentRequired
    ) {
      return false;
    }

    if (
      value.phase === "complimentary-observed" &&
      !(
        ready.amount === 0 &&
        ready.status === "CONFIRMED" &&
        !ready.paymentRequired &&
        !ready.paymentAllowed &&
        ready.holdExpiresAt === null
      )
    ) {
      return false;
    }
    if (
      [
        "reservation-ready",
        "attempt-requesting",
        "attempt-ready",
        "callback-received",
        "confirm-submitting",
        "hold-release-requesting",
        "hold-released",
      ].includes(String(value.phase)) &&
      ready.status !== "PAYMENT_PENDING"
    ) {
      return false;
    }
    if (
      value.phase === "attempt-requesting" &&
      !isSupportedBookingPaymentReadyForAttempt(ready)
    ) {
      return false;
    }
    if (
      value.phase === "reservation-status-observed" &&
      (ready.status === "PAYMENT_PENDING" ||
        (ready.amount === 0 && ready.status === "CONFIRMED"))
    ) {
      return false;
    }
  }

  if ("attempt" in value) {
    const ready = value.ready as BookingPaymentReady;
    const attempt = value.attempt as BookingPaymentAttempt;
    if (
      !isSupportedBookingPaymentReadyForAttempt(ready) ||
      attempt.orderId !== ready.reservationUid ||
      attempt.amount !== ready.amount ||
      attempt.currency !== ready.currency ||
      attempt.holdExpiresAt !== ready.holdExpiresAt
    ) {
      return false;
    }
  }

  if ("release" in value) {
    const ready = value.ready as BookingPaymentReady;
    const release = value.release as BookingPaymentRelease;
    if (release.reservationUid !== ready.reservationUid) return false;
  }

  return true;
};

export const isBookingPaymentJournalData = (
  value: unknown,
): value is BookingPaymentJournalData => {
  if (
    !isRecord(value) ||
    typeof value.phase !== "string" ||
    !phaseUsesKeys(value, value.phase) ||
    !isBookingPaymentUuid(value.flowId) ||
    !isBookingPaymentServerIntent(value.serverIntent) ||
    !isBookingPaymentPresentationIntent(value.presentationIntent) ||
    !isNonNegativeSafeInteger(value.recoveryExpiresAt) ||
    !isBookingPaymentQuote(value.quote) ||
    ("checkout" in value && !isBookingPaymentCheckout(value.checkout)) ||
    ("ready" in value && !isBookingPaymentReady(value.ready)) ||
    ("attempt" in value && !isBookingPaymentAttempt(value.attempt)) ||
    ("release" in value && !isBookingPaymentRelease(value.release))
  ) {
    return false;
  }
  return dataGroupsAreConsistent(value);
};

export const isBookingPaymentJournalEnvelope = (
  value: unknown,
): value is BookingPaymentJournalEnvelope =>
  isRecord(value) &&
  hasExactKeys(value, [
    "purpose",
    "version",
    "privacyClass",
    "containsPii",
    "owner",
    "createdAt",
    "hardExpiresAt",
    "lease",
    "data",
  ]) &&
  value.purpose === "booking-payment-journal" &&
  value.version === 2 &&
  value.privacyClass === "sensitive" &&
  value.containsPii === false &&
  isBookingPaymentOwner(value.owner) &&
  isNonNegativeSafeInteger(value.createdAt) &&
  isNonNegativeSafeInteger(value.hardExpiresAt) &&
  value.hardExpiresAt ===
    value.createdAt + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS &&
  isBookingPaymentRuntimeLease(value.lease) &&
  isBookingPaymentJournalData(value.data) &&
  value.data.recoveryExpiresAt >= value.createdAt &&
  value.data.recoveryExpiresAt <= value.hardExpiresAt;

export const parseBookingPaymentJournalEnvelope = (
  raw: string,
): BookingPaymentJournalEnvelope | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isBookingPaymentJournalEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const ALLOWED_TRANSITIONS: Readonly<
  Record<BookingPaymentJournalPhase, readonly BookingPaymentJournalPhase[]>
> = Object.freeze({
  quoted: ["checkout-prepared"],
  "checkout-prepared": ["checkout-submitting"],
  "checkout-submitting": [
    "complimentary-observed",
    "reservation-ready",
    "reservation-status-observed",
  ],
  "complimentary-observed": [],
  "reservation-ready": ["attempt-requesting", "hold-release-requesting"],
  "reservation-status-observed": [],
  "attempt-requesting": ["attempt-ready"],
  "attempt-ready": ["callback-received", "hold-release-requesting"],
  "callback-received": ["confirm-submitting"],
  "confirm-submitting": [],
  "hold-release-requesting": ["hold-released"],
  "hold-released": [],
});

export const isBookingPaymentTerminalPhase = (
  phase: BookingPaymentJournalPhase,
): boolean => TERMINAL_PHASES.has(phase);

export const isAllowedBookingPaymentJournalTransition = (
  previous: BookingPaymentJournalData,
  next: BookingPaymentJournalData,
): boolean => ALLOWED_TRANSITIONS[previous.phase].includes(next.phase);

export const preservesBookingPaymentJournalImmutableGroups = (
  previous: BookingPaymentJournalData,
  next: BookingPaymentJournalData,
): boolean => {
  if (
    previous.flowId !== next.flowId ||
    !exactJsonEqual(previous.serverIntent, next.serverIntent) ||
    !exactJsonEqual(previous.presentationIntent, next.presentationIntent) ||
    !exactJsonEqual(previous.quote, next.quote)
  ) {
    return false;
  }

  const addsAttempt = !("attempt" in previous) && "attempt" in next;
  if (
    addsAttempt &&
    !(previous.phase === "attempt-requesting" && next.phase === "attempt-ready")
  ) {
    return false;
  }

  for (const group of ["checkout", "ready", "attempt", "release"] as const) {
    if (group in previous) {
      const previousGroups = previous as unknown as Record<string, unknown>;
      const nextGroups = next as unknown as Record<string, unknown>;
      if (
        !(group in nextGroups) ||
        !exactJsonEqual(previousGroups[group], nextGroups[group])
      ) {
        return false;
      }
    }
  }
  return true;
};

export const isExactBookingPaymentJournalData = (
  left: BookingPaymentJournalData,
  right: BookingPaymentJournalData,
): boolean => exactJsonEqual(left, right);

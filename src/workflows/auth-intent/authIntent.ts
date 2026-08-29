declare const authIntentAttemptIdBrand: unique symbol;
declare const authIntentLocalDateBrand: unique symbol;

/**
 * Provider-local, monotonically increasing token. The numeric representation is
 * intentionally opaque to consumers.
 */
export type AuthIntentAttemptId = number & {
  readonly [authIntentAttemptIdBrand]: "AuthIntentAttemptId";
};

/** A strict calendar date in YYYY-MM-DD form. */
export type AuthIntentLocalDate = string & {
  readonly [authIntentLocalDateBrand]: "AuthIntentLocalDate";
};

export interface WishlistOpenAuthIntent {
  readonly type: "wishlist.open";
  readonly accommodationId: number;
}

export interface ReservationStartAuthIntent {
  readonly type: "reservation.start";
  readonly accommodationId: number;
  readonly checkIn: AuthIntentLocalDate;
  readonly checkOut: AuthIntentLocalDate;
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
  readonly couponId: number | null;
}

export interface CouponIssueAuthIntent {
  readonly type: "coupon.issue";
  readonly accommodationId: number;
  readonly couponId: number;
}

export type AuthIntent =
  | WishlistOpenAuthIntent
  | ReservationStartAuthIntent
  | CouponIssueAuthIntent;

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number) => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
};

export const isAuthIntentLocalDate = (
  value: unknown,
): value is AuthIntentLocalDate => {
  if (typeof value !== "string") return false;

  const match = localDatePattern.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
};

export const toAuthIntentLocalDate = (value: string): AuthIntentLocalDate => {
  if (!isAuthIntentLocalDate(value)) {
    throw new TypeError("Auth intent date must be a valid YYYY-MM-DD date.");
  }

  return value;
};

const assertPositiveSafeInteger = (value: number, field: string) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive safe integer.`);
  }
};

const assertNonNegativeSafeInteger = (value: number, field: string) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer.`);
  }
};

/**
 * Takes a primitive-only snapshot and intentionally drops all undeclared keys.
 * This prevents a caller's mutable object or accidental extra data from becoming
 * part of the pending workflow state.
 */
export const snapshotAuthIntent = (intent: AuthIntent): AuthIntent => {
  assertPositiveSafeInteger(intent.accommodationId, "accommodationId");

  switch (intent.type) {
    case "wishlist.open":
      return Object.freeze({
        type: intent.type,
        accommodationId: intent.accommodationId,
      });

    case "reservation.start": {
      assertNonNegativeSafeInteger(intent.adultCount, "adultCount");
      assertNonNegativeSafeInteger(intent.childCount, "childCount");
      assertNonNegativeSafeInteger(intent.infantCount, "infantCount");
      assertNonNegativeSafeInteger(intent.petCount, "petCount");
      if (intent.couponId !== null) {
        assertPositiveSafeInteger(intent.couponId, "couponId");
      }

      return Object.freeze({
        type: intent.type,
        accommodationId: intent.accommodationId,
        checkIn: toAuthIntentLocalDate(intent.checkIn),
        checkOut: toAuthIntentLocalDate(intent.checkOut),
        adultCount: intent.adultCount,
        childCount: intent.childCount,
        infantCount: intent.infantCount,
        petCount: intent.petCount,
        couponId: intent.couponId,
      });
    }

    case "coupon.issue":
      assertPositiveSafeInteger(intent.couponId, "couponId");
      return Object.freeze({
        type: intent.type,
        accommodationId: intent.accommodationId,
        couponId: intent.couponId,
      });

    default: {
      const unreachable: never = intent;
      throw new TypeError(`Unsupported auth intent: ${String(unreachable)}`);
    }
  }
};

export const isWishlistOpenAuthIntent = (
  intent: AuthIntent,
): intent is WishlistOpenAuthIntent => intent.type === "wishlist.open";

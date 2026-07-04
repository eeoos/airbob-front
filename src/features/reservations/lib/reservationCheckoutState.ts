export interface ReservationCheckoutState {
  reservationUid: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  checkIn: string;
  checkOut: string;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
  couponName: string | null;
  couponDiscount: number | null;
}

const storageKey = (accommodationId: string) =>
  `airbob:reservation-checkout:${accommodationId}`;

const reservationIndexKey = (reservationUid: string) =>
  `airbob:reservation-checkout-index:${reservationUid}`;

const checkoutStorageKeyPrefixes = [
  "airbob:reservation-checkout:",
  "airbob:reservation-checkout-index:",
];

const isReservationCheckoutStorageKey = (key: string) =>
  checkoutStorageKeyPrefixes.some((prefix) => key.startsWith(prefix));

const safeGetItem = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): boolean => {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemoveItem = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Best-effort cleanup; storage can be unavailable or denied.
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isReservationCheckoutState = (
  value: unknown
): value is ReservationCheckoutState =>
  isRecord(value) &&
  typeof value.reservationUid === "string" &&
  typeof value.orderName === "string" &&
  isFiniteNumber(value.amount) &&
  typeof value.customerEmail === "string" &&
  typeof value.customerName === "string" &&
  typeof value.checkIn === "string" &&
  typeof value.checkOut === "string" &&
  isFiniteNumber(value.adultOccupancy) &&
  isFiniteNumber(value.childOccupancy) &&
  isFiniteNumber(value.infantOccupancy) &&
  isFiniteNumber(value.petOccupancy) &&
  isNullableString(value.couponName) &&
  isNullableNumber(value.couponDiscount);

const parseReservationCheckoutState = (
  raw: string | null
): ReservationCheckoutState | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isReservationCheckoutState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveReservationCheckoutState = (
  accommodationId: string,
  state: ReservationCheckoutState
) => {
  const key = storageKey(accommodationId);
  const indexKey = reservationIndexKey(state.reservationUid);
  const previousState = parseReservationCheckoutState(safeGetItem(key));
  let serializedState: string;

  try {
    serializedState = JSON.stringify(state);
  } catch {
    // Router state remains the primary checkout handoff; storage is only a fallback.
    return;
  }

  if (previousState) {
    safeRemoveItem(reservationIndexKey(previousState.reservationUid));
  }

  const didWritePrimary = safeSetItem(key, serializedState);
  if (!didWritePrimary) {
    if (previousState) {
      safeSetItem(reservationIndexKey(previousState.reservationUid), accommodationId);
    }
    return;
  }

  const didWriteIndex = safeSetItem(indexKey, accommodationId);
  if (!didWriteIndex) {
    safeRemoveItem(key);
    safeRemoveItem(indexKey);
  }
};

export const getReservationCheckoutAccommodationId = (
  reservationUid: string
): string | null => {
  return safeGetItem(reservationIndexKey(reservationUid));
};

export const readReservationCheckoutState = (
  accommodationId: string,
  locationState: unknown
): ReservationCheckoutState | null => {
  if (isReservationCheckoutState(locationState)) {
    return locationState;
  }

  return parseReservationCheckoutState(safeGetItem(storageKey(accommodationId)));
};

export const clearReservationCheckoutState = (accommodationId: string) => {
  const key = storageKey(accommodationId);
  const savedState = parseReservationCheckoutState(safeGetItem(key));

  if (savedState) {
    safeRemoveItem(reservationIndexKey(savedState.reservationUid));
  }

  safeRemoveItem(key);
};

export const clearReservationCheckoutStateByReservationUid = (
  reservationUid: string
) => {
  const accommodationId = getReservationCheckoutAccommodationId(reservationUid);
  if (!accommodationId) return;

  const key = storageKey(accommodationId);
  const savedState = parseReservationCheckoutState(safeGetItem(key));

  safeRemoveItem(reservationIndexKey(reservationUid));

  if (savedState?.reservationUid === reservationUid) {
    safeRemoveItem(key);
  }
};

export const clearAllReservationCheckoutState = () => {
  let keys: string[];

  try {
    keys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index)
    ).filter((key): key is string =>
      key !== null && isReservationCheckoutStorageKey(key)
    );
  } catch {
    return;
  }

  keys.forEach(safeRemoveItem);
};

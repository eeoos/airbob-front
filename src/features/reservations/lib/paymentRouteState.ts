import type { ReservationCheckoutState } from "./reservationCheckoutState";

export type TossSuccessRouteInvalidReason =
  | "MISSING_TOSS_SUCCESS_QUERY"
  | "INVALID_TOSS_SUCCESS_AMOUNT"
  | "MISMATCHED_TOSS_ORDER";

export type TossSuccessRouteState =
  | {
      status: "valid";
      reservationUid: string;
      paymentKey: string;
      orderId: string;
      amount: string;
    }
  | {
      status: "invalid";
      reason: TossSuccessRouteInvalidReason;
    };

export type ReservationPaymentRequestState =
  | {
      status: "valid";
      reservationUid: string;
      orderName: string;
      amount: number;
      customerEmail: string;
      customerName: string;
    }
  | {
      status: "missing";
    };

export const formatCheckoutDateParam = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseCheckoutDateParam = (
  dateString?: string
): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString ?? "");
  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const getReservationPaymentRequestState = (
  checkoutState: ReservationCheckoutState | null
): ReservationPaymentRequestState => {
  if (
    !checkoutState?.reservationUid ||
    !checkoutState.orderName ||
    checkoutState.amount == null ||
    !checkoutState.customerEmail ||
    !checkoutState.customerName
  ) {
    return { status: "missing" };
  }

  return {
    status: "valid",
    reservationUid: checkoutState.reservationUid,
    orderName: checkoutState.orderName,
    amount: checkoutState.amount,
    customerEmail: checkoutState.customerEmail,
    customerName: checkoutState.customerName,
  };
};

const parseIntegerParam = (
  params: URLSearchParams,
  key: string
): number | null => {
  const value = params.get(key);

  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const parseTossSuccessRouteState = (
  reservationUid: string | null | undefined,
  params: URLSearchParams
): TossSuccessRouteState => {
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = params.get("amount");

  if (!reservationUid || !paymentKey || !orderId || !amount) {
    return {
      status: "invalid",
      reason: "MISSING_TOSS_SUCCESS_QUERY",
    };
  }

  if (orderId !== reservationUid) {
    return {
      status: "invalid",
      reason: "MISMATCHED_TOSS_ORDER",
    };
  }

  if (parseIntegerParam(params, "amount") === null) {
    return {
      status: "invalid",
      reason: "INVALID_TOSS_SUCCESS_AMOUNT",
    };
  }

  return {
    status: "valid",
    reservationUid,
    paymentKey,
    orderId,
    amount,
  };
};

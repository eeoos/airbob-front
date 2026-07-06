import { appendDefinedSearchParam } from "../../../routes/routeQuery";

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

export type PaymentFailReason = "confirm-failed" | "invalid-callback";

export type PaymentFailRouteQuery = {
  reason?: PaymentFailReason;
};

export const parsePaymentFailReason = (
  reason: string | null,
): PaymentFailReason | undefined => {
  if (reason === "confirm-failed" || reason === "invalid-callback") {
    return reason;
  }

  return undefined;
};

export const buildPaymentFailRouteSearchParams = (
  query?: PaymentFailRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "reason", query?.reason);

  return params;
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

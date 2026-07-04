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

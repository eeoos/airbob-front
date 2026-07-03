export type PaymentRouteInvalidReason =
  | "MISSING_PAYMENT_QUERY"
  | "INVALID_PAYMENT_AMOUNT";

export type TossSuccessRouteInvalidReason =
  | "MISSING_TOSS_SUCCESS_QUERY"
  | "INVALID_TOSS_SUCCESS_AMOUNT"
  | "MISMATCHED_TOSS_ORDER";

export type PaymentRouteState =
  | {
      status: "valid";
      reservationUid: string;
      orderName: string;
      amount: number;
      customerEmail: string;
      customerName: string;
      checkIn: Date | null;
      checkOut: Date | null;
      adultOccupancy: number;
      childOccupancy: number;
      infantOccupancy: number;
      petOccupancy: number;
      couponName: string | null;
      couponDiscount: number | null;
    }
  | {
      status: "invalid";
      reason: PaymentRouteInvalidReason;
    };

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

const parseOccupancyParam = (
  params: URLSearchParams,
  key: string,
  fallback: number
): number => {
  const parsed = parseIntegerParam(params, key);
  return parsed ?? fallback;
};

const parseDateParam = (params: URLSearchParams, key: string): Date | null => {
  const value = params.get(key);
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parsePaymentRouteState = (
  params: URLSearchParams
): PaymentRouteState => {
  const reservationUid = params.get("reservationUid");
  const orderName = params.get("orderName");
  const amountParam = params.get("amount");
  const customerEmail = params.get("customerEmail");
  const customerName = params.get("customerName");

  if (!reservationUid || !orderName || !amountParam || !customerEmail || !customerName) {
    return {
      status: "invalid",
      reason: "MISSING_PAYMENT_QUERY",
    };
  }

  const amount = parseIntegerParam(params, "amount");
  if (amount === null) {
    return {
      status: "invalid",
      reason: "INVALID_PAYMENT_AMOUNT",
    };
  }

  return {
    status: "valid",
    reservationUid,
    orderName,
    amount,
    customerEmail,
    customerName,
    checkIn: parseDateParam(params, "checkIn"),
    checkOut: parseDateParam(params, "checkOut"),
    adultOccupancy: parseOccupancyParam(params, "adultOccupancy", 1),
    childOccupancy: parseOccupancyParam(params, "childOccupancy", 0),
    infantOccupancy: parseOccupancyParam(params, "infantOccupancy", 0),
    petOccupancy: parseOccupancyParam(params, "petOccupancy", 0),
    couponName: params.get("couponName"),
    couponDiscount: parseIntegerParam(params, "couponDiscount"),
  };
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

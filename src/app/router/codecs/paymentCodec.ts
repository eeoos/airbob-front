import {
  appendDefinedSearchParam,
  type SearchParamsInput,
  toSearchParams,
} from "./queryCodecUtils";

export type PaymentFailReason = "confirm-failed" | "invalid-callback";

export interface PaymentSuccessRouteQuery {
  paymentKey: string | number;
  orderId: string | number;
  amount: string | number;
}

export type PaymentFailRouteQuery =
  | {
      reason?: undefined;
      paymentKey?: never;
      orderId?: never;
      amount?: never;
    }
  | {
      reason: "invalid-callback";
      paymentKey?: never;
      orderId?: never;
      amount?: never;
    }
  | ({ reason: "confirm-failed" } & Partial<PaymentSuccessRouteQuery>);

export interface PaymentRouteQueryState {
  reason?: PaymentFailReason;
  paymentKey?: string;
  orderId?: string;
  amount?: string;
}

export type PaymentSuccessRouteInvalidReason =
  | "MISSING_TOSS_SUCCESS_QUERY"
  | "INVALID_TOSS_SUCCESS_AMOUNT"
  | "MISMATCHED_TOSS_ORDER";

export type PaymentSuccessRouteState =
  | {
      status: "valid";
      reservationUid: string;
      paymentKey: string;
      orderId: string;
      amount: string;
    }
  | {
      status: "invalid";
      reason: PaymentSuccessRouteInvalidReason;
    };

export const parsePaymentFailReason = (
  value: string | null,
): PaymentFailReason | undefined =>
  value === "confirm-failed" || value === "invalid-callback"
    ? value
    : undefined;

const parseSafeIntegerString = (value: string | null): string | undefined => {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? value : undefined;
};

export const parsePaymentRouteQuery = (
  input: SearchParamsInput,
): PaymentRouteQueryState => {
  const params = toSearchParams(input);
  const reason = parsePaymentFailReason(params.get("reason"));
  const paymentKey = params.get("paymentKey") || undefined;
  const orderId = params.get("orderId") || undefined;
  const amount = parseSafeIntegerString(params.get("amount"));

  return {
    ...(reason ? { reason } : {}),
    ...(paymentKey ? { paymentKey } : {}),
    ...(orderId ? { orderId } : {}),
    ...(amount ? { amount } : {}),
  };
};

export const parsePaymentSuccessRouteState = (
  reservationUid: string | null | undefined,
  input: SearchParamsInput,
): PaymentSuccessRouteState => {
  const params = toSearchParams(input);
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = params.get("amount");

  if (!reservationUid || !paymentKey || !orderId || !amount) {
    return { status: "invalid", reason: "MISSING_TOSS_SUCCESS_QUERY" };
  }

  if (orderId !== reservationUid) {
    return { status: "invalid", reason: "MISMATCHED_TOSS_ORDER" };
  }

  if (parseSafeIntegerString(amount) === undefined) {
    return { status: "invalid", reason: "INVALID_TOSS_SUCCESS_AMOUNT" };
  }

  return {
    status: "valid",
    reservationUid,
    paymentKey,
    orderId,
    amount,
  };
};

export const serializePaymentSuccessRouteQuery = (
  query?: PaymentSuccessRouteQuery,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "paymentKey", query?.paymentKey);
  appendDefinedSearchParam(params, "orderId", query?.orderId);
  appendDefinedSearchParam(params, "amount", query?.amount);

  return params;
};

export const serializePaymentFailRouteQuery = (
  query?: PaymentFailRouteQuery,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "reason", query?.reason);
  appendDefinedSearchParam(params, "paymentKey", query?.paymentKey);
  appendDefinedSearchParam(params, "orderId", query?.orderId);
  appendDefinedSearchParam(params, "amount", query?.amount);

  return params;
};

export const serializePaymentRouteQueryState = (
  state: PaymentRouteQueryState,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "reason", state.reason);
  appendDefinedSearchParam(params, "paymentKey", state.paymentKey);
  appendDefinedSearchParam(params, "orderId", state.orderId);
  appendDefinedSearchParam(params, "amount", state.amount);

  return params;
};

const canonicalizePaymentRoute = (input: SearchParamsInput): string =>
  serializePaymentRouteQueryState(parsePaymentRouteQuery(input)).toString();

export const paymentCodec = {
  parse: parsePaymentRouteQuery,
  serialize: serializePaymentRouteQueryState,
  canonicalize: canonicalizePaymentRoute,
  parseFailReason: parsePaymentFailReason,
  parseSuccess: parsePaymentSuccessRouteState,
  serializeSuccess: serializePaymentSuccessRouteQuery,
  serializeFail: serializePaymentFailRouteQuery,
} as const;

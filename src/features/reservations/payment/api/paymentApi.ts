import {
  requestApiData,
  requestApiDataNullable,
  type ApiDataRequest,
} from "../../../../platform/http/request";
import type { PaymentApiPort } from "../ports/paymentApiPort";
import type { PaymentRecordWire } from "./contracts";
import { toPaymentConfirmationWireRequest, toPaymentRecord } from "./mappers";

export type PaymentApiTransport = <T>(
  request: ApiDataRequest,
) => Promise<NonNullable<T>>;

export type NullablePaymentApiTransport = <T = null>(
  request: ApiDataRequest,
) => Promise<T | null>;

export const createPaymentApi = (
  request: PaymentApiTransport,
  requestNullable: NullablePaymentApiTransport,
): PaymentApiPort => ({
  async confirm(input, options) {
    await requestNullable({
      method: "POST",
      path: "/payments/confirm",
      body: toPaymentConfirmationWireRequest(input),
      signal: options?.signal,
    });
  },

  async getByPaymentKey(paymentKey, options) {
    const wire = await request<PaymentRecordWire>({
      method: "GET",
      path: `/payments/${paymentKey}`,
      signal: options?.signal,
    });

    return toPaymentRecord(wire);
  },

  async getByOrderId(orderId, options) {
    const wire = await request<PaymentRecordWire>({
      method: "GET",
      path: `/payments/orders/${orderId}`,
      signal: options?.signal,
    });

    return toPaymentRecord(wire);
  },
});

export const paymentApi = createPaymentApi(
  requestApiData,
  requestApiDataNullable,
);

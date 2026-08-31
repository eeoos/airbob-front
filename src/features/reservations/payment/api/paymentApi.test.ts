import type { ApiDataRequest } from "../../../../platform/http/request";
import type { PaymentRecordWire } from "./contracts";
import {
  createPaymentApi,
  type NullablePaymentApiTransport,
  type PaymentApiTransport,
} from "./paymentApi";

const paymentWire: PaymentRecordWire = {
  order_id: "reservation-123",
  payment_key: "payment/key 1",
  total_amount: 120000,
  status: "DONE",
};

const createTransports = () => {
  const request = vi.fn();
  const requestNullable = vi.fn();

  return {
    request,
    requestNullable,
    transport: request as PaymentApiTransport,
    nullableTransport: requestNullable as NullablePaymentApiTransport,
  };
};

describe("payment API adapter", () => {
  it("preserves the confirm method, path, snake_case body, signal, and nullable response", async () => {
    const { nullableTransport, requestNullable, transport } =
      createTransports();
    const api = createPaymentApi(transport, nullableTransport);
    const signal = new AbortController().signal;
    requestNullable.mockResolvedValue(null);

    await expect(
      api.confirm(
        {
          paymentKey: "payment-key-1",
          orderId: "reservation-123",
          amount: 120000,
        },
        { signal },
      ),
    ).resolves.toBeUndefined();

    expect(requestNullable).toHaveBeenCalledWith({
      method: "POST",
      path: "/payments/confirm",
      body: {
        payment_key: "payment-key-1",
        order_id: "reservation-123",
        amount: 120000,
      },
      signal,
    });
  });

  it("preserves direct payment-key interpolation and maps the wire response", async () => {
    const { nullableTransport, request, transport } = createTransports();
    const api = createPaymentApi(transport, nullableTransport);
    const signal = new AbortController().signal;
    request.mockResolvedValue(paymentWire);

    await expect(
      api.getByPaymentKey("payment/key 1", { signal }),
    ).resolves.toEqual({
      orderId: "reservation-123",
      paymentKey: "payment/key 1",
      totalAmount: 120000,
      status: "DONE",
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/payments/payment/key 1",
      signal,
    });
  });

  it("uses the order lookup path and normalizes an omitted payment key to null", async () => {
    const { nullableTransport, request, transport } = createTransports();
    const api = createPaymentApi(transport, nullableTransport);
    const signal = new AbortController().signal;
    request.mockResolvedValue({
      ...paymentWire,
      payment_key: undefined,
      status: "READY",
    });

    await expect(
      api.getByOrderId("reservation-123", { signal }),
    ).resolves.toEqual({
      orderId: "reservation-123",
      paymentKey: null,
      totalAmount: 120000,
      status: "READY",
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/payments/orders/reservation-123",
      signal,
    });
  });

  it("omits the signal only when the caller does not provide one", async () => {
    const { nullableTransport, request, transport } = createTransports();
    const api = createPaymentApi(transport, nullableTransport);
    request.mockResolvedValue(paymentWire);

    await expect(api.getByOrderId("reservation-123")).resolves.toEqual({
      orderId: "reservation-123",
      paymentKey: "payment/key 1",
      totalAmount: 120000,
      status: "DONE",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining<ApiDataRequest>({
        method: "GET",
        path: "/payments/orders/reservation-123",
        signal: undefined,
      }),
    );
  });
});

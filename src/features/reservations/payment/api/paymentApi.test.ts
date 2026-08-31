import {
  requestApiData,
  requestApiDataNullable,
  type ApiDataRequest,
} from "../../../../platform/http/request";
import type { PaymentRecordWire } from "./contracts";
import { paymentApi } from "./paymentApi";

vi.mock("../../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
  requestApiDataNullable: vi.fn(),
}));

const paymentWire: PaymentRecordWire = {
  order_id: "reservation-123",
  payment_key: "payment/key 1",
  total_amount: 120000,
  status: "DONE",
};

const mockRequestApiData = vi.mocked(requestApiData);
const mockRequestApiDataNullable = vi.mocked(requestApiDataNullable);

describe("payment API adapter", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
    mockRequestApiDataNullable.mockReset();
  });

  it("preserves the confirm method, path, snake_case body, signal, and nullable response", async () => {
    const signal = new AbortController().signal;
    mockRequestApiDataNullable.mockResolvedValue(null);

    await expect(
      paymentApi.confirm(
        {
          paymentKey: "payment-key-1",
          orderId: "reservation-123",
          amount: 120000,
        },
        { signal },
      ),
    ).resolves.toBeUndefined();

    expect(mockRequestApiDataNullable).toHaveBeenCalledWith({
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
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue(paymentWire);

    await expect(
      paymentApi.getByPaymentKey("payment/key 1", { signal }),
    ).resolves.toEqual({
      orderId: "reservation-123",
      paymentKey: "payment/key 1",
      totalAmount: 120000,
      status: "DONE",
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/payments/payment/key 1",
      signal,
    });
  });

  it("uses the order lookup path and normalizes an omitted payment key to null", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue({
      ...paymentWire,
      payment_key: undefined,
      status: "READY",
    });

    await expect(
      paymentApi.getByOrderId("reservation-123", { signal }),
    ).resolves.toEqual({
      orderId: "reservation-123",
      paymentKey: null,
      totalAmount: 120000,
      status: "READY",
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/payments/orders/reservation-123",
      signal,
    });
  });

  it("passes an absent signal through the platform request contract", async () => {
    mockRequestApiData.mockResolvedValue(paymentWire);

    await expect(paymentApi.getByOrderId("reservation-123")).resolves.toEqual({
      orderId: "reservation-123",
      paymentKey: "payment/key 1",
      totalAmount: 120000,
      status: "DONE",
    });

    const requestArgument = mockRequestApiData.mock.calls[0]?.[0];

    expect(requestArgument).toEqual({
      method: "GET",
      path: "/payments/orders/reservation-123",
      signal: undefined,
    } satisfies ApiDataRequest);
  });
});

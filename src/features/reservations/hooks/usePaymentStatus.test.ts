import { act, renderHook } from "@testing-library/react";
import { paymentApi } from "../../../api";
import { PaymentStatus } from "../../../types/enums";
import { usePaymentStatus } from "./usePaymentStatus";

jest.mock("../../../api", () => ({
  paymentApi: {
    getByPaymentKey: jest.fn(),
  },
}));

const request = {
  amount: 120000,
  orderId: "reservation-123",
  paymentKey: "payment-key-1",
};

describe("usePaymentStatus", () => {
  beforeEach(() => {
    jest.mocked(paymentApi.getByPaymentKey).mockReset();
  });

  it("normalizes a matching completed payment", async () => {
    jest.mocked(paymentApi.getByPaymentKey).mockResolvedValue({
      order_id: request.orderId,
      total_amount: request.amount,
      payment_key: request.paymentKey,
      status: PaymentStatus.DONE,
    } as never);

    const { result } = renderHook(() => usePaymentStatus());
    let status: string | undefined;

    await act(async () => {
      status = await result.current.checkPaymentStatus(request);
    });

    expect(status).toBe("done");
    expect(paymentApi.getByPaymentKey).toHaveBeenCalledWith(request.paymentKey);
  });

  it("keeps a matching non-completed payment pending", async () => {
    jest.mocked(paymentApi.getByPaymentKey).mockResolvedValue({
      order_id: request.orderId,
      total_amount: request.amount,
      payment_key: request.paymentKey,
      status: PaymentStatus.IN_PROGRESS,
    } as never);

    const { result } = renderHook(() => usePaymentStatus());
    let status: string | undefined;

    await act(async () => {
      status = await result.current.checkPaymentStatus(request);
    });

    expect(status).toBe("pending");
  });

  it.each([
    "mismatched order",
    "mismatched amount",
    "mismatched payment key",
    "lookup failure",
  ])("normalizes %s as an error", async (failure) => {
    if (failure === "lookup failure") {
      jest
        .mocked(paymentApi.getByPaymentKey)
        .mockRejectedValue(new Error("lookup failed"));
    } else {
      jest.mocked(paymentApi.getByPaymentKey).mockResolvedValue({
        order_id:
          failure === "mismatched order" ? "another-order" : request.orderId,
        total_amount:
          failure === "mismatched amount" ? 1 : request.amount,
        payment_key:
          failure === "mismatched payment key"
            ? "another-payment"
            : request.paymentKey,
        status: PaymentStatus.DONE,
      } as never);
    }

    const { result } = renderHook(() => usePaymentStatus());
    let status: string | undefined;

    await act(async () => {
      status = await result.current.checkPaymentStatus(request);
    });

    expect(status).toBe("error");
  });
});

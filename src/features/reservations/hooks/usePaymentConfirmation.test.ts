import { act, renderHook, waitFor } from "@testing-library/react";
import { paymentApi } from "../../../api";
import { resetPaymentConfirmationAttemptRegistryForTests } from "../lib/paymentConfirmationAttemptRegistry";
import { usePaymentConfirmation } from "./usePaymentConfirmation";

jest.mock("../../../api", () => ({
  paymentApi: {
    confirm: jest.fn(),
  },
}));

describe("usePaymentConfirmation", () => {
  beforeEach(() => {
    jest.mocked(paymentApi.confirm).mockReset();
    resetPaymentConfirmationAttemptRegistryForTests();
    sessionStorage.clear();
  });

  it("confirms payment when all payment query values are present", async () => {
    jest.mocked(paymentApi.confirm).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePaymentConfirmation({
        amount: "120000",
        orderId: "order-1",
        paymentKey: "payment-key-1",
      })
    );

    expect(result.current.isProcessing).toBe(true);

    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    expect(paymentApi.confirm).toHaveBeenCalledWith({
      payment_key: "payment-key-1",
      order_id: "order-1",
      amount: 120000,
    });
    expect(result.current.result).toEqual({
      status: "confirmed",
      error: null,
    });
  });

  it("skips confirmation when any payment query value is missing", async () => {
    const { result } = renderHook(() =>
      usePaymentConfirmation({
        amount: null,
        orderId: "order-1",
        paymentKey: "payment-key-1",
      })
    );

    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    expect(paymentApi.confirm).not.toHaveBeenCalled();
    expect(result.current.result).toEqual({
      status: "skipped",
      error: null,
    });
  });

  it("returns an invalid result without confirming malformed amount values", async () => {
    const { result } = renderHook(() =>
      usePaymentConfirmation({
        amount: "120000x",
        orderId: "order-1",
        paymentKey: "payment-key-1",
      })
    );

    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    expect(paymentApi.confirm).not.toHaveBeenCalled();
    expect(result.current.result).toEqual({
      status: "invalid",
      error: null,
    });
  });

  it("returns a retryable failed result when confirmation fails", async () => {
    const error = new Error("confirm failed");
    jest.mocked(paymentApi.confirm).mockRejectedValue(error);

    const { result } = renderHook(() =>
      usePaymentConfirmation({
        amount: "120000",
        orderId: "order-1",
        paymentKey: "payment-key-1",
      })
    );

    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    expect(result.current.result).toEqual({
      status: "failed",
      retryable: true,
      error,
    });
  });

  it("shares duplicate in-flight confirmation attempts for the same payment values", async () => {
    let resolveConfirm: () => void = () => undefined;
    jest.mocked(paymentApi.confirm).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );
    const paymentValues = {
      amount: "120000",
      orderId: "order-1",
      paymentKey: "payment-key-1",
    };

    const first = renderHook(() => usePaymentConfirmation(paymentValues));
    const duplicate = renderHook(() => usePaymentConfirmation(paymentValues));

    expect(paymentApi.confirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveConfirm();
    });

    await waitFor(() => {
      expect(first.result.current.result).toEqual({
        status: "confirmed",
        error: null,
      });
      expect(duplicate.result.current.result).toEqual({
        status: "confirmed",
        error: null,
      });
    });
  });
});

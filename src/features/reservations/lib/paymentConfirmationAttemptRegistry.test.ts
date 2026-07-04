import {
  getPaymentConfirmationAttemptKey,
  resetPaymentConfirmationAttemptRegistryForTests,
  runPaymentConfirmationAttempt,
} from "./paymentConfirmationAttemptRegistry";

describe("payment confirmation attempt registry", () => {
  const attemptKey = getPaymentConfirmationAttemptKey({
    amount: 120000,
    orderId: "order-1",
    paymentKey: "payment-key-1",
  });

  beforeEach(() => {
    resetPaymentConfirmationAttemptRegistryForTests();
    sessionStorage.clear();
  });

  it("marks successful confirmations and skips later same-session attempts", async () => {
    const confirm = jest.fn().mockResolvedValue(undefined);

    await expect(
      runPaymentConfirmationAttempt(attemptKey, confirm)
    ).resolves.toBe("confirmed");
    await expect(
      runPaymentConfirmationAttempt(attemptKey, confirm)
    ).resolves.toBe("already-confirmed");

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("dedupes duplicate in-flight attempts for the same payment values", async () => {
    let resolveConfirm: () => void = () => undefined;
    const confirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );

    const firstAttempt = runPaymentConfirmationAttempt(attemptKey, confirm);
    const duplicateAttempt = runPaymentConfirmationAttempt(attemptKey, confirm);

    expect(confirm).toHaveBeenCalledTimes(1);

    resolveConfirm();

    await expect(Promise.all([firstAttempt, duplicateAttempt])).resolves.toEqual([
      "confirmed",
      "already-confirmed",
    ]);
  });

  it("allows retry after a rejected confirmation attempt", async () => {
    const confirmError = new Error("confirm failed");
    const failedConfirm = jest.fn().mockRejectedValue(confirmError);
    const retryConfirm = jest.fn().mockResolvedValue(undefined);

    await expect(
      runPaymentConfirmationAttempt(attemptKey, failedConfirm)
    ).rejects.toThrow(confirmError);
    await expect(
      runPaymentConfirmationAttempt(attemptKey, retryConfirm)
    ).resolves.toBe("confirmed");

    expect(failedConfirm).toHaveBeenCalledTimes(1);
    expect(retryConfirm).toHaveBeenCalledTimes(1);
  });
});

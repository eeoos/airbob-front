import {
  clearPaymentConfirmationAttemptRegistry,
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

  it("does not restore a confirmation marker when an old generation succeeds after cleanup", async () => {
    let resolveConfirm: () => void = () => undefined;
    const confirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const attempt = runPaymentConfirmationAttempt(attemptKey, confirm);

    clearPaymentConfirmationAttemptRegistry();
    resolveConfirm();

    await expect(attempt).resolves.toBe("confirmed");
    expect(
      Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.key(index),
      ).filter((key) => key?.startsWith("airbob:payment-confirmed:")),
    ).toEqual([]);
  });

  it("keeps a newer same-key attempt registered when an old generation finishes", async () => {
    let resolveOldConfirm: () => void = () => undefined;
    let resolveNewConfirm: () => void = () => undefined;
    const oldConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOldConfirm = resolve;
        }),
    );
    const newConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveNewConfirm = resolve;
        }),
    );
    const unexpectedThirdConfirm = jest.fn().mockResolvedValue(undefined);

    const oldAttempt = runPaymentConfirmationAttempt(attemptKey, oldConfirm);
    clearPaymentConfirmationAttemptRegistry();
    const newAttempt = runPaymentConfirmationAttempt(attemptKey, newConfirm);

    resolveOldConfirm();
    await expect(oldAttempt).resolves.toBe("confirmed");

    const duplicateNewAttempt = runPaymentConfirmationAttempt(
      attemptKey,
      unexpectedThirdConfirm,
    );
    expect(unexpectedThirdConfirm).not.toHaveBeenCalled();

    resolveNewConfirm();
    await expect(
      Promise.all([newAttempt, duplicateNewAttempt]),
    ).resolves.toEqual(["confirmed", "already-confirmed"]);
    expect(newConfirm).toHaveBeenCalledTimes(1);
  });

  it("clears payment markers idempotently without removing unrelated session data", async () => {
    await runPaymentConfirmationAttempt(
      attemptKey,
      jest.fn().mockResolvedValue(undefined),
    );
    sessionStorage.setItem("airbob:unrelated", "keep");

    clearPaymentConfirmationAttemptRegistry();
    clearPaymentConfirmationAttemptRegistry();

    expect(sessionStorage.getItem("airbob:unrelated")).toBe("keep");
    expect(
      Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.key(index),
      ).filter((key) => key?.startsWith("airbob:payment-confirmed:")),
    ).toEqual([]);
  });
});

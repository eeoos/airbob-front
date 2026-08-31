import { onAuthError, triggerAuthError } from "./authEvents";

describe("authEvents", () => {
  it("delivers consecutive events without a time-based suppression window", () => {
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);

    triggerAuthError();
    triggerAuthError();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].sequence).toBeGreaterThan(
      listener.mock.calls[0][0].sequence,
    );
    unsubscribe();
  });

  it("isolates listener failures and supports idempotent unsubscription", () => {
    const throwingListener = jest.fn(() => {
      throw new Error("listener failed");
    });
    const survivingListener = jest.fn();
    const unsubscribeThrowing = onAuthError(throwingListener);
    const unsubscribeSurviving = onAuthError(survivingListener);

    expect(triggerAuthError).not.toThrow();
    expect(survivingListener).toHaveBeenCalledTimes(1);

    unsubscribeThrowing();
    unsubscribeThrowing();
    unsubscribeSurviving();
    triggerAuthError();

    expect(survivingListener).toHaveBeenCalledTimes(1);
  });
});

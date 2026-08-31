import { onAuthError, triggerAuthError } from "./authEvents";

describe("authEvents", () => {
  it("delivers consecutive events without a time-based suppression window", () => {
    const listener = vi.fn();
    const unsubscribe = onAuthError(listener);

    triggerAuthError();
    triggerAuthError();

    expect(listener).toHaveBeenCalledTimes(2);
    const firstEvent = listener.mock.calls.at(0)?.at(0);
    const secondEvent = listener.mock.calls.at(1)?.at(0);
    if (!firstEvent || !secondEvent) {
      throw new Error("Expected two authentication error events");
    }
    expect(secondEvent.sequence).toBeGreaterThan(firstEvent.sequence);
    unsubscribe();
  });

  it("isolates listener failures and supports idempotent unsubscription", () => {
    const throwingListener = vi.fn(() => {
      throw new Error("listener failed");
    });
    const survivingListener = vi.fn();
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

import {
  getPaymentConfirmationAttemptKey,
  runPaymentConfirmationAttempt,
} from "../lib/paymentConfirmationAttemptRegistry";
import { clearReservationSessionState } from "./sessionCleanup";

describe("clearReservationSessionState", () => {
  beforeEach(() => {
    clearReservationSessionState();
    sessionStorage.clear();
  });

  it("idempotently clears checkout and payment state while preserving unrelated data", async () => {
    const attemptKey = getPaymentConfirmationAttemptKey({
      amount: 120000,
      orderId: "order-session-cleanup",
      paymentKey: "payment-session-cleanup",
    });
    await runPaymentConfirmationAttempt(
      attemptKey,
      jest.fn().mockResolvedValue(undefined),
    );
    sessionStorage.setItem("airbob:reservation-checkout:7", "checkout");
    sessionStorage.setItem(
      "airbob:reservation-checkout-index:reservation-7",
      "7",
    );
    sessionStorage.setItem("airbob:unrelated", "keep");
    sessionStorage.setItem("third-party", "keep");

    clearReservationSessionState();
    clearReservationSessionState();

    expect(sessionStorage.getItem("airbob:reservation-checkout:7")).toBeNull();
    expect(
      sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-7",
      ),
    ).toBeNull();
    expect(
      Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.key(index),
      ).filter((key) => key?.startsWith("airbob:payment-confirmed:")),
    ).toEqual([]);
    expect(sessionStorage.getItem("airbob:unrelated")).toBe("keep");
    expect(sessionStorage.getItem("third-party")).toBe("keep");
  });
});

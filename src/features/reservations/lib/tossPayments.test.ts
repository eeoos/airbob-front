import {
  ensureTossPaymentsScript,
  getTossClientKey,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "./tossPayments";

describe("tossPayments adapter", () => {
  const originalClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;

  afterEach(() => {
    process.env.REACT_APP_TOSS_CLIENT_KEY = originalClientKey;
    delete window.TossPayments;
    document
      .querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
      .forEach((script) => script.remove());
  });

  it("inserts the Toss SDK script only once", () => {
    ensureTossPaymentsScript();
    ensureTossPaymentsScript();

    expect(
      document.querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
    ).toHaveLength(1);
  });

  it("shares SDK loading work and resolves after the script loads", async () => {
    const firstLoad = ensureTossPaymentsScript();
    const secondLoad = ensureTossPaymentsScript();
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.tosspayments.com/v1"]',
    );

    expect(secondLoad).toBe(firstLoad);
    expect(script).not.toBeNull();

    window.TossPayments = jest.fn();
    script?.dispatchEvent(new Event("load"));

    await expect(firstLoad).resolves.toBeUndefined();
  });

  it("removes failed SDK scripts so a later load can retry", async () => {
    const failedLoad = ensureTossPaymentsScript();
    const failedScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.tosspayments.com/v1"]',
    );

    failedScript?.dispatchEvent(new Event("error"));

    await expect(failedLoad).rejects.toThrow(
      "결제 시스템을 불러올 수 없습니다.",
    );
    expect(
      document.querySelector('script[src="https://js.tosspayments.com/v1"]'),
    ).toBeNull();

    ensureTossPaymentsScript().catch(() => undefined);

    expect(
      document.querySelectorAll('script[src="https://js.tosspayments.com/v1"]'),
    ).toHaveLength(1);
  });

  it("replaces a stale pre-existing SDK script when no loader is active", () => {
    const staleScript = document.createElement("script");
    staleScript.src = "https://js.tosspayments.com/v1";
    staleScript.async = true;
    document.body.appendChild(staleScript);

    ensureTossPaymentsScript().catch(() => undefined);

    const currentScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.tosspayments.com/v1"]',
    );

    expect(currentScript).not.toBe(staleScript);
    expect(staleScript.isConnected).toBe(false);
    expect(currentScript?.isConnected).toBe(true);
  });

  it("removes stale duplicates before reusing an active SDK loader", () => {
    const activeLoad = ensureTossPaymentsScript();
    const activeScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.tosspayments.com/v1"]',
    );
    const staleScript = document.createElement("script");
    staleScript.src = "https://js.tosspayments.com/v1";
    staleScript.async = true;
    document.body.prepend(staleScript);

    const duplicateLoad = ensureTossPaymentsScript();

    expect(duplicateLoad).toBe(activeLoad);
    expect(staleScript.isConnected).toBe(false);
    expect(activeScript?.isConnected).toBe(true);
    expect(
      document.querySelectorAll('script[src="https://js.tosspayments.com/v1"]'),
    ).toHaveLength(1);
  });

  it("returns the configured client key", () => {
    process.env.REACT_APP_TOSS_CLIENT_KEY = "test_ck_123";

    expect(getTossClientKey()).toBe("test_ck_123");
  });

  it("throws a user-facing setup error when the client key is missing", () => {
    delete process.env.REACT_APP_TOSS_CLIENT_KEY;

    expect(() => getTossClientKey()).toThrow("결제 설정이 올바르지 않습니다.");
  });

  it("recognizes user-cancel and Toss sandbox selection failures as silent resets", () => {
    expect(
      shouldSilentlyResetPayment({
        code: "USER_CANCEL",
        message: "사용자가 결제를 취소했습니다.",
      })
    ).toBe(true);
    expect(
      shouldSilentlyResetPayment({
        code: "BAD_REQUEST",
        message: "계약 후 테스트 가능합니다.",
      })
    ).toBe(true);
  });

  it("normalizes Toss auth failures", () => {
    expect(toReservationPaymentError(new Error("Unauthorized"))).toEqual(
      new Error(
        "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
          "클라이언트 키가 올바른지 확인해주세요. " +
          "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다."
      )
    );
  });
});

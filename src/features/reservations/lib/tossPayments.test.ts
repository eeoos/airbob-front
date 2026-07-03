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

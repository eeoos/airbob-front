import { getPublicRuntimeConfig } from "../../../platform/config/publicRuntimeConfig";
import { IntegrationError } from "../../../platform/integrations/errors";
import {
  createTossPaymentsV1Client,
  TOSS_PAYMENTS_READINESS_TIMEOUT_MS,
} from "../../../platform/integrations/tossPaymentsV1";
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  getTossPaymentsClient,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "./tossPayments";

jest.mock("../../../platform/config/publicRuntimeConfig", () => ({
  getPublicRuntimeConfig: jest.fn(),
}));

const runtimeConfig = (tossClientKey: string | null) => ({
  mode: "test" as const,
  apiBaseUrl: "/api/v1",
  googleMapsBrowserKey: null,
  tossClientKey,
  cloudFrontHost: "assets.example.cloudfront.net",
});

const tossScripts = () =>
  Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[src="https://js.tosspayments.com/v1"]',
    ),
  );

const installTossRuntime = () => {
  window.TossPayments = jest.fn(() => ({
    widgets: jest.fn(),
    requestPayment: jest.fn(),
  })) as any;
};

describe("tossPayments v1 compatibility adapter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(getPublicRuntimeConfig).mockReturnValue(runtimeConfig("test_ck_123"));
    delete window.TossPayments;
    tossScripts().forEach((script) => script.remove());
  });

  afterEach(() => {
    tossScripts().forEach((script) => script.dispatchEvent(new Event("error")));
    tossScripts().forEach((script) => script.remove());
    delete window.TossPayments;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("uses one marked exact-HTTPS script and shares pending work", async () => {
    const firstLoad = ensureTossPaymentsScript();
    const secondLoad = ensureTossPaymentsScript();
    const script = tossScripts()[0];

    expect(secondLoad).toBe(firstLoad);
    expect(tossScripts()).toHaveLength(1);
    expect(script.dataset.airbobIntegration).toBe("toss-payments-v1");

    installTossRuntime();
    script.dispatchEvent(new Event("load"));
    await expect(firstLoad).resolves.toBeUndefined();
  });

  it("resolves without a script when the validated global already exists", async () => {
    installTossRuntime();

    await expect(ensureTossPaymentsScript()).resolves.toBeUndefined();
    expect(tossScripts()).toHaveLength(0);
  });

  it("removes a failed SDK script so a later load can retry", async () => {
    const failedLoad = ensureTossPaymentsScript();
    const failedScript = tossScripts()[0];

    failedScript.dispatchEvent(new Event("error"));

    await expect(failedLoad).rejects.toEqual(
      expect.objectContaining({
        code: "INTEGRATION_LOAD_FAILED",
        message: "결제 시스템을 불러올 수 없습니다.",
      }),
    );
    expect(failedScript.isConnected).toBe(false);

    const retry = ensureTossPaymentsScript();
    const retryScript = tossScripts()[0];
    expect(retryScript).not.toBe(failedScript);

    installTossRuntime();
    retryScript.dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });

  it("rejects a load event whose runtime is not callable", async () => {
    const loading = ensureTossPaymentsScript();
    tossScripts()[0].dispatchEvent(new Event("load"));

    await expect(loading).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RUNTIME",
    });
    expect(tossScripts()).toHaveLength(0);
  });

  it("times out with a typed safe error and can retry", async () => {
    const loading = ensureTossPaymentsScript();

    jest.advanceTimersByTime(TOSS_PAYMENTS_READINESS_TIMEOUT_MS);

    await expect(loading).rejects.toBeInstanceOf(IntegrationError);
    await expect(loading).rejects.toMatchObject({
      code: "INTEGRATION_TIMEOUT",
      integration: "toss-payments-v1",
    });
    expect(tossScripts()).toHaveLength(0);
  });

  it("replaces a stale pre-existing exact script", async () => {
    const staleScript = document.createElement("script");
    staleScript.src = "https://js.tosspayments.com/v1";
    document.body.appendChild(staleScript);

    const loading = ensureTossPaymentsScript();
    const currentScript = tossScripts()[0];

    expect(currentScript).not.toBe(staleScript);
    expect(staleScript.isConnected).toBe(false);
    expect(currentScript.isConnected).toBe(true);

    installTossRuntime();
    currentScript.dispatchEvent(new Event("load"));
    await loading;
  });

  it("removes stale duplicates before reusing an active loader", async () => {
    const activeLoad = ensureTossPaymentsScript();
    const activeScript = tossScripts()[0];
    const staleScript = document.createElement("script");
    staleScript.src = "https://js.tosspayments.com/v1";
    document.body.prepend(staleScript);

    const duplicateLoad = ensureTossPaymentsScript();

    expect(duplicateLoad).toBe(activeLoad);
    expect(staleScript.isConnected).toBe(false);
    expect(tossScripts()).toEqual([activeScript]);

    installTossRuntime();
    activeScript.dispatchEvent(new Event("load"));
    await activeLoad;
  });

  it("rejects a disconnected active attempt and starts a fresh loader", async () => {
    const disconnectedLoad = ensureTossPaymentsScript();
    const disconnectedScript = tossScripts()[0];
    disconnectedScript.remove();

    const replacementLoad = ensureTossPaymentsScript();
    const replacementScript = tossScripts()[0];

    await expect(disconnectedLoad).rejects.toMatchObject({
      code: "INTEGRATION_DISCONNECTED",
    });
    expect(replacementScript).not.toBe(disconnectedScript);

    installTossRuntime();
    replacementScript.dispatchEvent(new Event("load"));
    await replacementLoad;
  });

  it("reads the allowlisted public client key", () => {
    expect(getTossClientKey()).toBe("test_ck_123");
  });

  it("preserves the user-facing setup error when the key is missing", () => {
    jest.mocked(getPublicRuntimeConfig).mockReturnValue(runtimeConfig(null));

    expect(() => getTossClientKey()).toThrow("결제 설정이 올바르지 않습니다.");
  });

  it("creates the SDK client only through the platform runtime accessor", () => {
    installTossRuntime();

    getTossPaymentsClient("test_ck_explicit");

    expect(window.TossPayments).toHaveBeenCalledWith("test_ck_explicit");
  });

  it("preserves the unavailable client error", () => {
    expect(() => getTossPaymentsClient("test_ck_explicit")).toThrow(
      "결제 시스템을 불러올 수 없습니다.",
    );
  });

  it("rejects an invalid or throwing provider factory as a safe AppError", () => {
    window.TossPayments = jest.fn(() => {
      throw new Error("provider payload must not escape");
    });

    expect(() => createTossPaymentsV1Client("test_ck_explicit")).toThrow(
      expect.objectContaining({
        kind: "integration",
        code: "INTEGRATION_INVALID_RUNTIME",
        message: "결제 시스템을 불러올 수 없습니다.",
      }),
    );
  });

  it.each([
    ["a null client", null],
    ["an empty client", {}],
    ["a client without widgets", { requestPayment: jest.fn() }],
    ["a client without requestPayment", { widgets: jest.fn() }],
  ])("rejects %s as a typed invalid runtime", (_description, client) => {
    window.TossPayments = jest.fn(() => client) as any;

    expect(() => createTossPaymentsV1Client("test_ck_explicit")).toThrow(
      expect.objectContaining({
        kind: "integration",
        code: "INTEGRATION_INVALID_RUNTIME",
        integration: "toss-payments-v1",
        message: "결제 시스템을 불러올 수 없습니다.",
      }),
    );
  });

  it("preserves the feature-facing error for a malformed provider client", () => {
    window.TossPayments = jest.fn(() => ({
      widgets: jest.fn(),
    })) as any;

    expect(() => getTossPaymentsClient("test_ck_explicit")).toThrow(
      "결제 시스템을 불러올 수 없습니다.",
    );
  });

  it("recognizes cancellation and sandbox selection failures as silent resets", () => {
    expect(
      shouldSilentlyResetPayment({
        code: "USER_CANCEL",
        message: "사용자가 결제를 취소했습니다.",
      }),
    ).toBe(true);
    expect(
      shouldSilentlyResetPayment({
        code: "BAD_REQUEST",
        message: "계약 후 테스트 가능합니다.",
      }),
    ).toBe(true);
  });

  it("preserves Toss authentication failure normalization", () => {
    expect(toReservationPaymentError(new Error("Unauthorized"))).toEqual(
      new Error(
        "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
          "클라이언트 키가 올바른지 확인해주세요. " +
          "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다.",
      ),
    );
  });
});

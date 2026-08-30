import { ConfigError } from "../../../platform/config/env";
import { requireTossClientKey } from "../../../platform/config/publicRuntimeConfig";
import { IntegrationError } from "../../../platform/integrations/errors";
import {
  createTossPaymentsV1Client,
  ensureTossPaymentsV1Script,
} from "../../../platform/integrations/tossPaymentsV1";
import {
  PaymentGatewayError,
  tossPaymentsV1Gateway,
} from "./paymentGateway";

jest.mock("../../../platform/config/publicRuntimeConfig", () => ({
  requireTossClientKey: jest.fn(),
}));

jest.mock("../../../platform/integrations/tossPaymentsV1", () => ({
  createTossPaymentsV1Client: jest.fn(),
  ensureTossPaymentsV1Script: jest.fn(),
}));

const request = {
  amount: 120_000,
  customerEmail: "guest@example.com",
  customerName: "게스트",
  failUrl: "https://airbob.test/reservations/r-1/fail",
  orderId: "r-1",
  orderName: "테스트 숙소 예약",
  successUrl: "https://airbob.test/reservations/r-1/success",
};

describe("Toss Payments v1 gateway", () => {
  beforeEach(() => {
    jest.mocked(ensureTossPaymentsV1Script).mockReset();
    jest.mocked(createTossPaymentsV1Client).mockReset();
    jest.mocked(requireTossClientKey).mockReset();
    jest.mocked(ensureTossPaymentsV1Script).mockResolvedValue(undefined);
    jest.mocked(requireTossClientKey).mockReturnValue("test_ck_public");
  });

  it("prepares the existing v1 runtime without creating a payment", async () => {
    await expect(tossPaymentsV1Gateway.prepare()).resolves.toBeUndefined();

    expect(ensureTossPaymentsV1Script).toHaveBeenCalledTimes(1);
    expect(createTossPaymentsV1Client).not.toHaveBeenCalled();
  });

  it("forwards the exact current v1 request contract", async () => {
    const requestPayment = jest.fn().mockResolvedValue(undefined);
    jest.mocked(createTossPaymentsV1Client).mockReturnValue({
      requestPayment,
      widgets: jest.fn(),
    });

    await tossPaymentsV1Gateway.requestPayment(request);

    expect(ensureTossPaymentsV1Script).toHaveBeenCalledTimes(1);
    expect(createTossPaymentsV1Client).toHaveBeenCalledWith("test_ck_public");
    expect(requestPayment).toHaveBeenCalledWith(request);
  });

  it.each([
    [{ code: "USER_CANCEL" }, "cancelled", true],
    [{ code: "BAD_REQUEST" }, "recoverable", true],
    [new Error("Unauthorized"), "terminal", false],
  ] as const)(
    "normalizes provider failures without exposing their object",
    async (providerError, kind, silent) => {
      jest.mocked(createTossPaymentsV1Client).mockReturnValue({
        requestPayment: jest.fn().mockRejectedValue(providerError),
        widgets: jest.fn(),
      });

      await expect(
        tossPaymentsV1Gateway.requestPayment(request),
      ).rejects.toMatchObject({ kind, silent });
    },
  );

  it("keeps an SDK load failure recoverable", async () => {
    jest.mocked(ensureTossPaymentsV1Script).mockRejectedValue(
      new IntegrationError({
        code: "INTEGRATION_LOAD_FAILED",
        integration: "toss-payments-v1",
        message: "safe",
        retryable: true,
      }),
    );

    await expect(tossPaymentsV1Gateway.prepare()).rejects.toEqual(
      expect.objectContaining({
        kind: "recoverable",
        message: "결제 시스템을 불러올 수 없습니다.",
      }),
    );
  });

  it("maps missing public configuration to a safe terminal error", async () => {
    jest
      .mocked(requireTossClientKey)
      .mockImplementation(() => {
        throw new ConfigError("missing", "REACT_APP_TOSS_CLIENT_KEY");
      });

    await expect(
      tossPaymentsV1Gateway.requestPayment(request),
    ).rejects.toEqual(
      expect.objectContaining({
        kind: "terminal",
        message: "결제 설정이 올바르지 않습니다.",
      }),
    );
  });

  it("exports only safe gateway failures", () => {
    const error = new PaymentGatewayError({
      kind: "recoverable",
      message: "safe",
    });

    expect(error).toMatchObject({
      kind: "recoverable",
      message: "safe",
      silent: false,
    });
  });
});

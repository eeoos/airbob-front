import { ConfigError } from "../../../platform/config/env";
import { requireTossClientKey } from "../../../platform/config/publicRuntimeConfig";
import { IntegrationError } from "../../../platform/integrations/errors";
import {
  loadTossPaymentsV2Client,
} from "../../../platform/integrations/tossPaymentsV2";
import {
  createTossPaymentsV2GatewayLease,
  PaymentGatewayError,
  type PaymentGatewayLease,
  type PaymentGatewayPort,
} from "./paymentGateway";

vi.mock("../../../platform/config/publicRuntimeConfig", () => ({
  requireTossClientKey: vi.fn(),
}));

vi.mock("../../../platform/integrations/tossPaymentsV2", () => ({
  loadTossPaymentsV2Client: vi.fn(),
}));

const request = {
  amount: 120_000,
  customerEmail: "guest@example.com",
  customerName: "게스트",
  failUrl: "https://airbob.test/reservations/r-1/fail",
  orderId: "reservation-1",
  orderName: "테스트 숙소 예약",
  successUrl: "https://airbob.test/reservations/r-1/success",
};

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("Toss Payments v2 gateway", () => {
  let gateway: PaymentGatewayPort;
  let lease: PaymentGatewayLease;

  beforeEach(() => {
    vi.mocked(loadTossPaymentsV2Client).mockReset();
    vi.mocked(requireTossClientKey).mockReset();
    vi.mocked(loadTossPaymentsV2Client).mockResolvedValue({
      dispose: vi.fn().mockResolvedValue(undefined),
      requestPayment: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(requireTossClientKey).mockReturnValue("test_ck_public");
    lease = createTossPaymentsV2GatewayLease();
    gateway = lease.gateway;
  });

  it("prepares the v2 runtime without requesting a payment", async () => {
    await expect(gateway.prepare()).resolves.toBeUndefined();

    expect(loadTossPaymentsV2Client).toHaveBeenCalledWith("test_ck_public");
    const client = await vi.mocked(loadTossPaymentsV2Client).mock.results[0]
      .value;
    expect(client.requestPayment).not.toHaveBeenCalled();
  });

  it("forwards the exact current gateway request contract", async () => {
    const requestPayment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(loadTossPaymentsV2Client).mockResolvedValue({
      dispose: vi.fn().mockResolvedValue(undefined),
      requestPayment,
    });

    await gateway.requestPayment(request);

    expect(loadTossPaymentsV2Client).toHaveBeenCalledWith("test_ck_public");
    expect(requestPayment).toHaveBeenCalledWith(request);
  });

  it.each([
    [{ code: "USER_CANCEL" }, "cancelled", true],
    [{ code: "BAD_REQUEST" }, "recoverable", true],
    [{ code: "NETWORK_ERROR" }, "recoverable", false],
    [{ code: "INVALID_METHOD_TRANSACTION" }, "recoverable", false],
    [{ code: "INVALID_CLIENT_KEY" }, "terminal", false],
    [{ code: "INVALID_CUSTOMER_KEY" }, "terminal", false],
    [{ code: "INVALID_PARAMETERS" }, "terminal", false],
    [new Error("Unauthorized"), "terminal", false],
  ] as const)(
    "normalizes provider failures without exposing their object",
    async (providerError, kind, silent) => {
      vi.mocked(loadTossPaymentsV2Client).mockResolvedValue({
        dispose: vi.fn().mockResolvedValue(undefined),
        requestPayment: vi.fn().mockRejectedValue(providerError),
      });

      await expect(
        gateway.requestPayment(request),
      ).rejects.toMatchObject({ kind, silent });
    },
  );

  it("keeps an SDK load failure recoverable", async () => {
    vi.mocked(loadTossPaymentsV2Client).mockRejectedValue(
      new IntegrationError({
        code: "INTEGRATION_LOAD_FAILED",
        integration: "toss-payments-v2",
        message: "safe",
        retryable: true,
      }),
    );

    await expect(gateway.prepare()).rejects.toEqual(
      expect.objectContaining({
        kind: "recoverable",
        message: "결제 시스템을 불러올 수 없습니다.",
      }),
    );
  });

  it("maps missing public configuration to a safe terminal error", async () => {
    vi
      .mocked(requireTossClientKey)
      .mockImplementation(() => {
        throw new ConfigError("missing", "REACT_APP_TOSS_CLIENT_KEY");
      });

    await expect(
      gateway.requestPayment(request),
    ).rejects.toEqual(
      expect.objectContaining({
        kind: "terminal",
        message: "결제 설정이 올바르지 않습니다.",
      }),
    );
  });

  it("releases its route-owned client and can prepare a new one", async () => {
    const firstDispose = vi.fn().mockResolvedValue(undefined);
    const secondDispose = vi.fn().mockResolvedValue(undefined);
    vi
      .mocked(loadTossPaymentsV2Client)
      .mockResolvedValueOnce({
        dispose: firstDispose,
        requestPayment: vi.fn().mockResolvedValue(undefined),
      })
      .mockResolvedValueOnce({
        dispose: secondDispose,
        requestPayment: vi.fn().mockResolvedValue(undefined),
      });

    await gateway.prepare();
    lease.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(firstDispose).toHaveBeenCalledTimes(1);

    await gateway.prepare();
    expect(loadTossPaymentsV2Client).toHaveBeenCalledTimes(2);
    expect(secondDispose).not.toHaveBeenCalled();
  });

  it("retires only the old generation when disposed during a pending load", async () => {
    const firstClient = {
      dispose: vi.fn().mockResolvedValue(undefined),
      requestPayment: vi.fn().mockResolvedValue(undefined),
    };
    const secondClient = {
      dispose: vi.fn().mockResolvedValue(undefined),
      requestPayment: vi.fn().mockResolvedValue(undefined),
    };
    const firstLoad = deferred<typeof firstClient>();
    const secondLoad = deferred<typeof secondClient>();
    vi
      .mocked(loadTossPaymentsV2Client)
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);

    const firstPrepare = gateway.prepare();
    await Promise.resolve();
    lease.dispose();
    const secondPrepare = gateway.prepare();
    await Promise.resolve();

    firstLoad.resolve(firstClient);
    await expect(firstPrepare).resolves.toBeUndefined();
    await Promise.resolve();
    expect(firstClient.dispose).toHaveBeenCalledTimes(1);
    expect(secondClient.dispose).not.toHaveBeenCalled();

    secondLoad.resolve(secondClient);
    await expect(secondPrepare).resolves.toBeUndefined();
    expect(secondClient.dispose).not.toHaveBeenCalled();

    lease.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(secondClient.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases a failed client load so prepare can retry", async () => {
    vi
      .mocked(loadTossPaymentsV2Client)
      .mockRejectedValueOnce(
        new IntegrationError({
          code: "INTEGRATION_LOAD_FAILED",
          integration: "toss-payments-v2",
          message: "safe",
          retryable: true,
        }),
      )
      .mockResolvedValueOnce({
        dispose: vi.fn().mockResolvedValue(undefined),
        requestPayment: vi.fn().mockResolvedValue(undefined),
      });

    await expect(gateway.prepare()).rejects.toMatchObject({
      kind: "recoverable",
    });
    await expect(gateway.prepare()).resolves.toBeUndefined();
    expect(loadTossPaymentsV2Client).toHaveBeenCalledTimes(2);
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

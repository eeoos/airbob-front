import {
  ANONYMOUS,
  clearTossPayments,
  loadTossPayments,
} from "@tosspayments/tosspayments-sdk";
import { IntegrationError } from "./errors";
import { loadTossPaymentsV2Client } from "./tossPaymentsV2";

type TossPaymentsV2Client = Awaited<
  ReturnType<typeof loadTossPaymentsV2Client>
>;
type TossPaymentsV2Request = Parameters<
  TossPaymentsV2Client["requestPayment"]
>[0];
const TOSS_PAYMENTS_V2_READINESS_TIMEOUT_MS = 8000;

vi.mock("@tosspayments/tosspayments-sdk", () => ({
  ANONYMOUS: "@@ANONYMOUS",
  clearTossPayments: vi.fn(),
  loadTossPayments: vi.fn(),
}));

const request: TossPaymentsV2Request = {
  amount: 120_000,
  customerEmail: "guest@example.com",
  customerName: "게스트",
  failUrl: "https://airbob.test/reservations/r-1/fail",
  orderId: "reservation-1",
  orderName: "테스트 숙소 예약",
  successUrl: "https://airbob.test/reservations/r-1/success",
};

let keySequence = 0;
const nextClientKey = () => `test_ck_v2_${++keySequence}`;

const setupSdk = () => {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const requestPayment = vi.fn().mockResolvedValue(undefined);
  const payment = vi.fn(() => ({ destroy, requestPayment }));

  vi.mocked(loadTossPayments).mockResolvedValue({ payment } as never);

  return { destroy, payment, requestPayment };
};

describe("Toss Payments v2 integration", () => {
  beforeEach(() => {
    vi.mocked(clearTossPayments).mockReset();
    vi.mocked(loadTossPayments).mockReset();
  });

  it("loads the official SDK and maps the existing request to CARD/KRW", async () => {
    const { payment, requestPayment } = setupSdk();
    const clientKey = nextClientKey();

    const client = await loadTossPaymentsV2Client(clientKey);
    await client.requestPayment(request);

    expect(loadTossPayments).toHaveBeenCalledWith(clientKey);
    expect(payment).toHaveBeenCalledWith({ customerKey: ANONYMOUS });
    expect(requestPayment).toHaveBeenCalledWith({
      amount: { currency: "KRW", value: request.amount },
      customerEmail: request.customerEmail,
      customerName: request.customerName,
      failUrl: request.failUrl,
      method: "CARD",
      orderId: request.orderId,
      orderName: request.orderName,
      successUrl: request.successUrl,
    });
  });

  it("deduplicates concurrent SDK loads for the same public key", async () => {
    const { payment } = setupSdk();
    const clientKey = nextClientKey();

    const first = loadTossPaymentsV2Client(clientKey);
    const duplicate = loadTossPaymentsV2Client(clientKey);

    const [firstClient, duplicateClient] = await Promise.all([
      first,
      duplicate,
    ]);
    expect(duplicateClient).not.toBe(firstClient);
    expect(loadTossPayments).toHaveBeenCalledTimes(1);
    expect(payment).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a client across different public keys", async () => {
    setupSdk();

    await loadTossPaymentsV2Client(nextClientKey());
    await loadTossPaymentsV2Client(nextClientKey());

    expect(loadTossPayments).toHaveBeenCalledTimes(2);
  });

  it("clears a failed load so the same key can retry", async () => {
    const clientKey = nextClientKey();
    const loadFailure = Object.assign(new Error("provider URL omitted"), {
      name: "ScriptLoadFailedError",
    });
    vi.mocked(loadTossPayments).mockRejectedValueOnce(loadFailure);

    await expect(loadTossPaymentsV2Client(clientKey)).rejects.toMatchObject({
      code: "INTEGRATION_LOAD_FAILED",
      integration: "toss-payments-v2",
      retryable: true,
    });

    setupSdk();
    await expect(loadTossPaymentsV2Client(clientKey)).resolves.toBeDefined();
    expect(loadTossPayments).toHaveBeenCalledTimes(2);
  });

  it("bounds an SDK load that never settles and releases the local cache", async () => {
    vi.useFakeTimers();
    try {
      const clientKey = nextClientKey();
      vi.mocked(loadTossPayments).mockReturnValue(
        new Promise(() => undefined) as never,
      );

      const readiness = loadTossPaymentsV2Client(clientKey);
      vi.advanceTimersByTime(TOSS_PAYMENTS_V2_READINESS_TIMEOUT_MS);

      await expect(readiness).rejects.toMatchObject({
        code: "INTEGRATION_TIMEOUT",
        integration: "toss-payments-v2",
        retryable: true,
      });
      expect(clearTossPayments).toHaveBeenCalledTimes(1);

      setupSdk();
      await expect(loadTossPaymentsV2Client(clientKey)).resolves.toBeDefined();
      expect(loadTossPayments).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still times out and releases the cache when provider cleanup throws", async () => {
    vi.useFakeTimers();
    try {
      const clientKey = nextClientKey();
      vi.mocked(clearTossPayments).mockImplementation(() => {
        throw new Error("cleanup unavailable");
      });
      vi.mocked(loadTossPayments).mockReturnValue(
        new Promise(() => undefined) as never,
      );

      const readiness = loadTossPaymentsV2Client(clientKey);
      vi.advanceTimersByTime(TOSS_PAYMENTS_V2_READINESS_TIMEOUT_MS);
      await expect(readiness).rejects.toMatchObject({
        code: "INTEGRATION_TIMEOUT",
      });

      vi.mocked(clearTossPayments).mockReset();
      setupSdk();
      await expect(loadTossPaymentsV2Client(clientKey)).resolves.toBeDefined();
      expect(loadTossPayments).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an invalid SDK namespace with a typed safe error", async () => {
    const clientKey = nextClientKey();
    vi.mocked(loadTossPayments).mockResolvedValue({} as never);

    await expect(loadTossPaymentsV2Client(clientKey)).rejects.toEqual(
      expect.objectContaining({
        code: "INTEGRATION_INVALID_RUNTIME",
        integration: "toss-payments-v2",
      }),
    );
    expect(clearTossPayments).toHaveBeenCalledTimes(1);
  });

  it("can reload the same key after resetting an invalid SDK namespace", async () => {
    const clientKey = nextClientKey();
    vi.mocked(loadTossPayments).mockResolvedValueOnce({} as never);

    await expect(loadTossPaymentsV2Client(clientKey)).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RUNTIME",
    });

    setupSdk();
    await expect(loadTossPaymentsV2Client(clientKey)).resolves.toBeDefined();
    expect(loadTossPayments).toHaveBeenCalledTimes(2);
  });

  it("rejects and resets a malformed payment runtime", async () => {
    const payment = vi.fn(() => ({}));
    vi.mocked(loadTossPayments).mockResolvedValue({ payment } as never);

    await expect(
      loadTossPaymentsV2Client(nextClientKey()),
    ).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RUNTIME",
      integration: "toss-payments-v2",
    });
    expect(clearTossPayments).toHaveBeenCalledTimes(1);
  });

  it("preserves a provider configuration failure raised during payment init", async () => {
    const providerError = {
      code: "INVALID_CLIENT_KEY",
      message: "provider details",
    };
    const payment = vi.fn(() => {
      throw providerError;
    });
    vi.mocked(loadTossPayments).mockResolvedValue({ payment } as never);

    await expect(loadTossPaymentsV2Client(nextClientKey())).rejects.toBe(
      providerError,
    );
  });

  it("rejects an empty client key before loading the SDK", async () => {
    await expect(loadTossPaymentsV2Client("   ")).rejects.toBeInstanceOf(
      IntegrationError,
    );
    expect(loadTossPayments).not.toHaveBeenCalled();
  });

  it("preserves provider request failures for gateway normalization", async () => {
    const providerError = { code: "USER_CANCEL", message: "cancelled" };
    const { requestPayment } = setupSdk();
    requestPayment.mockRejectedValue(providerError);
    const client = await loadTossPaymentsV2Client(nextClientKey());

    await expect(client.requestPayment(request)).rejects.toBe(providerError);
  });

  it("destroys one route-owned payment client at most once", async () => {
    const { destroy } = setupSdk();
    const client = await loadTossPaymentsV2Client(nextClientKey());

    await client.dispose();
    await client.dispose();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["short order ID", { orderId: "short" }],
    ["unsupported order ID character", { orderId: "reservation.1" }],
    ["long order name", { orderName: "가".repeat(101) }],
    ["long customer email", { customerEmail: "e".repeat(101) }],
    ["long customer name", { customerName: "가".repeat(101) }],
    ["unsafe amount", { amount: Number.MAX_SAFE_INTEGER + 1 }],
    ["zero amount", { amount: 0 }],
    ["relative success URL", { successUrl: "/success" }],
    ["relative fail URL", { failUrl: "/fail" }],
  ] as const)(
    "rejects a %s before provider request I/O",
    async (_, override) => {
      const { requestPayment } = setupSdk();
      const client = await loadTossPaymentsV2Client(nextClientKey());

      await expect(
        client.requestPayment({ ...request, ...override }),
      ).rejects.toMatchObject({ code: "INVALID_PARAMETERS" });
      expect(requestPayment).not.toHaveBeenCalled();
    },
  );
});

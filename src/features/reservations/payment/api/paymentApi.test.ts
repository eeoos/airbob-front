import { requestApiData } from "../../../../platform/http/request";
import type {
  PaymentAttemptWire,
  PaymentOperationAcceptedWire,
  PaymentOperationDetailWire,
  ReservationHoldReleaseWire,
} from "./contracts";
import { paymentApi } from "./paymentApi";

vi.mock("../../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);

const reservationUid = "10000000-0000-4000-8000-000000000001";
const paymentAttemptId = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";

const paymentAttemptWire: PaymentAttemptWire = {
  payment_attempt_id: paymentAttemptId,
  order_id: reservationUid,
  amount: 120000,
  currency: "KRW",
  hold_expires_at: "2026-09-01T10:15:00.123456789Z",
  remaining_seconds: 900,
  server_time: "2026-09-01T10:00:00.123456789Z",
};

const holdReleaseWire: ReservationHoldReleaseWire = {
  reservation_uid: reservationUid,
  status: "EXPIRED",
  released_now: true,
  server_time: "2026-09-01T10:01:00.123456789Z",
};

const acceptedWire: PaymentOperationAcceptedWire = {
  operation_id: operationId,
  status: "PENDING",
  status_url: `/api/v1/payment-operations/${operationId}`,
};

const operationDetailWire: PaymentOperationDetailWire = {
  operation_id: operationId,
  order_id: reservationUid,
  status: "PENDING",
  failure_code: "provider-private-code",
  updated_at: "2026-09-01T10:02:00.123456789Z",
  next_action: "POLL",
  retry_after_seconds: 2,
  user_message: "<script>backend text must be discarded</script>",
  server_time: "2026-09-01T10:02:01.123456789Z",
  user_failure_code: null,
};

describe("payment API adapter", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
  });

  it("issues a payment attempt with the exact resource path, method, and signal", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue(paymentAttemptWire);

    await expect(
      paymentApi.beginPaymentAttempt(reservationUid, { signal }),
    ).resolves.toEqual({
      paymentAttemptId,
      orderId: reservationUid,
      amount: 120000,
      currency: "KRW",
      holdExpiresAt: "2026-09-01T10:15:00.123456789Z",
      remainingSeconds: 900,
      serverTime: "2026-09-01T10:00:00.123456789Z",
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "POST",
      path: `/reservations/${reservationUid}/payment-attempts`,
      signal,
    });
  });

  it("releases a hold with the exact resource path, method, and signal", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue(holdReleaseWire);

    await expect(
      paymentApi.releaseHold(reservationUid, { signal }),
    ).resolves.toEqual({
      reservationUid,
      status: "EXPIRED",
      releasedNow: true,
      serverTime: "2026-09-01T10:01:00.123456789Z",
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "DELETE",
      path: `/reservations/${reservationUid}/hold`,
      signal,
    });
  });

  it("confirms with the exact four-field body and returns the accepted operation identity", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue(acceptedWire);

    await expect(
      paymentApi.confirmPaymentOperation(
        {
          paymentKey: "payment-key-1",
          orderId: reservationUid,
          amount: 120000,
          paymentAttemptId,
        },
        { signal },
      ),
    ).resolves.toEqual({ operationId });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "POST",
      path: "/payments/confirm",
      expectedSuccessStatus: 202,
      body: {
        payment_key: "payment-key-1",
        order_id: reservationUid,
        amount: 120000,
        payment_attempt_id: paymentAttemptId,
      },
      signal,
    });
  });

  it.each(["PROCESSING", "SUCCEEDED", "FAILED", "REQUIRES_REVIEW"])(
    "returns the same operation identity on an exact %s replay",
    async (status) => {
      mockRequestApiData.mockResolvedValue({ ...acceptedWire, status });

      await expect(
        paymentApi.confirmPaymentOperation({
          paymentKey: "payment-key-1",
          orderId: reservationUid,
          amount: 120000,
          paymentAttemptId,
        }),
      ).resolves.toEqual({ operationId });

      expect(mockRequestApiData).toHaveBeenCalledWith({
        method: "POST",
        path: "/payments/confirm",
        expectedSuccessStatus: 202,
        body: {
          payment_key: "payment-key-1",
          order_id: reservationUid,
          amount: 120000,
          payment_attempt_id: paymentAttemptId,
        },
        signal: undefined,
      });
    },
  );

  it("reads the exact operation path and discards raw backend text", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue(operationDetailWire);

    await expect(
      paymentApi.getPaymentOperation(operationId, reservationUid, { signal }),
    ).resolves.toEqual({
      operationId,
      orderId: reservationUid,
      status: "PENDING",
      updatedAt: "2026-09-01T10:02:00.123456789Z",
      nextAction: "POLL",
      retryAfterSeconds: 2,
      serverTime: "2026-09-01T10:02:01.123456789Z",
      userFailureCode: null,
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: `/payment-operations/${operationId}`,
      signal,
    });
  });

  it("rejects malformed resource identities before any transport call", async () => {
    await expect(
      paymentApi.beginPaymentAttempt("reservation/path"),
    ).rejects.toThrow(TypeError);
    await expect(paymentApi.releaseHold("reservation/path")).rejects.toThrow(
      TypeError,
    );
    await expect(
      paymentApi.getPaymentOperation("operation/path", reservationUid),
    ).rejects.toThrow(TypeError);
    await expect(
      paymentApi.getPaymentOperation(operationId, "reservation/path"),
    ).rejects.toThrow(TypeError);
    await expect(
      paymentApi.confirmPaymentOperation({
        paymentKey: "payment-key-1",
        orderId: "reservation/path",
        amount: 120000,
        paymentAttemptId,
      }),
    ).rejects.toThrow(TypeError);

    expect(mockRequestApiData).not.toHaveBeenCalled();
  });
});

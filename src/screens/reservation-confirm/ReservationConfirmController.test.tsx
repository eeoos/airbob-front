import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { renderApp } from "../../test/renderApp";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import { PaymentGatewayError } from "../../workflows/booking-payment/checkout/paymentGateway";
import type {
  BookingTransactionHandle,
  BookingTransactionSnapshot,
  BookingTransactionWorkflow,
} from "../../workflows/booking-payment/transaction/booking";
import { ReservationConfirmController } from "./ReservationConfirmController";

const mockUseAccommodationDetailReadQuery = vi.fn();

vi.mock("../../features/accommodations/detail/public", () => ({
  useAccommodationDetailReadQuery: (...args: unknown[]) =>
    mockUseAccommodationDetailReadQuery(...args),
}));

const scope: AuthenticatedSessionScope = {
  epoch: 7,
  runtimeLeaseId: testSessionRuntimeLeaseId,
  subject: "subject:reservation_confirm" as SessionSubject,
};
const reservationUid = "20000000-0000-4000-8000-000000000002";
const handle: BookingTransactionHandle = {
  flowId: "10000000-0000-4000-8000-000000000001",
  locator: { kind: "reservation", reservationUid },
};
const snapshot: BookingTransactionSnapshot = {
  phase: "reservation-ready",
  flowId: handle.flowId,
  accommodationId: 42,
  reservationUid,
  orderName: "테스트 숙소 예약",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultCount: 2,
  childCount: 0,
  infantCount: 0,
  petCount: 0,
  nightlyPrice: 60_000,
  nights: 2,
  subtotal: 120_000,
  discountAmount: 0,
  amount: 120_000,
  currency: "KRW",
  couponDisplayName: null,
  quoteExpiresAt: "2026-09-01T10:10:00Z",
  serverTime: "2026-09-01T10:00:00Z",
  paymentRequired: true,
  reservationStatus: "PAYMENT_PENDING",
  paymentAllowed: true,
  holdExpiresAt: "2026-09-01T10:15:00Z",
  canCheckout: false,
  canPay: true,
  canRetryPayment: false,
  canReleaseHold: true,
};

const holdReleasedSnapshot: BookingTransactionSnapshot = {
  ...snapshot,
  phase: "hold-released",
  reservationStatus: "EXPIRED",
  paymentAllowed: false,
  holdExpiresAt: null,
  canPay: false,
  canReleaseHold: false,
};

const createWorkflow = () =>
  ({
    prepareGateway: vi.fn().mockResolvedValue({ status: "ready" }),
    load: vi.fn().mockReturnValue({ status: "ready", handle, snapshot }),
    pay: vi.fn(),
    releaseHold: vi.fn(),
  }) as unknown as BookingTransactionWorkflow;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderController = (
  workflow: BookingTransactionWorkflow,
  onReleased = vi.fn().mockResolvedValue(true),
  onReservationStatusDrift = vi.fn().mockResolvedValue(true),
  initialSnapshot: BookingTransactionSnapshot = snapshot,
) =>
  renderApp(
    <ReservationConfirmController
      customer={{ email: "guest@example.com", name: "게스트" }}
      failUrl={`https://airbob.test/reservations/${reservationUid}/fail`}
      handle={handle}
      onReleased={onReleased}
      onReservationStatusDrift={onReservationStatusDrift}
      resolveImageUrl={(path) => path ?? ""}
      routeLease={{ isCurrent: () => true }}
      scope={scope}
      snapshot={initialSnapshot}
      successUrl={`https://airbob.test/reservations/${reservationUid}/success`}
      workflow={workflow}
    />,
  );

describe("ReservationConfirmController", () => {
  beforeEach(() => {
    mockUseAccommodationDetailReadQuery.mockReturnValue({
      data: {
        id: 42,
        name: "테스트 숙소",
        basePrice: 999_999,
        images: [],
        reviewSummary: { averageRating: 4.5, totalCount: 3 },
      },
      isError: false,
      isLoading: false,
    });
  });

  it("uses runtime-only customer data and keeps a cancelled Toss attempt retryable", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.pay)
      .mockResolvedValueOnce({
        status: "gateway-cancelled",
        error: new PaymentGatewayError({
          kind: "cancelled",
          message: "cancelled",
          silent: true,
        }),
        handle,
        snapshot: {
          ...snapshot,
          phase: "attempt-ready",
          canRetryPayment: true,
        },
      })
      .mockResolvedValueOnce({
        status: "gateway-requested",
        handle,
        snapshot: {
          ...snapshot,
          phase: "attempt-ready",
          canRetryPayment: true,
        },
      });
    renderController(workflow);

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(paymentButton).toBeEnabled());
    fireEvent.click(paymentButton);
    await screen.findByText(
      "결제가 취소되었습니다. 같은 결제 시도로 다시 진행할 수 있습니다.",
    );
    fireEvent.click(paymentButton);

    await waitFor(() => expect(workflow.pay).toHaveBeenCalledTimes(2));
    expect(workflow.pay).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        customer: { email: "guest@example.com", name: "게스트" },
        handle,
      }),
    );
    expect(workflow.pay).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ handle }),
    );
  });

  it("allows the next transaction while an old route request is unresolved", async () => {
    const nextReservationUid = "20000000-0000-4000-8000-000000000003";
    const nextHandle: BookingTransactionHandle = {
      flowId: "10000000-0000-4000-8000-000000000004",
      locator: { kind: "reservation", reservationUid: nextReservationUid },
    };
    const nextSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      flowId: nextHandle.flowId,
      reservationUid: nextReservationUid,
    };
    const oldPayment =
      deferred<Awaited<ReturnType<BookingTransactionWorkflow["pay"]>>>();
    const oldWorkflow = createWorkflow();
    const nextWorkflow = createWorkflow();
    vi.mocked(oldWorkflow.pay).mockReturnValue(oldPayment.promise);
    vi.mocked(nextWorkflow.pay).mockResolvedValue({
      status: "gateway-requested",
      handle: nextHandle,
      snapshot: nextSnapshot,
    });
    let activeFlowId = handle.flowId;
    const oldRouteLease = { isCurrent: () => activeFlowId === handle.flowId };
    const nextRouteLease = {
      isCurrent: () => activeFlowId === nextHandle.flowId,
    };
    const callbacks = {
      onReleased: vi.fn().mockResolvedValue(true),
      onReservationStatusDrift: vi.fn().mockResolvedValue(true),
    };
    const view = renderApp(
      <ReservationConfirmController
        customer={{ email: "guest@example.com", name: "게스트" }}
        failUrl={`https://airbob.test/reservations/${reservationUid}/fail`}
        handle={handle}
        resolveImageUrl={(path) => path ?? ""}
        routeLease={oldRouteLease}
        scope={scope}
        snapshot={snapshot}
        successUrl={`https://airbob.test/reservations/${reservationUid}/success`}
        workflow={oldWorkflow}
        {...callbacks}
      />,
    );
    const oldPaymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(oldPaymentButton).toBeEnabled());
    fireEvent.click(oldPaymentButton);
    await waitFor(() => expect(oldWorkflow.pay).toHaveBeenCalledOnce());

    activeFlowId = nextHandle.flowId;
    view.rerender(
      <ReservationConfirmController
        customer={{ email: "guest@example.com", name: "게스트" }}
        failUrl={`https://airbob.test/reservations/${nextReservationUid}/fail`}
        handle={nextHandle}
        resolveImageUrl={(path) => path ?? ""}
        routeLease={nextRouteLease}
        scope={scope}
        snapshot={nextSnapshot}
        successUrl={`https://airbob.test/reservations/${nextReservationUid}/success`}
        workflow={nextWorkflow}
        {...callbacks}
      />,
    );
    const nextPaymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(nextPaymentButton).toBeEnabled());
    fireEvent.click(nextPaymentButton);

    await waitFor(() => expect(nextWorkflow.pay).toHaveBeenCalledOnce());
    await act(async () => {
      oldPayment.resolve({
        status: "gateway-cancelled",
        error: new PaymentGatewayError({
          kind: "cancelled",
          message: "cancelled",
          silent: true,
        }),
        handle,
        snapshot,
      });
    });

    expect(
      screen.queryByText(
        "결제가 취소되었습니다. 같은 결제 시도로 다시 진행할 수 있습니다.",
      ),
    ).not.toBeInTheDocument();
  });

  it("allows the next hold release while an old route release is unresolved", async () => {
    const nextReservationUid = "20000000-0000-4000-8000-000000000005";
    const nextHandle: BookingTransactionHandle = {
      flowId: "10000000-0000-4000-8000-000000000006",
      locator: { kind: "reservation", reservationUid: nextReservationUid },
    };
    const nextSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      flowId: nextHandle.flowId,
      reservationUid: nextReservationUid,
    };
    const oldRelease =
      deferred<
        Awaited<ReturnType<BookingTransactionWorkflow["releaseHold"]>>
      >();
    const nextRelease =
      deferred<
        Awaited<ReturnType<BookingTransactionWorkflow["releaseHold"]>>
      >();
    const oldWorkflow = createWorkflow();
    const nextWorkflow = createWorkflow();
    vi.mocked(oldWorkflow.releaseHold).mockReturnValue(oldRelease.promise);
    vi.mocked(nextWorkflow.releaseHold).mockReturnValue(nextRelease.promise);
    let activeFlowId = handle.flowId;
    const oldRouteLease = { isCurrent: () => activeFlowId === handle.flowId };
    const nextRouteLease = {
      isCurrent: () => activeFlowId === nextHandle.flowId,
    };
    const callbacks = {
      onReleased: vi.fn().mockResolvedValue(true),
      onReservationStatusDrift: vi.fn().mockResolvedValue(true),
    };
    const view = renderApp(
      <ReservationConfirmController
        customer={{ email: "guest@example.com", name: "게스트" }}
        failUrl={`https://airbob.test/reservations/${reservationUid}/fail`}
        handle={handle}
        resolveImageUrl={(path) => path ?? ""}
        routeLease={oldRouteLease}
        scope={scope}
        snapshot={snapshot}
        successUrl={`https://airbob.test/reservations/${reservationUid}/success`}
        workflow={oldWorkflow}
        {...callbacks}
      />,
    );
    const oldReleaseButton = await screen.findByRole("button", {
      name: "예약을 취소하고 객실 해제",
    });
    await waitFor(() => expect(oldReleaseButton).toBeEnabled());
    fireEvent.click(oldReleaseButton);
    await waitFor(() => expect(oldWorkflow.releaseHold).toHaveBeenCalledOnce());

    activeFlowId = nextHandle.flowId;
    view.rerender(
      <ReservationConfirmController
        customer={{ email: "guest@example.com", name: "게스트" }}
        failUrl={`https://airbob.test/reservations/${nextReservationUid}/fail`}
        handle={nextHandle}
        resolveImageUrl={(path) => path ?? ""}
        routeLease={nextRouteLease}
        scope={scope}
        snapshot={nextSnapshot}
        successUrl={`https://airbob.test/reservations/${nextReservationUid}/success`}
        workflow={nextWorkflow}
        {...callbacks}
      />,
    );
    const nextReleaseButton = await screen.findByRole("button", {
      name: "예약을 취소하고 객실 해제",
    });
    await waitFor(() => expect(nextReleaseButton).toBeEnabled());
    fireEvent.click(nextReleaseButton);

    await waitFor(() =>
      expect(nextWorkflow.releaseHold).toHaveBeenCalledOnce(),
    );
    await act(async () => {
      oldRelease.resolve({
        status: "retryable-error",
        stage: "release",
        failure: { code: "NETWORK_ERROR", retryable: true },
      });
    });

    expect(
      screen.queryByText(
        "예약 해제 결과를 확인하지 못했습니다. 같은 작업을 다시 시도해주세요.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps payment disabled until a reloaded attempt-requesting flow prepares Toss", async () => {
    const workflow = createWorkflow();
    const prepared = deferred<{ status: "ready" }>();
    vi.mocked(workflow.prepareGateway).mockReturnValue(prepared.promise);
    const requestingSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      phase: "attempt-requesting",
      canRetryPayment: true,
    };
    renderController(workflow, undefined, undefined, requestingSnapshot);

    const paymentButton = await screen.findByRole("button", {
      name: "결제 시스템 로딩 중...",
    });
    expect(paymentButton).toBeDisabled();
    expect(workflow.prepareGateway).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
    expect(workflow.pay).not.toHaveBeenCalled();

    prepared.resolve({ status: "ready" });
    await waitFor(() => expect(paymentButton).toBeEnabled());
  });

  it("finishes a reloaded released hold without preparing Toss again", async () => {
    const workflow = createWorkflow();
    const onReleased = vi.fn().mockResolvedValue(true);

    renderController(workflow, onReleased, undefined, holdReleasedSnapshot);

    await waitFor(() =>
      expect(onReleased).toHaveBeenCalledWith(
        handle,
        holdReleasedSnapshot,
        expect.any(Object),
      ),
    );
    expect(workflow.prepareGateway).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "예약 해제 확인 중..." }),
    ).toBeDisabled();
  });

  it("keeps a reloaded released hold recoverable when terminal publication fails", async () => {
    const workflow = createWorkflow();
    const onReleased = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    renderController(workflow, onReleased, undefined, holdReleasedSnapshot);

    await screen.findByText(
      "예약 내역을 갱신하지 못했습니다. 다시 확인해주세요.",
    );
    const retryButton = screen.getByRole("button", {
      name: "예약을 취소하고 객실 해제",
    });
    expect(retryButton).toBeEnabled();

    fireEvent.click(retryButton);
    await waitFor(() => expect(onReleased).toHaveBeenCalledTimes(2));
    expect(workflow.prepareGateway).not.toHaveBeenCalled();
  });

  it("does not prepare Toss while an ambiguous hold release is being replayed", async () => {
    const workflow = createWorkflow();
    const requestingSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      phase: "hold-release-requesting",
      canPay: false,
    };

    renderController(workflow, undefined, undefined, requestingSnapshot);

    expect(
      await screen.findByRole("button", {
        name: "결제 시스템 로딩 중...",
      }),
    ).toBeDisabled();
    expect(workflow.prepareGateway).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "예약을 취소하고 객실 해제" }),
    ).toBeEnabled();
  });

  it("keeps payment retryable after a recoverable Toss preparation error", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.prepareGateway).mockResolvedValue({
      status: "gateway-error",
      error: new PaymentGatewayError({
        kind: "recoverable",
        message: "prepare recoverable",
      }),
    });

    renderController(workflow);

    await screen.findByText("prepare recoverable");
    expect(screen.getByRole("button", { name: "확인 및 결제" })).toBeEnabled();
  });

  it("keeps payment disabled after a terminal Toss preparation error", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.prepareGateway).mockResolvedValue({
      status: "gateway-error",
      error: new PaymentGatewayError({
        kind: "terminal",
        message: "prepare terminal",
      }),
    });

    renderController(workflow);

    await screen.findByText("prepare terminal");
    expect(
      screen.getByRole("button", { name: "결제 시스템 로딩 중..." }),
    ).toBeDisabled();
  });

  it.each([
    {
      result: { status: "auth-required" as const },
      message: "다시 로그인한 뒤 결제를 계속해주세요.",
    },
    {
      result: {
        status: "blocked" as const,
        reason: "recovery-required" as const,
      },
      message: "결제 정보를 안전하게 확인할 수 없습니다.",
    },
  ])(
    "keeps payment disabled when gateway preparation returns $result.status",
    async ({ result, message }) => {
      const workflow = createWorkflow();
      vi.mocked(workflow.prepareGateway).mockResolvedValue(result);

      renderController(workflow);

      await screen.findByText(message);
      expect(
        screen.getByRole("button", { name: "결제 시스템 로딩 중..." }),
      ).toBeDisabled();
      expect(workflow.pay).not.toHaveBeenCalled();
    },
  );

  it("releases the hold explicitly and completes only after terminal publication", async () => {
    const workflow = createWorkflow();
    const releasedSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      phase: "hold-released",
      reservationStatus: "EXPIRED",
      paymentAllowed: false,
      holdExpiresAt: null,
      canPay: false,
      canReleaseHold: false,
    };
    vi.mocked(workflow.releaseHold).mockResolvedValue({
      status: "released",
      handle,
      snapshot: releasedSnapshot,
    });
    const onReleased = vi.fn().mockResolvedValue(true);
    renderController(workflow, onReleased);

    const releaseButton = await screen.findByRole("button", {
      name: "예약을 취소하고 객실 해제",
    });
    fireEvent.click(releaseButton);

    await waitFor(() =>
      expect(workflow.releaseHold).toHaveBeenCalledWith({
        handle,
        routeLease: expect.any(Object),
      }),
    );
    expect(onReleased).toHaveBeenCalledWith(
      handle,
      releasedSnapshot,
      expect.any(Object),
    );
  });

  it("converges R023 state drift to reservation status without offering release", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.pay).mockResolvedValue({
      status: "attempt-unavailable",
      failure: { code: "R023", retryable: false },
    });
    const onStatusDrift = vi.fn().mockResolvedValue(true);
    renderController(workflow, undefined, onStatusDrift);

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(paymentButton).toBeEnabled());
    fireEvent.click(paymentButton);

    await waitFor(() =>
      expect(onStatusDrift).toHaveBeenCalledWith(
        handle,
        snapshot,
        expect.any(Object),
      ),
    );
    expect(workflow.releaseHold).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "예약을 취소하고 객실 해제" }),
    ).not.toBeInTheDocument();
  });

  it("retains the exact R023 recovery surface when status convergence fails", async () => {
    const workflow = createWorkflow();
    const requestingSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      phase: "attempt-requesting",
      canRetryPayment: true,
    };
    vi.mocked(workflow.pay).mockResolvedValue({
      status: "attempt-unavailable",
      failure: { code: "R023", retryable: false },
    });
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle,
      snapshot: requestingSnapshot,
    });
    const onStatusDrift = vi.fn().mockResolvedValue(false);
    renderController(workflow, undefined, onStatusDrift);

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(paymentButton).toBeEnabled());
    fireEvent.click(paymentButton);

    await screen.findByText(
      "예약 상태를 갱신하지 못했습니다. 예약 내역에서 확인해주세요.",
    );
    expect(onStatusDrift).toHaveBeenCalledWith(
      handle,
      requestingSnapshot,
      expect.any(Object),
    );
    expect(paymentButton).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "예약을 취소하고 객실 해제" }),
    ).not.toBeInTheDocument();
  });

  it("converges an R021 release conflict to authoritative reservation status", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.releaseHold).mockResolvedValue({
      status: "not-releasable",
    });
    const onStatusDrift = vi.fn().mockResolvedValue(true);
    renderController(workflow, undefined, onStatusDrift);

    const releaseButton = await screen.findByRole("button", {
      name: "예약을 취소하고 객실 해제",
    });
    fireEvent.click(releaseButton);

    await waitFor(() =>
      expect(onStatusDrift).toHaveBeenCalledWith(
        handle,
        snapshot,
        expect.any(Object),
      ),
    );
    expect(
      screen.queryByRole("button", { name: "예약을 취소하고 객실 해제" }),
    ).not.toBeInTheDocument();
  });

  it("retains the exact R021 recovery surface when status convergence fails", async () => {
    const workflow = createWorkflow();
    const requestingSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      phase: "hold-release-requesting",
      canPay: false,
    };
    vi.mocked(workflow.releaseHold).mockResolvedValue({
      status: "not-releasable",
    });
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle,
      snapshot: requestingSnapshot,
    });
    const onStatusDrift = vi.fn().mockResolvedValue(false);
    renderController(workflow, undefined, onStatusDrift);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "예약을 취소하고 객실 해제",
      }),
    );

    await screen.findByText(
      "예약 상태를 갱신하지 못했습니다. 예약 내역에서 확인해주세요.",
    );
    expect(onStatusDrift).toHaveBeenCalledWith(
      handle,
      requestingSnapshot,
      expect.any(Object),
    );
    expect(
      screen.queryByRole("button", { name: "예약을 취소하고 객실 해제" }),
    ).not.toBeInTheDocument();
  });

  it("disables payment after a zero-window attempt while preserving explicit release", async () => {
    const workflow = createWorkflow();
    const attemptSnapshot: BookingTransactionSnapshot = {
      ...snapshot,
      phase: "attempt-ready",
      canRetryPayment: true,
    };
    vi.mocked(workflow.pay).mockResolvedValue({
      status: "attempt-unavailable",
      failure: { code: "R022", retryable: false },
    });
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle,
      snapshot: attemptSnapshot,
    });
    vi.mocked(workflow.releaseHold).mockResolvedValue({
      status: "released",
      handle,
      snapshot: holdReleasedSnapshot,
    });
    const onReleased = vi.fn().mockResolvedValue(true);
    renderController(workflow, onReleased);

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(paymentButton).toBeEnabled());
    fireEvent.click(paymentButton);

    await screen.findByText(
      "결제 가능 시간이 부족합니다. 예약을 해제한 뒤 다시 예약해주세요.",
    );
    expect(paymentButton).toBeDisabled();
    const releaseButton = screen.getByRole("button", {
      name: "예약을 취소하고 객실 해제",
    });
    expect(releaseButton).toBeEnabled();

    fireEvent.click(releaseButton);
    await waitFor(() =>
      expect(onReleased).toHaveBeenCalledWith(
        handle,
        holdReleasedSnapshot,
        expect.any(Object),
      ),
    );
  });

  it("renders immutable quote pricing instead of the latest detail base price", async () => {
    const workflow = createWorkflow();
    renderController(workflow);

    await screen.findByText("2박 x ₩60,000");
    expect(screen.queryByText("₩999,999")).not.toBeInTheDocument();
  });
});

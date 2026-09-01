import { act, renderHook, waitFor } from "@testing-library/react";
import type {
  BookingTransactionHandle,
  BookingTransactionSnapshot,
  BookingTransactionWorkflow,
} from "../../workflows/booking-payment/transaction/booking";
import { useReservationCreateCommand } from "./useReservationCreateCommand";

const accommodation = {
  id: 7,
  basePrice: 100000,
  policy: { maxOccupancy: 4, infantOccupancy: 1, petOccupancy: 1 },
};
const availability = {
  accommodationId: 7,
  bookingWindowStartInclusive: "2026-07-10",
  bookingWindowEndExclusive: "2027-07-10",
  unavailableRanges: [],
};
const handle: BookingTransactionHandle = {
  flowId: "10000000-0000-4000-8000-000000000001",
  locator: { kind: "accommodation", accommodationId: 7 },
};
const quoteSnapshot: BookingTransactionSnapshot = {
  phase: "quoted",
  flowId: handle.flowId,
  accommodationId: 7,
  reservationUid: null,
  checkIn: "2026-07-20",
  checkOut: "2026-07-22",
  adultCount: 2,
  childCount: 0,
  infantCount: 0,
  petCount: 0,
  orderName: "테스트 숙소",
  nightlyPrice: 100000,
  nights: 2,
  subtotal: 200000,
  discountAmount: 0,
  amount: 200000,
  currency: "KRW",
  couponDisplayName: null,
  quoteExpiresAt: "2026-07-10T00:10:00Z",
  serverTime: "2026-07-10T00:00:00Z",
  paymentRequired: true,
  reservationStatus: null,
  paymentAllowed: false,
  holdExpiresAt: null,
  canCheckout: true,
  canPay: false,
  canRetryPayment: false,
  canReleaseHold: false,
};
const paymentHandle: BookingTransactionHandle = {
  flowId: handle.flowId,
  locator: {
    kind: "reservation",
    reservationUid: "20000000-0000-4000-8000-000000000002",
  },
};
const paymentSnapshot: BookingTransactionSnapshot = {
  ...quoteSnapshot,
  phase: "reservation-ready",
  reservationUid:
    paymentHandle.locator.kind === "reservation"
      ? paymentHandle.locator.reservationUid
      : null,
  reservationStatus: "PAYMENT_PENDING",
  paymentAllowed: true,
  holdExpiresAt: "2026-07-10T00:15:00Z",
  canCheckout: false,
  canPay: true,
  canReleaseHold: true,
};

const createWorkflow = () =>
  ({
    quote: vi.fn().mockResolvedValue({
      status: "quoted",
      handle,
      snapshot: quoteSnapshot,
    }),
    load: vi.fn().mockReturnValue({ status: "missing" }),
    checkout: vi.fn().mockResolvedValue({
      status: "payment-ready",
      handle: paymentHandle,
      snapshot: paymentSnapshot,
    }),
    prepareGateway: vi.fn(),
    pay: vi.fn(),
    releaseHold: vi.fn(),
    acknowledgeTerminal: vi.fn(),
    abandonUnheld: vi.fn().mockReturnValue({ status: "abandoned" }),
    dispose: vi.fn(),
  }) as unknown as BookingTransactionWorkflow;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderCommand = ({
  flowHandle = null,
  flowHandleChangeResult = true,
  isRecoveryBlocked = false,
  workflow = createWorkflow(),
}: {
  flowHandle?: BookingTransactionHandle | null;
  flowHandleChangeResult?: boolean;
  isRecoveryBlocked?: boolean;
  workflow?: BookingTransactionWorkflow;
} = {}) => {
  const onError = vi.fn();
  const onFlowHandleChange = vi.fn(() => flowHandleChangeResult);
  const onOpenPayment = vi.fn();
  const onOpenTrips = vi.fn();
  const onTerminalReservation = vi.fn().mockResolvedValue(true);
  const requestAuthentication = vi.fn();
  const routeLease = { isCurrent: () => true };
  const view = renderHook(
    ({ currentFlowHandle }) =>
      useReservationCreateCommand({
        accommodation,
        availability,
        bookingDates: {
          checkIn: new Date(2026, 6, 20),
          checkOut: new Date(2026, 6, 22),
          totalPrice: 200000,
        },
        flowHandle: currentFlowHandle,
        guestCounts: {
          adultCount: 2,
          childCount: 0,
          infantCount: 0,
          petCount: 0,
        },
        isRecoveryBlocked,
        onError,
        onFlowHandleChange,
        onOpenPayment,
        onOpenTrips,
        onTerminalReservation,
        requestAuthentication,
        routeLease,
        selectedCoupon: null,
        workflow,
      }),
    { initialProps: { currentFlowHandle: flowHandle } },
  );
  return {
    ...view,
    onError,
    onFlowHandleChange,
    onOpenPayment,
    onTerminalReservation,
    workflow,
  };
};

describe("useReservationCreateCommand", () => {
  it("persists a quote first and checks out only on the second explicit action", async () => {
    const view = renderCommand();

    await act(async () => void (await view.result.current.startReservation()));
    expect(view.workflow.quote).toHaveBeenCalledOnce();
    expect(view.workflow.checkout).not.toHaveBeenCalled();
    expect(view.onFlowHandleChange).toHaveBeenCalledWith(handle);
    expect(view.result.current.quoteSnapshot).toEqual(quoteSnapshot);
    expect(view.result.current.selectionLocked).toBe(true);

    await act(async () => void (await view.result.current.startReservation()));
    expect(view.workflow.checkout).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
    expect(view.onOpenPayment).toHaveBeenCalledWith(
      paymentHandle,
      paymentSnapshot,
    );
    expect(view.onFlowHandleChange).toHaveBeenLastCalledWith(paymentHandle);
    expect(
      view.onFlowHandleChange.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(
      view.onOpenPayment.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("keeps an in-flight quote alive when same-key history publication rerenders", async () => {
    const workflow = createWorkflow();
    const pendingQuote =
      deferred<Awaited<ReturnType<BookingTransactionWorkflow["quote"]>>>();
    vi.mocked(workflow.quote).mockImplementation((input) => {
      expect(input.publishPreparedHandle(handle)).toBe(true);
      return pendingQuote.promise;
    });
    const view = renderCommand({ workflow });

    let command!: Promise<void>;
    act(() => {
      command = view.result.current.startReservation();
    });
    await waitFor(() => expect(workflow.quote).toHaveBeenCalledOnce());

    view.rerender({ currentFlowHandle: handle });
    expect(workflow.load).not.toHaveBeenCalled();
    expect(view.result.current.isReserving).toBe(true);

    pendingQuote.resolve({ status: "quoted", handle, snapshot: quoteSnapshot });
    await act(async () => void (await command));
    expect(view.result.current.quoteSnapshot).toEqual(quoteSnapshot);
    expect(view.result.current.reservationStatus).toBe("quoted");
  });

  it("abandons the exact unheld quote before unlocking booking inputs", async () => {
    const view = renderCommand();
    await act(async () => void (await view.result.current.startReservation()));

    act(() => expect(view.result.current.abandonQuote()).toBe(true));

    expect(view.workflow.abandonUnheld).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
    expect(view.onFlowHandleChange).toHaveBeenLastCalledWith(null);
    expect(view.result.current.quoteSnapshot).toBeNull();
    expect(view.result.current.selectionLocked).toBe(false);
  });

  it("loads only the exact direct flow reference after a route reload", () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle,
      snapshot: quoteSnapshot,
    });

    const view = renderCommand({ flowHandle: handle, workflow });

    expect(workflow.load).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
    expect(view.result.current.quoteSnapshot).toEqual(quoteSnapshot);
    expect(view.result.current.reservationStatus).toBe("quoted");
  });

  it("discards an exact pre-quote accommodation reference when no journal exists", () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.load).mockReturnValue({ status: "missing" });

    const view = renderCommand({ flowHandle: handle, workflow });

    expect(view.onFlowHandleChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(view.result.current.reservationStatus).toBe("idle");
    expect(view.result.current.quoteSnapshot).toBeNull();
    expect(view.onError).toHaveBeenLastCalledWith(null);
  });

  it("locks an exact pre-quote reference when safe history cleanup cannot be published", () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.load).mockReturnValue({ status: "missing" });

    const view = renderCommand({
      flowHandle: handle,
      flowHandleChangeResult: false,
      workflow,
    });

    expect(view.onFlowHandleChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(view.result.current.reservationStatus).toBe("locked");
    expect(view.result.current.quoteSnapshot).toBeNull();
    expect(view.onError).toHaveBeenLastCalledWith(
      "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.",
    );
  });

  it("publishes a promoted reservation locator before exposing crash recovery", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle: paymentHandle,
      snapshot: paymentSnapshot,
    });

    const view = renderCommand({ flowHandle: handle, workflow });

    expect(view.onFlowHandleChange).toHaveBeenCalledExactlyOnceWith(
      paymentHandle,
    );
    expect(view.onFlowHandleChange.mock.invocationCallOrder[0]).toBeLessThan(
      view.onError.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(view.result.current.quoteSnapshot).toEqual(paymentSnapshot);

    await act(async () => void (await view.result.current.startReservation()));
    expect(view.onOpenPayment).toHaveBeenCalledWith(
      paymentHandle,
      paymentSnapshot,
    );
  });

  it("does not expose a promoted journal when the reservation handle publication fails", () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle: paymentHandle,
      snapshot: paymentSnapshot,
    });

    const view = renderCommand({
      flowHandle: handle,
      flowHandleChangeResult: false,
      workflow,
    });

    expect(view.onFlowHandleChange).toHaveBeenCalledExactlyOnceWith(
      paymentHandle,
    );
    expect(view.result.current.reservationStatus).toBe("locked");
    expect(view.result.current.quoteSnapshot).toBeNull();
    expect(view.onOpenPayment).not.toHaveBeenCalled();
    expect(view.onError).toHaveBeenLastCalledWith(
      "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.",
    );
  });

  it("fails closed when the pre-network quote handle cannot be published", async () => {
    const workflow = createWorkflow();
    vi.mocked(workflow.quote).mockImplementation(async (input) => {
      if (!input.publishPreparedHandle(handle)) {
        return { status: "blocked", reason: "persistence-unavailable" };
      }
      return { status: "quoted", handle, snapshot: quoteSnapshot };
    });
    const view = renderCommand({
      flowHandleChangeResult: false,
      workflow,
    });

    await act(async () => void (await view.result.current.startReservation()));

    expect(view.onFlowHandleChange).toHaveBeenCalledExactlyOnceWith(handle);
    expect(view.result.current.reservationStatus).toBe("locked");
    expect(view.result.current.quoteSnapshot).toBeNull();
    expect(view.onError).toHaveBeenLastCalledWith(
      "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.",
    );
  });

  it("rejects a quoted result that was never durably published to history", async () => {
    const workflow = createWorkflow();
    const view = renderCommand({
      flowHandleChangeResult: false,
      workflow,
    });

    await act(async () => void (await view.result.current.startReservation()));

    expect(view.onFlowHandleChange).toHaveBeenCalledExactlyOnceWith(handle);
    expect(view.result.current.reservationStatus).toBe("locked");
    expect(view.result.current.quoteSnapshot).toBeNull();
    expect(view.onError).toHaveBeenLastCalledWith(
      "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.",
    );
  });

  it("does not open Toss when checkout reservation authority cannot be published", async () => {
    const workflow = createWorkflow();
    const view = renderCommand({ workflow });
    await act(async () => void (await view.result.current.startReservation()));
    view.onFlowHandleChange.mockReturnValue(false);

    await act(async () => void (await view.result.current.startReservation()));

    expect(view.onFlowHandleChange).toHaveBeenLastCalledWith(paymentHandle);
    expect(view.result.current.reservationStatus).toBe("locked");
    expect(view.onOpenPayment).not.toHaveBeenCalled();
    expect(view.onError).toHaveBeenLastCalledWith(
      "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.",
    );
  });

  it("replays a reloaded journal without reconstructing authority from client defaults", async () => {
    const workflow = createWorkflow();
    const restoredSnapshot = {
      ...quoteSnapshot,
      checkIn: "2026-08-10",
      checkOut: "2026-08-13",
      nights: 3,
      subtotal: 300000,
      amount: 300000,
    };
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle,
      snapshot: restoredSnapshot,
    });
    const view = renderCommand({ flowHandle: handle, workflow });

    await act(async () => void (await view.result.current.startReservation()));

    expect(workflow.checkout).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
  });

  it("blocks a new quote while the app recovery fence is active", async () => {
    const view = renderCommand({ isRecoveryBlocked: true });

    await act(async () => void (await view.result.current.startReservation()));

    expect(view.workflow.quote).not.toHaveBeenCalled();
    expect(view.result.current.isReservationLocked).toBe(true);
    expect(view.onError).toHaveBeenCalledWith(
      "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.",
    );
  });

  it("publishes and acknowledges terminal reservation state before leaving", async () => {
    const workflow = createWorkflow();
    const terminalSnapshot: BookingTransactionSnapshot = {
      ...paymentSnapshot,
      phase: "complimentary-observed",
      amount: 0,
      paymentRequired: false,
      paymentAllowed: false,
      holdExpiresAt: null,
      reservationStatus: "CONFIRMED",
      canPay: false,
      canReleaseHold: false,
    };
    vi.mocked(workflow.checkout).mockResolvedValue({
      status: "complimentary",
      handle: paymentHandle,
      snapshot: terminalSnapshot,
    });
    const view = renderCommand({ workflow });
    await act(async () => void (await view.result.current.startReservation()));

    await act(async () => void (await view.result.current.startReservation()));

    await waitFor(() =>
      expect(view.onTerminalReservation).toHaveBeenCalledWith(
        paymentHandle,
        terminalSnapshot,
        expect.any(Object),
      ),
    );
    expect(view.onFlowHandleChange).toHaveBeenLastCalledWith(paymentHandle);
    expect(
      view.onFlowHandleChange.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(
      view.onTerminalReservation.mock.invocationCallOrder[0] ??
        Number.MAX_SAFE_INTEGER,
    );
  });

  it("publishes a reservation-status handle before terminal completion", async () => {
    const workflow = createWorkflow();
    const terminalSnapshot: BookingTransactionSnapshot = {
      ...paymentSnapshot,
      phase: "reservation-status-observed",
      reservationStatus: "EXPIRED",
      paymentAllowed: false,
      holdExpiresAt: null,
      canPay: false,
      canReleaseHold: false,
    };
    vi.mocked(workflow.checkout).mockResolvedValue({
      status: "reservation-status",
      handle: paymentHandle,
      snapshot: terminalSnapshot,
    });
    const view = renderCommand({ workflow });

    await act(async () => void (await view.result.current.startReservation()));
    await act(async () => void (await view.result.current.startReservation()));

    expect(view.onFlowHandleChange).toHaveBeenLastCalledWith(paymentHandle);
    expect(
      view.onFlowHandleChange.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(
      view.onTerminalReservation.mock.invocationCallOrder[0] ??
        Number.MAX_SAFE_INTEGER,
    );
  });

  it("keeps a reloaded terminal journal explicitly completable", async () => {
    const workflow = createWorkflow();
    const terminalSnapshot: BookingTransactionSnapshot = {
      ...paymentSnapshot,
      phase: "reservation-status-observed",
      reservationStatus: "EXPIRED",
      paymentAllowed: false,
      holdExpiresAt: null,
      canPay: false,
      canReleaseHold: false,
    };
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle: paymentHandle,
      snapshot: terminalSnapshot,
    });
    const view = renderCommand({ flowHandle: paymentHandle, workflow });

    expect(view.result.current.reservationStatus).toBe("terminal-ready");
    expect(view.result.current.isReserving).toBe(false);

    await act(async () => void (await view.result.current.startReservation()));
    expect(view.onTerminalReservation).toHaveBeenCalledWith(
      paymentHandle,
      terminalSnapshot,
      expect.any(Object),
    );
  });

  it("keeps a terminal journal retryable when reservation publication fails", async () => {
    const workflow = createWorkflow();
    const terminalSnapshot: BookingTransactionSnapshot = {
      ...paymentSnapshot,
      phase: "reservation-status-observed",
      reservationStatus: "EXPIRED",
      paymentAllowed: false,
      holdExpiresAt: null,
      canPay: false,
      canReleaseHold: false,
    };
    vi.mocked(workflow.load).mockReturnValue({
      status: "ready",
      handle: paymentHandle,
      snapshot: terminalSnapshot,
    });
    const view = renderCommand({ flowHandle: paymentHandle, workflow });
    view.onTerminalReservation.mockResolvedValue(false);

    await act(async () => void (await view.result.current.startReservation()));

    expect(view.result.current.reservationStatus).toBe("terminal-ready");
    expect(view.onError).toHaveBeenLastCalledWith(
      "예약 내역을 갱신하지 못했습니다. 다시 시도해주세요.",
    );
  });
});

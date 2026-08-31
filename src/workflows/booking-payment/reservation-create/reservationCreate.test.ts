import { AppError } from "../../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import type { ReservationReady } from "../../../features/reservations/public";
import {
  createReservationCreateWorkflow,
  type ReservationCheckoutHandoffPreflightResult,
  type ReservationCreateCommandInput,
  type ReservationCreateTransport,
} from "./reservationCreate";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:reservation_a" as SessionSubject,
  epoch: 7,
};

const scopeB: AuthenticatedSessionScope = {
  subject: "subject:reservation_b" as SessionSubject,
  epoch: 8,
};

const reservationReady: ReservationReady = {
  reservationUid: "reservation-123",
  orderName: "합정 테스트 숙소 2박",
  amount: 190000,
  customerEmail: "guest@example.invalid",
  customerName: "테스트 게스트",
};

const baseInput = (): ReservationCreateCommandInput => ({
  intent: {
    type: "reservation.start",
    accommodationId: 7,
    checkIn: "2026-07-10",
    checkOut: "2026-07-12",
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
    petCount: 0,
    couponId: null,
  },
  accommodation: {
    id: 7,
    maxOccupancy: 4,
    maxInfants: 1,
    maxPets: 1,
    unavailableDates: [],
  },
  appliedCoupon: null,
  routeLease: { isCurrent: () => true },
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
};

const setup = ({
  activeScope = scopeA as AuthenticatedSessionScope | null,
  create = vi.fn().mockResolvedValue(reservationReady),
} = {}) => {
  let currentScope = activeScope;
  let routeCurrent = true;
  const transport: ReservationCreateTransport = { create };
  const handoff = {
    preflight: vi.fn((): ReservationCheckoutHandoffPreflightResult => ({
      status: "ready",
    })),
    commit: vi.fn(),
  };
  const session = {
    captureAuthenticatedSession: vi.fn(() => currentScope),
    isCurrentSession: vi.fn(
      (scope: AuthenticatedSessionScope) =>
        currentScope?.subject === scope.subject &&
        currentScope.epoch === scope.epoch,
    ),
  };
  const workflow = createReservationCreateWorkflow({
    handoff,
    session,
    transport,
  });
  const input = (): ReservationCreateCommandInput => ({
    ...baseInput(),
    routeLease: { isCurrent: () => routeCurrent },
  });

  return {
    create,
    handoff,
    input,
    setCurrentScope: (scope: AuthenticatedSessionScope | null) => {
      currentScope = scope;
    },
    setRouteCurrent: (current: boolean) => {
      routeCurrent = current;
    },
    workflow,
  };
};

describe("reservation create workflow", () => {
  it.each([
    [
      "calendar date",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        intent: { ...input.intent, checkIn: "2026-02-30" },
      }),
      "INVALID_DATE",
    ],
    [
      "date ordering",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        intent: { ...input.intent, checkOut: "2026-07-10" },
      }),
      "INVALID_DATE_RANGE",
    ],
    [
      "availability",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        accommodation: {
          ...input.accommodation,
          unavailableDates: ["2026-07-11"],
        },
      }),
      "UNAVAILABLE_DATE",
    ],
    [
      "accommodation identity",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        accommodation: { ...input.accommodation, id: 8 },
      }),
      "INVALID_ACCOMMODATION",
    ],
    [
      "adult and child occupancy",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        intent: { ...input.intent, adultCount: 4, childCount: 1 },
      }),
      "INVALID_OCCUPANCY",
    ],
    [
      "infant occupancy",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        intent: { ...input.intent, infantCount: 2 },
      }),
      "INVALID_OCCUPANCY",
    ],
    [
      "pet occupancy",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        intent: { ...input.intent, petCount: 2 },
      }),
      "INVALID_OCCUPANCY",
    ],
    [
      "coupon identity",
      (input: ReservationCreateCommandInput) => ({
        ...input,
        intent: { ...input.intent, couponId: 31 },
        appliedCoupon: { id: 32, name: "만원 쿠폰", discount: 10000 },
      }),
      "INVALID_COUPON",
    ],
  ])(
    "rejects invalid %s without sending a POST",
    async (_name, mutate, code) => {
      const { create, handoff, input, workflow } = setup();

      await expect(workflow.start(mutate(input()))).resolves.toMatchObject({
        status: "invalid",
        error: { code },
      });
      expect(create).not.toHaveBeenCalled();
      expect(handoff.commit).not.toHaveBeenCalled();
    },
  );

  it("returns an exact immutable auth intent when no session is authenticated", async () => {
    const { create, handoff, input, workflow } = setup({ activeScope: null });
    const command = input();
    const pending = workflow.start(command);
    (command.intent as { adultCount: number }).adultCount = 4;

    const result = await pending;

    expect(result).toEqual({
      status: "auth-required",
      intent: {
        type: "reservation.start",
        accommodationId: 7,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultCount: 2,
        childCount: 1,
        infantCount: 0,
        petCount: 0,
        couponId: null,
      },
    });
    expect(
      result.status === "auth-required" && Object.isFrozen(result.intent),
    ).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("blocks reservation creation before POST when payment recovery is active", async () => {
    const { create, handoff, input, workflow } = setup();
    handoff.preflight.mockReturnValue({
      status: "payment-recovery-required",
    });

    await expect(workflow.start(input())).resolves.toEqual({
      status: "payment-recovery-required",
    });

    expect(handoff.preflight).toHaveBeenCalledWith({
      session: scopeA,
      intent: expect.objectContaining({ accommodationId: 7 }),
    });
    expect(create).not.toHaveBeenCalled();
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("fails closed before POST when active payment state cannot be inspected", async () => {
    const { create, handoff, input, workflow } = setup();
    handoff.preflight.mockReturnValue({ status: "blocked" });

    await expect(workflow.start(input())).resolves.toEqual({
      status: "checkout-blocked",
    });
    expect(create).not.toHaveBeenCalled();
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("creates once and commits the immutable checkout handoff while current", async () => {
    const { create, handoff, input, workflow } = setup();
    const initialCommand = input();
    const command: ReservationCreateCommandInput = {
      ...initialCommand,
      intent: {
        ...initialCommand.intent,
        couponId: 31,
      },
      appliedCoupon: {
        id: 31,
        name: "만원 쿠폰",
        discount: 10000,
      },
    };

    await expect(workflow.start(command)).resolves.toMatchObject({
      status: "handed-off",
      reservation: reservationReady,
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      {
        accommodationId: 7,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        guestCount: 3,
        couponId: 31,
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(handoff.commit).toHaveBeenCalledWith({
      session: scopeA,
      reservation: reservationReady,
      intent: expect.objectContaining({ adultCount: 2, couponId: 31 }),
      appliedCoupon: {
        id: 31,
        name: "만원 쿠폰",
        discount: 10000,
      },
    });
  });

  it("snapshots an authenticated command before the transport microtask starts", async () => {
    const { create, input, workflow } = setup();
    const command = input();
    const pending = workflow.start(command);
    (command.intent as { checkIn: string; adultCount: number }).checkIn =
      "2026-08-01";
    (command.intent as { checkIn: string; adultCount: number }).adultCount = 4;

    await pending;

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        checkIn: "2026-07-10",
        guestCount: 3,
      }),
      expect.any(Object),
    );
  });

  it("does not start a request when the exact route lease is already stale", async () => {
    const { create, handoff, input, setRouteCurrent, workflow } = setup();
    setRouteCurrent(false);

    await expect(workflow.start(input())).resolves.toEqual({ status: "stale" });

    expect(create).not.toHaveBeenCalled();
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("does not start a request with a captured session that is no longer current", async () => {
    const create = vi.fn().mockResolvedValue(reservationReady);
    const handoff = {
      preflight: vi.fn((): ReservationCheckoutHandoffPreflightResult => ({
        status: "ready",
      })),
      commit: vi.fn(),
    };
    const workflow = createReservationCreateWorkflow({
      transport: { create },
      handoff,
      session: {
        captureAuthenticatedSession: () => scopeA,
        isCurrentSession: () => false,
      },
    });

    await expect(workflow.start(baseInput())).resolves.toEqual({
      status: "stale",
    });

    expect(create).not.toHaveBeenCalled();
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("shares the same active promise for same-tick duplicate starts", async () => {
    const deferred = createDeferred<ReservationReady>();
    const create = vi.fn().mockReturnValue(deferred.promise);
    const { handoff, input, workflow } = setup({ create });

    const first = workflow.start(input());
    const duplicate = workflow.start(input());

    expect(duplicate).toBe(first);
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1);

    deferred.resolve(reservationReady);
    await expect(first).resolves.toMatchObject({ status: "handed-off" });
    expect(handoff.commit).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful workflow terminally locked after handoff", async () => {
    const { create, handoff, input, workflow } = setup();

    await workflow.start(input());

    await expect(workflow.start(input())).resolves.toEqual({
      status: "locked",
      terminal: "handed-off",
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(handoff.commit).toHaveBeenCalledTimes(1);
  });

  it("discards a late success after the exact route lease becomes stale", async () => {
    const deferred = createDeferred<ReservationReady>();
    const { handoff, input, setRouteCurrent, workflow } = setup({
      create: vi.fn().mockReturnValue(deferred.promise),
    });
    const pending = workflow.start(input());
    await Promise.resolve();

    setRouteCurrent(false);
    deferred.resolve(reservationReady);

    await expect(pending).resolves.toEqual({ status: "stale" });
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("rechecks the route lease immediately before committing the handoff", async () => {
    const routeChecks = [true, true, true, true, false];
    const { handoff, input, workflow } = setup();
    const command: ReservationCreateCommandInput = {
      ...input(),
      routeLease: {
        isCurrent: () => routeChecks.shift() ?? false,
      },
    };

    await expect(workflow.start(command)).resolves.toEqual({ status: "stale" });
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("discards a late success after the authenticated session changes", async () => {
    const deferred = createDeferred<ReservationReady>();
    const { handoff, input, setCurrentScope, workflow } = setup({
      create: vi.fn().mockReturnValue(deferred.promise),
    });
    const pending = workflow.start(input());
    await Promise.resolve();

    setCurrentScope(scopeB);
    deferred.resolve(reservationReady);

    await expect(pending).resolves.toEqual({ status: "stale" });
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it("aborts and discards an active request when disposed", async () => {
    let capturedSignal: AbortSignal | undefined;
    const deferred = createDeferred<ReservationReady>();
    const create = vi.fn(
      (_input, options: { readonly signal: AbortSignal }) => {
        capturedSignal = options.signal;
        return deferred.promise;
      },
    );
    const { handoff, input, workflow } = setup({ create });
    const pending = workflow.start(input());
    await Promise.resolve();

    workflow.dispose();
    expect(capturedSignal?.aborted).toBe(true);
    deferred.resolve(reservationReady);

    await expect(pending).resolves.toEqual({ status: "stale" });
    expect(handoff.commit).not.toHaveBeenCalled();
    await expect(workflow.start(input())).resolves.toEqual({
      status: "locked",
      terminal: "disposed",
    });
  });

  it("unlocks after an authoritative definitive failure", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new AppError({
          kind: "conflict",
          code: "R002",
          message: "The request conflicts with the current state.",
          status: 409,
        }),
      )
      .mockResolvedValueOnce(reservationReady);
    const { handoff, input, workflow } = setup({ create });

    await expect(workflow.start(input())).resolves.toMatchObject({
      status: "definitive-failure",
      error: { code: "R002" },
    });
    await expect(workflow.start(input())).resolves.toMatchObject({
      status: "handed-off",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(handoff.commit).toHaveBeenCalledTimes(1);
  });

  it("locks an ambiguous transport outcome instead of blindly retrying", async () => {
    const networkError = new AppError({
      kind: "network",
      code: "NETWORK_ERROR",
      message: "The network request failed.",
      retryable: true,
    });
    const create = vi.fn().mockRejectedValue(networkError);
    const { handoff, input, workflow } = setup({ create });

    await expect(workflow.start(input())).resolves.toEqual({
      status: "ambiguous",
      error: networkError,
    });
    await expect(workflow.start(input())).resolves.toEqual({
      status: "locked",
      terminal: "ambiguous",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(handoff.commit).not.toHaveBeenCalled();
  });

  it.each(["", "../admin"])(
    "terminal-locks a malformed response UID after the reservation POST succeeds: %s",
    async (reservationUid) => {
      const create = vi.fn().mockResolvedValue({
        ...reservationReady,
        reservationUid,
      });
      const { handoff, input, workflow } = setup({ create });

      await expect(workflow.start(input())).resolves.toMatchObject({
        status: "ambiguous",
        error: expect.any(TypeError),
      });
      await expect(workflow.start(input())).resolves.toEqual({
        status: "locked",
        terminal: "ambiguous",
      });

      expect(create).toHaveBeenCalledTimes(1);
      expect(handoff.commit).not.toHaveBeenCalled();
    },
  );

  it("terminal-locks a throwing checkout handoff after one successful POST", async () => {
    const handoffError = new Error("checkout handoff failed");
    const { create, handoff, input, workflow } = setup();
    handoff.commit.mockImplementation(() => {
      throw handoffError;
    });

    await expect(workflow.start(input())).resolves.toEqual({
      status: "ambiguous",
      error: handoffError,
    });
    await expect(workflow.start(input())).resolves.toEqual({
      status: "locked",
      terminal: "ambiguous",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(handoff.commit).toHaveBeenCalledTimes(1);
  });

  it("does not publish even a definitive failure after route departure", async () => {
    const deferred = createDeferred<ReservationReady>();
    const { input, setRouteCurrent, workflow } = setup({
      create: vi.fn().mockReturnValue(deferred.promise),
    });
    const pending = workflow.start(input());
    await Promise.resolve();

    setRouteCurrent(false);
    deferred.reject(
      new AppError({
        kind: "conflict",
        code: "R002",
        message: "The request conflicts with the current state.",
      }),
    );

    await expect(pending).resolves.toEqual({ status: "stale" });
  });
});

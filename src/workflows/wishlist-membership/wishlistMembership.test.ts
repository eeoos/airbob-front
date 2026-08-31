import type { Mocked } from "vitest";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import {
  createWishlistMembership,
  type WishlistMembershipDependencies,
  type WishlistMembershipPage,
  type WishlistMembershipProjection,
  type WishlistMembershipTransport,
} from "./wishlistMembership";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:member_b" as SessionSubject,
  epoch: 4,
};

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const membershipPage = ({
  contained = false,
  hasNext = false,
  nextCursor = null,
  wishlistId = 11,
}: {
  contained?: boolean;
  hasNext?: boolean;
  nextCursor?: string | null;
  wishlistId?: number;
} = {}): WishlistMembershipPage => ({
  wishlists: [{ id: wishlistId, isContained: contained }],
  pageInfo: { hasNext, nextCursor },
});

const createTransport = (): Mocked<WishlistMembershipTransport> => ({
  addAccommodation: vi.fn().mockResolvedValue({ id: 101 }),
  createWishlist: vi.fn().mockResolvedValue({ id: 11 }),
  deleteWishlist: vi.fn().mockResolvedValue(undefined),
  getAccommodationMembership: vi
    .fn()
    .mockResolvedValue(membershipPage({ contained: true })),
  removeAccommodation: vi.fn().mockResolvedValue(undefined),
  removeRecentlyViewed: vi.fn().mockResolvedValue(undefined),
  saveMemo: vi.fn().mockResolvedValue(undefined),
});

const createProjection = (): Mocked<WishlistMembershipProjection> => ({
  membershipReconciled: vi.fn(),
  membershipRefreshRequired: vi.fn(),
  memoSaved: vi.fn(),
  recentlyViewedRemoved: vi.fn(),
  wishlistCreated: vi.fn(),
  wishlistDeleted: vi.fn(),
});

const setup = (initialScope: AuthenticatedSessionScope | null = scopeA) => {
  let activeScope = initialScope;
  const transport = createTransport();
  const projection = createProjection();
  const dependencies: WishlistMembershipDependencies = {
    projection,
    session: {
      captureAuthenticatedSession: () => activeScope,
      isCurrentSession: (candidate) =>
        activeScope?.subject === candidate.subject &&
        activeScope.epoch === candidate.epoch,
    },
    transport,
  };
  const commands = createWishlistMembership(dependencies);

  return {
    commands,
    projection,
    setScope: (scope: AuthenticatedSessionScope | null) => {
      activeScope = scope;
    },
    transport,
  };
};

describe("wishlistMembership", () => {
  it("joins duplicate target commands into one mutation and one reconciliation", async () => {
    const { commands, projection, transport } = setup();

    const first = commands.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });
    const second = commands.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({
      status: "applied",
      isInAnyWishlist: true,
    });
    expect(transport.addAccommodation).toHaveBeenCalledTimes(1);
    expect(transport.getAccommodationMembership).toHaveBeenCalledTimes(1);
    expect(projection.membershipReconciled).toHaveBeenCalledTimes(1);
  });

  it("does not issue create-and-add's second mutation after an A to B switch", async () => {
    const { commands, projection, setScope, transport } = setup();
    const createRequest = deferred<{ id: number }>();
    transport.createWishlist.mockReturnValueOnce(createRequest.promise);

    const result = commands.createAndAddAccommodation({
      accommodationId: 7,
      name: "여름 여행",
    });
    setScope(scopeB);
    createRequest.resolve({ id: 91 });

    await expect(result).resolves.toEqual({ status: "stale" });
    expect(transport.addAccommodation).not.toHaveBeenCalled();
    expect(projection.wishlistCreated).not.toHaveBeenCalled();
  });

  it("suppresses an old subject's late mutation completion before cache projection", async () => {
    const { commands, projection, setScope, transport } = setup();
    const addRequest = deferred<{ id: number }>();
    transport.addAccommodation.mockReturnValueOnce(addRequest.promise);

    const result = commands.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });
    setScope(scopeB);
    addRequest.resolve({ id: 101 });

    await expect(result).resolves.toEqual({ status: "stale" });
    expect(transport.getAccommodationMembership).not.toHaveBeenCalled();
    expect(projection.membershipReconciled).not.toHaveBeenCalled();
  });

  it("lets a new epoch run the same target independently while the old epoch is pending", async () => {
    const { commands, projection, setScope, transport } = setup();
    const oldAddRequest = deferred<{ id: number }>();
    const nextEpoch: AuthenticatedSessionScope = {
      subject: scopeA.subject,
      epoch: scopeA.epoch + 1,
    };
    transport.addAccommodation
      .mockReturnValueOnce(oldAddRequest.promise)
      .mockResolvedValueOnce({ id: 202 });

    const oldResult = commands.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });
    setScope(nextEpoch);
    const currentResult = commands.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });

    expect(currentResult).not.toBe(oldResult);
    await expect(currentResult).resolves.toEqual({
      status: "applied",
      isInAnyWishlist: true,
    });
    oldAddRequest.resolve({ id: 101 });
    await expect(oldResult).resolves.toEqual({ status: "stale" });

    expect(transport.addAccommodation).toHaveBeenCalledTimes(2);
    expect(projection.membershipReconciled).toHaveBeenCalledTimes(1);
    expect(projection.membershipReconciled).toHaveBeenCalledWith({
      scope: nextEpoch,
      accommodationId: 7,
      isInAnyWishlist: true,
    });
  });

  it("derives multi-list membership from every server page after removal", async () => {
    const { commands, projection, transport } = setup();
    transport.getAccommodationMembership
      .mockResolvedValueOnce(
        membershipPage({ hasNext: true, nextCursor: "next" }),
      )
      .mockResolvedValueOnce(membershipPage({ contained: true }));

    await expect(
      commands.removeAccommodation({
        accommodationId: 7,
        wishlistAccommodationId: 31,
      }),
    ).resolves.toEqual({ status: "applied", isInAnyWishlist: true });

    expect(transport.getAccommodationMembership).toHaveBeenNthCalledWith(
      1,
      { accommodationId: 7, size: 20 },
      expect.any(AbortSignal),
    );
    expect(transport.getAccommodationMembership).toHaveBeenNthCalledWith(
      2,
      { accommodationId: 7, cursor: "next", size: 20 },
      expect.any(AbortSignal),
    );
    expect(projection.membershipReconciled).toHaveBeenCalledWith({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: true,
    });
  });

  it("serializes membership mutations for one accommodation through reconciliation", async () => {
    const { commands, projection, transport } = setup();
    const firstMembership = deferred<WishlistMembershipPage>();
    transport.getAccommodationMembership
      .mockReturnValueOnce(firstMembership.promise)
      .mockResolvedValueOnce(membershipPage({ contained: false }));

    const first = commands.removeAccommodation({
      accommodationId: 7,
      wishlistAccommodationId: 31,
    });
    await Promise.resolve();
    const second = commands.removeAccommodation({
      accommodationId: 7,
      wishlistAccommodationId: 32,
    });

    expect(transport.removeAccommodation).toHaveBeenCalledTimes(1);
    firstMembership.resolve(membershipPage({ contained: true }));
    await expect(first).resolves.toEqual({
      status: "applied",
      isInAnyWishlist: true,
    });
    await expect(second).resolves.toEqual({
      status: "applied",
      isInAnyWishlist: false,
    });

    expect(transport.removeAccommodation).toHaveBeenCalledTimes(2);
    expect(projection.membershipReconciled.mock.calls).toEqual([
      [
        {
          scope: scopeA,
          accommodationId: 7,
          isInAnyWishlist: true,
        },
      ],
      [
        {
          scope: scopeA,
          accommodationId: 7,
          isInAnyWishlist: false,
        },
      ],
    ]);
  });

  it("retries add with the already-created wishlist after a partial failure", async () => {
    const { commands, projection, transport } = setup();
    const addError = new Error("add failed");
    transport.addAccommodation
      .mockRejectedValueOnce(addError)
      .mockResolvedValueOnce({ id: 101 });
    transport.getAccommodationMembership
      .mockResolvedValueOnce(membershipPage({ contained: false }))
      .mockResolvedValueOnce(membershipPage({ contained: true }));

    await expect(
      commands.createAndAddAccommodation({
        accommodationId: 7,
        name: "여름 여행",
      }),
    ).resolves.toEqual({
      status: "created-only",
      wishlistId: 11,
      error: addError,
    });

    await expect(
      commands.createAndAddAccommodation({
        accommodationId: 7,
        name: " 여름 여행 ",
      }),
    ).resolves.toEqual({
      status: "applied",
      isInAnyWishlist: true,
      wishlistId: 11,
    });

    expect(transport.createWishlist).toHaveBeenCalledTimes(1);
    expect(transport.addAccommodation).toHaveBeenCalledTimes(2);
    expect(projection.wishlistCreated).toHaveBeenCalledTimes(1);
  });

  it("reconciles an ambiguous create-and-add response before retrying the mutation", async () => {
    const { commands, projection, transport } = setup();
    transport.addAccommodation.mockRejectedValueOnce(
      new Error("response lost after apply"),
    );
    transport.getAccommodationMembership.mockResolvedValueOnce(
      membershipPage({ contained: true }),
    );

    await expect(
      commands.createAndAddAccommodation({
        accommodationId: 7,
        name: "여름 여행",
      }),
    ).resolves.toMatchObject({ status: "created-only", wishlistId: 11 });
    await expect(
      commands.createAndAddAccommodation({
        accommodationId: 7,
        name: "여름 여행",
      }),
    ).resolves.toEqual({
      status: "applied",
      isInAnyWishlist: true,
      wishlistId: 11,
    });

    expect(transport.createWishlist).toHaveBeenCalledTimes(1);
    expect(transport.addAccommodation).toHaveBeenCalledTimes(1);
    expect(projection.membershipReconciled).toHaveBeenCalledWith({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: true,
    });
  });

  it("treats reconciliation failure as applied instead of retrying the mutation", async () => {
    const { commands, projection, transport } = setup();
    const refreshError = new Error("refresh failed");
    transport.getAccommodationMembership.mockRejectedValueOnce(refreshError);

    await expect(
      commands.addAccommodation({ accommodationId: 7, wishlistId: 11 }),
    ).resolves.toEqual({
      status: "applied-unconfirmed",
      error: refreshError,
    });
    expect(transport.addAccommodation).toHaveBeenCalledTimes(1);
    expect(projection.membershipRefreshRequired).toHaveBeenCalledWith({
      scope: scopeA,
      accommodationId: 7,
    });
  });

  it("allows clearing a memo to an empty string and single-flights the save", async () => {
    const { commands, projection, transport } = setup();
    const saveRequest = deferred<void>();
    transport.saveMemo.mockReturnValueOnce(saveRequest.promise);

    const first = commands.saveMemo({
      wishlistAccommodationId: 31,
      memo: "",
    });
    const second = commands.saveMemo({
      wishlistAccommodationId: 31,
      memo: "새 값은 pending 중 무시",
    });
    expect(second).toBe(first);
    saveRequest.resolve();

    await expect(first).resolves.toEqual({ status: "applied" });
    expect(transport.saveMemo).toHaveBeenCalledWith(
      31,
      { memo: "" },
      expect.any(AbortSignal),
    );
    expect(projection.memoSaved).toHaveBeenCalledWith({
      scope: scopeA,
      wishlistAccommodationId: 31,
      memo: "",
    });
  });

  it("routes list deletion and recently-viewed removal through their scoped projections", async () => {
    const { commands, projection, transport } = setup();

    await expect(commands.deleteWishlist({ wishlistId: 11 })).resolves.toEqual({
      status: "applied",
    });
    await expect(
      commands.removeRecentlyViewed({ accommodationId: 7 }),
    ).resolves.toEqual({ status: "applied" });

    expect(transport.deleteWishlist).toHaveBeenCalledWith(
      11,
      expect.any(AbortSignal),
    );
    expect(projection.wishlistDeleted).toHaveBeenCalledWith({
      scope: scopeA,
      wishlistId: 11,
    });
    expect(transport.removeRecentlyViewed).toHaveBeenCalledWith(
      7,
      expect.any(AbortSignal),
    );
    expect(projection.recentlyViewedRemoved).toHaveBeenCalledWith({
      scope: scopeA,
      accommodationId: 7,
    });
  });

  it("stops repeated cursors instead of looping forever", async () => {
    const { commands, transport } = setup();
    transport.getAccommodationMembership.mockResolvedValue(
      membershipPage({ hasNext: true, nextCursor: "same" }),
    );

    await expect(
      commands.addAccommodation({ accommodationId: 7, wishlistId: 11 }),
    ).resolves.toEqual({ status: "applied", isInAnyWishlist: false });
    expect(transport.getAccommodationMembership).toHaveBeenCalledTimes(2);
  });

  it("aborts owned work on disposal and suppresses the late completion", async () => {
    const { commands, projection, transport } = setup();
    const request = deferred<{ id: number }>();
    let capturedSignal: AbortSignal | undefined;
    transport.addAccommodation.mockImplementationOnce(
      (_wishlistId, _input, signal) => {
        capturedSignal = signal;
        return request.promise;
      },
    );

    const result = commands.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });
    commands.dispose();
    expect(capturedSignal?.aborted).toBe(true);
    request.resolve({ id: 101 });

    await expect(result).resolves.toEqual({ status: "stale" });
    expect(projection.membershipReconciled).not.toHaveBeenCalled();
  });

  it("rejects commands without an authenticated session before transport", async () => {
    const { commands, transport } = setup(null);

    await expect(
      commands.deleteWishlist({ wishlistId: 11 }),
    ).rejects.toMatchObject({
      code: "AUTHENTICATED_SESSION_REQUIRED",
      kind: "authentication",
    });
    expect(transport.deleteWishlist).not.toHaveBeenCalled();
  });

  it.each([
    [
      "add accommodation id",
      () =>
        setup().commands.addAccommodation({
          accommodationId: 0,
          wishlistId: 11,
        }),
    ],
    [
      "add wishlist id",
      () =>
        setup().commands.addAccommodation({
          accommodationId: 7,
          wishlistId: -1,
        }),
    ],
    [
      "remove item id",
      () =>
        setup().commands.removeAccommodation({
          accommodationId: 7,
          wishlistAccommodationId: Number.NaN,
        }),
    ],
    [
      "delete wishlist id",
      () =>
        setup().commands.deleteWishlist({
          wishlistId: Number.MAX_SAFE_INTEGER + 1,
        }),
    ],
    [
      "memo item id",
      () => setup().commands.saveMemo({ wishlistAccommodationId: 0, memo: "" }),
    ],
    [
      "recently viewed id",
      () => setup().commands.removeRecentlyViewed({ accommodationId: -1 }),
    ],
    [
      "empty wishlist name",
      () =>
        setup().commands.createAndAddAccommodation({
          accommodationId: 7,
          name: "   ",
        }),
    ],
  ])("rejects invalid %s before creating transport work", (_case, command) => {
    expect(command).toThrow(TypeError);
  });
});

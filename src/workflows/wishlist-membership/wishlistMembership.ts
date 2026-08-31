import { AppError } from "../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import type {
  CreateAndAddWishlistCommandResult,
  WishlistMembershipCommandPort,
  WishlistMembershipCommandResult,
  WishlistProjectionPort,
} from "../../features/wishlist/public";

const MEMBERSHIP_PAGE_SIZE = 20;

export interface WishlistMembershipPage {
  readonly wishlists: ReadonlyArray<{
    readonly id: number;
    readonly isContained: boolean | null;
  }>;
  readonly pageInfo: {
    readonly hasNext: boolean;
    readonly nextCursor: string | null;
  };
}

interface WishlistMembershipSnapshot {
  readonly isInAnyWishlist: boolean;
  readonly targetWishlistContains: boolean | null;
  readonly targetWishlistFound: boolean;
}

export interface WishlistMembershipTransport {
  createWishlist(
    input: { readonly name: string },
    signal: AbortSignal,
  ): Promise<{ readonly id: number }>;
  addAccommodation(
    wishlistId: number,
    input: { readonly accommodationId: number },
    signal: AbortSignal,
  ): Promise<{ readonly id: number }>;
  removeAccommodation(
    wishlistAccommodationId: number,
    signal: AbortSignal,
  ): Promise<void>;
  deleteWishlist(wishlistId: number, signal: AbortSignal): Promise<void>;
  saveMemo(
    wishlistAccommodationId: number,
    input: { readonly memo: string },
    signal: AbortSignal,
  ): Promise<void>;
  removeRecentlyViewed(
    accommodationId: number,
    signal: AbortSignal,
  ): Promise<void>;
  getAccommodationMembership(
    input: {
      readonly accommodationId: number;
      readonly cursor?: string;
      readonly size: number;
    },
    signal: AbortSignal,
  ): Promise<WishlistMembershipPage>;
}

export type WishlistMembershipProjection = WishlistProjectionPort;

export interface WishlistMembershipSession {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export type WishlistMembershipMutationResult = WishlistMembershipCommandResult;

export type WishlistCommandResult =
  { readonly status: "applied" } | { readonly status: "stale" };

export type CreateAndAddWishlistResult = CreateAndAddWishlistCommandResult;

export interface WishlistMembershipCommands extends WishlistMembershipCommandPort {
  deleteWishlist(input: {
    readonly wishlistId: number;
  }): Promise<WishlistCommandResult>;
  saveMemo(input: {
    readonly wishlistAccommodationId: number;
    readonly memo: string;
  }): Promise<WishlistCommandResult>;
  removeRecentlyViewed(input: {
    readonly accommodationId: number;
  }): Promise<WishlistCommandResult>;
  dispose(): void;
}

export interface WishlistMembershipDependencies {
  readonly projection: WishlistMembershipProjection;
  readonly session: WishlistMembershipSession;
  readonly transport: WishlistMembershipTransport;
}

const staleResult = { status: "stale" } as const;
const appliedResult = { status: "applied" } as const;

const createAuthenticationRequiredError = () =>
  new AppError({
    kind: "authentication",
    code: "AUTHENTICATED_SESSION_REQUIRED",
    message: "An authenticated session is required.",
  });

const commandKey = (scope: AuthenticatedSessionScope, operation: string) =>
  `${scope.subject}:${scope.epoch}:${operation}`;

const isPositiveSafeInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

const requirePositiveId = (name: string, value: number) => {
  if (!isPositiveSafeInteger(value)) {
    throw new TypeError(`${name} must be a positive safe integer.`);
  }
};

export function createWishlistMembership(
  dependencies: WishlistMembershipDependencies,
): WishlistMembershipCommands {
  const pending = new Map<string, Promise<unknown>>();
  const laneTails = new Map<string, Promise<void>>();
  const controllers = new Set<AbortController>();
  const createdWishlistIds = new Map<string, number>();
  let disposed = false;

  const isCurrent = (scope: AuthenticatedSessionScope) =>
    !disposed && dependencies.session.isCurrentSession(scope);

  const run = <T>(
    operation: string,
    execute: (
      scope: AuthenticatedSessionScope,
      signal: AbortSignal,
    ) => Promise<T>,
    lane?: string,
  ): Promise<T | { readonly status: "stale" }> => {
    if (disposed) {
      return Promise.resolve(staleResult);
    }

    const scope = dependencies.session.captureAuthenticatedSession();
    if (scope === null) {
      return Promise.reject(createAuthenticationRequiredError());
    }

    const key = commandKey(scope, operation);
    const existing = pending.get(key) as
      Promise<T | { readonly status: "stale" }> | undefined;
    if (existing) return existing;

    const controller = new AbortController();
    controllers.add(controller);

    const executeCurrentCommand = async () => {
      if (!isCurrent(scope)) return staleResult;

      try {
        return await execute(scope, controller.signal);
      } catch (error) {
        if (!isCurrent(scope) || controller.signal.aborted) {
          return staleResult;
        }
        throw error;
      }
    };
    const laneKey = lane ? commandKey(scope, `lane:${lane}`) : null;
    const previousLane = laneKey ? laneTails.get(laneKey) : undefined;
    const promise = (
      previousLane
        ? previousLane.then(executeCurrentCommand)
        : executeCurrentCommand()
    ).finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
      controllers.delete(controller);
    });

    pending.set(key, promise);
    if (laneKey) {
      const tail = promise.then(
        () => undefined,
        () => undefined,
      );
      laneTails.set(laneKey, tail);
      void tail.then(() => {
        if (laneTails.get(laneKey) === tail) laneTails.delete(laneKey);
      });
    }
    return promise;
  };

  const resolveMembership = async (
    scope: AuthenticatedSessionScope,
    accommodationId: number,
    signal: AbortSignal,
    targetWishlistId?: number,
  ): Promise<WishlistMembershipSnapshot | null> => {
    let cursor: string | undefined;
    const visitedCursors = new Set<string>();
    let isInAnyWishlist = false;
    let targetWishlistContains: boolean | null = null;
    let targetWishlistFound = false;

    while (true) {
      if (!isCurrent(scope)) return null;

      const page = await dependencies.transport.getAccommodationMembership(
        {
          accommodationId,
          ...(cursor ? { cursor } : {}),
          size: MEMBERSHIP_PAGE_SIZE,
        },
        signal,
      );

      if (!isCurrent(scope)) return null;
      isInAnyWishlist ||= page.wishlists.some(
        (wishlist) => wishlist.isContained === true,
      );
      if (targetWishlistId !== undefined) {
        const targetWishlist = page.wishlists.find(
          (wishlist) => wishlist.id === targetWishlistId,
        );
        if (targetWishlist) {
          targetWishlistFound = true;
          targetWishlistContains = targetWishlist.isContained;
        }
      }

      const nextCursor = page.pageInfo.nextCursor;
      if (
        !page.pageInfo.hasNext ||
        nextCursor === null ||
        visitedCursors.has(nextCursor)
      ) {
        return {
          isInAnyWishlist,
          targetWishlistContains,
          targetWishlistFound,
        };
      }

      visitedCursors.add(nextCursor);
      cursor = nextCursor;
    }
  };

  const reconcileMembership = async (
    scope: AuthenticatedSessionScope,
    accommodationId: number,
    signal: AbortSignal,
  ): Promise<WishlistMembershipMutationResult> => {
    try {
      const membership = await resolveMembership(
        scope,
        accommodationId,
        signal,
      );

      if (membership === null || !isCurrent(scope)) return staleResult;

      dependencies.projection.membershipReconciled({
        scope,
        accommodationId,
        isInAnyWishlist: membership.isInAnyWishlist,
      });
      return {
        status: "applied",
        isInAnyWishlist: membership.isInAnyWishlist,
      };
    } catch (error) {
      if (!isCurrent(scope) || signal.aborted) return staleResult;

      dependencies.projection.membershipRefreshRequired({
        scope,
        accommodationId,
      });
      return { status: "applied-unconfirmed", error };
    }
  };

  const addAccommodation = ({
    accommodationId,
    wishlistId,
  }: {
    readonly accommodationId: number;
    readonly wishlistId: number;
  }) => {
    requirePositiveId("accommodationId", accommodationId);
    requirePositiveId("wishlistId", wishlistId);

    return run(
      `add:${accommodationId}:${wishlistId}`,
      async (scope, signal) => {
        await dependencies.transport.addAccommodation(
          wishlistId,
          { accommodationId },
          signal,
        );
        if (!isCurrent(scope)) return staleResult;
        return reconcileMembership(scope, accommodationId, signal);
      },
      `membership:${accommodationId}`,
    ) as Promise<WishlistMembershipMutationResult>;
  };

  const removeAccommodation = ({
    accommodationId,
    wishlistAccommodationId,
  }: {
    readonly accommodationId: number;
    readonly wishlistAccommodationId: number;
  }) => {
    requirePositiveId("accommodationId", accommodationId);
    requirePositiveId("wishlistAccommodationId", wishlistAccommodationId);

    return run(
      `remove:${wishlistAccommodationId}`,
      async (scope, signal) => {
        await dependencies.transport.removeAccommodation(
          wishlistAccommodationId,
          signal,
        );
        if (!isCurrent(scope)) return staleResult;
        return reconcileMembership(scope, accommodationId, signal);
      },
      `membership:${accommodationId}`,
    ) as Promise<WishlistMembershipMutationResult>;
  };

  const createAndAddAccommodation = ({
    accommodationId,
    name,
  }: {
    readonly accommodationId: number;
    readonly name: string;
  }) => {
    requirePositiveId("accommodationId", accommodationId);
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new TypeError("name must not be empty.");
    }

    return run(
      `create-and-add:${accommodationId}:${normalizedName}`,
      async (scope, signal): Promise<CreateAndAddWishlistResult> => {
        const partialKey = commandKey(
          scope,
          `created:${accommodationId}:${normalizedName}`,
        );
        let wishlistId = createdWishlistIds.get(partialKey);

        if (wishlistId !== undefined) {
          const existingWishlistId = wishlistId;
          try {
            const membership = await resolveMembership(
              scope,
              accommodationId,
              signal,
              existingWishlistId,
            );
            if (membership === null || !isCurrent(scope)) return staleResult;

            if (membership.targetWishlistContains === true) {
              createdWishlistIds.delete(partialKey);
              dependencies.projection.membershipReconciled({
                scope,
                accommodationId,
                isInAnyWishlist: membership.isInAnyWishlist,
              });
              return {
                status: "applied",
                isInAnyWishlist: membership.isInAnyWishlist,
                wishlistId: existingWishlistId,
              };
            }

            if (!membership.targetWishlistFound) {
              createdWishlistIds.delete(partialKey);
              wishlistId = undefined;
            }
          } catch (error) {
            if (!isCurrent(scope) || signal.aborted) return staleResult;
            dependencies.projection.membershipRefreshRequired({
              scope,
              accommodationId,
            });
            return {
              status: "created-only",
              wishlistId: existingWishlistId,
              error,
            };
          }
        }

        if (wishlistId === undefined) {
          const created = await dependencies.transport.createWishlist(
            { name: normalizedName },
            signal,
          );
          if (!isCurrent(scope)) return staleResult;
          wishlistId = created.id;
          createdWishlistIds.set(partialKey, wishlistId);
          dependencies.projection.wishlistCreated({ scope, wishlistId });
        }

        try {
          await dependencies.transport.addAccommodation(
            wishlistId,
            { accommodationId },
            signal,
          );
        } catch (error) {
          if (!isCurrent(scope) || signal.aborted) return staleResult;
          return { status: "created-only", wishlistId, error };
        }

        if (!isCurrent(scope)) return staleResult;
        createdWishlistIds.delete(partialKey);
        const result = await reconcileMembership(
          scope,
          accommodationId,
          signal,
        );
        return { ...result, wishlistId };
      },
      `membership:${accommodationId}`,
    ) as Promise<CreateAndAddWishlistResult>;
  };

  const deleteWishlist = ({ wishlistId }: { readonly wishlistId: number }) => {
    requirePositiveId("wishlistId", wishlistId);

    return run(`delete:${wishlistId}`, async (scope, signal) => {
      await dependencies.transport.deleteWishlist(wishlistId, signal);
      if (!isCurrent(scope)) return staleResult;
      dependencies.projection.wishlistDeleted({ scope, wishlistId });
      return appliedResult;
    }) as Promise<WishlistCommandResult>;
  };

  const saveMemo = ({
    wishlistAccommodationId,
    memo,
  }: {
    readonly wishlistAccommodationId: number;
    readonly memo: string;
  }) => {
    requirePositiveId("wishlistAccommodationId", wishlistAccommodationId);

    return run(`memo:${wishlistAccommodationId}`, async (scope, signal) => {
      await dependencies.transport.saveMemo(
        wishlistAccommodationId,
        { memo },
        signal,
      );
      if (!isCurrent(scope)) return staleResult;
      dependencies.projection.memoSaved({
        scope,
        wishlistAccommodationId,
        memo,
      });
      return appliedResult;
    }) as Promise<WishlistCommandResult>;
  };

  const removeRecentlyViewed = ({
    accommodationId,
  }: {
    readonly accommodationId: number;
  }) => {
    requirePositiveId("accommodationId", accommodationId);

    return run(`recently-viewed:${accommodationId}`, async (scope, signal) => {
      await dependencies.transport.removeRecentlyViewed(
        accommodationId,
        signal,
      );
      if (!isCurrent(scope)) return staleResult;
      dependencies.projection.recentlyViewedRemoved({
        scope,
        accommodationId,
      });
      return appliedResult;
    }) as Promise<WishlistCommandResult>;
  };

  return {
    addAccommodation,
    createAndAddAccommodation,
    deleteWishlist,
    dispose: () => {
      disposed = true;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      pending.clear();
      laneTails.clear();
      createdWishlistIds.clear();
    },
    removeAccommodation,
    removeRecentlyViewed,
    saveMemo,
  };
}

import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { withSessionScopeKey } from "../../../platform/query/sessionScope";

const root = ["wishlist"] as const;

export const wishlistReadQueryKeys = {
  root,
  lists: (scope: AuthenticatedSessionScope, accommodationId: number | null) =>
    withSessionScopeKey(scope, [
      ...root,
      "lists",
      accommodationId,
    ] as const),
  detail: (
    scope: AuthenticatedSessionScope,
    wishlistId: number | null,
  ) =>
    withSessionScopeKey(scope, [
      ...root,
      "detail",
      wishlistId,
    ] as const),
  recentlyViewed: (scope: AuthenticatedSessionScope) =>
    withSessionScopeKey(scope, [...root, "recentlyViewed"] as const),
};

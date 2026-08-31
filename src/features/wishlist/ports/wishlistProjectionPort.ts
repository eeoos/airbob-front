import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";

interface ScopedProjectionOperation {
  readonly scope: AuthenticatedSessionScope;
}

interface MembershipReconciledProjection extends ScopedProjectionOperation {
  readonly accommodationId: number;
  readonly isInAnyWishlist: boolean;
}

interface MembershipRefreshRequiredProjection extends ScopedProjectionOperation {
  readonly accommodationId: number;
}

interface WishlistDeletedProjection extends ScopedProjectionOperation {
  readonly wishlistId: number;
}

interface MemoSavedProjection extends ScopedProjectionOperation {
  readonly wishlistAccommodationId: number;
  readonly memo: string;
}

interface RecentlyViewedRemovedProjection extends ScopedProjectionOperation {
  readonly accommodationId: number;
}

interface WishlistCreatedProjection extends ScopedProjectionOperation {
  readonly wishlistId: number;
}

/**
 * Cache-only projection boundary for wishlist writes. Implementations may
 * reconcile or invalidate cached reads, but never issue mutation I/O.
 */
export interface WishlistProjectionPort {
  membershipReconciled(input: MembershipReconciledProjection): void;
  membershipRefreshRequired(input: MembershipRefreshRequiredProjection): void;
  wishlistDeleted(input: WishlistDeletedProjection): void;
  memoSaved(input: MemoSavedProjection): void;
  recentlyViewedRemoved(input: RecentlyViewedRemovedProjection): void;
  wishlistCreated(input: WishlistCreatedProjection): void;
}

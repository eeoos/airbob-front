import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";

interface AccommodationDetailScopedProjection {
  readonly scope: AuthenticatedSessionScope;
  readonly accommodationId: number;
}

interface AccommodationDetailMembershipReconciled extends AccommodationDetailScopedProjection {
  readonly isInAnyWishlist: boolean;
}

/**
 * Cache-only projection boundary for writes that affect the public
 * accommodation detail resource. Implementations never issue mutation I/O.
 */
export interface AccommodationDetailCacheProjectionPort {
  detailRefreshRequired(
    input: AccommodationDetailScopedProjection,
  ): Promise<void>;
  membershipReconciled(input: AccommodationDetailMembershipReconciled): void;
  membershipScopeRefreshRequired(
    input: Pick<AccommodationDetailScopedProjection, "scope">,
  ): void;
  membershipRefreshRequired(input: AccommodationDetailScopedProjection): void;
}

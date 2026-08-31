import type { Mocked } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import type {
  WishlistMembershipProjection,
  WishlistMembershipTransport,
} from "./wishlistMembership";
import { WishlistMembershipProvider } from "./WishlistMembershipProvider";
import { useWishlistMembership } from "./useWishlistMembership";

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 3,
};

const transport: Mocked<WishlistMembershipTransport> = {
  addAccommodation: vi.fn().mockResolvedValue({ id: 31 }),
  createWishlist: vi.fn().mockResolvedValue({ id: 11 }),
  deleteWishlist: vi.fn().mockResolvedValue(undefined),
  getAccommodationMembership: vi.fn().mockResolvedValue({
    wishlists: [{ id: 11, isContained: true }],
    pageInfo: { hasNext: false, nextCursor: null },
  }),
  removeAccommodation: vi.fn().mockResolvedValue(undefined),
  removeRecentlyViewed: vi.fn().mockResolvedValue(undefined),
  saveMemo: vi.fn().mockResolvedValue(undefined),
};

const projection: Mocked<WishlistMembershipProjection> = {
  membershipReconciled: vi.fn(),
  membershipRefreshRequired: vi.fn(),
  memoSaved: vi.fn(),
  recentlyViewedRemoved: vi.fn(),
  wishlistCreated: vi.fn(),
  wishlistDeleted: vi.fn(),
};

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <WishlistMembershipProvider
      session={{
        captureAuthenticatedSession: () => scope,
        isCurrentSession: (candidate) =>
          candidate.subject === scope.subject && candidate.epoch === scope.epoch,
      }}
      transport={transport}
      projectionFactory={() => projection}
    >
      {children}
    </WishlistMembershipProvider>
  </QueryClientProvider>
);

describe("WishlistMembershipProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transport.addAccommodation.mockResolvedValue({ id: 31 });
    transport.getAccommodationMembership.mockResolvedValue({
      wishlists: [{ id: 11, isContained: true }],
      pageInfo: { hasNext: false, nextCursor: null },
    });
  });

  it("shares one command single-flight registry with every consumer", async () => {
    const { result } = renderHook(() => useWishlistMembership(), { wrapper });

    let first!: ReturnType<typeof result.current.addAccommodation>;
    let second!: ReturnType<typeof result.current.addAccommodation>;
    act(() => {
      first = result.current.addAccommodation({
        accommodationId: 7,
        wishlistId: 11,
      });
      second = result.current.addAccommodation({
        accommodationId: 7,
        wishlistId: 11,
      });
    });

    expect(second).toBe(first);
    await expect(first).resolves.toMatchObject({ status: "applied" });
    expect(transport.addAccommodation).toHaveBeenCalledTimes(1);
  });
});

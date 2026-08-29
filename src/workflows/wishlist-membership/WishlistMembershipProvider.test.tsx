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

const transport: jest.Mocked<WishlistMembershipTransport> = {
  addAccommodation: jest.fn().mockResolvedValue({ id: 31 }),
  createWishlist: jest.fn().mockResolvedValue({ id: 11 }),
  deleteWishlist: jest.fn().mockResolvedValue(undefined),
  getAccommodationMembership: jest.fn().mockResolvedValue({
    wishlists: [{ id: 11, isContained: true }],
    pageInfo: { hasNext: false, nextCursor: null },
  }),
  removeAccommodation: jest.fn().mockResolvedValue(undefined),
  removeRecentlyViewed: jest.fn().mockResolvedValue(undefined),
  saveMemo: jest.fn().mockResolvedValue(undefined),
};

const projection: jest.Mocked<WishlistMembershipProjection> = {
  membershipReconciled: jest.fn(),
  membershipRefreshRequired: jest.fn(),
  memoSaved: jest.fn(),
  recentlyViewedRemoved: jest.fn(),
  wishlistCreated: jest.fn(),
  wishlistDeleted: jest.fn(),
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
    jest.clearAllMocks();
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

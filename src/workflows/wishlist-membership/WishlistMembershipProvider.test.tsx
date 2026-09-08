import type { Mocked } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateWishlistModal } from "../../features/wishlist/components/CreateWishlistModal/CreateWishlistModal";
import type { ReactNode } from "react";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import type {
  WishlistMembershipDependencies,
  WishlistMembershipTransport,
} from "./wishlistMembership";
import { WishlistMembershipProvider } from "./WishlistMembershipProvider";
import { useWishlistMembership } from "./useWishlistMembership";

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 3,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};

type WishlistMembershipProjection =
  WishlistMembershipDependencies["projection"];

const transport: Mocked<WishlistMembershipTransport> = {
  addAccommodation: vi.fn().mockResolvedValue({ id: 31 }),
  createWishlist: vi.fn().mockResolvedValue({ id: 11 }),
  deleteWishlist: vi.fn().mockResolvedValue(undefined),
  getAccommodationMembership: vi.fn().mockResolvedValue({
    isInAnyWishlist: true,
    targetWishlistFound: false,
    targetWishlistContains: null,
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
          candidate.subject === scope.subject &&
          candidate.epoch === scope.epoch,
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
    transport.createWishlist.mockResolvedValue({ id: 11 });
    transport.addAccommodation.mockResolvedValue({ id: 31 });
    transport.getAccommodationMembership.mockResolvedValue({
      isInAnyWishlist: true,
      targetWishlistFound: false,
      targetWishlistContains: null,
    });
  });

  it("creates and saves from the modal after StrictMode replays provider effects", async () => {
    const onComplete = vi.fn();
    const CreateModal = () => (
      <CreateWishlistModal
        accommodationId={7}
        commands={useWishlistMembership()}
        isOpen
        onClose={vi.fn()}
        onComplete={onComplete}
      />
    );
    render(<CreateModal />, { wrapper, reactStrictMode: true });
    await userEvent.type(
      screen.getByRole("textbox", { name: "이름" }),
      "  부산 여행  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "새로 만들기" }));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        status: "applied",
        isInAnyWishlist: true,
        wishlistId: 11,
      }),
    );
    expect(transport.createWishlist).toHaveBeenCalledExactlyOnceWith(
      { name: "부산 여행" },
      expect.any(AbortSignal),
    );
    expect(transport.addAccommodation).toHaveBeenCalledExactlyOnceWith(
      11,
      { accommodationId: 7 },
      expect.any(AbortSignal),
    );
    expect(projection.membershipReconciled).toHaveBeenCalledWith({
      scope,
      accommodationId: 7,
      isInAnyWishlist: true,
    });
  });

  it("still aborts pending work on a real unmount without applying stale cache changes", async () => {
    let finishAdd!: (value: { id: number }) => void;
    transport.addAccommodation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishAdd = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useWishlistMembership(), {
      wrapper,
      reactStrictMode: true,
    });
    const request = result.current.addAccommodation({
      accommodationId: 7,
      wishlistId: 11,
    });
    const signal = transport.addAccommodation.mock.calls[0]?.[2];
    expect(signal?.aborted).toBe(false);

    unmount();
    await act(async () => Promise.resolve());
    expect(signal?.aborted).toBe(true);
    finishAdd({ id: 31 });
    await expect(request).resolves.toEqual({ status: "stale" });
    expect(transport.getAccommodationMembership).not.toHaveBeenCalled();
    expect(projection.membershipReconciled).not.toHaveBeenCalled();
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

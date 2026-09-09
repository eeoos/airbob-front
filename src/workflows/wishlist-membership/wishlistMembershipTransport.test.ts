import { recentlyViewedApi, wishlistApi } from "../../features/wishlist/api";
import { wishlistMembershipTransport } from "./wishlistMembershipTransport";

vi.mock("../../features/wishlist/api", () => ({
  recentlyViewedApi: { remove: vi.fn() },
  wishlistApi: {
    addAccommodation: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getWishlists: vi.fn(),
    getAccommodationMembership: vi.fn(),
    removeAccommodation: vi.fn(),
    updateAccommodationMemo: vi.fn(),
  },
}));

describe("wishlistMembershipTransport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests one membership snapshot and forwards the target and AbortSignal", async () => {
    const snapshot = {
      isInAnyWishlist: true,
      targetWishlistFound: true,
      targetWishlistContains: false,
    };
    vi.mocked(wishlistApi.getAccommodationMembership).mockResolvedValue(
      snapshot,
    );
    const signal = new AbortController().signal;
    await expect(
      wishlistMembershipTransport.getAccommodationMembership(
        { accommodationId: 7, wishlistId: 11 },
        signal,
      ),
    ).resolves.toEqual(snapshot);
    expect(
      wishlistApi.getAccommodationMembership,
    ).toHaveBeenCalledExactlyOnceWith(
      { accommodationId: 7, wishlistId: 11 },
      { signal },
    );
    expect(wishlistApi.getWishlists).not.toHaveBeenCalled();
  });

  it("passes AbortSignal through every mutation adapter", async () => {
    vi.mocked(wishlistApi.create).mockResolvedValue({ id: 11 });
    vi.mocked(wishlistApi.addAccommodation).mockResolvedValue({ id: 31 });
    vi.mocked(wishlistApi.removeAccommodation).mockResolvedValue();
    vi.mocked(wishlistApi.delete).mockResolvedValue();
    vi.mocked(wishlistApi.updateAccommodationMemo).mockResolvedValue({
      id: 31,
    });
    vi.mocked(recentlyViewedApi.remove).mockResolvedValue();
    const signal = new AbortController().signal;

    await wishlistMembershipTransport.createWishlist({ name: "여행" }, signal);
    await wishlistMembershipTransport.addAccommodation(
      11,
      { accommodationId: 7 },
      signal,
    );
    await wishlistMembershipTransport.removeAccommodation(31, signal);
    await wishlistMembershipTransport.deleteWishlist(11, signal);
    await wishlistMembershipTransport.saveMemo(31, { memo: "" }, signal);
    await wishlistMembershipTransport.removeRecentlyViewed(7, signal);

    expect(wishlistApi.create).toHaveBeenCalledWith(
      { name: "여행" },
      { signal },
    );
    expect(wishlistApi.addAccommodation).toHaveBeenCalledWith(
      11,
      { accommodationId: 7 },
      { signal },
    );
    expect(wishlistApi.removeAccommodation).toHaveBeenCalledWith(31, {
      signal,
    });
    expect(wishlistApi.delete).toHaveBeenCalledWith(11, { signal });
    expect(wishlistApi.updateAccommodationMemo).toHaveBeenCalledWith(
      31,
      { memo: "" },
      { signal },
    );
    expect(recentlyViewedApi.remove).toHaveBeenCalledWith(7, { signal });
  });
});

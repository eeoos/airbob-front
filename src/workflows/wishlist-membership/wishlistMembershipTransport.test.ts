import { recentlyViewedApi, wishlistApi } from "../../features/wishlist/api";
import { wishlistMembershipTransport } from "./wishlistMembershipTransport";

vi.mock("../../features/wishlist/api", () => ({
  recentlyViewedApi: { remove: vi.fn() },
  wishlistApi: {
    addAccommodation: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getWishlists: vi.fn(),
    removeAccommodation: vi.fn(),
    updateAccommodationMemo: vi.fn(),
  },
}));

describe("wishlistMembershipTransport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the feature collection into the workflow membership page", async () => {
    vi.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [
        {
          id: 11,
          name: "여행",
          createdAt: "2026-08-29T00:00:00Z",
          itemCount: 2,
          thumbnailImageUrl: null,
          containsAccommodation: true,
          wishlistAccommodationId: 31,
        },
      ],
      pageInfo: { hasNext: true, nextCursor: "next", currentSize: 1 },
    });
    const signal = new AbortController().signal;

    await expect(
      wishlistMembershipTransport.getAccommodationMembership(
        { accommodationId: 7, cursor: "cursor", size: 20 },
        signal,
      ),
    ).resolves.toEqual({
      wishlists: [{ id: 11, isContained: true }],
      pageInfo: { hasNext: true, nextCursor: "next" },
    });
    expect(wishlistApi.getWishlists).toHaveBeenCalledWith(
      { accommodationId: 7, cursor: "cursor", size: 20 },
      { signal },
    );
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

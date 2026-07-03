import { act, renderHook, waitFor } from "@testing-library/react";
import { recentlyViewedApi, wishlistApi } from "../../../api";
import { useWishlistData } from "./useWishlistData";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  recentlyViewedApi: {
    getRecentlyViewed: jest.fn(),
    remove: jest.fn(),
  },
  wishlistApi: {
    delete: jest.fn(),
    getWishlistAccommodations: jest.fn(),
    getWishlists: jest.fn(),
    removeAccommodation: jest.fn(),
    updateAccommodationMemo: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

const pageInfo = (hasNext: boolean, cursor: string | null) => ({
  has_next: hasNext,
  next_cursor: cursor,
  current_size: 1,
});

const createWishlist = (id: number) =>
  ({
    id,
    name: `위시리스트 ${id}`,
    created_at: "2026-07-01T00:00:00",
    wishlist_item_count: id,
    thumbnail_image_url: null,
    is_contained: null,
    wishlist_accommodation_id: null,
  } as any);

const createRecentlyViewed = (id: number, isInWishlist = false) =>
  ({
    accommodation_id: id,
    accommodation_name: `숙소 ${id}`,
    thumbnail_url: null,
    viewed_at: "2026-07-02T00:00:00",
    address_summary: null,
    review_summary: null,
    is_in_wishlist: isInWishlist,
  } as any);

const createWishlistAccommodation = (id: number, memo: string | null = null) =>
  ({
    wishlist_accommodation_id: id,
    memo,
    created_at: "2026-07-01T00:00:00",
    accommodation: {
      id,
      name: `숙소 ${id}`,
      thumbnail_url: null,
    },
    address_summary: {
      country: "KR",
      city: "Seoul",
      district: null,
    },
    review_summary: {
      average_rating: 0,
      total_count: 0,
    },
    is_in_wishlist: true,
  } as any);

describe("useWishlistData", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockReset();
    jest.mocked(recentlyViewedApi.remove).mockReset();
    jest.mocked(wishlistApi.delete).mockReset();
    jest.mocked(wishlistApi.getWishlistAccommodations).mockReset();
    jest.mocked(wishlistApi.getWishlists).mockReset();
    jest.mocked(wishlistApi.removeAccommodation).mockReset();
    jest.mocked(wishlistApi.updateAccommodationMemo).mockReset();
  });

  it("loads recently viewed accommodations and wishlists", async () => {
    const recentlyViewed = createRecentlyViewed(1);
    const wishlist = createWishlist(10);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [recentlyViewed],
      total_count: 1,
    } as any);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [wishlist],
      page_info: pageInfo(true, "wishlists-cursor"),
    } as any);

    const { result } = renderHook(() =>
      useWishlistData({
        selectedWishlistId: null,
        showRecentlyViewed: false,
      })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(recentlyViewedApi.getRecentlyViewed).toHaveBeenCalledTimes(1);
    expect(wishlistApi.getWishlists).toHaveBeenCalledWith({ size: 20 });
    expect(result.current.recentlyViewed).toEqual([recentlyViewed]);
    expect(result.current.wishlists).toEqual([wishlist]);
    expect(result.current.wishlistsHasNext).toBe(true);
  });

  it("appends the next wishlist page when loadMoreWishlists is called", async () => {
    const firstWishlist = createWishlist(1);
    const secondWishlist = createWishlist(2);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [],
      total_count: 0,
    } as any);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [firstWishlist],
        page_info: pageInfo(true, "cursor-1"),
      } as any)
      .mockResolvedValueOnce({
        wishlists: [secondWishlist],
        page_info: pageInfo(false, null),
      } as any);

    const { result } = renderHook(() =>
      useWishlistData({
        selectedWishlistId: null,
        showRecentlyViewed: false,
      })
    );

    await waitFor(() => expect(result.current.wishlistsHasNext).toBe(true));

    await act(async () => {
      await result.current.loadMoreWishlists();
    });

    expect(wishlistApi.getWishlists).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      size: 20,
    });
    expect(result.current.wishlists).toEqual([firstWishlist, secondWishlist]);
    expect(result.current.wishlistsHasNext).toBe(false);
  });

  it("loads and appends wishlist accommodations for the selected wishlist", async () => {
    const firstAccommodation = createWishlistAccommodation(101);
    const secondAccommodation = createWishlistAccommodation(102);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [],
      total_count: 0,
    } as any);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [],
      page_info: pageInfo(false, null),
    } as any);
    jest
      .mocked(wishlistApi.getWishlistAccommodations)
      .mockResolvedValueOnce({
        wishlist_accommodations: [firstAccommodation],
        page_info: pageInfo(true, "accommodations-cursor"),
      } as any)
      .mockResolvedValueOnce({
        wishlist_accommodations: [secondAccommodation],
        page_info: pageInfo(false, null),
      } as any);

    const { result } = renderHook(() =>
      useWishlistData({
        selectedWishlistId: 7,
        showRecentlyViewed: false,
      })
    );

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMoreWishlistAccommodations();
    });

    expect(wishlistApi.getWishlistAccommodations).toHaveBeenLastCalledWith(7, {
      cursor: "accommodations-cursor",
      size: 20,
    });
    expect(result.current.wishlistAccommodations).toEqual([
      firstAccommodation,
      secondAccommodation,
    ]);
    expect(result.current.hasNext).toBe(false);
  });

  it("updates local state after removing recent and wishlist items", async () => {
    const recentlyViewed = createRecentlyViewed(1);
    const wishlistAccommodation = createWishlistAccommodation(101);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [recentlyViewed],
      total_count: 1,
    } as any);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [],
      page_info: pageInfo(false, null),
    } as any);
    jest.mocked(wishlistApi.getWishlistAccommodations).mockResolvedValue({
      wishlist_accommodations: [wishlistAccommodation],
      page_info: pageInfo(false, null),
    } as any);
    jest.mocked(recentlyViewedApi.remove).mockResolvedValue(undefined);
    jest.mocked(wishlistApi.removeAccommodation).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWishlistData({
        selectedWishlistId: 7,
        showRecentlyViewed: false,
      })
    );

    await waitFor(() =>
      expect(result.current.wishlistAccommodations).toEqual([
        wishlistAccommodation,
      ])
    );

    await act(async () => {
      await result.current.removeRecentlyViewed(1);
      await result.current.removeFromWishlist(101);
    });

    expect(result.current.recentlyViewed).toEqual([]);
    expect(result.current.wishlistAccommodations).toEqual([]);
  });

  it("saves memo changes into the selected wishlist accommodation", async () => {
    const wishlistAccommodation = createWishlistAccommodation(101);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [],
      total_count: 0,
    } as any);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [],
      page_info: pageInfo(false, null),
    } as any);
    jest.mocked(wishlistApi.getWishlistAccommodations).mockResolvedValue({
      wishlist_accommodations: [wishlistAccommodation],
      page_info: pageInfo(false, null),
    } as any);
    jest.mocked(wishlistApi.updateAccommodationMemo).mockResolvedValue({
      id: 101,
    } as any);

    const { result } = renderHook(() =>
      useWishlistData({
        selectedWishlistId: 7,
        showRecentlyViewed: false,
      })
    );

    await waitFor(() =>
      expect(result.current.wishlistAccommodations[0]?.memo).toBeNull()
    );

    await act(async () => {
      await result.current.saveWishlistAccommodationMemo(101, "가족 여행");
    });

    expect(wishlistApi.updateAccommodationMemo).toHaveBeenCalledWith(101, {
      memo: "가족 여행",
    });
    expect(result.current.wishlistAccommodations[0]?.memo).toBe("가족 여행");
  });
});

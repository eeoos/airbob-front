import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { recentlyViewedApi, wishlistApi } from "../../../api";
import { RecentlyViewedAccommodationInfos } from "../../../types/recentlyViewed";
import {
  WishlistAccommodationInfos,
  WishlistInfos,
} from "../../../types/wishlist";
import { searchQueryKeys } from "../../search/queryKeys";
import { wishlistQueryKeys } from "../queryKeys";
import { getWishlistListsParamsSignature } from "./useWishlistListsQuery";
import { useWishlistData } from "./useWishlistData";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
};

const renderUseWishlistData = (
  options: Parameters<typeof useWishlistData>[0]
) => {
  const { Wrapper, queryClient } = createWrapper();
  const hook = renderHook(() => useWishlistData(options), {
    wrapper: Wrapper,
  });

  return { ...hook, queryClient };
};

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

const mockInitialWishlistQueries = () => {
  jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
    accommodations: [],
    total_count: 0,
  } as any);
  jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
    wishlists: [],
    page_info: pageInfo(false, null),
  } as any);
  jest.mocked(wishlistApi.getWishlistAccommodations).mockResolvedValue({
    wishlist_accommodations: [],
    page_info: pageInfo(false, null),
  } as any);
};

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

    const { queryClient, result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(recentlyViewedApi.getRecentlyViewed).toHaveBeenCalledTimes(1);
    expect(wishlistApi.getWishlists).toHaveBeenCalledWith({ size: 20 });
    expect(result.current.recentlyViewed).toEqual([recentlyViewed]);
    expect(result.current.wishlists).toEqual([wishlist]);
    expect(result.current.wishlistsHasNext).toBe(true);
    expect(
      queryClient.getQueryData<RecentlyViewedAccommodationInfos>(
        wishlistQueryKeys.recentlyViewed()
      )?.accommodations
    ).toEqual([recentlyViewed]);
    expect(
      queryClient
        .getQueryData<InfiniteData<WishlistInfos, string | null>>(
          wishlistQueryKeys.lists("")
        )
        ?.pages.flatMap((page) => page.wishlists)
    ).toEqual([wishlist]);
    expect(
      queryClient.getQueryData<InfiniteData<WishlistInfos, string | null>>(
        wishlistQueryKeys.lists("")
      )?.pageParams
    ).toEqual([null]);
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

    const { queryClient, result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.wishlistsHasNext).toBe(true));

    await act(async () => {
      await result.current.loadMoreWishlists();
    });

    expect(wishlistApi.getWishlists).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      size: 20,
    });

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([
        firstWishlist,
        secondWishlist,
      ])
    );
    expect(result.current.wishlistsHasNext).toBe(false);
    expect(
      queryClient
        .getQueryData<InfiniteData<WishlistInfos, string | null>>(
          wishlistQueryKeys.lists("")
        )
        ?.pages.flatMap((page) => page.wishlists)
    ).toEqual([firstWishlist, secondWishlist]);
    expect(
      queryClient.getQueryData<InfiniteData<WishlistInfos, string | null>>(
        wishlistQueryKeys.lists("")
      )?.pageParams
    ).toEqual([null, "cursor-1"]);
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

    const { queryClient, result } = renderUseWishlistData({
      selectedWishlistId: 7,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMoreWishlistAccommodations();
    });

    expect(wishlistApi.getWishlistAccommodations).toHaveBeenLastCalledWith(7, {
      cursor: "accommodations-cursor",
      size: 20,
    });

    await waitFor(() =>
      expect(result.current.wishlistAccommodations).toEqual([
        firstAccommodation,
        secondAccommodation,
      ])
    );
    expect(result.current.hasNext).toBe(false);
    expect(
      queryClient
        .getQueryData<
          InfiniteData<WishlistAccommodationInfos, string | null>
        >(wishlistQueryKeys.detail(7))
        ?.pages.flatMap((page) => page.wishlist_accommodations)
    ).toEqual([firstAccommodation, secondAccommodation]);
    expect(
      queryClient.getQueryData<
        InfiniteData<WishlistAccommodationInfos, string | null>
      >(wishlistQueryKeys.detail(7))?.pageParams
    ).toEqual([null, "accommodations-cursor"]);
  });

  it("updates cached data after removing recent and wishlist items", async () => {
    const recentlyViewed = createRecentlyViewed(1);
    const wishlistAccommodation = createWishlistAccommodation(101);
    jest
      .mocked(recentlyViewedApi.getRecentlyViewed)
      .mockResolvedValueOnce({
        accommodations: [recentlyViewed],
        total_count: 1,
      } as any)
      .mockResolvedValue({
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
    jest.mocked(recentlyViewedApi.remove).mockResolvedValue(undefined);
    jest.mocked(wishlistApi.removeAccommodation).mockResolvedValue(undefined);

    const { queryClient, result } = renderUseWishlistData({
      selectedWishlistId: 7,
      showRecentlyViewed: false,
    });

    await waitFor(() =>
      expect(result.current.wishlistAccommodations).toEqual([
        wishlistAccommodation,
      ])
    );

    const accommodationScopedListsKey = wishlistQueryKeys.lists(
      getWishlistListsParamsSignature({ accommodationId: 7 })
    );
    queryClient.setQueryData<InfiniteData<WishlistInfos, string | null>>(
      accommodationScopedListsKey,
      {
        pageParams: [null],
        pages: [
          {
            wishlists: [
              {
                ...createWishlist(10),
                is_contained: true,
                wishlist_accommodation_id: 101,
              },
            ],
            page_info: pageInfo(false, null),
          } as WishlistInfos,
        ],
      }
    );

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.removeRecentlyViewed(1);
      await result.current.removeFromWishlist(101);
    });

    await waitFor(() => expect(result.current.recentlyViewed).toEqual([]));
    expect(result.current.wishlistAccommodations).toEqual([]);
    expect(
      queryClient.getQueryData<RecentlyViewedAccommodationInfos>(
        wishlistQueryKeys.recentlyViewed()
      )?.accommodations
    ).toEqual([]);
    expect(
      queryClient
        .getQueryData<
          InfiniteData<WishlistAccommodationInfos, string | null>
        >(wishlistQueryKeys.detail(7))
        ?.pages.flatMap((page) => page.wishlist_accommodations)
    ).toEqual([]);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [...wishlistQueryKeys.all, "lists"],
    });
    expect(
      queryClient.getQueryState(accommodationScopedListsKey)?.isInvalidated
    ).toBe(true);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: wishlistQueryKeys.recentlyViewed(),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: searchQueryKeys.all,
    });
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

    const { result } = renderUseWishlistData({
      selectedWishlistId: 7,
      showRecentlyViewed: false,
    });

    await waitFor(() =>
      expect(result.current.wishlistAccommodations[0]?.memo).toBeNull()
    );

    await act(async () => {
      await result.current.saveWishlistAccommodationMemo(101, "가족 여행");
    });

    expect(wishlistApi.updateAccommodationMemo).toHaveBeenCalledWith(101, {
      memo: "가족 여행",
    });
    await waitFor(() =>
      expect(result.current.wishlistAccommodations[0]?.memo).toBe("가족 여행")
    );
  });

  it("handles a failed recently viewed reload error once", async () => {
    const reloadError = new Error("reload failed");
    jest
      .mocked(recentlyViewedApi.getRecentlyViewed)
      .mockResolvedValueOnce({
        accommodations: [],
        total_count: 0,
      } as any)
      .mockRejectedValueOnce(reloadError);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [],
      page_info: pageInfo(false, null),
    } as any);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockHandleError.mockClear();

    await act(async () => {
      await result.current.reloadRecentlyViewed();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockHandleError).toHaveBeenCalledTimes(1);
    expect(mockHandleError).toHaveBeenCalledWith(reloadError);
  });

  it("handles a failed wishlist load-more error once", async () => {
    const loadMoreError = new Error("load more failed");
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [],
      total_count: 0,
    } as any);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [createWishlist(1)],
        page_info: pageInfo(true, "cursor-1"),
      } as any)
      .mockRejectedValueOnce(loadMoreError);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.wishlistsHasNext).toBe(true));
    mockHandleError.mockClear();

    await act(async () => {
      await result.current.loadMoreWishlists();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockHandleError).toHaveBeenCalledTimes(1);
    expect(mockHandleError).toHaveBeenCalledWith(loadMoreError);
  });

  it("removes all cached detail variants after deleting a wishlist", async () => {
    const wishlist = createWishlist(7);
    const detailItem = createWishlistAccommodation(701);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [],
      total_count: 0,
    } as any);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [wishlist],
      page_info: pageInfo(false, null),
    } as any);
    jest.mocked(wishlistApi.delete).mockResolvedValue(undefined);

    const { queryClient, result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.wishlists).toEqual([wishlist]));

    queryClient.setQueryData<InfiniteData<WishlistAccommodationInfos, string | null>>(
      wishlistQueryKeys.detail(7, "sort=created"),
      {
        pageParams: [null],
        pages: [
          {
            wishlist_accommodations: [detailItem],
            page_info: pageInfo(false, null),
          },
        ],
      }
    );

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.deleteWishlist(7);
    });

    expect(
      queryClient.getQueryData(wishlistQueryKeys.detail(7, "sort=created"))
    ).toBeUndefined();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: wishlistQueryKeys.recentlyViewed(),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: searchQueryKeys.all,
    });
  });

  it("updates recently viewed wishlist state through toggle and refresh", async () => {
    const recentlyViewed = createRecentlyViewed(1, false);
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [recentlyViewed],
      total_count: 1,
    } as any);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [],
        page_info: pageInfo(false, null),
      } as any)
      .mockResolvedValueOnce({
        wishlists: [],
        page_info: pageInfo(false, null),
      } as any);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: true,
    });

    await waitFor(() =>
      expect(result.current.recentlyViewed[0]?.is_in_wishlist).toBe(false)
    );

    act(() => {
      result.current.toggleRecentlyViewedWishlistState(1);
    });

    await waitFor(() =>
      expect(result.current.recentlyViewed[0]?.is_in_wishlist).toBe(true)
    );

    await act(async () => {
      await result.current.refreshRecentlyViewedWishlistState(1);
    });

    expect(wishlistApi.getWishlists).toHaveBeenLastCalledWith({
      accommodationId: 1,
      size: 20,
    });
    await waitFor(() =>
      expect(result.current.recentlyViewed[0]?.is_in_wishlist).toBe(false)
    );
  });

  it("refreshes recently viewed wishlist state across wishlist pages", async () => {
    const recentlyViewed = createRecentlyViewed(1, false);
    const containedWishlist = {
      ...createWishlist(10),
      is_contained: true,
    };
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [recentlyViewed],
      total_count: 1,
    } as any);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [],
        page_info: pageInfo(false, null),
      } as any)
      .mockResolvedValueOnce({
        wishlists: [createWishlist(9)],
        page_info: pageInfo(true, "cursor-2"),
      } as any)
      .mockResolvedValueOnce({
        wishlists: [containedWishlist],
        page_info: pageInfo(false, null),
      } as any);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: true,
    });

    await waitFor(() =>
      expect(result.current.recentlyViewed[0]?.is_in_wishlist).toBe(false)
    );

    await act(async () => {
      await result.current.refreshRecentlyViewedWishlistState(1);
    });

    expect(wishlistApi.getWishlists).toHaveBeenNthCalledWith(2, {
      accommodationId: 1,
      size: 20,
    });
    expect(wishlistApi.getWishlists).toHaveBeenNthCalledWith(3, {
      accommodationId: 1,
      cursor: "cursor-2",
      size: 20,
    });
    await waitFor(() =>
      expect(result.current.recentlyViewed[0]?.is_in_wishlist).toBe(true)
    );
  });

  it("handles removeRecentlyViewed rejection", async () => {
    const removeError = new Error("remove recent failed");
    mockInitialWishlistQueries();
    jest.mocked(recentlyViewedApi.remove).mockRejectedValue(removeError);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockHandleError.mockClear();

    await act(async () => {
      await result.current.removeRecentlyViewed(1);
    });

    expect(mockHandleError).toHaveBeenCalledWith(removeError);
  });

  it("returns false and handles deleteWishlist rejection", async () => {
    const deleteError = new Error("delete failed");
    mockInitialWishlistQueries();
    jest.mocked(wishlistApi.delete).mockRejectedValue(deleteError);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockHandleError.mockClear();

    let isDeleted: boolean | undefined;
    await act(async () => {
      isDeleted = await result.current.deleteWishlist(7);
    });

    expect(isDeleted).toBe(false);
    expect(mockHandleError).toHaveBeenCalledWith(deleteError);
  });

  it("handles removeFromWishlist rejection", async () => {
    const removeError = new Error("remove wishlist item failed");
    mockInitialWishlistQueries();
    jest.mocked(wishlistApi.removeAccommodation).mockRejectedValue(removeError);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockHandleError.mockClear();

    await act(async () => {
      await result.current.removeFromWishlist(101);
    });

    expect(mockHandleError).toHaveBeenCalledWith(removeError);
  });

  it("returns false and handles saveWishlistAccommodationMemo rejection", async () => {
    const memoError = new Error("memo failed");
    mockInitialWishlistQueries();
    jest.mocked(wishlistApi.updateAccommodationMemo).mockRejectedValue(memoError);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockHandleError.mockClear();

    let isSaved: boolean | undefined;
    await act(async () => {
      isSaved = await result.current.saveWishlistAccommodationMemo(
        101,
        "메모"
      );
    });

    expect(isSaved).toBe(false);
    expect(mockHandleError).toHaveBeenCalledWith(memoError);
  });

  it("handles refreshRecentlyViewedWishlistState rejection", async () => {
    const refreshError = new Error("membership refresh failed");
    jest.mocked(recentlyViewedApi.getRecentlyViewed).mockResolvedValue({
      accommodations: [],
      total_count: 0,
    } as any);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [],
        page_info: pageInfo(false, null),
      } as any)
      .mockRejectedValueOnce(refreshError);

    const { result } = renderUseWishlistData({
      selectedWishlistId: null,
      showRecentlyViewed: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockHandleError.mockClear();

    await act(async () => {
      await result.current.refreshRecentlyViewedWishlistState(1);
    });

    expect(mockHandleError).toHaveBeenCalledWith(refreshError);
  });
});

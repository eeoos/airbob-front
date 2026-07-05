import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { wishlistApi } from "../../../api/wishlist";
import { WishlistInfo, WishlistInfos } from "../../../types/wishlist";
import { searchQueryKeys } from "../../search/queryKeys";
import { toWishlistModalItemViewModel } from "../lib/wishlistAccommodationViewModel";
import { wishlistQueryKeys } from "../queryKeys";
import { useWishlistSelection } from "./useWishlistSelection";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();
let mockError: string | null = null;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
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

const renderUseWishlistSelection = (
  options: Parameters<typeof useWishlistSelection>[0]
) => {
  const { Wrapper, queryClient } = createWrapper();
  const hook = renderHook(
    (props: Parameters<typeof useWishlistSelection>[0]) =>
      useWishlistSelection(props),
    {
      initialProps: options,
      wrapper: Wrapper,
    }
  );

  return { ...hook, queryClient };
};

jest.mock("../../../api/wishlist", () => ({
  wishlistApi: {
    addAccommodation: jest.fn(),
    getWishlists: jest.fn(),
    removeAccommodation: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    clearError: mockClearError,
    error: mockError,
    handleError: mockHandleError,
  }),
}));

const pageInfo = (hasNext: boolean, cursor: string | null) => ({
  has_next: hasNext,
  next_cursor: cursor,
  current_size: 1,
});

const createWishlist = (
  id: number,
  overrides: Partial<WishlistInfo> = {}
): WishlistInfo => ({
  id,
  name: `위시리스트 ${id}`,
  created_at: "2026-07-01T00:00:00",
  wishlist_item_count: id,
  thumbnail_image_url: null,
  is_contained: false,
  wishlist_accommodation_id: null,
  ...overrides,
});

const expectWishlistMutationCacheInvalidations = (
  invalidateQueriesSpy: jest.SpyInstance
) => {
  expect(invalidateQueriesSpy).toHaveBeenCalledWith({
    queryKey: wishlistQueryKeys.all,
  });
  expect(invalidateQueriesSpy).toHaveBeenCalledWith({
    queryKey: wishlistQueryKeys.recentlyViewed(),
  });
  expect(invalidateQueriesSpy).toHaveBeenCalledWith({
    queryKey: searchQueryKeys.all,
  });
};

describe("useWishlistSelection", () => {
  beforeEach(() => {
    mockError = null;
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(wishlistApi.addAccommodation).mockReset();
    jest.mocked(wishlistApi.getWishlists).mockReset();
    jest.mocked(wishlistApi.removeAccommodation).mockReset();
  });

  it("loads wishlist selection state for the accommodation when opened", async () => {
    const wishlist = createWishlist(1);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [wishlist],
      page_info: pageInfo(true, "cursor-1"),
    });

    const { result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(wishlistApi.getWishlists).toHaveBeenCalledWith({
      size: 20,
      cursor: undefined,
      accommodationId: 7,
    });
    expect(result.current.wishlists).toEqual([
      toWishlistModalItemViewModel(wishlist),
    ]);
    expect(result.current.hasNext).toBe(true);
  });

  it("appends the next wishlist page", async () => {
    const first = createWishlist(1);
    const second = createWishlist(2);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [first],
        page_info: pageInfo(true, "cursor-1"),
      })
      .mockResolvedValueOnce({
        wishlists: [second],
        page_info: pageInfo(false, null),
      });

    const { result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
    });

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMoreWishlists();
    });

    expect(wishlistApi.getWishlists).toHaveBeenLastCalledWith({
      size: 20,
      cursor: "cursor-1",
      accommodationId: 7,
    });
    expect(result.current.wishlists).toEqual([
      toWishlistModalItemViewModel(first),
      toWishlistModalItemViewModel(second),
    ]);
  });

  it("adds and removes an accommodation, then refreshes the list", async () => {
    const onSuccess = jest.fn();
    const emptyWishlist = createWishlist(1);
    const containedWishlist = createWishlist(1, {
      is_contained: true,
      wishlist_accommodation_id: 99,
    });
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [emptyWishlist],
        page_info: pageInfo(false, null),
      })
      .mockResolvedValueOnce({
        wishlists: [containedWishlist],
        page_info: pageInfo(false, null),
      })
      .mockResolvedValueOnce({
        wishlists: [emptyWishlist],
        page_info: pageInfo(false, null),
    });
    jest.mocked(wishlistApi.addAccommodation).mockResolvedValue({ id: 10 });
    jest.mocked(wishlistApi.removeAccommodation).mockResolvedValue(undefined);
    const emptyModalWishlist = toWishlistModalItemViewModel(emptyWishlist);
    const containedModalWishlist =
      toWishlistModalItemViewModel(containedWishlist);

    const { queryClient, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
      onSuccess,
    });

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([emptyModalWishlist])
    );

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.toggleWishlist(emptyModalWishlist);
    });

    expect(wishlistApi.addAccommodation).toHaveBeenCalledWith(1, {
      accommodation_id: 7,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.wishlists).toEqual([containedModalWishlist]);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
    expectWishlistMutationCacheInvalidations(invalidateQueriesSpy);

    await act(async () => {
      await result.current.toggleWishlist(containedModalWishlist);
    });

    expect(wishlistApi.removeAccommodation).toHaveBeenCalledWith(99);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(result.current.wishlists).toEqual([emptyModalWishlist]);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(6);
  });

  it("adds the accommodation to a newly created wishlist and refreshes", async () => {
    const onSuccess = jest.fn();
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [],
        page_info: pageInfo(false, null),
      })
      .mockResolvedValueOnce({
        wishlists: [
          createWishlist(55, {
            is_contained: true,
            wishlist_accommodation_id: 101,
          }),
        ],
        page_info: pageInfo(false, null),
      });
    jest.mocked(wishlistApi.addAccommodation).mockResolvedValue({ id: 101 });

    const { queryClient, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
      onSuccess,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    act(() => {
      result.current.openCreateModal();
    });

    await act(async () => {
      await result.current.handleCreateSuccess(55);
    });

    expect(result.current.showCreateModal).toBe(false);
    expect(wishlistApi.addAccommodation).toHaveBeenCalledWith(55, {
      accommodation_id: 7,
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.wishlists[0].isContained).toBe(true);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
    expectWishlistMutationCacheInvalidations(invalidateQueriesSpy);
  });

  it("invalidates caches before a failed toggle refresh after adding", async () => {
    const onSuccess = jest.fn();
    const refreshError = new Error("refresh failed");
    const emptyWishlist = createWishlist(1);
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [emptyWishlist],
        page_info: pageInfo(false, null),
      })
      .mockRejectedValueOnce(refreshError);
    jest.mocked(wishlistApi.addAccommodation).mockResolvedValue({ id: 10 });

    const { queryClient, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
      onSuccess,
    });

    const emptyModalWishlist = toWishlistModalItemViewModel(emptyWishlist);

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([emptyModalWishlist])
    );

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.toggleWishlist(emptyModalWishlist);
    });

    expect(wishlistApi.addAccommodation).toHaveBeenCalledWith(1, {
      accommodation_id: 7,
    });
    expect(mockHandleError).toHaveBeenCalledWith(refreshError);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
    expectWishlistMutationCacheInvalidations(invalidateQueriesSpy);
    expect(
      invalidateQueriesSpy.mock.invocationCallOrder[0]
    ).toBeLessThan(jest.mocked(wishlistApi.getWishlists).mock.invocationCallOrder[1]);
  });

  it("invalidates caches before a failed toggle refresh after removing", async () => {
    const onSuccess = jest.fn();
    const refreshError = new Error("refresh failed");
    const containedWishlist = createWishlist(1, {
      is_contained: true,
      wishlist_accommodation_id: 99,
    });
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [containedWishlist],
        page_info: pageInfo(false, null),
      })
      .mockRejectedValueOnce(refreshError);
    jest.mocked(wishlistApi.removeAccommodation).mockResolvedValue(undefined);

    const { queryClient, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
      onSuccess,
    });

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([
        toWishlistModalItemViewModel(containedWishlist),
      ])
    );

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.toggleWishlist(
        toWishlistModalItemViewModel(containedWishlist)
      );
    });

    expect(wishlistApi.removeAccommodation).toHaveBeenCalledWith(99);
    expect(mockHandleError).toHaveBeenCalledWith(refreshError);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
    expectWishlistMutationCacheInvalidations(invalidateQueriesSpy);
    expect(
      invalidateQueriesSpy.mock.invocationCallOrder[0]
    ).toBeLessThan(jest.mocked(wishlistApi.getWishlists).mock.invocationCallOrder[1]);
  });

  it("invalidates caches before a failed create-success refresh", async () => {
    const onSuccess = jest.fn();
    const refreshError = new Error("refresh failed");
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [],
        page_info: pageInfo(false, null),
      })
      .mockRejectedValueOnce(refreshError);
    jest.mocked(wishlistApi.addAccommodation).mockResolvedValue({ id: 101 });

    const { queryClient, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
      onSuccess,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    act(() => {
      result.current.openCreateModal();
    });

    await act(async () => {
      await result.current.handleCreateSuccess(55);
    });

    expect(result.current.showCreateModal).toBe(false);
    expect(wishlistApi.addAccommodation).toHaveBeenCalledWith(55, {
      accommodation_id: 7,
    });
    expect(mockHandleError).toHaveBeenCalledWith(refreshError);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
    expectWishlistMutationCacheInvalidations(invalidateQueriesSpy);
    expect(
      invalidateQueriesSpy.mock.invocationCallOrder[0]
    ).toBeLessThan(jest.mocked(wishlistApi.getWishlists).mock.invocationCallOrder[1]);
  });

  it("exposes the shared error state for modal rendering", () => {
    mockError = "위시리스트 실패";

    const { result } = renderUseWishlistSelection({
      isOpen: false,
      accommodationId: 7,
    });

    expect(result.current.error).toBe("위시리스트 실패");
    expect(result.current.clearError).toBe(mockClearError);
  });

  it("clears selection state when the modal closes", async () => {
    const wishlist = createWishlist(1);
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [wishlist],
      page_info: pageInfo(true, "cursor-1"),
    });

    const { rerender, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
    });

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([
        toWishlistModalItemViewModel(wishlist),
      ])
    );
    expect(result.current.hasNext).toBe(true);

    rerender({
      isOpen: false,
      accommodationId: 7,
    });

    await waitFor(() => expect(result.current.wishlists).toEqual([]));
    expect(result.current.hasNext).toBe(false);
    expect(mockClearError).toHaveBeenCalled();
  });

  it("resets stale selection before fetching a different accommodation while open", async () => {
    const firstWishlist = createWishlist(1);
    const secondWishlist = createWishlist(2);
    const secondPage: WishlistInfos = {
      wishlists: [secondWishlist],
      page_info: pageInfo(false, null),
    };
    let resolveSecondPage!: (value: WishlistInfos) => void;
    const secondPagePromise = new Promise<WishlistInfos>((resolve) => {
      resolveSecondPage = resolve;
    });

    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce({
        wishlists: [firstWishlist],
        page_info: pageInfo(true, "cursor-1"),
      })
      .mockReturnValueOnce(secondPagePromise);

    const { rerender, result } = renderUseWishlistSelection({
      isOpen: true,
      accommodationId: 7,
    });

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([
        toWishlistModalItemViewModel(firstWishlist),
      ])
    );
    expect(result.current.hasNext).toBe(true);

    rerender({
      isOpen: true,
      accommodationId: 8,
    });

    await waitFor(() =>
      expect(wishlistApi.getWishlists).toHaveBeenLastCalledWith({
        size: 20,
        cursor: undefined,
        accommodationId: 8,
      })
    );
    expect(result.current.wishlists).toEqual([]);
    expect(result.current.hasNext).toBe(false);

    await act(async () => {
      resolveSecondPage(secondPage);
      await secondPagePromise;
    });

    await waitFor(() =>
      expect(result.current.wishlists).toEqual([
        toWishlistModalItemViewModel(secondWishlist),
      ])
    );
  });
});

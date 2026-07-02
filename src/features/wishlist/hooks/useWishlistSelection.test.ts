import { act, renderHook, waitFor } from "@testing-library/react";
import { wishlistApi } from "../../../api/wishlist";
import { WishlistInfo } from "../../../types/wishlist";
import { useWishlistSelection } from "./useWishlistSelection";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

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

describe("useWishlistSelection", () => {
  beforeEach(() => {
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

    const { result } = renderHook(() =>
      useWishlistSelection({
        isOpen: true,
        accommodationId: 7,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(wishlistApi.getWishlists).toHaveBeenCalledWith({
      size: 20,
      cursor: undefined,
      accommodationId: 7,
    });
    expect(result.current.wishlists).toEqual([wishlist]);
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

    const { result } = renderHook(() =>
      useWishlistSelection({
        isOpen: true,
        accommodationId: 7,
      })
    );

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMoreWishlists();
    });

    expect(wishlistApi.getWishlists).toHaveBeenLastCalledWith({
      size: 20,
      cursor: "cursor-1",
      accommodationId: 7,
    });
    expect(result.current.wishlists).toEqual([first, second]);
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

    const { result } = renderHook(() =>
      useWishlistSelection({
        isOpen: true,
        accommodationId: 7,
        onSuccess,
      })
    );

    await waitFor(() => expect(result.current.wishlists).toEqual([emptyWishlist]));

    await act(async () => {
      await result.current.toggleWishlist(emptyWishlist);
    });

    expect(wishlistApi.addAccommodation).toHaveBeenCalledWith(1, {
      accommodation_id: 7,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.wishlists).toEqual([containedWishlist]);

    await act(async () => {
      await result.current.toggleWishlist(containedWishlist);
    });

    expect(wishlistApi.removeAccommodation).toHaveBeenCalledWith(99);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(result.current.wishlists).toEqual([emptyWishlist]);
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

    const { result } = renderHook(() =>
      useWishlistSelection({
        isOpen: true,
        accommodationId: 7,
        onSuccess,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

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
    expect(result.current.wishlists[0].is_contained).toBe(true);
  });
});

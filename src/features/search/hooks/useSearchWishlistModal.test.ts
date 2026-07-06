import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { wishlistApi } from "../../../api";
import { getWishlistListsParamsSignature } from "../../wishlist/lib/wishlistListQueryParams";
import { wishlistQueryKeys } from "../../wishlist/queryKeys";
import { useSearchWishlistModal } from "./useSearchWishlistModal";

jest.mock("../../../api", () => ({
  wishlistApi: {
    getWishlists: jest.fn(),
  },
}));

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

const renderUseSearchWishlistModal = (
  options: Parameters<typeof useSearchWishlistModal>[0]
) => {
  const { Wrapper, queryClient } = createWrapper();
  const view = renderHook(
    (props: Parameters<typeof useSearchWishlistModal>[0]) =>
      useSearchWishlistModal(props),
    {
      initialProps: options,
      wrapper: Wrapper,
    }
  );

  return { ...view, queryClient };
};

describe("useSearchWishlistModal", () => {
  beforeEach(() => {
    jest.mocked(wishlistApi.getWishlists).mockReset();
  });

  it("opens the auth modal instead of wishlist selection when signed out", () => {
    const onWishlistStatusChange = jest.fn();
    const { result } = renderUseSearchWishlistModal({
      isAuthenticated: false,
      onWishlistStatusChange,
    });

    act(() => {
      result.current.openWishlistModal(7);
    });

    expect(result.current.authModalOpen).toBe(true);
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
    expect(result.current.pendingAccommodationForWishlist).toBe(7);
    expect(onWishlistStatusChange).not.toHaveBeenCalled();
  });

  it("resumes the pending wishlist action after successful auth for accommodation id 0", () => {
    const onWishlistStatusChange = jest.fn();
    const { rerender, result } = renderUseSearchWishlistModal({
      isAuthenticated: false,
      onWishlistStatusChange,
    });

    act(() => {
      result.current.openWishlistModal(0);
    });

    rerender({
      isAuthenticated: true,
      onWishlistStatusChange,
    });

    act(() => {
      result.current.handleAuthSuccess();
    });

    expect(result.current.authModalOpen).toBe(false);
    expect(result.current.wishlistModalOpen).toBe(true);
    expect(result.current.selectedAccommodationForWishlist).toBe(0);
    expect(result.current.pendingAccommodationForWishlist).toBeNull();
  });

  it("clears the pending wishlist action when auth modal closes", () => {
    const onWishlistStatusChange = jest.fn();
    const { result } = renderUseSearchWishlistModal({
      isAuthenticated: false,
      onWishlistStatusChange,
    });

    act(() => {
      result.current.openWishlistModal(0);
    });

    act(() => {
      result.current.closeAuthModal();
    });

    expect(result.current.authModalOpen).toBe(false);
    expect(result.current.pendingAccommodationForWishlist).toBeNull();
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });

  it("reconciles the search card wishlist state when the modal closes", async () => {
    const onWishlistStatusChange = jest.fn();
    const firstPage = {
      wishlists: [
        {
          id: 1,
          name: "서울",
          created_at: "2026-07-01T00:00:00",
          wishlist_item_count: 1,
          thumbnail_image_url: null,
          is_contained: false,
          wishlist_accommodation_id: null,
        },
      ],
      page_info: {
        has_next: true,
        next_cursor: "cursor-2",
        current_size: 1,
      },
    };
    const secondPage = {
      wishlists: [
        {
          id: 2,
          name: "부산",
          created_at: "2026-07-01T00:00:00",
          wishlist_item_count: 1,
          thumbnail_image_url: null,
          is_contained: true,
          wishlist_accommodation_id: 11,
        },
      ],
      page_info: {
        has_next: false,
        next_cursor: null,
        current_size: 1,
      },
    };
    jest
      .mocked(wishlistApi.getWishlists)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const { queryClient, result } = renderUseSearchWishlistModal({
      isAuthenticated: true,
      onWishlistStatusChange,
    });

    act(() => {
      result.current.openWishlistModal(0);
    });

    await act(async () => {
      await result.current.closeWishlistModal();
    });

    expect(wishlistApi.getWishlists).toHaveBeenNthCalledWith(1, {
      size: 20,
      accommodationId: 0,
    });
    expect(wishlistApi.getWishlists).toHaveBeenNthCalledWith(2, {
      size: 20,
      accommodationId: 0,
      cursor: "cursor-2",
    });
    expect(onWishlistStatusChange).toHaveBeenCalledWith(0, true);
    expect(
      queryClient.getQueryData(
        wishlistQueryKeys.lists(
          getWishlistListsParamsSignature({ accommodationId: 0 })
        )
      )
    ).toEqual({
      pageParams: [null, "cursor-2"],
      pages: [firstPage, secondPage],
    });
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });
});

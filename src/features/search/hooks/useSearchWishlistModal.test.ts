import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { wishlistApi } from "../../../api";
import { AccommodationSearchInfo } from "../../../types/accommodation";
import { getWishlistListsParamsSignature } from "../../wishlist/hooks/useWishlistListsQuery";
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
  const hook = renderHook(() => useSearchWishlistModal(options), {
    wrapper: Wrapper,
  });

  return { ...hook, queryClient };
};

const createAccommodation = (
  id: number,
  isInWishlist = false
): AccommodationSearchInfo =>
  ({
    id,
    name: `숙소 ${id}`,
    accommodation_thumbnail_url: null,
    base_price: 100000,
    currency: "KRW",
    type: "APARTMENT",
    address_summary: {
      country: "KR",
      state: null,
      city: "Seoul",
      district: null,
    },
    coordinate: {
      latitude: 37.5,
      longitude: 127,
    },
    review_summary: {
      total_count: 0,
      average_rating: 0,
    },
    is_in_wishlist: isInWishlist,
  } as AccommodationSearchInfo);

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
    expect(onWishlistStatusChange).not.toHaveBeenCalled();
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
      result.current.openWishlistModal(7);
    });

    await act(async () => {
      await result.current.closeWishlistModal();
    });

    expect(wishlistApi.getWishlists).toHaveBeenNthCalledWith(1, {
      size: 20,
      accommodationId: 7,
    });
    expect(wishlistApi.getWishlists).toHaveBeenNthCalledWith(2, {
      size: 20,
      accommodationId: 7,
      cursor: "cursor-2",
    });
    expect(onWishlistStatusChange).toHaveBeenCalledWith(7, true);
    expect(
      queryClient.getQueryData(
        wishlistQueryKeys.lists(
          getWishlistListsParamsSignature({ accommodationId: 7 })
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

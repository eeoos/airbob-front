import { act, renderHook } from "@testing-library/react";
import { wishlistApi } from "../../../api";
import { AccommodationSearchInfo } from "../../../types/accommodation";
import { useSearchWishlistModal } from "./useSearchWishlistModal";

jest.mock("../../../api", () => ({
  wishlistApi: {
    getWishlists: jest.fn(),
  },
}));

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
    const setAccommodations = jest.fn();
    const { result } = renderHook(() =>
      useSearchWishlistModal({
        isAuthenticated: false,
        setAccommodations,
      })
    );

    act(() => {
      result.current.openWishlistModal(7);
    });

    expect(result.current.authModalOpen).toBe(true);
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });

  it("reconciles the search card wishlist state when the modal closes", async () => {
    let accommodations = [createAccommodation(7, false), createAccommodation(8, false)];
    const setAccommodations = jest.fn((updater) => {
      accommodations =
        typeof updater === "function" ? updater(accommodations) : updater;
    });
    jest.mocked(wishlistApi.getWishlists).mockResolvedValue({
      wishlists: [
        {
          id: 1,
          name: "서울",
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
    });

    const { result } = renderHook(() =>
      useSearchWishlistModal({
        isAuthenticated: true,
        setAccommodations,
      })
    );

    act(() => {
      result.current.openWishlistModal(7);
    });

    await act(async () => {
      await result.current.closeWishlistModal();
    });

    expect(wishlistApi.getWishlists).toHaveBeenCalledWith({
      size: 20,
      accommodationId: 7,
    });
    expect(accommodations).toEqual([
      createAccommodation(7, true),
      createAccommodation(8, false),
    ]);
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Wishlist from "./Wishlist";

const mockCloseMemoModal = jest.fn();
const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams("id=42");

jest.mock(
  "react-router-dom",
  () => ({
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }),
  { virtual: true }
);

jest.mock("../../features/wishlist", () => {
  const { useWishlistRouteViewState } = jest.requireActual(
    "../../features/wishlist/hooks/useWishlistRouteViewState"
  );

  return {
    useWishlistRouteViewState,
    useWishlistData: () => ({
      clearError: jest.fn(),
      deleteWishlist: jest.fn(),
      error: null,
      hasNext: false,
      isLoading: false,
      isLoadingMore: false,
      isLoadingMoreWishlists: false,
      loadMoreWishlistAccommodations: jest.fn(),
      loadMoreWishlists: jest.fn(),
      recentlyViewed: [],
      refreshRecentlyViewedWishlistState: jest.fn(),
      reloadRecentlyViewed: jest.fn(),
      removeFromWishlist: jest.fn(),
      removeRecentlyViewed: jest.fn(),
      saveWishlistAccommodationMemo: jest.fn(),
      toggleRecentlyViewedWishlistState: jest.fn(),
      wishlistAccommodations: [
        {
          wishlist_accommodation_id: 10,
          memo: "",
          accommodation: {
            id: 101,
            name: "Albany stay",
            thumbnail_url: null,
          },
          address_summary: {
            country: "United States",
            city: "Albany",
            district: "",
          },
          review_summary: {
            average_rating: 0,
            total_count: 0,
          },
        },
      ],
      wishlists: [
        {
          id: 42,
          name: "QA saved stays",
          thumbnail_image_url: null,
          wishlist_item_count: 1,
        },
      ],
      wishlistsHasNext: false,
    }),
    useWishlistModals: () => ({
      clearMemoText: jest.fn(),
      closeMemoModal: mockCloseMemoModal,
      closeWishlistModal: jest.fn(),
      memoModalOpen: true,
      memoText: "",
      openMemoModal: jest.fn(),
      openWishlistModal: jest.fn(),
      selectedAccommodationForWishlist: null,
      selectedMemoItem: null,
      updateMemoText: jest.fn(),
      wishlistModalOpen: false,
    }),
  };
});

jest.mock("../../components/ListContainer", () => ({
  ListContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: () => null,
}));

jest.mock("../../features/wishlist/components/WishlistModal", () => ({
  WishlistModal: () => null,
}));

describe("Wishlist memo modal", () => {
  beforeEach(() => {
    mockCloseMemoModal.mockClear();
    mockSetSearchParams.mockClear();
    mockSearchParams = new URLSearchParams("id=42");
    (global as any).IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
    }));
  });

  it("closes the memo modal when Escape is pressed", () => {
    // Regression: ISSUE-001 - Wishlist memo modal ignored Escape.
    // Found by /qa on 2026-07-03.
    // Report: .gstack/qa-reports/qa-report-localhost-3000-2026-07-03-structural-final.md
    render(<Wishlist />);

    expect(screen.getByRole("heading", { name: "메모 추가" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockCloseMemoModal).toHaveBeenCalledTimes(1);
  });
});

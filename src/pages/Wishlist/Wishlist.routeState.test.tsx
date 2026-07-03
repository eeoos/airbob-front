import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Wishlist from "./Wishlist";

const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams("");
const mockBuildWishlistRouteSearchParams = jest.fn((state) => {
  const params = new URLSearchParams();
  params.set("builtView", state.view);
  if (state.wishlistId !== null) {
    params.set("builtWishlistId", state.wishlistId.toString());
  }
  return params;
});

jest.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}), { virtual: true });

jest.mock("../../features/wishlist/lib/wishlistRouteState", () => {
  const actual = jest.requireActual("../../features/wishlist/lib/wishlistRouteState");

  return {
    ...actual,
    buildWishlistRouteSearchParams: (state: unknown) =>
      mockBuildWishlistRouteSearchParams(state),
  };
});

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
      wishlistAccommodations: [],
      wishlists: [
        {
          id: 42,
          name: "Weekend",
          thumbnail_image_url: null,
          wishlist_item_count: 3,
        },
      ],
      wishlistsHasNext: false,
    }),
    useWishlistModals: () => ({
      clearMemoText: jest.fn(),
      closeMemoModal: jest.fn(),
      closeWishlistModal: jest.fn(),
      memoModalOpen: false,
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

jest.mock("../../components/WishlistModal", () => ({
  WishlistModal: () => null,
}));

describe("Wishlist route state integration", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockBuildWishlistRouteSearchParams.mockClear();
    mockBuildWishlistRouteSearchParams.mockImplementation((state) => {
      const params = new URLSearchParams();
      params.set("builtView", state.view);
      if (state.wishlistId !== null) {
        params.set("builtWishlistId", state.wishlistId.toString());
      }
      return params;
    });
    mockSearchParams = new URLSearchParams("");
    (global as any).IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
    }));
  });

  it("uses the wishlist route-state builder when opening recently viewed", async () => {
    render(<Wishlist />);

    await userEvent.click(screen.getByText("최근 조회"));

    expect(mockBuildWishlistRouteSearchParams).toHaveBeenCalledWith({
      view: "recently-viewed",
      wishlistId: null,
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("builtView=recently-viewed")
    );
  });

  it("uses the wishlist route-state builder when opening a wishlist", async () => {
    render(<Wishlist />);

    await userEvent.click(screen.getByText("Weekend"));

    expect(mockBuildWishlistRouteSearchParams).toHaveBeenCalledWith({
      view: "wishlist-detail",
      wishlistId: 42,
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("builtView=wishlist-detail&builtWishlistId=42")
    );
  });

  it("syncs the visible wishlist view when the URL search params change after mount", async () => {
    const { rerender } = render(<Wishlist />);

    expect(
      screen.getByRole("heading", { name: "위시리스트" })
    ).toBeInTheDocument();

    mockSearchParams = new URLSearchParams("view=recently-viewed");
    rerender(<Wishlist />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "최근 조회" })
      ).toBeInTheDocument();
    });

    mockSearchParams = new URLSearchParams("id=42");
    rerender(<Wishlist />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Weekend" })
      ).toBeInTheDocument();
    });
  });
});

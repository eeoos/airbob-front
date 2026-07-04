import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WishlistRoute } from "./WishlistRoute";
import { useWishlistRouteViewState } from "./hooks/useWishlistRouteViewState";

const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams("");
let mockRecentlyViewed: unknown[] = [];
let mockWishlistAccommodations: unknown[] = [];
let mockWishlists: unknown[] = [];
const mockDeleteWishlist = jest.fn();
const mockRefreshRecentlyViewedWishlistState = jest.fn();
const mockReloadRecentlyViewed = jest.fn();
const mockRemoveFromWishlist = jest.fn();
const mockRemoveRecentlyViewed = jest.fn();
const mockSaveWishlistAccommodationMemo = jest.fn();
const mockToggleRecentlyViewedWishlistState = jest.fn();
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

jest.mock("./lib/wishlistRouteState", () => {
  const actual = jest.requireActual("./lib/wishlistRouteState");

  return {
    ...actual,
    buildWishlistRouteSearchParams: (state: unknown) =>
      mockBuildWishlistRouteSearchParams(state),
  };
});

jest.mock("./hooks/useWishlistData", () => ({
  useWishlistData: () => ({
    clearError: jest.fn(),
    deleteWishlist: mockDeleteWishlist,
    error: null,
    hasNext: false,
    isLoading: false,
    isLoadingMore: false,
    isLoadingMoreWishlists: false,
    loadMoreWishlistAccommodations: jest.fn(),
    loadMoreWishlists: jest.fn(),
    recentlyViewed: mockRecentlyViewed,
    refreshRecentlyViewedWishlistState: mockRefreshRecentlyViewedWishlistState,
    reloadRecentlyViewed: mockReloadRecentlyViewed,
    removeFromWishlist: mockRemoveFromWishlist,
    removeRecentlyViewed: mockRemoveRecentlyViewed,
    saveWishlistAccommodationMemo: mockSaveWishlistAccommodationMemo,
    toggleRecentlyViewedWishlistState: mockToggleRecentlyViewedWishlistState,
    wishlistAccommodations: mockWishlistAccommodations,
    wishlists: mockWishlists,
    wishlistsHasNext: false,
  }),
}));

jest.mock("../../components/ListContainer", () => ({
  ListContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: () => null,
}));

jest.mock("./components/WishlistModal", () => ({
  WishlistModal: ({
    accommodationId,
    isOpen,
    onClose,
    onSuccess,
  }: {
    accommodationId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="위시리스트에 저장하기">
        <span data-testid="wishlist-modal-accommodation-id">
          {accommodationId}
        </span>
        <button type="button" onClick={onSuccess}>
          저장 성공
        </button>
        <button type="button" onClick={onClose}>
          위시리스트 모달 닫기
        </button>
      </div>
    ) : null,
}));

describe("Wishlist route state integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    mockRecentlyViewed = [];
    mockWishlistAccommodations = [];
    mockWishlists = [
      {
        id: 42,
        name: "Weekend",
        created_at: "2026-07-01T00:00:00Z",
        is_contained: null,
        thumbnail_image_url: null,
        wishlist_accommodation_id: null,
        wishlist_item_count: 3,
      },
    ];
    mockDeleteWishlist.mockResolvedValue(false);
    mockRefreshRecentlyViewedWishlistState.mockResolvedValue(undefined);
    mockReloadRecentlyViewed.mockResolvedValue(undefined);
    mockSaveWishlistAccommodationMemo.mockResolvedValue(true);
    (global as any).IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
    }));
  });

  it("uses the wishlist route-state builder when opening recently viewed", async () => {
    render(<WishlistRoute />);

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
    render(<WishlistRoute />);

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
    const { rerender } = render(<WishlistRoute />);

    expect(
      screen.getByRole("heading", { name: "위시리스트" })
    ).toBeInTheDocument();

    mockSearchParams = new URLSearchParams("view=recently-viewed");
    rerender(<WishlistRoute />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "최근 조회" })
      ).toBeInTheDocument();
    });

    mockSearchParams = new URLSearchParams("id=42");
    rerender(<WishlistRoute />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Weekend" })
      ).toBeInTheDocument();
    });
  });

  it("canonicalizes the selected wishlist route after the selected wishlist is deleted", async () => {
    mockSearchParams = new URLSearchParams("id=42");
    mockBuildWishlistRouteSearchParams.mockImplementation((state) => {
      if (
        state &&
        typeof state === "object" &&
        "view" in state &&
        state.view === "index" &&
        "wishlistId" in state &&
        state.wishlistId === null
      ) {
        return new URLSearchParams("");
      }

      return new URLSearchParams("unexpected=true");
    });

    const RouteStateHarness = () => {
      const {
        clearSelectedWishlist,
        isEditMode,
        selectedWishlist,
        setIsEditMode,
        showRecentlyViewed,
      } = useWishlistRouteViewState();

      return (
        <div>
          <span data-testid="selected-wishlist">
            {selectedWishlist ?? "none"}
          </span>
          <span data-testid="recently-viewed">
            {showRecentlyViewed ? "shown" : "hidden"}
          </span>
          <span data-testid="edit-mode">
            {isEditMode ? "editing" : "viewing"}
          </span>
          <button type="button" onClick={() => setIsEditMode(true)}>
            편집
          </button>
          <button type="button" onClick={clearSelectedWishlist}>
            선택 위시리스트 삭제 성공
          </button>
        </div>
      );
    };

    render(<RouteStateHarness />);

    expect(screen.getByTestId("selected-wishlist")).toHaveTextContent("42");

    await userEvent.click(screen.getByText("편집"));
    expect(screen.getByTestId("edit-mode")).toHaveTextContent("editing");

    await userEvent.click(screen.getByText("선택 위시리스트 삭제 성공"));

    expect(mockBuildWishlistRouteSearchParams).toHaveBeenCalledWith({
      view: "index",
      wishlistId: null,
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(new URLSearchParams(""), {
      replace: true,
    });
    expect(screen.getByTestId("selected-wishlist")).toHaveTextContent("none");
    expect(screen.getByTestId("recently-viewed")).toHaveTextContent("hidden");
    expect(screen.getByTestId("edit-mode")).toHaveTextContent("viewing");
  });

  it("wires the recently viewed wishlist modal callbacks", async () => {
    mockSearchParams = new URLSearchParams("view=recently-viewed");
    mockRecentlyViewed = [
      {
        accommodation_id: 101,
        accommodation_name: "Ocean house",
        address_summary: {
          country: "대한민국",
          state: null,
          city: "부산",
          district: "해운대구",
        },
        is_in_wishlist: false,
        review_summary: {
          average_rating: 4.8,
          total_count: 12,
        },
        thumbnail_url: null,
        viewed_at: "2026-07-04T00:00:00Z",
      },
    ];

    render(<WishlistRoute />);

    await userEvent.click(screen.getByRole("button", { name: "위시리스트" }));

    expect(
      screen.getByRole("dialog", { name: "위시리스트에 저장하기" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("wishlist-modal-accommodation-id")).toHaveTextContent(
      "101"
    );

    await userEvent.click(screen.getByRole("button", { name: "저장 성공" }));
    expect(mockToggleRecentlyViewedWishlistState).toHaveBeenCalledWith(101);

    await userEvent.click(
      screen.getByRole("button", { name: "위시리스트 모달 닫기" })
    );

    await waitFor(() => {
      expect(mockRefreshRecentlyViewedWishlistState).toHaveBeenCalledWith(101);
      expect(
        screen.queryByRole("dialog", { name: "위시리스트에 저장하기" })
      ).not.toBeInTheDocument();
    });
  });

  it("wires the wishlist memo modal save path", async () => {
    mockSearchParams = new URLSearchParams("id=42");
    mockWishlistAccommodations = [
      {
        wishlist_accommodation_id: 501,
        accommodation: {
          id: 201,
          name: "Lake cabin",
          thumbnail_url: null,
        },
        address_summary: {
          country: "대한민국",
          state: null,
          city: "춘천",
          district: "남산면",
        },
        created_at: "2026-07-01T00:00:00Z",
        is_in_wishlist: true,
        memo: "",
        review_summary: {
          average_rating: 0,
          total_count: 0,
        },
      },
    ];

    render(<WishlistRoute />);

    await userEvent.click(screen.getByRole("button", { name: "메모 추가" }));

    expect(screen.getByRole("dialog", { name: "메모 추가" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("메모"), "Pack sunscreen");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockSaveWishlistAccommodationMemo).toHaveBeenCalledWith(
        501,
        "Pack sunscreen"
      );
      expect(
        screen.queryByRole("dialog", { name: "메모 추가" })
      ).not.toBeInTheDocument();
    });
  });
});

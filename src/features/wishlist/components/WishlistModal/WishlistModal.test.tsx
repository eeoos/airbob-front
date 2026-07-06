import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useWishlistSelection } from "../../hooks/useWishlistSelection";
import type { WishlistModalItemViewModel } from "../../lib/wishlistAccommodationViewModel";
import { WishlistModal } from "./WishlistModal";

jest.mock("../../hooks/useWishlistSelection", () => ({
  useWishlistSelection: jest.fn(),
}));

jest.mock("../CreateWishlistModal/CreateWishlistModal", () => ({
  CreateWishlistModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="create wishlist" /> : null,
}));

const mockWishlistSelection = jest.mocked(useWishlistSelection);
const defaultWishlist: WishlistModalItemViewModel = {
  id: 1,
  name: "서울 여행",
  thumbnailUrl: "https://example.com/seoul.jpg",
  itemCountLabel: "저장된 항목 2개",
  isContained: true,
  wishlistAccommodationId: 10,
};

const defaultSelection = {
  closeCreateModal: jest.fn(),
  clearError: jest.fn(),
  error: null,
  handleCreateSuccess: jest.fn(),
  hasNext: false,
  isLoading: false,
  loadMoreWishlists: jest.fn(),
  openCreateModal: jest.fn(),
  showCreateModal: false,
  toggleWishlist: jest.fn(),
  wishlists: [] as WishlistModalItemViewModel[],
};

describe("WishlistModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWishlistSelection.mockReturnValue(defaultSelection);
  });

  it("does not render nested create modal when the parent modal is closed", () => {
    render(
      <WishlistModal
        isOpen={false}
        onClose={jest.fn()}
        accommodationId={1}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible dialog and toggles a wishlist item from its button", async () => {
    const toggleWishlist = jest.fn();
    mockWishlistSelection.mockReturnValue({
      ...defaultSelection,
      toggleWishlist,
      wishlists: [defaultWishlist],
    });

    render(
      <WishlistModal
        isOpen
        onClose={jest.fn()}
        accommodationId={1}
      />
    );

    expect(
      screen.getByRole("dialog", { name: "위시리스트에 저장하기" })
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "서울 여행" })).toHaveAttribute(
      "src",
      "https://example.com/seoul.jpg"
    );
    expect(screen.getByText("저장된 항목 2개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /서울 여행/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await userEvent.click(screen.getByRole("button", { name: /서울 여행/ }));

    expect(toggleWishlist).toHaveBeenCalledWith(
      defaultWishlist,
      expect.any(Object)
    );
  });

  it("renders modal errors as an alert and clears them from the toast", async () => {
    const clearError = jest.fn();
    mockWishlistSelection.mockReturnValue({
      ...defaultSelection,
      clearError,
      error: "위시리스트 저장에 실패했습니다.",
    });

    render(
      <WishlistModal
        isOpen
        onClose={jest.fn()}
        accommodationId={1}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "위시리스트 저장에 실패했습니다."
    );

    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));

    expect(clearError).toHaveBeenCalledTimes(1);
  });
});

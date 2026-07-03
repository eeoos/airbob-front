import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateWishlist } from "../../hooks/useCreateWishlist";
import { CreateWishlistModal } from "./CreateWishlistModal";

jest.mock("../../hooks/useCreateWishlist", () => ({
  useCreateWishlist: jest.fn(),
}));

const mockUseCreateWishlist = jest.mocked(useCreateWishlist);

describe("CreateWishlistModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreateWishlist.mockReturnValue({
      clearError: jest.fn(),
      error: null,
      isLoading: false,
      name: "",
      submit: jest.fn(),
      updateName: jest.fn(),
    });
  });

  it("renders an accessible dialog", () => {
    render(
      <CreateWishlistModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(
      screen.getByRole("dialog", { name: "위시리스트 만들기" })
    ).toBeInTheDocument();
  });

  it("renders create errors as an alert and clears them from the toast", async () => {
    const clearError = jest.fn();
    mockUseCreateWishlist.mockReturnValue({
      clearError,
      error: "위시리스트 생성에 실패했습니다.",
      isLoading: false,
      name: "",
      submit: jest.fn(),
      updateName: jest.fn(),
    });

    render(
      <CreateWishlistModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "위시리스트 생성에 실패했습니다."
    );

    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));

    expect(clearError).toHaveBeenCalledTimes(1);
  });
});

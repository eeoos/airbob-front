import { act, renderHook, waitFor } from "@testing-library/react";
import { wishlistApi } from "../../../api/wishlist";
import { useCreateWishlist } from "./useCreateWishlist";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api/wishlist", () => ({
  wishlistApi: {
    create: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

describe("useCreateWishlist", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(wishlistApi.create).mockReset();
  });

  it("resets the name and clears errors when the modal opens", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useCreateWishlist({
          isOpen,
          onSuccess: jest.fn(),
        }),
      { initialProps: { isOpen: false } }
    );

    act(() => {
      result.current.updateName("여름 여행");
    });

    rerender({ isOpen: true });

    expect(result.current.name).toBe("");
    expect(mockClearError).toHaveBeenCalled();
  });

  it("creates a wishlist with a trimmed name and reports the new id", async () => {
    const onSuccess = jest.fn();
    jest.mocked(wishlistApi.create).mockResolvedValue({ id: 42 });

    const { result } = renderHook(() =>
      useCreateWishlist({
        isOpen: true,
        onSuccess,
      })
    );

    act(() => {
      result.current.updateName("  제주 숙소  ");
    });

    await act(async () => {
      await result.current.submit({
        preventDefault: jest.fn(),
      });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(wishlistApi.create).toHaveBeenCalledWith({ name: "제주 숙소" });
    expect(onSuccess).toHaveBeenCalledWith(42);
    expect(result.current.name).toBe("");
  });

  it("keeps names capped at 50 characters and ignores blank submits", async () => {
    const { result } = renderHook(() =>
      useCreateWishlist({
        isOpen: true,
        onSuccess: jest.fn(),
      })
    );

    act(() => {
      result.current.updateName("a".repeat(50));
      result.current.updateName("b".repeat(51));
    });

    expect(result.current.name).toBe("a".repeat(50));

    act(() => {
      result.current.updateName("   ");
    });

    await act(async () => {
      await result.current.submit({
        preventDefault: jest.fn(),
      });
    });

    expect(wishlistApi.create).not.toHaveBeenCalled();
  });
});

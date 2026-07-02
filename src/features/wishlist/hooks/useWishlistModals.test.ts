import { act, renderHook } from "@testing-library/react";
import { useWishlistModals } from "./useWishlistModals";

const wishlistAccommodation = {
  wishlist_accommodation_id: 10,
  memo: "기존 메모",
} as any;

describe("useWishlistModals", () => {
  it("tracks the selected accommodation for the wishlist modal", () => {
    const { result } = renderHook(() => useWishlistModals());

    act(() => {
      result.current.openWishlistModal(7);
    });

    expect(result.current.wishlistModalOpen).toBe(true);
    expect(result.current.selectedAccommodationForWishlist).toBe(7);

    act(() => {
      result.current.closeWishlistModal();
    });

    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });

  it("tracks memo modal state and caps memo text at 250 characters", () => {
    const { result } = renderHook(() => useWishlistModals());

    act(() => {
      result.current.openMemoModal(wishlistAccommodation);
    });

    expect(result.current.memoModalOpen).toBe(true);
    expect(result.current.selectedMemoItem).toBe(wishlistAccommodation);
    expect(result.current.memoText).toBe("기존 메모");

    act(() => {
      result.current.updateMemoText("a".repeat(260));
    });

    expect(result.current.memoText).toHaveLength(250);

    act(() => {
      result.current.closeMemoModal();
    });

    expect(result.current.memoModalOpen).toBe(false);
    expect(result.current.selectedMemoItem).toBeNull();
    expect(result.current.memoText).toBe("");
  });
});

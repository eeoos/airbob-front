import { act, renderHook } from "@testing-library/react";
import { useSearchParams } from "react-router-dom";
import { useWishlistRouteViewState } from "./useWishlistRouteViewState";

jest.mock(
  "react-router-dom",
  () => ({
    useSearchParams: jest.fn(),
  }),
  { virtual: true }
);

const mockSetSearchParams = jest.fn();
let currentSearchParams = new URLSearchParams();

describe("useWishlistRouteViewState", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    currentSearchParams = new URLSearchParams();
    jest.mocked(useSearchParams).mockImplementation(() => [
      currentSearchParams,
      mockSetSearchParams,
    ] as any);
  });

  it("defaults to the wishlist index view", () => {
    const { result } = renderHook(() => useWishlistRouteViewState());

    expect(result.current.selectedWishlist).toBeNull();
    expect(result.current.showRecentlyViewed).toBe(false);
    expect(result.current.isEditMode).toBe(false);
  });

  it("opens recently viewed and resets local edit state", () => {
    const { result } = renderHook(() => useWishlistRouteViewState());

    act(() => {
      result.current.setIsEditMode(true);
    });

    act(() => {
      result.current.openRecentlyViewed();
    });

    expect(result.current.selectedWishlist).toBeNull();
    expect(result.current.showRecentlyViewed).toBe(true);
    expect(result.current.isEditMode).toBe(false);
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("view=recently-viewed")
    );
  });

  it("opens a wishlist detail route", () => {
    const { result } = renderHook(() => useWishlistRouteViewState());

    act(() => {
      result.current.openWishlist(42);
    });

    expect(result.current.selectedWishlist).toBe(42);
    expect(result.current.showRecentlyViewed).toBe(false);
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("id=42")
    );
  });

  it("syncs state from changed URL search params", () => {
    const { result, rerender } = renderHook(() => useWishlistRouteViewState());

    currentSearchParams = new URLSearchParams("view=recently-viewed");
    rerender();

    expect(result.current.showRecentlyViewed).toBe(true);
    expect(result.current.selectedWishlist).toBeNull();

    act(() => {
      result.current.setIsEditMode(true);
    });

    currentSearchParams = new URLSearchParams("id=42");
    rerender();

    expect(result.current.showRecentlyViewed).toBe(false);
    expect(result.current.selectedWishlist).toBe(42);
    expect(result.current.isEditMode).toBe(false);
  });
});

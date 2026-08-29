import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "fs";
import path from "path";
import { useSearchWishlistModal } from "./useSearchWishlistModal";

const renderUseSearchWishlistModal = (
  options: Parameters<typeof useSearchWishlistModal>[0]
) =>
  renderHook(
    (props: Parameters<typeof useSearchWishlistModal>[0]) =>
      useSearchWishlistModal(props),
    {
      initialProps: options,
    }
  );

describe("useSearchWishlistModal", () => {
  it("opens the auth modal instead of wishlist selection when signed out", () => {
    const { result } = renderUseSearchWishlistModal({
      isAuthenticated: false,
    });

    act(() => {
      result.current.openWishlistModal(7);
    });

    expect(result.current.authModalOpen).toBe(true);
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
    expect(result.current.pendingAccommodationForWishlist).toBe(7);
  });

  it("resumes the pending wishlist action after successful auth for accommodation id 0", () => {
    const { rerender, result } = renderUseSearchWishlistModal({
      isAuthenticated: false,
    });

    act(() => {
      result.current.openWishlistModal(0);
    });

    rerender({
      isAuthenticated: true,
    });

    act(() => {
      result.current.handleAuthSuccess();
    });

    expect(result.current.authModalOpen).toBe(false);
    expect(result.current.wishlistModalOpen).toBe(true);
    expect(result.current.selectedAccommodationForWishlist).toBe(0);
    expect(result.current.pendingAccommodationForWishlist).toBeNull();
  });

  it("clears the pending wishlist action when auth modal closes", () => {
    const { result } = renderUseSearchWishlistModal({
      isAuthenticated: false,
    });

    act(() => {
      result.current.openWishlistModal(0);
    });

    act(() => {
      result.current.closeAuthModal();
    });

    expect(result.current.authModalOpen).toBe(false);
    expect(result.current.pendingAccommodationForWishlist).toBeNull();
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });

  it("registers and cancels a data-only auth intent", () => {
    const cancel = jest.fn();
    const request = jest.fn(() => 17);
    const { result } = renderUseSearchWishlistModal({
      authIntent: {
        cancel,
        completeResume: jest.fn(),
        request,
        resumed: null,
      },
      isAuthenticated: false,
    });

    act(() => {
      result.current.openWishlistModal(7);
    });
    expect(request).toHaveBeenCalledWith(7);

    act(() => {
      result.current.closeAuthModal();
    });
    expect(cancel).toHaveBeenCalledWith(17);
  });

  it("opens wishlist selection once from a current intent claimed by the new session", () => {
    const completeResume = jest.fn();
    const isCurrent = jest.fn(() => true);
    const { result } = renderUseSearchWishlistModal({
      authIntent: {
        cancel: jest.fn(),
        completeResume,
        request: jest.fn(() => 18),
        resumed: {
          accommodationId: 9,
          attemptId: 18,
          isCurrent,
        },
      },
      isAuthenticated: true,
    });

    expect(isCurrent).toHaveBeenCalledTimes(1);
    expect(result.current.authModalOpen).toBe(false);
    expect(result.current.wishlistModalOpen).toBe(true);
    expect(result.current.selectedAccommodationForWishlist).toBe(9);
    expect(completeResume).toHaveBeenCalledWith(18);
  });

  it("closes synchronously with local state cleanup only", () => {
    const { result } = renderUseSearchWishlistModal({
      isAuthenticated: true,
    });

    act(() => {
      result.current.openWishlistModal(0);
    });

    let closeResult: ReturnType<typeof result.current.closeWishlistModal>;
    act(() => {
      closeResult = result.current.closeWishlistModal();
    });

    expect(closeResult!).toBeUndefined();
    expect(result.current.wishlistModalOpen).toBe(false);
    expect(result.current.selectedAccommodationForWishlist).toBeNull();
  });

  it("does not own query, API, logging, or cross-feature cache reconciliation", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/search/hooks/useSearchWishlistModal.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("useQueryClient");
    expect(source).not.toContain("wishlistApi");
    expect(source).not.toContain("clientLogger");
    expect(source).not.toContain("publicCache");
    expect(source).not.toContain("refreshAccommodationScopedWishlistMembershipCache");
  });
});

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { clientLogger } from "../../../utils/clientLogger";
import { refreshAccommodationScopedWishlistMembershipCache } from "../../wishlist/publicCache";

interface UseSearchWishlistModalOptions {
  isAuthenticated: boolean;
  onWishlistStatusChange: (
    accommodationId: number,
    isInWishlist: boolean
  ) => void;
  authIntent?: SearchWishlistAuthIntentBridge;
}

export interface SearchWishlistAuthIntentBridge {
  request(accommodationId: number): number;
  cancel(attemptId: number): void;
  resumed: {
    attemptId: number;
    accommodationId: number;
    isCurrent(): boolean;
  } | null;
  completeResume(attemptId: number): void;
}

export function useSearchWishlistModal({
  isAuthenticated,
  onWishlistStatusChange,
  authIntent,
}: UseSearchWishlistModalOptions) {
  const queryClient = useQueryClient();
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [
    selectedAccommodationForWishlist,
    setSelectedAccommodationForWishlist,
  ] = useState<number | null>(null);
  const [pendingAccommodationForWishlist, setPendingAccommodationForWishlist] =
    useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingAuthAttemptIdRef = useRef<number | null>(null);
  const handledResumeAttemptRef = useRef<number | null>(null);

  useEffect(() => {
    const resumed = authIntent?.resumed;
    if (!resumed || handledResumeAttemptRef.current === resumed.attemptId) {
      return;
    }

    handledResumeAttemptRef.current = resumed.attemptId;
    setAuthModalOpen(false);
    pendingAuthAttemptIdRef.current = null;
    setPendingAccommodationForWishlist(null);

    if (isAuthenticated && resumed.isCurrent()) {
      setSelectedAccommodationForWishlist(resumed.accommodationId);
      setWishlistModalOpen(true);
    }

    authIntent.completeResume(resumed.attemptId);
  }, [authIntent, isAuthenticated]);

  const openWishlistModal = useCallback(
    (accommodationId: number) => {
      if (!isAuthenticated) {
        const attemptId = authIntent?.request(accommodationId) ?? null;
        pendingAuthAttemptIdRef.current = attemptId;
        setPendingAccommodationForWishlist(accommodationId);
        setAuthModalOpen(true);
        return;
      }

      setSelectedAccommodationForWishlist(accommodationId);
      setWishlistModalOpen(true);
    },
    [authIntent, isAuthenticated]
  );

  const closeAuthModal = useCallback(() => {
    const attemptId = pendingAuthAttemptIdRef.current;
    pendingAuthAttemptIdRef.current = null;
    if (attemptId !== null) {
      authIntent?.cancel(attemptId);
    }
    setAuthModalOpen(false);
    setPendingAccommodationForWishlist(null);
  }, [authIntent]);

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);

    if (authIntent) {
      return;
    }

    if (pendingAccommodationForWishlist !== null) {
      setSelectedAccommodationForWishlist(pendingAccommodationForWishlist);
      setPendingAccommodationForWishlist(null);
      setWishlistModalOpen(true);
    }
  }, [authIntent, pendingAccommodationForWishlist]);

  const closeWishlistModal = useCallback(async () => {
    if (selectedAccommodationForWishlist !== null) {
      try {
        const membership = await refreshAccommodationScopedWishlistMembershipCache(
          queryClient,
          selectedAccommodationForWishlist,
        );

        onWishlistStatusChange(
          selectedAccommodationForWishlist,
          membership.isInAnyWishlist,
        );
      } catch (error) {
        clientLogger.error({
          message: "위시리스트 상태 확인 실패:",
          error,
        });
      }
    }

    setWishlistModalOpen(false);
    setSelectedAccommodationForWishlist(null);
  }, [onWishlistStatusChange, queryClient, selectedAccommodationForWishlist]);

  return {
    authModalOpen,
    closeAuthModal,
    closeWishlistModal,
    handleAuthSuccess,
    openWishlistModal,
    pendingAccommodationForWishlist,
    selectedAccommodationForWishlist,
    wishlistModalOpen,
  };
}

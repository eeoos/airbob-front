import { useCallback, useEffect, useRef, useState } from "react";

interface UseSearchWishlistModalOptions {
  isAuthenticated: boolean;
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
  authIntent,
}: UseSearchWishlistModalOptions) {
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

  const closeWishlistModal = useCallback(() => {
    setWishlistModalOpen(false);
    setSelectedAccommodationForWishlist(null);
  }, []);

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

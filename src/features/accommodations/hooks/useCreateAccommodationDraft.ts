import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationDraftApi } from "../api/accommodationDraftApi";
import type { AccommodationDraftApiPort } from "../ports/accommodationDraftApiPort";

interface UseCreateAccommodationDraftOptions {
  api?: AccommodationDraftApiPort;
  onCreated: (accommodationId: number) => void;
  onError: (error: unknown) => void;
}

export function useCreateAccommodationDraft({
  api = accommodationDraftApi,
  onCreated,
  onError,
}: UseCreateAccommodationDraftOptions) {
  const [isCreating, setIsCreating] = useState(false);
  const activePromiseRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const createDraft = useCallback((): Promise<void> => {
    const activePromise = activePromiseRef.current;
    if (activePromise) return activePromise;

    setIsCreating(true);
    const operation = (async () => {
      await Promise.resolve();

      try {
        const response = await api.create();
        if (isMountedRef.current) onCreated(response.id);
      } catch (error) {
        if (isMountedRef.current) onError(error);
      }
    })();
    activePromiseRef.current = operation;
    const releaseOperation = () => {
      if (activePromiseRef.current === operation) {
        activePromiseRef.current = null;
        if (isMountedRef.current) setIsCreating(false);
      }
    };
    void operation.then(releaseOperation, releaseOperation);
    return operation;
  }, [api, onCreated, onError]);

  return {
    createDraft,
    isCreating,
  };
}

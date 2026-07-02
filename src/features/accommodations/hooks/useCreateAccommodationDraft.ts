import { useCallback, useState } from "react";
import { accommodationApi } from "../../../api";

interface UseCreateAccommodationDraftOptions {
  onCreated: (accommodationId: number) => void;
  onError: (error: unknown) => void;
}

export function useCreateAccommodationDraft({
  onCreated,
  onError,
}: UseCreateAccommodationDraftOptions) {
  const [isCreating, setIsCreating] = useState(false);

  const createDraft = useCallback(async () => {
    if (isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      const response = await accommodationApi.create();
      onCreated(response.id);
    } catch (error) {
      onError(error);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, onCreated, onError]);

  return {
    createDraft,
    isCreating,
  };
}

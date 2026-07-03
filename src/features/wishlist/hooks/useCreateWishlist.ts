import { useCallback, useEffect, useState } from "react";
import { wishlistApi } from "../../../api/wishlist";
import { useApiError } from "../../../hooks/useApiError";

interface PreventableEvent {
  preventDefault: () => void;
}

interface UseCreateWishlistOptions {
  isOpen: boolean;
  onSuccess: (wishlistId: number) => void;
}

export function useCreateWishlist({
  isOpen,
  onSuccess,
}: UseCreateWishlistOptions) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { error, handleError, clearError } = useApiError();

  useEffect(() => {
    if (isOpen) {
      setName("");
      clearError();
    }
  }, [clearError, isOpen]);

  const updateName = useCallback((value: string) => {
    if (value.length <= 50) {
      setName(value);
    }
  }, []);

  const submit = useCallback(
    async (event: PreventableEvent) => {
      event.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }

      setIsLoading(true);
      clearError();

      try {
        const response = await wishlistApi.create({ name: trimmedName });
        onSuccess(response.id);
        setName("");
      } catch (error) {
        handleError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [clearError, handleError, name, onSuccess]
  );

  return {
    clearError,
    error,
    isLoading,
    name,
    submit,
    updateName,
  };
}

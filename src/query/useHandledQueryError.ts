import { useEffect, useRef } from "react";

interface UseHandledQueryErrorOptions {
  error: unknown;
  errorUpdatedAt: number;
  isError: boolean;
  onError: (error: unknown) => unknown;
}

export const useHandledQueryError = ({
  error,
  errorUpdatedAt,
  isError,
  onError,
}: UseHandledQueryErrorOptions) => {
  const handledErrorUpdatedAtRef = useRef(0);

  useEffect(() => {
    if (
      !isError ||
      !error ||
      handledErrorUpdatedAtRef.current === errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = errorUpdatedAt;
    onError(error);
  }, [error, errorUpdatedAt, isError, onError]);
};

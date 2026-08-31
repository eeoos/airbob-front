import { useCallback, useEffect, useState } from "react";

interface IntersectionLoadMoreOptions {
  readonly disabled?: boolean;
  readonly hasNext: boolean;
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
  readonly rootMargin?: string;
  readonly threshold?: number;
}

export const useIntersectionLoadMore = ({
  disabled = false,
  hasNext,
  isLoading,
  onLoadMore,
  rootMargin = "0px",
  threshold = 0.1,
}: IntersectionLoadMoreOptions) => {
  const [target, setTarget] = useState<Element | null>(null);
  const setObserverTarget = useCallback((node: Element | null) => {
    setTarget(node);
  }, []);

  useEffect(() => {
    if (
      target === null ||
      disabled ||
      !hasNext ||
      isLoading ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin, threshold },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [disabled, hasNext, isLoading, onLoadMore, rootMargin, target, threshold]);

  return setObserverTarget;
};

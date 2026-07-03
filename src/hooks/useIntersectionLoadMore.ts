import { useCallback, useEffect, useState } from "react";

interface UseIntersectionLoadMoreOptions {
  disabled?: boolean;
  hasNext: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

export const useIntersectionLoadMore = ({
  disabled = false,
  hasNext,
  isLoading,
  onLoadMore,
  threshold = 0.1,
}: UseIntersectionLoadMoreOptions) => {
  const [target, setTarget] = useState<Element | null>(null);

  const setObserverTarget = useCallback((node: Element | null) => {
    setTarget(node);
  }, []);

  useEffect(() => {
    if (!target || disabled || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNext && !isLoading) {
          onLoadMore();
        }
      },
      { threshold }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [disabled, hasNext, isLoading, onLoadMore, target, threshold]);

  return setObserverTarget;
};

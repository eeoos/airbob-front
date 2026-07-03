import { act, renderHook } from "@testing-library/react";
import { useIntersectionLoadMore } from "./useIntersectionLoadMore";

type ObserverCallback = IntersectionObserverCallback;

const intersectionEntry = (isIntersecting: boolean) =>
  ({ isIntersecting } as IntersectionObserverEntry);

describe("useIntersectionLoadMore", () => {
  let observerCallback: ObserverCallback | null;
  let observe: jest.Mock;
  let unobserve: jest.Mock;

  beforeEach(() => {
    observerCallback = null;
    observe = jest.fn();
    unobserve = jest.fn();

    (global as any).IntersectionObserver = jest.fn(
      (callback: ObserverCallback) => {
        observerCallback = callback;

        return {
          observe,
          unobserve,
        };
      }
    );
  });

  it("observes the assigned target and loads more when it intersects", () => {
    const loadMore = jest.fn();
    const target = document.createElement("div");
    const { result } = renderHook(() =>
      useIntersectionLoadMore({
        hasNext: true,
        isLoading: false,
        onLoadMore: loadMore,
      })
    );

    act(() => {
      result.current(target);
    });

    expect(observe).toHaveBeenCalledWith(target);

    act(() => {
      observerCallback?.([intersectionEntry(true)], {} as IntersectionObserver);
    });

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("does not load more while disabled, loading, or out of pages", () => {
    const loadMore = jest.fn();
    const target = document.createElement("div");
    const { result, rerender } = renderHook(
      ({
        disabled,
        hasNext,
        isLoading,
      }: {
        disabled: boolean;
        hasNext: boolean;
        isLoading: boolean;
      }) =>
        useIntersectionLoadMore({
          disabled,
          hasNext,
          isLoading,
          onLoadMore: loadMore,
        }),
      {
        initialProps: {
          disabled: true,
          hasNext: true,
          isLoading: false,
        },
      }
    );

    act(() => {
      result.current(target);
    });

    expect(observe).not.toHaveBeenCalled();

    rerender({ disabled: false, hasNext: false, isLoading: false });
    act(() => {
      observerCallback?.([intersectionEntry(true)], {} as IntersectionObserver);
    });

    rerender({ disabled: false, hasNext: true, isLoading: true });
    act(() => {
      observerCallback?.([intersectionEntry(true)], {} as IntersectionObserver);
    });

    expect(loadMore).not.toHaveBeenCalled();
  });

  it("unobserves the previous target when the target changes", () => {
    const firstTarget = document.createElement("div");
    const nextTarget = document.createElement("div");
    const { result } = renderHook(() =>
      useIntersectionLoadMore({
        hasNext: true,
        isLoading: false,
        onLoadMore: jest.fn(),
      })
    );

    act(() => {
      result.current(firstTarget);
    });
    act(() => {
      result.current(nextTarget);
    });

    expect(unobserve).toHaveBeenCalledWith(firstTarget);
    expect(observe).toHaveBeenLastCalledWith(nextTarget);
  });
});

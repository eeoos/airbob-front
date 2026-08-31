import { act, render, screen } from "@testing-library/react";
import { useIntersectionLoadMore } from "./useIntersectionLoadMore";

let intersectionCallback: IntersectionObserverCallback;
const disconnect = vi.fn();
const observe = vi.fn();

const ObserverHarness = ({
  disabled = false,
  hasNext = true,
  isLoading = false,
  onLoadMore,
  rootMargin,
}: {
  disabled?: boolean;
  hasNext?: boolean;
  isLoading?: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) => {
  const observerTarget = useIntersectionLoadMore({
    disabled,
    hasNext,
    isLoading,
    onLoadMore,
    ...(rootMargin === undefined ? {} : { rootMargin }),
  });

  return <div data-testid="load-more" ref={observerTarget} />;
};

describe("useIntersectionLoadMore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = vi.fn(function IntersectionObserverMock(
      callback,
      _options,
    ) {
      intersectionCallback = callback;
      return {
        disconnect,
        observe,
        root: null,
        rootMargin: "",
        takeRecords: () => [],
        thresholds: [],
        unobserve: vi.fn(),
      };
    });
  });

  it("loads only while enabled and disconnects when loading starts", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <ObserverHarness onLoadMore={onLoadMore} rootMargin="100px" />,
    );

    expect(observe).toHaveBeenCalledWith(screen.getByTestId("load-more"));
    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      { rootMargin: "100px", threshold: 0.1 },
    );
    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<ObserverHarness isLoading onLoadMore={onLoadMore} />);
    expect(disconnect).toHaveBeenCalled();
  });

  it("does not observe without more pages or browser observer support", () => {
    const originalObserver = global.IntersectionObserver;
    global.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;

    const { rerender } = render(
      <ObserverHarness hasNext={false} onLoadMore={vi.fn()} />,
    );
    expect(observe).not.toHaveBeenCalled();

    rerender(<ObserverHarness onLoadMore={vi.fn()} />);
    expect(observe).not.toHaveBeenCalled();
    global.IntersectionObserver = originalObserver;
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type {
  SearchRequest,
  SearchResultPage,
} from "../../features/search/model/search";
import type { SearchControllerProps } from "./SearchController";
import { SearchController } from "./SearchController";

const mockSearch = vi.fn();

vi.mock("../../features/search/api/searchApi", () => ({
  searchApi: {
    search: (...args: unknown[]) => mockSearch(...args),
  },
}));

vi.mock("../../features/search/hooks/useSearchBottomSheet", () => ({
  useSearchBottomSheet: () => ({
    bottomSheetRef: { current: null },
    bottomSheetState: "collapsed",
    handleBottomSheetScroll: vi.fn(),
    handleDrag: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragStart: vi.fn(),
    handleMapInteraction: vi.fn(),
    isMobileOrTablet: false,
    setBottomSheetState: vi.fn(),
    snapPositions: { collapsed: 0, half: 0, expanded: 0 },
    translateY: 0,
  }),
}));

vi.mock("../../features/search/hooks/useSearchMapState", () => ({
  useSearchMapState: () => ({
    handleAccommodationSelect: vi.fn(),
    hoveredAccommodationId: null,
    isMapExpanded: false,
    onMapBoundsUpdated: vi.fn(),
    requestMapBoundsUpdate: vi.fn(),
    selectAccommodationId: vi.fn(),
    selectedAccommodationId: null,
    setHoveredAccommodationId: vi.fn(),
    shouldUpdateMapBounds: false,
    toggleMapExpanded: vi.fn(),
  }),
}));

vi.mock("./SearchScreen", () => ({
  SearchScreen: ({
    results,
  }: {
    results: { accommodationCards: Array<{ name: string }> };
  }) => <div>{results.accommodationCards[0]?.name ?? "empty"}</div>,
}));

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const createResult = (id: number, name: string): SearchResultPage => ({
  accommodations: [
    {
      id,
      name,
      thumbnailUrl: null,
      basePrice: 100000,
      currency: "KRW",
      type: "APARTMENT",
      addressSummary: {
        country: "KR",
        state: null,
        city: "Seoul",
        district: null,
      },
      coordinate: { latitude: 37.5, longitude: 127 },
      reviewSummary: { totalCount: 0, averageRating: 0 },
      isInWishlist: false,
    },
  ],
  pageInfo: {
    pageSize: 18,
    currentPage: 0,
    totalPages: 1,
    totalElements: 1,
    isFirst: true,
    isLast: true,
    hasNext: false,
    hasPrevious: false,
  },
});

const createProps = (destination: string): SearchControllerProps => ({
  isAuthenticated: true,
  navigation: {
    getAccommodationHref: (id) => `/accommodations/${id}`,
    openAccommodation: vi.fn(),
    openPage: vi.fn(),
    replaceMapBounds: vi.fn(),
    scrollResultsToTop: vi.fn(),
  },
  routeState: {
    destination,
    page: 0,
    adultOccupancy: 1,
    childOccupancy: 0,
    infantOccupancy: 0,
    petOccupancy: 0,
  },
  scope: { subject: null, epoch: 4 },
});

describe("SearchController stale result fencing", () => {
  it("keeps result B visible when the aborted result A resolves last", async () => {
    const requestA = createDeferred<SearchResultPage>();
    const requestB = createDeferred<SearchResultPage>();
    const signals = new Map<string, AbortSignal>();
    mockSearch.mockImplementation(
      (request: SearchRequest, options: { signal: AbortSignal }) => {
        const destination = request.destination ?? "";
        signals.set(destination, options.signal);
        return destination === "A" ? requestA.promise : requestB.promise;
      },
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { gcTime: Infinity, retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const view = render(<SearchController {...createProps("A")} />, {
      wrapper,
    });

    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));

    view.rerender(<SearchController {...createProps("B")} />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
    expect(signals.get("A")?.aborted).toBe(true);

    await act(async () => {
      requestB.resolve(createResult(2, "B stay"));
      await requestB.promise;
    });
    expect(await screen.findByText("B stay")).toBeInTheDocument();

    await act(async () => {
      requestA.resolve(createResult(1, "A stay"));
      await requestA.promise;
    });

    expect(screen.getByText("B stay")).toBeInTheDocument();
    expect(screen.queryByText("A stay")).not.toBeInTheDocument();

    view.unmount();
    queryClient.clear();
  });
});

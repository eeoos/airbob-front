import { act, render } from "@testing-library/react";
import type { SearchResultPage } from "../../features/search/model/search";
import { AppError } from "../../platform/http/errors";
import type { SearchScreenProps } from "./SearchScreen";
import {
  SearchController,
  type SearchControllerProps,
} from "./SearchController";

let mockCapturedScreenProps: SearchScreenProps | null = null;
let mockQueryResult: {
  data: SearchResultPage | undefined;
  dataUpdatedAt: number;
  error: Error | null;
  errorUpdatedAt: number;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  refetch: ReturnType<typeof vi.fn>;
};

const mockUseSearchResultsReadQuery = vi.fn();
const mockSelectAccommodationId = vi.fn();
const mockSetIsMapDragMode = vi.fn();
const mockRequestMapBoundsUpdate = vi.fn();
const mockOnMapBoundsUpdated = vi.fn();

vi.mock("../../features/search/queries/searchQueries", () => ({
  useSearchResultsReadQuery: (options: unknown) => {
    mockUseSearchResultsReadQuery(options);
    return mockQueryResult;
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
    isMapDragMode: false,
    isMapExpanded: false,
    onMapBoundsUpdated: mockOnMapBoundsUpdated,
    requestMapBoundsUpdate: mockRequestMapBoundsUpdate,
    selectAccommodationId: mockSelectAccommodationId,
    selectedAccommodationId: null,
    setHoveredAccommodationId: vi.fn(),
    setIsMapDragMode: mockSetIsMapDragMode,
    shouldUpdateMapBounds: false,
    toggleMapExpanded: vi.fn(),
  }),
}));

vi.mock("./SearchScreen", () => ({
  SearchScreen: (props: SearchScreenProps) => {
    mockCapturedScreenProps = props;
    return <div data-testid="search-screen" />;
  },
}));

const resultPage: SearchResultPage = {
  accommodations: [
    {
      id: 7,
      name: "성수 숙소",
      thumbnailUrl: "/rooms/7.jpg",
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
      reviewSummary: { totalCount: 12, averageRating: 4.75 },
      isInWishlist: false,
    },
  ],
  pageInfo: {
    pageSize: 18,
    currentPage: 1,
    totalPages: 20,
    totalElements: 1200,
    isFirst: false,
    isLast: false,
    hasNext: true,
    hasPrevious: true,
  },
};

const navigation = () => ({
  getAccommodationHref: vi.fn(
    (id: number) => `/accommodations/${id}?adultOccupancy=2`,
  ),
  openAccommodation: vi.fn(),
  openPage: vi.fn(),
  replaceMapBounds: vi.fn(),
});

const baseProps = (
  overrides: Partial<SearchControllerProps> = {},
): SearchControllerProps => ({
  isAuthenticated: true,
  navigation: navigation(),
  routeState: {
    destination: "Seoul",
    page: 1,
    checkIn: "2026-07-10",
    checkOut: "2026-07-12",
    adultOccupancy: 2,
    childOccupancy: 1,
    infantOccupancy: 0,
    petOccupancy: 0,
  },
  scope: { subject: null, epoch: 3 },
  ...overrides,
});

const currentScreenProps = (): SearchScreenProps => {
  if (mockCapturedScreenProps === null) {
    throw new Error("SearchScreen was not rendered");
  }
  return mockCapturedScreenProps;
};

describe("SearchController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCapturedScreenProps = null;
    mockQueryResult = {
      data: resultPage,
      dataUpdatedAt: 1,
      error: null,
      errorUpdatedAt: 0,
      isError: false,
      isFetching: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    };
  });

  it("builds the scoped query from committed route state and maps domain results", () => {
    const props = baseProps();
    render(<SearchController {...props} />);

    expect(mockUseSearchResultsReadQuery).toHaveBeenLastCalledWith({
      request: {
        destination: "Seoul",
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultOccupancy: 2,
        childOccupancy: 1,
        infantOccupancy: 0,
        petOccupancy: 0,
        page: 1,
        size: 18,
      },
      scope: props.scope,
    });
    expect(currentScreenProps().results.totalPages).toBe(15);
    expect(currentScreenProps().results.totalElements).toBe(1200);
    expect(currentScreenProps().results.accommodationCards[0]).toMatchObject({
      id: 7,
      locationLabel: "Seoul의 아파트",
      reviewRatingLabel: "4.8",
    });
  });

  it("delegates detail, page and map navigation without browser access", () => {
    const commands = navigation();
    render(<SearchController {...baseProps({ navigation: commands })} />);

    act(() => currentScreenProps().onAccommodationOpen(7));
    expect(commands.openAccommodation).toHaveBeenCalledWith(7);
    expect(mockSelectAccommodationId).toHaveBeenCalledWith(7);
    expect(currentScreenProps().getAccommodationHref(7)).toBe(
      "/accommodations/7?adultOccupancy=2",
    );

    act(() => currentScreenProps().onPageChange(2));
    expect(commands.openPage).toHaveBeenCalledWith(2);

    const bounds = { north: 38, south: 37, east: 128, west: 126 };
    act(() => currentScreenProps().map.requestBounds(bounds));
    expect(commands.replaceMapBounds).toHaveBeenCalledWith(bounds);
  });

  it("applies deferred pagination effects only after the target request settles", () => {
    const commands = navigation();
    const view = render(
      <SearchController {...baseProps({ navigation: commands })} />,
    );

    act(() => currentScreenProps().onPageChange(2));

    mockQueryResult = {
      ...mockQueryResult,
      data: {
        ...resultPage,
        pageInfo: { ...resultPage.pageInfo, currentPage: 2 },
      },
      dataUpdatedAt: 2,
    };
    view.rerender(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: { ...baseProps().routeState, page: 2 },
        })}
      />,
    );

    expect(mockRequestMapBoundsUpdate).toHaveBeenCalledTimes(1);
  });

  it("lets a user drag cancel a pending pagination refit", () => {
    const commands = navigation();
    const view = render(
      <SearchController {...baseProps({ navigation: commands })} />,
    );

    act(() => currentScreenProps().onPageChange(2));

    mockQueryResult = {
      ...mockQueryResult,
      isFetching: true,
      isPlaceholderData: true,
    };
    const pageTwoProps = baseProps({
      navigation: commands,
      routeState: { ...baseProps().routeState, page: 2 },
    });
    view.rerender(<SearchController {...pageTwoProps} />);

    act(() => currentScreenProps().map.onBoundsDragStart());
    expect(currentScreenProps().map.isMapDragMode).toBe(true);
    expect(mockOnMapBoundsUpdated).toHaveBeenCalledTimes(1);

    mockQueryResult = {
      ...mockQueryResult,
      data: {
        ...resultPage,
        pageInfo: { ...resultPage.pageInfo, currentPage: 2 },
      },
      dataUpdatedAt: 2,
      isFetching: false,
      isPlaceholderData: false,
    };
    view.rerender(<SearchController {...pageTwoProps} />);

    expect(mockRequestMapBoundsUpdate).not.toHaveBeenCalled();

    act(() => currentScreenProps().map.onBoundsDragCancel());
    expect(currentScreenProps().map.isMapDragMode).toBe(false);
    expect(mockRequestMapBoundsUpdate).toHaveBeenCalledTimes(1);
  });

  it("restores a pending pagination refit when a no-op drag ends before the query", () => {
    const commands = navigation();
    const view = render(
      <SearchController {...baseProps({ navigation: commands })} />,
    );

    act(() => currentScreenProps().onPageChange(2));

    mockQueryResult = {
      ...mockQueryResult,
      isFetching: true,
      isPlaceholderData: true,
    };
    const pageTwoProps = baseProps({
      navigation: commands,
      routeState: { ...baseProps().routeState, page: 2 },
    });
    view.rerender(<SearchController {...pageTwoProps} />);

    act(() => {
      currentScreenProps().map.onBoundsDragStart();
      currentScreenProps().map.onBoundsDragCancel();
    });
    expect(mockRequestMapBoundsUpdate).not.toHaveBeenCalled();

    mockQueryResult = {
      ...mockQueryResult,
      data: {
        ...resultPage,
        pageInfo: { ...resultPage.pageInfo, currentPage: 2 },
      },
      dataUpdatedAt: 2,
      isFetching: false,
      isPlaceholderData: false,
    };
    view.rerender(<SearchController {...pageTwoProps} />);

    expect(mockRequestMapBoundsUpdate).toHaveBeenCalledTimes(1);
  });

  it("requests a result refit after a non-map search even when result ids stay the same", () => {
    const commands = navigation();
    const view = render(
      <SearchController {...baseProps({ navigation: commands })} />,
    );

    mockQueryResult = {
      ...mockQueryResult,
      dataUpdatedAt: 2,
    };
    view.rerender(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: {
            ...baseProps().routeState,
            destination: "Busan",
            page: 0,
          },
        })}
      />,
    );

    expect(mockRequestMapBoundsUpdate).toHaveBeenCalledTimes(1);
  });

  it("preserves a user viewport when its map-search result settles", () => {
    const commands = navigation();
    const view = render(
      <SearchController {...baseProps({ navigation: commands })} />,
    );

    mockQueryResult = {
      ...mockQueryResult,
      dataUpdatedAt: 2,
    };
    view.rerender(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: {
            page: 0,
            topLeftLat: 35.3,
            topLeftLng: 128.7,
            bottomRightLat: 34.9,
            bottomRightLng: 129.3,
            adultOccupancy: 1,
            childOccupancy: 0,
            infantOccupancy: 0,
            petOccupancy: 0,
          },
        })}
      />,
    );

    expect(mockRequestMapBoundsUpdate).not.toHaveBeenCalled();
  });

  it("drops stale page effects while refitting the superseding search", () => {
    const commands = navigation();
    const view = render(
      <SearchController {...baseProps({ navigation: commands })} />,
    );

    act(() => currentScreenProps().onPageChange(2));

    mockQueryResult = {
      ...mockQueryResult,
      isFetching: true,
      isPlaceholderData: true,
    };
    view.rerender(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: { ...baseProps().routeState, page: 2 },
        })}
      />,
    );

    mockQueryResult = {
      ...mockQueryResult,
      dataUpdatedAt: 3,
      isFetching: false,
      isPlaceholderData: false,
    };
    view.rerender(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: {
            ...baseProps().routeState,
            destination: "Busan",
            page: 0,
          },
        })}
      />,
    );

    expect(mockRequestMapBoundsUpdate).toHaveBeenCalledTimes(1);
  });

  it("derives map-drag mode from the committed viewport across pagination", () => {
    const commands = navigation();
    const view = render(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: {
            page: 1,
            topLeftLat: 38,
            topLeftLng: 126,
            bottomRightLat: 37,
            bottomRightLng: 128,
            adultOccupancy: 1,
            childOccupancy: 0,
            infantOccupancy: 0,
            petOccupancy: 0,
          },
        })}
      />,
    );

    expect(currentScreenProps().map.isMapDragMode).toBe(true);
    act(() => currentScreenProps().onPageChange(2));
    expect(currentScreenProps().map.isMapDragMode).toBe(true);
    expect(commands.openPage).toHaveBeenCalledWith(2);

    mockQueryResult = {
      ...mockQueryResult,
      data: {
        ...resultPage,
        pageInfo: { ...resultPage.pageInfo, currentPage: 2 },
      },
      dataUpdatedAt: 2,
    };
    view.rerender(
      <SearchController
        {...baseProps({
          navigation: commands,
          routeState: {
            page: 2,
            topLeftLat: 38,
            topLeftLng: 126,
            bottomRightLat: 37,
            bottomRightLng: 128,
            adultOccupancy: 1,
            childOccupancy: 0,
            infantOccupancy: 0,
            petOccupancy: 0,
          },
        })}
      />,
    );

    expect(mockRequestMapBoundsUpdate).toHaveBeenCalledTimes(1);
  });

  it("gates wishlist intent behind auth and cancels the active attempt", () => {
    const authIntent = {
      request: vi.fn().mockReturnValue(41),
      cancel: vi.fn(),
      resumed: null,
      completeResume: vi.fn(),
    };
    render(
      <SearchController
        {...baseProps({
          isAuthenticated: false,
          wishlistAuthIntent: authIntent,
        })}
      />,
    );

    act(() => currentScreenProps().onWishlistToggle?.(7));
    expect(authIntent.request).toHaveBeenCalledWith(7);
    expect(currentScreenProps().authModal.isOpen).toBe(true);

    act(() => currentScreenProps().authModal.onClose());
    expect(authIntent.cancel).toHaveBeenCalledWith(41);
    expect(currentScreenProps().authModal.isOpen).toBe(false);
  });

  it("surfaces query errors from the controller while keeping the query pure", () => {
    mockQueryResult = {
      ...mockQueryResult,
      data: undefined,
      error: new AppError({
        kind: "server",
        code: "SERVER_ERROR",
        message: "검색 서버 연결 실패",
        retryable: true,
      }),
      errorUpdatedAt: 2,
      isError: true,
    };

    render(<SearchController {...baseProps()} />);

    expect(currentScreenProps().errorMessage).toBe(
      "검색 결과를 불러오지 못했습니다.",
    );
    expect(currentScreenProps().isErrorRetryable).toBe(true);

    act(() => currentScreenProps().onRetry());
    expect(mockQueryResult.refetch).toHaveBeenCalledTimes(1);
  });

  it("clears a same-request error after a successful refetch settles", () => {
    mockQueryResult = {
      ...mockQueryResult,
      data: undefined,
      error: new AppError({
        kind: "server",
        code: "SERVER_ERROR",
        message: "검색 서버 연결 실패",
        retryable: true,
      }),
      errorUpdatedAt: 2,
      isError: true,
    };
    const props = baseProps();
    const view = render(<SearchController {...props} />);

    expect(currentScreenProps().errorMessage).toBe(
      "검색 결과를 불러오지 못했습니다.",
    );

    mockQueryResult = {
      ...mockQueryResult,
      data: resultPage,
      dataUpdatedAt: 3,
      error: null,
      isError: false,
      isFetching: false,
      isPlaceholderData: false,
    };
    view.rerender(<SearchController {...props} />);

    expect(currentScreenProps().errorMessage).toBeNull();
  });

  it("keeps the last successful page when a same-family page transition fails", () => {
    const props = baseProps();
    const view = render(<SearchController {...props} />);

    mockQueryResult = {
      ...mockQueryResult,
      data: undefined,
      error: new AppError({
        kind: "server",
        code: "SERVER_ERROR",
        message: "다음 페이지를 불러오지 못했습니다.",
        retryable: true,
      }),
      errorUpdatedAt: 2,
      isError: true,
    };
    view.rerender(
      <SearchController
        {...props}
        routeState={{ ...props.routeState, page: 2 }}
      />,
    );

    expect(currentScreenProps().results.accommodationCards).toHaveLength(1);
    expect(currentScreenProps().results.accommodationCards[0]?.id).toBe(7);
    expect(currentScreenProps().results.isPlaceholderData).toBe(true);
    expect(currentScreenProps().errorMessage).toBe(
      "검색 결과를 불러오지 못했습니다.",
    );
  });

  it("does not expose retry for non-retryable search failures", () => {
    mockQueryResult = {
      ...mockQueryResult,
      data: undefined,
      error: new AppError({
        kind: "validation",
        code: "VALIDATION_ERROR",
        message: "검색 조건을 확인해주세요.",
      }),
      errorUpdatedAt: 2,
      isError: true,
    };

    render(<SearchController {...baseProps()} />);

    expect(currentScreenProps().isErrorRetryable).toBe(false);
    expect(currentScreenProps().errorMessage).toBe("검색 조건을 확인해주세요.");
  });
});

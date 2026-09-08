import { createRef, forwardRef, type HTMLAttributes, type Ref } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SearchScreenProps } from "./SearchScreen";
import { SearchScreen } from "./SearchScreen";

const mockMap = vi.fn();
const mockResultsList = vi.fn();
const mockPagination = vi.fn();

vi.mock("framer-motion", () => {
  return {
    motion: {
      div: forwardRef(function MotionDiv(
        {
          children,
          drag,
          dragControls,
          dragConstraints,
          dragElastic,
          dragListener,
          dragMomentum,
          onDrag,
          onDragEnd,
          onDragStart,
          ...props
        }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>,
        ref: Ref<HTMLDivElement>,
      ) {
        return (
          <div ref={ref} {...props}>
            {children}
          </div>
        );
      }),
      section: forwardRef(function MotionSection(
        {
          children,
          drag,
          dragControls,
          dragConstraints,
          dragElastic,
          dragListener,
          dragMomentum,
          onDrag,
          onDragEnd,
          onDragStart,
          ...props
        }: HTMLAttributes<HTMLElement> & Record<string, unknown>,
        ref: Ref<HTMLElement>,
      ) {
        return (
          <section ref={ref} {...props}>
            {children}
          </section>
        );
      }),
    },
  };
});

vi.mock("../../features/search/components/SearchMap", () => ({
  Map: (props: unknown) => {
    mockMap(props);
    return <section data-testid="search-map" />;
  },
}));

vi.mock("../../features/search/components/SearchResultsList", () => ({
  SearchResultsList: (props: {
    errorMessage?: string | null;
    layout: string;
    onAccommodationClick: (accommodationId: number) => void;
    onWishlistToggle?: (accommodationId: number) => void;
  }) => {
    mockResultsList(props);
    return (
      <section data-testid="search-results" data-layout={props.layout}>
        <button type="button" onClick={() => props.onAccommodationClick(7)}>
          open result
        </button>
        <button type="button" onClick={() => props.onWishlistToggle?.(7)}>
          save result
        </button>
      </section>
    );
  },
}));

vi.mock("../../features/search/components/SearchPagination", () => ({
  SearchPagination: (props: {
    currentPage: number;
    onPageChange: (page: number) => void;
    variant?: "compact" | "full";
  }) => {
    mockPagination(props);
    return (
      <button
        data-pagination-variant={props.variant ?? "full"}
        type="button"
        onClick={() => props.onPageChange(2)}
      >
        next page
      </button>
    );
  },
}));

vi.mock("../../features/auth/public", () => ({
  DeferredAuthModal: ({ isOpen }: { isOpen: boolean }) => (
    <section data-testid="auth-modal" data-open={String(isOpen)} />
  ),
}));

vi.mock("../../features/wishlist/components/WishlistModal", () => ({
  WishlistModal: ({ accommodationId }: { accommodationId: number }) => (
    <section data-testid="wishlist-modal">{accommodationId}</section>
  ),
}));

const createProps = (
  overrides: Partial<SearchScreenProps> = {},
): SearchScreenProps => ({
  authModal: { isOpen: false, onClose: vi.fn() },
  bottomSheet: {
    bottomSheetRef: createRef<HTMLDivElement>(),
    bottomSheetHeaderRef: createRef<HTMLDivElement>(),
    bottomSheetHandleRef: createRef<HTMLButtonElement>(),
    bottomSheetState: "collapsed",
    dragControls: {} as SearchScreenProps["bottomSheet"]["dragControls"],
    handleBottomSheetKeyDown: vi.fn(),
    handleBottomSheetPointerDown: vi.fn(),
    handleBottomSheetPointerEnd: vi.fn(),
    handleBottomSheetToggle: vi.fn(),
    handleDrag: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragStart: vi.fn(),
    handleMapInteraction: vi.fn(),
    isDragging: false,
    isMobileOrTablet: false,
    snapPositions: { collapsed: 691, half: 382, expanded: 0 },
    translateY: 0,
    visibleSheetHeight: 72,
  },
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  errorMessage: null,
  getAccommodationHref: (id) => `/accommodations/${id}`,
  isErrorRetryable: false,
  map: {
    boundsRequestKey: "seoul-page-1",
    handleAccommodationSelect: vi.fn(),
    hoveredAccommodationId: null,
    isMapDragMode: false,
    isMapExpanded: false,
    onBoundsDragCancel: vi.fn(),
    onBoundsDragStart: vi.fn(),
    onMapBoundsUpdated: vi.fn(),
    requestBounds: vi.fn(),
    selectedAccommodationId: null,
    setHoveredAccommodationId: vi.fn(),
    shouldUpdateMapBounds: false,
    toggleMapExpanded: vi.fn(),
    viewport: null,
  },
  onAccommodationOpen: vi.fn(),
  onPageChange: vi.fn(),
  onRetry: vi.fn(),
  onWishlistToggle: vi.fn(),
  results: {
    accommodationCards: [
      {
        id: 7,
        name: "남산 전망 숙소",
        thumbnailUrl: null,
        locationLabel: "서울의 아파트",
        showReview: true,
        reviewRatingLabel: "4.8",
        reviewCountLabel: "(12)",
        basePrice: 120000,
        currency: "KRW",
        isInWishlist: false,
      },
    ],
    accommodationMapItems: [
      {
        id: 7,
        name: "남산 전망 숙소",
        thumbnailUrl: null,
        locationLabel: "서울",
        showReview: true,
        reviewRatingLabel: "4.8",
        reviewCountLabel: "(12)",
        basePrice: 120000,
        currency: "KRW",
        isInWishlist: false,
        coordinate: { latitude: 37.5, longitude: 127 },
      },
    ],
    currentPage: 1,
    isLoading: false,
    isPlaceholderData: false,
    isRefreshing: false,
    totalElements: 42,
    totalPages: 3,
  },
  wishlistModal: null,
  ...overrides,
});

describe("SearchScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the desktop results/map structure and delegates commands", () => {
    const props = createProps();
    render(<SearchScreen {...props} />);

    expect(screen.getByRole("heading", { name: "숙소 42개" })).toBeVisible();
    expect(screen.getByTestId("search-results")).toHaveAttribute(
      "data-layout",
      "desktop",
    );
    expect(screen.getByTestId("search-map")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "open result" }));
    fireEvent.click(screen.getByRole("button", { name: "save result" }));
    fireEvent.click(screen.getByRole("button", { name: "next page" }));

    expect(props.onAccommodationOpen).toHaveBeenCalledWith(7);
    expect(props.onWishlistToggle).toHaveBeenCalledWith(7);
    expect(props.onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: "next page" })).toHaveAttribute(
      "data-pagination-variant",
      "full",
    );
  });

  it.each([false, true])(
    "scrolls new result pages to the top without resetting refreshes (mobile: %s)",
    (isMobileOrTablet) => {
      const base = createProps();
      const props = createProps({
        bottomSheet: {
          ...base.bottomSheet,
          isMobileOrTablet,
          bottomSheetState: "expanded",
        },
      });
      const view = render(<SearchScreen {...props} />);
      const scrollArea = screen.getByRole(
        isMobileOrTablet ? "group" : "region",
        {
          name: isMobileOrTablet ? "검색 결과 목록" : "숙소 목록 스크롤",
        },
      );
      scrollArea.scrollTop = 300;

      view.rerender(
        <SearchScreen
          {...props}
          results={{
            ...props.results,
            isRefreshing: true,
            isPlaceholderData: true,
          }}
        />,
      );
      expect(scrollArea.scrollTop).toBe(300);

      view.rerender(
        <SearchScreen
          {...props}
          results={{ ...props.results, currentPage: 2 }}
        />,
      );
      expect(scrollArea.scrollTop).toBe(0);

      scrollArea.scrollTop = 200;
      view.rerender(
        <SearchScreen
          {...props}
          results={{ ...props.results, currentPage: 2, isRefreshing: true }}
        />,
      );
      expect(scrollArea.scrollTop).toBe(200);
    },
  );

  it("removes the collapsed result pane from navigation in expanded map mode", () => {
    const base = createProps();

    render(
      <SearchScreen {...base} map={{ ...base.map, isMapExpanded: true }} />,
    );

    const resultsPane = screen.getByLabelText("숙소 검색 결과 패널");
    expect(resultsPane).toHaveAttribute("role", "region");
    expect(resultsPane).toHaveAttribute("aria-hidden", "true");
    expect(resultsPane).toHaveAttribute("inert");
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({ isExpanded: true }),
    );
  });

  it("preserves the mobile map/bottom-sheet structure and modal/error hosts", () => {
    const props = createProps({
      bottomSheet: {
        ...createProps().bottomSheet,
        bottomSheetState: "half",
        isMobileOrTablet: true,
      },
      errorMessage: "검색 요청 실패",
      results: {
        ...createProps().results,
        totalElements: 1200,
      },
      wishlistModal: {
        accommodationId: 7,
        commands: {} as NonNullable<
          SearchScreenProps["wishlistModal"]
        >["commands"],
        onClose: vi.fn(),
        scope: { subject: "subject:7", epoch: 3 } as NonNullable<
          SearchScreenProps["wishlistModal"]
        >["scope"],
      },
    });

    render(<SearchScreen {...props} />);

    expect(
      screen.getByRole("heading", { name: "숙소 1,000개 이상" }),
    ).toBeVisible();
    expect(screen.getByTestId("search-results")).toHaveAttribute(
      "data-layout",
      "bottomSheet",
    );
    expect(mockResultsList).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "검색 요청 실패" }),
    );
    expect(mockMap.mock.lastCall?.[0]).not.toHaveProperty("onExpandToggle");
    expect(screen.getByTestId("wishlist-modal")).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: "next page" })).toHaveAttribute(
      "data-pagination-variant",
      "compact",
    );
  });

  it("connects a named keyboard handle to the mobile result region", () => {
    const handleBottomSheetKeyDown = vi.fn();
    const handleBottomSheetPointerDown = vi.fn();
    const handleBottomSheetPointerEnd = vi.fn();
    const handleBottomSheetToggle = vi.fn();
    const props = createProps({
      bottomSheet: {
        ...createProps().bottomSheet,
        bottomSheetState: "half",
        handleBottomSheetKeyDown,
        handleBottomSheetPointerDown,
        handleBottomSheetPointerEnd,
        handleBottomSheetToggle,
        isMobileOrTablet: true,
      },
    });

    const view = render(<SearchScreen {...props} />);
    const region = screen.getByRole("region", { name: "숙소 42개" });
    const handle = screen.getByRole("button", {
      name: "검색 결과 패널 조절, 현재 중간",
    });
    const content = screen.getByRole("group", { name: "검색 결과 목록" });
    const contentId = handle.getAttribute("aria-controls");

    expect(region).toContainElement(handle);
    expect(handle).toHaveAttribute("aria-expanded", "true");
    expect(handle).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowDown Home End",
    );
    expect(contentId).toBeTruthy();
    expect(content).toHaveAttribute("id", contentId as string);
    expect(content).not.toHaveAttribute("hidden");

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.pointerDown(handle);
    fireEvent.pointerUp(handle);
    fireEvent.click(handle);

    expect(handleBottomSheetKeyDown).toHaveBeenCalledTimes(1);
    expect(handleBottomSheetPointerDown).toHaveBeenCalledTimes(1);
    expect(handleBottomSheetPointerEnd).toHaveBeenCalledTimes(1);
    expect(handleBottomSheetToggle).toHaveBeenCalledTimes(1);

    view.rerender(
      <SearchScreen
        {...props}
        bottomSheet={{ ...props.bottomSheet, bottomSheetState: "collapsed" }}
      />,
    );

    const collapsedHandle = screen.getByRole("button", {
      name: "검색 결과 패널 조절, 현재 접힘",
    });
    expect(collapsedHandle).toHaveAttribute("aria-expanded", "false");
    expect(collapsedHandle).toHaveAttribute("aria-controls", contentId);
    expect(content).toHaveAttribute("hidden");

    view.rerender(
      <SearchScreen
        {...props}
        bottomSheet={{
          ...props.bottomSheet,
          bottomSheetState: "collapsed",
          isDragging: true,
        }}
      />,
    );

    expect(content).not.toHaveAttribute("hidden");
    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(content).toHaveAttribute("inert");
  });

  it("offers an accessible map return action only from the expanded sheet", () => {
    const base = createProps();
    const handleMapInteraction = vi.fn();
    const view = render(
      <SearchScreen
        {...base}
        bottomSheet={{
          ...base.bottomSheet,
          bottomSheetState: "half",
          handleMapInteraction,
          isMobileOrTablet: true,
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "지도 보기" }),
    ).not.toBeInTheDocument();

    view.rerender(
      <SearchScreen
        {...base}
        bottomSheet={{
          ...base.bottomSheet,
          bottomSheetState: "expanded",
          handleMapInteraction,
          isMobileOrTablet: true,
        }}
      />,
    );

    const sheet = screen.getByRole("region", { name: "숙소 42개" });
    const mapButton = screen.getByRole("button", { name: "지도 보기" });
    const mobileMap = screen.getByTestId("search-mobile-map-layer");

    expect(sheet).toHaveAttribute("data-bottom-sheet", "search-results");
    expect(sheet).toHaveAttribute("data-state", "expanded");
    expect(mobileMap).toHaveAttribute("aria-hidden", "true");
    expect(mobileMap).toHaveAttribute("inert");
    fireEvent.click(mapButton);
    expect(handleMapInteraction).toHaveBeenCalledTimes(1);
  });

  it("loads the account dialog only when authentication is requested", async () => {
    const closedProps = createProps();
    const view = render(<SearchScreen {...closedProps} />);

    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();

    view.rerender(
      <SearchScreen
        {...closedProps}
        authModal={{ ...closedProps.authModal, isOpen: true }}
      />,
    );

    expect(await screen.findByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
  });
});

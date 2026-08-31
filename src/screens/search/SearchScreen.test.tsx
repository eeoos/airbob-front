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
          dragConstraints,
          dragElastic,
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
          dragConstraints,
          dragElastic,
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

vi.mock("../../features/auth/components/AuthModal", () => ({
  AuthModal: ({ isOpen }: { isOpen: boolean }) => (
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
    bottomSheetHandleRef: createRef<HTMLButtonElement>(),
    bottomSheetState: "collapsed",
    handleBottomSheetScroll: vi.fn(),
    handleBottomSheetKeyDown: vi.fn(),
    handleBottomSheetToggle: vi.fn(),
    handleDrag: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragStart: vi.fn(),
    handleMapInteraction: vi.fn(),
    isMobileOrTablet: false,
    snapPositions: { collapsed: 0, half: 250, expanded: 500 },
    translateY: 0,
  },
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  errorMessage: null,
  getAccommodationHref: (id) => `/accommodations/${id}`,
  map: {
    handleAccommodationSelect: vi.fn(),
    hoveredAccommodationId: null,
    isMapDragMode: false,
    isMapExpanded: false,
    onMapBoundsUpdated: vi.fn(),
    requestBounds: vi.fn(),
    selectedAccommodationId: null,
    setHoveredAccommodationId: vi.fn(),
    shouldUpdateMapBounds: false,
    toggleMapExpanded: vi.fn(),
    viewport: null,
  },
  onAccommodationOpen: vi.fn(),
  onClearError: vi.fn(),
  onPageChange: vi.fn(),
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
    expect(screen.getByText("검색 요청 실패")).toBeVisible();
    expect(screen.getByTestId("wishlist-modal")).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: "next page" })).toHaveAttribute(
      "data-pagination-variant",
      "compact",
    );
  });

  it("connects a named keyboard handle to the mobile result region", () => {
    const handleBottomSheetKeyDown = vi.fn();
    const handleBottomSheetToggle = vi.fn();
    const props = createProps({
      bottomSheet: {
        ...createProps().bottomSheet,
        bottomSheetState: "half",
        handleBottomSheetKeyDown,
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
    fireEvent.click(handle);

    expect(handleBottomSheetKeyDown).toHaveBeenCalledTimes(1);
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
  });
});

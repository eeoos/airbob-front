import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SearchScreenProps } from "./SearchScreen";
import { SearchScreen } from "./SearchScreen";

const mockMap = jest.fn();
const mockResultsList = jest.fn();
const mockPagination = jest.fn();

jest.mock("framer-motion", () => {
  const React = require("react");

  return {
    motion: {
      div: React.forwardRef(
        (
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
          }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>,
          ref: React.Ref<HTMLDivElement>,
        ) => (
          <div ref={ref} {...props}>
            {children}
          </div>
        ),
      ),
    },
  };
});

jest.mock("../../features/search/components/SearchMap", () => ({
  Map: (props: unknown) => {
    mockMap(props);
    return <section data-testid="search-map" />;
  },
}));

jest.mock("../../features/search/components/SearchResultsList", () => ({
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

jest.mock("../../features/search/components/SearchPagination", () => ({
  SearchPagination: (props: {
    currentPage: number;
    onPageChange: (page: number) => void;
  }) => {
    mockPagination(props);
    return (
      <button type="button" onClick={() => props.onPageChange(2)}>
        next page
      </button>
    );
  },
}));

jest.mock("../../features/auth/components/AuthModal", () => ({
  AuthModal: ({ isOpen }: { isOpen: boolean }) => (
    <section data-testid="auth-modal" data-open={String(isOpen)} />
  ),
}));

jest.mock("../../features/wishlist/components/WishlistModal", () => ({
  WishlistModal: ({ accommodationId }: { accommodationId: number }) => (
    <section data-testid="wishlist-modal">{accommodationId}</section>
  ),
}));

const createProps = (
  overrides: Partial<SearchScreenProps> = {},
): SearchScreenProps => ({
  authModal: { isOpen: false, onClose: jest.fn() },
  bottomSheet: {
    bottomSheetRef: createRef<HTMLDivElement>(),
    bottomSheetState: "collapsed",
    handleBottomSheetScroll: jest.fn(),
    handleDrag: jest.fn(),
    handleDragEnd: jest.fn(),
    handleDragStart: jest.fn(),
    handleMapInteraction: jest.fn(),
    isMobileOrTablet: false,
    snapPositions: { collapsed: 0, half: 250, expanded: 500 },
    translateY: 0,
  },
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  errorMessage: null,
  getAccommodationHref: (id) => `/accommodations/${id}`,
  map: {
    handleAccommodationSelect: jest.fn(),
    hoveredAccommodationId: null,
    isMapDragMode: false,
    isMapExpanded: false,
    onMapBoundsUpdated: jest.fn(),
    requestBounds: jest.fn(),
    selectedAccommodationId: null,
    setHoveredAccommodationId: jest.fn(),
    shouldUpdateMapBounds: false,
    toggleMapExpanded: jest.fn(),
    viewport: null,
  },
  onAccommodationOpen: jest.fn(),
  onClearError: jest.fn(),
  onPageChange: jest.fn(),
  onWishlistToggle: jest.fn(),
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
    jest.clearAllMocks();
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
        onClose: jest.fn(),
        scope: { subject: "subject:7", epoch: 3 } as NonNullable<
          SearchScreenProps["wishlistModal"]
        >["scope"],
      },
    });

    render(<SearchScreen {...props} />);

    expect(screen.getByRole("heading", { name: "숙소 1,000개 이상" })).toBeVisible();
    expect(screen.getByTestId("search-results")).toHaveAttribute(
      "data-layout",
      "bottomSheet",
    );
    expect(screen.getByText("검색 요청 실패")).toBeVisible();
    expect(screen.getByTestId("wishlist-modal")).toHaveTextContent("7");
  });
});

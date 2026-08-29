import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import path from "path";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import type { WishlistModalCommandPort } from "../wishlist/appShell";
import type {
  SearchAccommodationCardViewModel,
  SearchAccommodationMapViewModel,
} from "./lib/searchAccommodationViewModel";
import { SearchRoute } from "./SearchRoute";

const mockUseSearchRouteController = jest.fn();
const mockOpenWishlistModal = jest.fn();
const mockCloseAuthModal = jest.fn();
const mockCloseWishlistModal = jest.fn();
const mockHandleAuthSuccess = jest.fn();
const mockOpenAccommodationDetail = jest.fn();
let mockWishlistModalProps:
  | {
      accommodationId: number;
      commands: WishlistModalCommandPort;
      isOpen: boolean;
      onClose: () => void;
      scope: AuthenticatedSessionScope;
    }
  | undefined;

const wishlistScope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 3,
};
const wishlistCommands: WishlistModalCommandPort = {
  addAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
  }),
  removeAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: false,
  }),
  createAndAddAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
    wishlistId: 11,
  }),
};
const wishlistMembership = {
  commands: wishlistCommands,
  scope: wishlistScope,
};

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
          }: React.HTMLAttributes<HTMLDivElement> & {
            drag?: unknown;
            dragConstraints?: unknown;
            dragElastic?: unknown;
            dragMomentum?: unknown;
            onDrag?: unknown;
            onDragEnd?: unknown;
            onDragStart?: unknown;
          },
          ref: React.Ref<HTMLDivElement>
        ) => (
          <div ref={ref} {...props}>
            {children}
          </div>
        )
      ),
    },
  };
});

jest.mock("../auth/appShell", () => ({
  AuthModal: ({
    isOpen,
    initialMode,
    onClose,
    onSuccess,
  }: {
    isOpen: boolean;
    initialMode?: "login" | "signup";
    onClose: () => void;
    onSuccess?: () => void;
  }) => (
    <section
      data-testid="auth-modal"
      data-open={String(isOpen)}
      data-initial-mode={initialMode}
    >
      <button type="button" onClick={onClose}>
        close auth
      </button>
      <button type="button" onClick={onSuccess}>
        auth success
      </button>
    </section>
  ),
}));

jest.mock("../wishlist/appShell", () => ({
  WishlistModal: (props: {
    accommodationId: number;
    commands: WishlistModalCommandPort;
    isOpen: boolean;
    onClose: () => void;
    scope: AuthenticatedSessionScope;
  }) => {
    mockWishlistModalProps = props;
    return (
      <section
        data-testid="wishlist-modal"
        data-accommodation-id={props.accommodationId}
        data-open={String(props.isOpen)}
      >
        <button type="button" onClick={props.onClose}>
          close wishlist
        </button>
      </section>
    );
  },
}));

jest.mock("./components/SearchMap", () => ({
  Map: ({
    accommodations,
    onWishlistToggle,
  }: {
    accommodations: SearchAccommodationMapViewModel[];
    onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
  }) => (
    <section data-testid="search-map">
      <div data-testid="search-map-count">{accommodations.length}</div>
      <button
        type="button"
        disabled={!onWishlistToggle}
        onClick={() => {
          const firstAccommodation = accommodations[0];
          if (firstAccommodation) {
            onWishlistToggle?.(
              firstAccommodation.id,
              firstAccommodation.isInWishlist
            );
          }
        }}
      >
        map wishlist
      </button>
    </section>
  ),
}));

jest.mock("./components/SearchPagination", () => ({
  SearchPagination: ({
    currentPage,
    totalPages,
  }: {
    currentPage: number;
    totalPages: number;
  }) => (
    <nav data-testid="search-pagination">
      {currentPage + 1}/{totalPages}
    </nav>
  ),
}));

jest.mock("./components/SearchResultsList", () => ({
  SearchResultsList: ({
    accommodations,
    layout,
    onAccommodationClick,
    onWishlistToggle,
  }: {
    accommodations: SearchAccommodationCardViewModel[];
    layout?: "desktop" | "bottomSheet";
    onAccommodationClick: (accommodationId: number) => void;
    onWishlistToggle?: (accommodationId: number) => void;
  }) => (
    <section data-testid="search-results-list" data-layout={layout}>
      <div data-testid="search-results-count">{accommodations.length}</div>
      {accommodations.map((accommodation) => (
        <article key={accommodation.id}>
          <h3>{accommodation.name}</h3>
          <button
            type="button"
            disabled={!onWishlistToggle}
            onClick={() => onWishlistToggle?.(accommodation.id)}
          >
            {`wishlist ${accommodation.id}`}
          </button>
          <button
            type="button"
            onClick={() => onAccommodationClick(accommodation.id)}
          >
            {`open ${accommodation.id}`}
          </button>
        </article>
      ))}
    </section>
  ),
}));

jest.mock("./hooks/useSearchRouteController", () => ({
  useSearchRouteController: (options: unknown) =>
    mockUseSearchRouteController(options),
}));

const accommodationCards: SearchAccommodationCardViewModel[] = [
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
  {
    id: 11,
    name: "한강 근처 숙소",
    thumbnailUrl: null,
    locationLabel: "서울의 주택",
    showReview: false,
    reviewRatingLabel: "0.0",
    reviewCountLabel: "(0)",
    basePrice: 90000,
    currency: "KRW",
    isInWishlist: true,
  },
];

const accommodationMapItems: SearchAccommodationMapViewModel[] =
  accommodationCards.map((accommodation, index) => ({
    ...accommodation,
    coordinate: {
      latitude: 37.5 + index,
      longitude: 127 + index,
    },
  }));

const renderSearchRoute = (
  wishlistAuthIntent?: Parameters<typeof SearchRoute>[0]["wishlistAuthIntent"],
) =>
  render(
    <SearchRoute
      searchParams={
        new URLSearchParams(
          "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12"
        )
      }
      setSearchParams={jest.fn()}
      wishlistAuthIntent={wishlistAuthIntent}
      wishlistMembership={wishlistMembership}
    />
  );

const renderSearchRouteWithoutWishlistMembership = () =>
  render(
    <SearchRoute
      searchParams={new URLSearchParams("destination=Seoul")}
      setSearchParams={jest.fn()}
    />,
  );

describe("SearchRoute structure", () => {
  it("keeps route orchestration in useSearchRouteController", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "src/features/search/SearchRoute.tsx"),
      "utf8"
    );

    expect(routeSource).toContain("useSearchRouteController");
    expect(routeSource).not.toContain("window.open(");
    expect(routeSource).not.toContain("routeTo.accommodationDetail");
    expect(routeSource).not.toContain("useSearchResults({");
    expect(routeSource).not.toContain("useSearchWishlistModal({");
  });
});

describe("SearchRoute", () => {
  beforeEach(() => {
    mockUseSearchRouteController.mockClear();
    mockWishlistModalProps = undefined;
    mockUseSearchRouteController.mockReturnValue({
      bottomSheet: {
        bottomSheetState: "expanded",
        isMobileOrTablet: false,
        bottomSheetRef: { current: null },
        snapPositions: {
          expanded: 600,
          collapsed: 120,
        },
        translateY: 0,
        handleDragStart: jest.fn(),
        handleDrag: jest.fn(),
        handleDragEnd: jest.fn(),
        handleMapInteraction: jest.fn(),
        handleBottomSheetScroll: jest.fn(),
      },
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      clearError: jest.fn(),
      error: null,
      hasResults: true,
      mapState: {
        selectedAccommodationId: 7,
        hoveredAccommodationId: null,
        isMapExpanded: false,
        isMapDragMode: false,
        shouldUpdateMapBounds: false,
        setHoveredAccommodationId: jest.fn(),
        setIsMapDragMode: jest.fn(),
        handleAccommodationSelect: jest.fn(),
        selectAccommodationId: jest.fn(),
        toggleMapExpanded: jest.fn(),
        requestMapBoundsUpdate: jest.fn(),
        onMapBoundsUpdated: jest.fn(),
      },
      openAccommodationDetail: mockOpenAccommodationDetail,
      searchResults: {
        accommodationCards,
        accommodationMapItems,
        isPlaceholderData: false,
        isLoading: false,
        currentPage: 0,
        totalPages: 3,
        totalElements: accommodationCards.length,
        handleMapBoundsChange: jest.fn(),
        handlePageChange: jest.fn(),
      },
      wishlist: {
        authModalOpen: true,
        closeAuthModal: mockCloseAuthModal,
        closeWishlistModal: mockCloseWishlistModal,
        handleAuthSuccess: mockHandleAuthSuccess,
        openWishlistModal: mockOpenWishlistModal,
        selectedAccommodationForWishlist: accommodationCards[0].id,
        wishlistModalOpen: true,
      },
    });
    mockOpenWishlistModal.mockClear();
    mockCloseAuthModal.mockClear();
    mockCloseWishlistModal.mockClear();
    mockHandleAuthSuccess.mockClear();
    mockOpenAccommodationDetail.mockClear();
  });

  it("composes the results, map, wishlist modal, and auth modal shell", () => {
    renderSearchRoute();

    expect(
      screen.getByRole("heading", { name: "숙소 2개" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("search-results-list")).toHaveAttribute(
      "data-layout",
      "desktop"
    );
    expect(screen.getByTestId("search-results-count")).toHaveTextContent("2");
    expect(screen.getByText("남산 전망 숙소")).toBeInTheDocument();
    expect(screen.getByTestId("search-map")).toBeInTheDocument();
    expect(screen.getByTestId("search-map-count")).toHaveTextContent("2");
    expect(screen.getByTestId("search-pagination")).toHaveTextContent("1/3");
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-initial-mode",
      "login"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-accommodation-id",
      "7"
    );
    expect(mockWishlistModalProps).toMatchObject({
      commands: wishlistCommands,
      scope: wishlistScope,
    });

    fireEvent.click(screen.getByRole("button", { name: "wishlist 11" }));
    fireEvent.click(screen.getByRole("button", { name: "map wishlist" }));
    fireEvent.click(screen.getByRole("button", { name: "open 11" }));

    expect(mockOpenWishlistModal).toHaveBeenNthCalledWith(1, 11);
    expect(mockOpenWishlistModal).toHaveBeenNthCalledWith(2, 7, false);
    expect(mockOpenAccommodationDetail).toHaveBeenCalledWith(11);
  });

  it("does not render wishlist UI without a current injected membership boundary", () => {
    renderSearchRouteWithoutWishlistMembership();

    expect(screen.queryByTestId("wishlist-modal")).not.toBeInTheDocument();
    expect(mockWishlistModalProps).toBeUndefined();
  });

  it("blocks wishlist interaction while visible results are placeholder data", () => {
    const controller = mockUseSearchRouteController();
    mockUseSearchRouteController.mockReturnValue({
      ...controller,
      searchResults: {
        ...controller.searchResults,
        isPlaceholderData: true,
      },
    });

    renderSearchRoute();

    expect(screen.getByRole("button", { name: "wishlist 7" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "map wishlist" })).toBeDisabled();
    expect(screen.queryByTestId("wishlist-modal")).not.toBeInTheDocument();
  });

  it("does not attach an old-generation auth success callback when an intent owner exists", () => {
    const wishlistAuthIntent = {
      cancel: jest.fn(),
      completeResume: jest.fn(),
      request: jest.fn(() => 1),
      resumed: null,
    };

    renderSearchRoute(wishlistAuthIntent);
    fireEvent.click(screen.getByRole("button", { name: "auth success" }));

    expect(mockHandleAuthSuccess).not.toHaveBeenCalled();
    expect(mockUseSearchRouteController).toHaveBeenCalledWith(
      expect.objectContaining({ wishlistAuthIntent }),
    );
  });

  it("defines the selected result style with existing focus and brand tokens", () => {
    const css = readFileSync(`${__dirname}/SearchRoute.module.css`, "utf8");

    expect(css).toContain(".selected");
    expect(css).toContain("outline: 2px solid var(--color-brand-coral);");
    expect(css).toContain("outline-offset: 2px;");
    expect(css).toContain("box-shadow: var(--focus-ring);");
    expect(css).not.toContain("outline: none !important");
    expect(css).toMatch(
      /\.results:focus-visible\s*\{[\s\S]*box-shadow:\s*var\(--focus-ring\);/
    );
  });
});

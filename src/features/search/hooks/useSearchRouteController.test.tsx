import { renderHook } from "@testing-library/react";
import { useSearchRouteController } from "./useSearchRouteController";

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    clearError: jest.fn(),
    error: null,
    handleError: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

const mockSelectAccommodationId = jest.fn();
const mockSetIsMapDragMode = jest.fn();
const mockRequestMapBoundsUpdate = jest.fn();
const mockUpdateAccommodationWishlistStatus = jest.fn();
const mockUseSearchResults = jest.fn();
const mockUseSearchWishlistModal = jest.fn();

jest.mock("./useSearchMapState", () => ({
  useSearchMapState: () => ({
    hoveredAccommodationId: null,
    isMapDragMode: false,
    isMapExpanded: false,
    onMapBoundsUpdated: jest.fn(),
    requestMapBoundsUpdate: mockRequestMapBoundsUpdate,
    selectAccommodationId: mockSelectAccommodationId,
    selectedAccommodationId: null,
    setHoveredAccommodationId: jest.fn(),
    setIsMapDragMode: mockSetIsMapDragMode,
    shouldUpdateMapBounds: false,
    toggleMapExpanded: jest.fn(),
    handleAccommodationSelect: jest.fn(),
  }),
}));

jest.mock("./useSearchResults", () => ({
  useSearchResults: (options: unknown) => {
    mockUseSearchResults(options);
    return {
      accommodationCards: [],
      accommodationMapItems: [],
      currentPage: 0,
      handleMapBoundsChange: jest.fn(),
      handlePageChange: jest.fn(),
      isLoading: false,
      totalElements: 0,
      totalPages: 0,
      updateAccommodationWishlistStatus: mockUpdateAccommodationWishlistStatus,
    };
  },
}));

jest.mock("./useSearchBottomSheet", () => ({
  useSearchBottomSheet: () => ({
    bottomSheetRef: { current: null },
    bottomSheetState: "collapsed",
    handleBottomSheetScroll: jest.fn(),
    handleDrag: jest.fn(),
    handleDragEnd: jest.fn(),
    handleDragStart: jest.fn(),
    handleMapInteraction: jest.fn(),
    isMobileOrTablet: false,
    snapPositions: { collapsed: 0, expanded: 0 },
    translateY: 0,
  }),
}));

jest.mock("./useSearchWishlistModal", () => ({
  useSearchWishlistModal: (options: unknown) => {
    mockUseSearchWishlistModal(options);
    return {
      authModalOpen: false,
      closeAuthModal: jest.fn(),
      closeWishlistModal: jest.fn(),
      handleAuthSuccess: jest.fn(),
      openWishlistModal: jest.fn(),
      selectedAccommodationForWishlist: null,
      wishlistModalOpen: false,
    };
  },
}));

describe("useSearchRouteController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens accommodation detail with booking query params and records selection", () => {
    const openWindow = jest.fn();
    const { result } = renderHook(() =>
      useSearchRouteController({
        openWindow,
        searchParams: new URLSearchParams(
          "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
        ),
        setSearchParams: jest.fn(),
      })
    );

    result.current.openAccommodationDetail(42);

    expect(openWindow).toHaveBeenCalledWith(
      "/accommodations/42?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
      "_blank"
    );
    expect(mockSelectAccommodationId).toHaveBeenCalledWith(42);
  });

  it("wires map state, auth state, and wishlist updates into child hooks", () => {
    const searchParams = new URLSearchParams("destination=Seoul");
    const setSearchParams = jest.fn();

    renderHook(() =>
      useSearchRouteController({
        searchParams,
        setSearchParams,
      })
    );

    expect(mockUseSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMapBoundsUpdate: mockRequestMapBoundsUpdate,
        searchParams,
        setIsMapDragMode: mockSetIsMapDragMode,
        setSearchParams,
      })
    );
    expect(mockUseSearchWishlistModal).toHaveBeenCalledWith({
      isAuthenticated: true,
      onWishlistStatusChange: mockUpdateAccommodationWishlistStatus,
    });
  });
});

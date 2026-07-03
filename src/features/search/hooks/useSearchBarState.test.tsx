import { act, renderHook, waitFor } from "@testing-library/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePlacesAutocomplete } from "../../../hooks/usePlacesAutocomplete";
import { useSearchBarState } from "./useSearchBarState";

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: jest.fn(),
    useNavigate: jest.fn(),
    useSearchParams: jest.fn(),
  }),
  { virtual: true }
);

jest.mock("../../../hooks/usePlacesAutocomplete", () => ({
  usePlacesAutocomplete: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();
const mockHandleInputChange = jest.fn();
const mockHandlePlaceSelect = jest.fn();
const mockResetPlaces = jest.fn();
const mockStartNewSession = jest.fn();

let currentSearchParams = new URLSearchParams();
let currentPathname = "/search";
let placesState: {
  inputText: string;
  suggestions: any[];
  isLoading: boolean;
  selectedPlace: any;
};

const setBrowserSearch = (queryString: string) => {
  window.history.pushState(null, "", `/search${queryString}`);
};

describe("useSearchBarState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockReset();
    mockSetSearchParams.mockReset();
    mockHandleInputChange.mockReset();
    mockHandlePlaceSelect.mockReset();
    mockResetPlaces.mockReset();
    mockStartNewSession.mockReset();

    currentSearchParams = new URLSearchParams();
    currentPathname = "/search";
    placesState = {
      inputText: "",
      suggestions: [],
      isLoading: false,
      selectedPlace: null,
    };

    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
    jest.mocked(useLocation).mockImplementation(() => ({
      pathname: currentPathname,
    } as any));
    jest.mocked(useSearchParams).mockImplementation(() => [
      currentSearchParams,
      mockSetSearchParams,
    ] as any);
    jest.mocked(usePlacesAutocomplete).mockImplementation((options = {}) => ({
      inputText: placesState.inputText,
      suggestions: placesState.suggestions,
      isLoading: placesState.isLoading,
      selectedPlace: placesState.selectedPlace,
      handleInputChange: mockHandleInputChange,
      handlePlaceSelect: mockHandlePlaceSelect,
      reset: mockResetPlaces,
      startNewSession: mockStartNewSession,
    } as any));
    setBrowserSearch("");
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("loads initial destination, dates, and guests from URL params", async () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1"
    );

    const { result } = renderHook(() => useSearchBarState());

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("Seoul");
    });

    expect(result.current.checkIn?.toISOString().slice(0, 10)).toBe("2026-07-10");
    expect(result.current.checkOut?.toISOString().slice(0, 10)).toBe("2026-07-12");
    expect(result.current.adultOccupancy).toBe(2);
    expect(result.current.childOccupancy).toBe(1);
    expect(result.current.infantOccupancy).toBe(1);
    expect(result.current.petOccupancy).toBe(1);
  });

  it("submits plain text search by navigating with stale viewport removed", () => {
    placesState.inputText = "Busan";
    setBrowserSearch(
      "?destination=Seoul&page=3&lat=37&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
    );

    const { result } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.handleSearch();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Busan&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
    expect(result.current.showDatePicker).toBe(false);
    expect(result.current.showGuestPicker).toBe(false);
    expect(result.current.showSuggestions).toBe(false);
  });

  it("calls onSearch with selected place coordinates instead of navigating", () => {
    const onSearch = jest.fn();
    placesState.inputText = "Seoul";
    placesState.selectedPlace = {
      placeId: "place-1",
      lat: 37.5665,
      lng: 126.978,
      viewport: {
        north: 37.7,
        south: 37.4,
        east: 127.1,
        west: 126.8,
      },
    };

    const { result } = renderHook(() => useSearchBarState({ onSearch }));

    act(() => {
      result.current.handleSearch();
    });

    expect(onSearch).toHaveBeenCalledWith({
      destination: "Seoul",
      lat: 37.5665,
      lng: 126.978,
      viewport: {
        north: 37.7,
        south: 37.4,
        east: 127.1,
        west: 126.8,
      },
      checkIn: undefined,
      checkOut: undefined,
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("treats zero latitude and longitude as valid selected place coordinates", () => {
    placesState.inputText = "Null Island";
    placesState.selectedPlace = {
      placeId: "place-zero",
      lat: 0,
      lng: 0,
      viewport: {
        north: 1,
        south: -1,
        east: 1,
        west: -1,
      },
    };

    const { result } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.handleSearch();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Null+Island&lat=0&lng=0&topLeftLat=1&topLeftLng=-1&bottomRightLat=-1&bottomRightLng=1&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
  });

  it("opens date picker and guest picker as mutually exclusive panels", () => {
    const onExpandedChange = jest.fn();
    const { result } = renderHook(() => useSearchBarState({ onExpandedChange }));

    act(() => {
      result.current.openDatePicker();
    });

    expect(result.current.isExpanded).toBe(true);
    expect(result.current.showDatePicker).toBe(true);
    expect(result.current.showGuestPicker).toBe(false);
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    act(() => {
      result.current.toggleGuestPicker();
    });

    expect(result.current.isExpanded).toBe(true);
    expect(result.current.showDatePicker).toBe(false);
    expect(result.current.showGuestPicker).toBe(true);
  });

  it("removes only viewport keys when exiting map drag mode from search page", () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&lat=37&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
    );

    const { result } = renderHook(() =>
      useSearchBarState({ isMapDragMode: true })
    );

    act(() => {
      result.current.exitMapDragMode();
    });

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const nextParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextParams.get("destination")).toBe("Seoul");
    expect(nextParams.get("lat")).toBe("37");
    expect(nextParams.get("lng")).toBe("127");
    expect(nextParams.has("topLeftLat")).toBe(false);
    expect(nextParams.has("topLeftLng")).toBe(false);
    expect(nextParams.has("bottomRightLat")).toBe(false);
    expect(nextParams.has("bottomRightLng")).toBe(false);
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });
  });
});

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
const mockHandleInputChange = jest.fn((value: string) => {
  placesState.inputText = value;
});
const mockHandlePlaceSelect = jest.fn();
const mockResetPlaces = jest.fn(() => {
  placesState.inputText = "";
  placesState.suggestions = [];
  placesState.selectedPlace = null;
});
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

const getLocalDateKey = (date: Date | null | undefined) => {
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

describe("useSearchBarState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockReset();
    mockSetSearchParams.mockReset();
    mockHandleInputChange.mockClear();
    mockHandlePlaceSelect.mockReset();
    mockResetPlaces.mockClear();
    mockStartNewSession.mockReset();

    currentSearchParams = new URLSearchParams();
    currentPathname = "/search";
    placesState = {
      inputText: "",
      suggestions: [],
      isLoading: false,
      selectedPlace: null,
    };
    mockHandleInputChange.mockImplementation((value: string) => {
      placesState.inputText = value;
    });
    mockResetPlaces.mockImplementation(() => {
      placesState.inputText = "";
      placesState.suggestions = [];
      placesState.selectedPlace = null;
    });

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

    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-07-10");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-07-12");
    expect(result.current.guests.adultOccupancy).toBe(2);
    expect(result.current.guests.childOccupancy).toBe(1);
    expect(result.current.guests.infantOccupancy).toBe(1);
    expect(result.current.guests.petOccupancy).toBe(1);
  });

  it("returns grouped state instead of exposing every field at the top level", () => {
    const { result } = renderHook(() => useSearchBarState());

    expect(result.current).toEqual(
      expect.objectContaining({
        destination: expect.any(Object),
        dates: expect.any(Object),
        guests: expect.any(Object),
        popover: expect.any(Object),
        actions: expect.any(Object),
        status: expect.any(Object),
      })
    );
    expect(result.current).not.toHaveProperty("checkIn");
    expect(result.current).not.toHaveProperty("handleSearch");
  });

  it("syncs search bar state when URL search params change after mount", async () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1"
    );

    const { result, rerender } = renderHook(() => useSearchBarState());

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("Seoul");
    });
    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-07-10");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-07-12");
    expect(result.current.guests.adultOccupancy).toBe(2);
    expect(result.current.guests.childOccupancy).toBe(1);
    expect(result.current.guests.infantOccupancy).toBe(1);
    expect(result.current.guests.petOccupancy).toBe(1);

    mockHandleInputChange.mockClear();
    currentSearchParams = new URLSearchParams(
      "destination=Busan&checkIn=2026-08-01&checkOut=2026-08-04&adultOccupancy=4&childOccupancy=2&infantOccupancy=1&petOccupancy=1"
    );
    rerender();

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("Busan");
    });
    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-08-01");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-08-04");
    expect(result.current.guests.adultOccupancy).toBe(4);
    expect(result.current.guests.childOccupancy).toBe(2);
    expect(result.current.guests.infantOccupancy).toBe(1);
    expect(result.current.guests.petOccupancy).toBe(1);

    mockHandleInputChange.mockClear();
    currentSearchParams = new URLSearchParams();
    rerender();

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("");
    });
    expect(result.current.dates.checkIn).toBeNull();
    expect(result.current.dates.checkOut).toBeNull();
    expect(result.current.guests.adultOccupancy).toBe(1);
    expect(result.current.guests.childOccupancy).toBe(0);
    expect(result.current.guests.infantOccupancy).toBe(0);
    expect(result.current.guests.petOccupancy).toBe(0);
  });

  it("falls back to defaults for malformed URL dates and guest counts", async () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&checkIn=2026-02-31&checkOut=not-a-date&adultOccupancy=0&childOccupancy=1.5&infantOccupancy=-1&petOccupancy=2abc"
    );

    const { result } = renderHook(() => useSearchBarState());

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("Seoul");
    });
    expect(result.current.dates.checkIn).toBeNull();
    expect(result.current.dates.checkOut).toBeNull();
    expect(result.current.guests.adultOccupancy).toBe(1);
    expect(result.current.guests.childOccupancy).toBe(0);
    expect(result.current.guests.infantOccupancy).toBe(0);
    expect(result.current.guests.petOccupancy).toBe(0);
  });

  it("clears stale selected place when URL sync changes the destination", async () => {
    currentSearchParams = new URLSearchParams("destination=Seoul");
    placesState.inputText = "Seoul";
    placesState.selectedPlace = {
      placeId: "stale-place",
      lat: 37.5665,
      lng: 126.978,
      viewport: {
        north: 37.7,
        south: 37.4,
        east: 127.1,
        west: 126.8,
      },
    };

    const { result, rerender } = renderHook(() => useSearchBarState());

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("Seoul");
    });

    mockHandleInputChange.mockClear();
    mockResetPlaces.mockClear();
    mockNavigate.mockClear();
    currentSearchParams = new URLSearchParams("destination=Busan");
    rerender();

    await waitFor(() => {
      expect(mockResetPlaces).toHaveBeenCalled();
      expect(mockHandleInputChange).toHaveBeenCalledWith("Busan");
    });
    rerender();

    act(() => {
      result.current.actions.handleSearch();
    });

    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
    expect(navigatedUrl).toBe(
      "/search?destination=Busan&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
    expect(navigatedUrl).not.toContain("lat=");
    expect(navigatedUrl).not.toContain("lng=");
    expect(navigatedUrl).not.toContain("topLeftLat=");
    expect(navigatedUrl).not.toContain("topLeftLng=");
    expect(navigatedUrl).not.toContain("bottomRightLat=");
    expect(navigatedUrl).not.toContain("bottomRightLng=");
  });

  it("does not reset local input when unrelated URL params change", async () => {
    currentSearchParams = new URLSearchParams("destination=Seoul");

    const { result, rerender } = renderHook(() => useSearchBarState());

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith("Seoul");
    });

    placesState.inputText = "Seoul cafe";
    rerender();
    mockHandleInputChange.mockClear();
    mockResetPlaces.mockClear();
    mockNavigate.mockClear();
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&page=2&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
    );
    rerender();

    expect(mockHandleInputChange).not.toHaveBeenCalled();
    expect(mockResetPlaces).not.toHaveBeenCalled();

    act(() => {
      result.current.actions.handleSearch();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Seoul+cafe&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
  });

  it("submits plain text search by navigating with stale viewport removed", () => {
    placesState.inputText = "Busan";
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&page=3&lat=37&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
    );
    setBrowserSearch("");

    const { result } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.actions.handleSearch();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Busan&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
    expect(result.current.popover.showDatePicker).toBe(false);
    expect(result.current.popover.showGuestPicker).toBe(false);
    expect(result.current.popover.showSuggestions).toBe(false);
  });

  it("uses the latest typed destination for route-ready search submission", () => {
    const { result, rerender } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.actions.handleInputChange("Gangneung");
    });
    rerender();

    act(() => {
      result.current.actions.handleSearch();
    });

    expect(mockHandleInputChange).toHaveBeenCalledWith("Gangneung");
    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Gangneung&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
  });

  it("normalizes reversed date selections so check-in stays before check-out", () => {
    const { result } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.actions.handleDateSelect(
        new Date(2026, 6, 12),
        new Date(2026, 6, 10)
      );
    });

    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-07-10");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-07-12");
  });

  it("clamps guest count setters to their minimum values", () => {
    const { result } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.actions.setAdultOccupancy(0);
      result.current.actions.setChildOccupancy(-1);
      result.current.actions.setInfantOccupancy(-1);
      result.current.actions.setPetOccupancy(-1);
    });

    expect(result.current.guests.adultOccupancy).toBe(1);
    expect(result.current.guests.childOccupancy).toBe(0);
    expect(result.current.guests.infantOccupancy).toBe(0);
    expect(result.current.guests.petOccupancy).toBe(0);
  });

  it("builds search params from router params instead of browser global search", () => {
    placesState.inputText = "Jeju";
    currentSearchParams = new URLSearchParams("destination=Seoul&page=3");
    setBrowserSearch(
      "?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&page=3"
    );

    const { result } = renderHook(() => useSearchBarState());

    act(() => {
      result.current.actions.handleSearch();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Jeju&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
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
      result.current.actions.handleSearch();
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
      result.current.actions.handleSearch();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Null+Island&lat=0&lng=0&topLeftLat=1&topLeftLng=-1&bottomRightLat=-1&bottomRightLng=1&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
    );
  });

  it("opens date picker and guest picker as mutually exclusive panels", () => {
    const onExpandedChange = jest.fn();
    const { result } = renderHook(() => useSearchBarState({ onExpandedChange }));

    act(() => {
      result.current.actions.openDatePicker();
    });

    expect(result.current.popover.isExpanded).toBe(true);
    expect(result.current.popover.showDatePicker).toBe(true);
    expect(result.current.popover.showGuestPicker).toBe(false);
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    act(() => {
      result.current.actions.toggleGuestPicker();
    });

    expect(result.current.popover.isExpanded).toBe(true);
    expect(result.current.popover.showDatePicker).toBe(false);
    expect(result.current.popover.showGuestPicker).toBe(true);
  });

  it("removes only viewport keys when exiting map drag mode from search page", () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&lat=37&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
    );

    const { result } = renderHook(() =>
      useSearchBarState({ isMapDragMode: true })
    );

    act(() => {
      result.current.actions.exitMapDragMode();
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

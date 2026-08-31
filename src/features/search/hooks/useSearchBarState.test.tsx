import { act, renderHook } from "@testing-library/react";
import { requireDefined } from "../../../test/assertions";
import {
  type PlacePrediction,
  type SelectedPlace,
  usePlacesAutocomplete,
} from "./usePlacesAutocomplete";
import {
  type SearchBarRoutePort,
  useSearchBarState,
} from "./useSearchBarState";

const getSearchParamsFromCall = (
  mock: ReturnType<typeof vi.fn>,
  label: string,
): URLSearchParams => {
  const call = requireDefined(mock.mock.calls[0], `${label} call`);
  const params = requireDefined(call[0], `${label} params`);
  if (!(params instanceof URLSearchParams)) {
    throw new Error(`Expected ${label} params to be URLSearchParams`);
  }
  return params;
};

vi.mock("./usePlacesAutocomplete", () => ({
  usePlacesAutocomplete: vi.fn(),
}));

const mockPushSearch = vi.fn();
const mockReplaceSearch = vi.fn();
const mockHandleInputChange = vi.fn();
const mockHandlePlaceSelect = vi.fn();
const mockResetPlaces = vi.fn();
const mockStartNewSession = vi.fn();

const seoulPrediction: PlacePrediction = {
  placeId: "place-1",
  description: "서울, 대한민국",
  mainText: "서울",
  secondaryText: "대한민국",
};
const seoulPlace: SelectedPlace = {
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

let currentSearchParams = new URLSearchParams();
let currentPathname = "/search";
let placesOptions: Parameters<typeof usePlacesAutocomplete>[0];
let placesState: {
  suggestions: PlacePrediction[];
  isLoading: boolean;
};

const createRoutePort = (): SearchBarRoutePort => ({
  currentSearchParams,
  isSearchRoute: currentPathname === "/search",
  pushSearch: mockPushSearch,
  replaceSearch: mockReplaceSearch,
});

const getLocalDateKey = (date: Date | null | undefined) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

describe("useSearchBarState", () => {
  beforeEach(() => {
    mockPushSearch.mockReset();
    mockReplaceSearch.mockReset();
    mockHandleInputChange.mockReset();
    mockHandlePlaceSelect.mockReset();
    mockResetPlaces.mockReset();
    mockStartNewSession.mockReset();
    currentSearchParams = new URLSearchParams();
    currentPathname = "/search";
    placesState = { suggestions: [], isLoading: false };
    placesOptions = undefined;

    vi.mocked(usePlacesAutocomplete).mockImplementation((options = {}) => {
      placesOptions = options;
      return {
        inputText: "integration-owned-text-is-ignored",
        suggestions: placesState.suggestions,
        isLoading: placesState.isLoading,
        selectedPlace: null,
        handleInputChange: mockHandleInputChange,
        handlePlaceSelect: mockHandlePlaceSelect,
        reset: mockResetPlaces,
        startNewSession: mockStartNewSession,
      } as any;
    });
    mockHandlePlaceSelect.mockImplementation(async () => {
      placesOptions?.onPlaceSelect?.(seoulPlace);
    });
  });

  it("hydrates destination, dates, and guests atomically on the first render", () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1",
    );

    const { result } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    expect(result.current.destination.inputText).toBe("Seoul");
    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-07-10");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-07-12");
    expect(result.current.guests).toEqual({
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 1,
      petOccupancy: 1,
      totalGuests: 3,
    });
  });

  it("keeps the grouped public contract and does not expose reducer internals", () => {
    const { result } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        destination: expect.any(Object),
        dates: expect.any(Object),
        guests: expect.any(Object),
        popover: expect.any(Object),
        actions: expect.any(Object),
        status: expect.any(Object),
      }),
    );
    expect(result.current).not.toHaveProperty("interaction");
    expect(result.current.actions).not.toHaveProperty("setShowDatePicker");
    expect(result.current.actions).not.toHaveProperty("setExpanded");
  });

  it("does not overwrite an active draft for page and bounds-only URL changes", () => {
    currentSearchParams = new URLSearchParams("destination=Seoul");
    const { result, rerender } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    act(() => {
      result.current.actions.openDestination();
      result.current.actions.changeDestination("Seoul cafe");
    });
    mockHandleInputChange.mockClear();
    mockResetPlaces.mockClear();

    currentSearchParams = new URLSearchParams(
      "destination=Seoul&page=2&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128",
    );
    rerender();

    expect(result.current.destination.inputText).toBe("Seoul cafe");
    expect(result.current.popover.activePopover).toBe("destination");
    expect(mockHandleInputChange).not.toHaveBeenCalled();
    expect(mockResetPlaces).not.toHaveBeenCalled();
  });

  it("atomically replaces the draft when committed search fields change", () => {
    currentSearchParams = new URLSearchParams("destination=Seoul");
    const { result, rerender } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    act(() => {
      result.current.actions.changeDestination("Seoul cafe");
    });

    currentSearchParams = new URLSearchParams(
      "destination=Busan&checkIn=2026-08-01&checkOut=2026-08-04&adultOccupancy=4&childOccupancy=2&infantOccupancy=1&petOccupancy=1",
    );
    rerender();

    expect(result.current.destination.inputText).toBe("Busan");
    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-08-01");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-08-04");
    expect(result.current.guests.totalGuests).toBe(6);
  });

  it("falls back to defaults for malformed committed dates and counts", () => {
    currentSearchParams = new URLSearchParams(
      "checkIn=2026-02-31&checkOut=nope&adultOccupancy=0&childOccupancy=1.5&infantOccupancy=-1&petOccupancy=2abc",
    );

    const { result } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    expect(result.current.dates.checkIn).toBeNull();
    expect(result.current.dates.checkOut).toBeNull();
    expect(result.current.guests).toEqual({
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
      totalGuests: 1,
    });
  });

  it("submits a text draft with stale viewport and page removed", () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&page=3&lat=37&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128",
    );
    const { result } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    act(() => {
      result.current.actions.changeDestination("Busan");
    });
    act(() => {
      result.current.actions.handleSearch();
    });

    expect(mockPushSearch).toHaveBeenCalledTimes(1);
    expect(
      getSearchParamsFromCall(mockPushSearch, "pushSearch").toString(),
    ).toBe(
      "destination=Busan&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0",
    );
  });

  it("commits selected place details into the reducer before submission", async () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() =>
      useSearchBarState({ onSearch, routePort: createRoutePort() }),
    );

    await act(async () => {
      result.current.actions.selectDestination(seoulPrediction);
      await Promise.resolve();
    });

    expect(result.current.destination.inputText).toBe("서울, 대한민국");
    expect(result.current.destination.selectedPlace).toEqual(seoulPlace);

    act(() => {
      result.current.actions.handleSearch();
    });

    expect(onSearch).toHaveBeenCalledWith({
      destination: "서울, 대한민국",
      lat: seoulPlace.lat,
      lng: seoulPlace.lng,
      viewport: seoulPlace.viewport,
      checkIn: undefined,
      checkOut: undefined,
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });
  });

  it("normalizes reversed dates and clamps all guest update paths", () => {
    const { result } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    act(() => {
      result.current.actions.handleDateSelect(
        new Date(2026, 6, 12),
        new Date(2026, 6, 10),
      );
      result.current.actions.changeAdultOccupancy(0);
      result.current.actions.changeChildOccupancy(-1);
      result.current.actions.changeInfantOccupancy(Number.NaN);
      result.current.actions.changePetOccupancy(-1);
    });

    expect(getLocalDateKey(result.current.dates.checkIn)).toBe("2026-07-10");
    expect(getLocalDateKey(result.current.dates.checkOut)).toBe("2026-07-12");
    expect(result.current.guests).toEqual({
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
      totalGuests: 1,
    });
  });

  it("projects shell and active-popover transitions from one reducer", () => {
    const { result } = renderHook(() =>
      useSearchBarState({ routePort: createRoutePort() }),
    );

    act(() => {
      result.current.actions.openDatePicker();
    });

    expect(result.current.popover.isExpanded).toBe(true);
    expect(result.current.popover.activePopover).toBe("date");
    act(() => {
      result.current.actions.toggleGuestPicker();
    });
    expect(result.current.popover.activePopover).toBe("guests");

    act(() => {
      result.current.actions.collapseShell();
    });
    expect(result.current.popover.isExpanded).toBe(false);
    expect(result.current.popover.activePopover).toBe("none");
  });

  it("preserves map-drag exit replace semantics", () => {
    currentSearchParams = new URLSearchParams(
      "destination=Seoul&lat=37&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128",
    );
    const { result } = renderHook(() =>
      useSearchBarState({
        isMapDragMode: true,
        routePort: createRoutePort(),
      }),
    );

    act(() => {
      result.current.actions.exitMapDragMode();
    });

    const nextParams = getSearchParamsFromCall(
      mockReplaceSearch,
      "replaceSearch",
    );
    expect(nextParams.get("destination")).toBe("Seoul");
    expect(nextParams.get("lat")).toBe("37");
    expect(nextParams.get("lng")).toBe("127");
    expect(nextParams.has("topLeftLat")).toBe(false);
    expect(mockReplaceSearch).toHaveBeenCalledTimes(1);
  });
});

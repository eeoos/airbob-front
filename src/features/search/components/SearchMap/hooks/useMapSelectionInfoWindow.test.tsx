import { renderHook } from "@testing-library/react";
import type { MutableRefObject, RefObject } from "react";
import type { SearchMapAccommodation, SearchMapMarker } from "../types";
import { useMapSelectionInfoWindow } from "./useMapSelectionInfoWindow";

type HookOptions = Parameters<typeof useMapSelectionInfoWindow>[0];

interface FakeInfoWindowInstance {
  addListener: jest.Mock;
  close: jest.Mock;
  listeners: Record<string, Array<() => void>>;
  open: jest.Mock;
}

const ref = <T,>(current: T): MutableRefObject<T> => ({ current });

const createAccommodation = (
  overrides: Partial<SearchMapAccommodation> = {},
): SearchMapAccommodation => ({
  id: 10,
  name: "Map test stay",
  thumbnailUrl: null,
  locationLabel: "Seoul, Mapo",
  showReview: false,
  reviewRatingLabel: "0.0",
  reviewCountLabel: "(0)",
  basePrice: 100000,
  currency: "KRW",
  isInWishlist: false,
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  ...overrides,
});

const createMarker = (accommodationId: number): SearchMapMarker =>
  ({
    accommodationId,
    getIcon: jest.fn(),
    icons: {
      default: "default-icon",
      hovered: "hovered-icon",
      selected: "selected-icon",
    },
    setIcon: jest.fn(),
  }) as unknown as SearchMapMarker;

const createHookOptions = (
  overrides: Partial<HookOptions> = {},
): HookOptions => ({
  accommodations: [],
  hoveredAccommodationId: null,
  hoveredAccommodationIdRef: ref<number | null>(null),
  infoWindowRef: ref<google.maps.InfoWindow | null>(null),
  mapInstanceRef: ref({} as google.maps.Map),
  mapRef: {
    current: document.createElement("div"),
  } as RefObject<HTMLDivElement | null>,
  markersRef: ref<SearchMapMarker[]>([]),
  onAccommodationSelect: jest.fn(),
  prevHoveredIdRef: ref<number | null>(null),
  prevSelectedIdRef: ref<number | null>(null),
  selectedAccommodationId: null,
  ...overrides,
});

const installGoogleMapsMock = () => {
  const infoWindows: FakeInfoWindowInstance[] = [];
  const removeListener = jest.fn();
  const addMapListener = jest.fn(() => ({ remove: jest.fn() }));

  class FakeInfoWindow implements FakeInfoWindowInstance {
    addListener = jest.fn((eventName: string, handler: () => void) => {
      this.listeners[eventName] = [
        ...(this.listeners[eventName] ?? []),
        handler,
      ];

      return { remove: jest.fn() };
    });

    close = jest.fn(() => {
      this.listeners.close?.forEach((handler) => {
        handler();
      });
    });

    listeners: Record<string, Array<() => void>> = {};
    open = jest.fn();

    constructor() {
      infoWindows.push(this);
    }
  }

  (window as any).google = {
    maps: {
      InfoWindow: FakeInfoWindow,
      event: {
        addListener: addMapListener,
        removeListener,
      },
    },
  };
  (global as any).google = (window as any).google;

  return {
    addMapListener,
    infoWindows,
    removeListener,
  };
};

describe("useMapSelectionInfoWindow", () => {
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    window.cancelAnimationFrame = jest.fn();
    window.requestAnimationFrame = jest.fn(() => 1);
  });

  afterEach(() => {
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    delete (window as any).google;
    delete (global as any).google;
    jest.clearAllMocks();
  });

  it("closes and clears the current InfoWindow when the selected accommodation disappears", () => {
    const googleMaps = installGoogleMapsMock();
    const selectedAccommodation = createAccommodation();
    const selectedMarker = createMarker(selectedAccommodation.id);
    const infoWindowRef = ref<google.maps.InfoWindow | null>(null);
    const onAccommodationSelect = jest.fn();

    const options: HookOptions = {
      accommodations: [selectedAccommodation],
      hoveredAccommodationId: null,
      hoveredAccommodationIdRef: ref<number | null>(null),
      infoWindowRef,
      mapInstanceRef: ref({} as google.maps.Map),
      mapRef: {
        current: document.createElement("div"),
      } as RefObject<HTMLDivElement | null>,
      markersRef: ref<SearchMapMarker[]>([selectedMarker]),
      onAccommodationSelect,
      prevHoveredIdRef: ref<number | null>(null),
      prevSelectedIdRef: ref<number | null>(null),
      selectedAccommodationId: selectedAccommodation.id,
    };

    const { rerender } = renderHook(
      ({ accommodations }) =>
        useMapSelectionInfoWindow({
          ...options,
          accommodations,
        }),
      {
        initialProps: {
          accommodations: [selectedAccommodation],
        },
      },
    );

    expect(googleMaps.infoWindows).toHaveLength(1);
    expect(infoWindowRef.current).toBe(googleMaps.infoWindows[0]);

    rerender({ accommodations: [] });

    expect(googleMaps.infoWindows[0].close).toHaveBeenCalledTimes(1);
    expect(infoWindowRef.current).toBeNull();
    expect(onAccommodationSelect).toHaveBeenCalledTimes(1);
    expect(onAccommodationSelect).toHaveBeenCalledWith(null);
    expect(googleMaps.removeListener).toHaveBeenCalled();
  });

  it("replaces the selected InfoWindow without clearing the new selection", () => {
    const googleMaps = installGoogleMapsMock();
    const firstAccommodation = createAccommodation({ id: 10 });
    const secondAccommodation = createAccommodation({
      id: 20,
      name: "Second map test stay",
    });
    const firstMarker = createMarker(firstAccommodation.id);
    const secondMarker = createMarker(secondAccommodation.id);
    const infoWindowRef = ref<google.maps.InfoWindow | null>(null);
    const onAccommodationSelect = jest.fn();
    const baseOptions = createHookOptions({
      accommodations: [firstAccommodation, secondAccommodation],
      infoWindowRef,
      markersRef: ref<SearchMapMarker[]>([firstMarker, secondMarker]),
      onAccommodationSelect,
    });

    const { rerender } = renderHook(
      ({ selectedAccommodationId }) =>
        useMapSelectionInfoWindow({
          ...baseOptions,
          selectedAccommodationId,
        }),
      {
        initialProps: {
          selectedAccommodationId: firstAccommodation.id,
        },
      },
    );

    expect(googleMaps.infoWindows).toHaveLength(1);
    expect(infoWindowRef.current).toBe(googleMaps.infoWindows[0]);

    rerender({ selectedAccommodationId: secondAccommodation.id });

    expect(googleMaps.infoWindows).toHaveLength(2);
    expect(googleMaps.infoWindows[0].close).toHaveBeenCalledTimes(1);
    expect(onAccommodationSelect).not.toHaveBeenCalledWith(null);
    expect(infoWindowRef.current).toBe(googleMaps.infoWindows[1]);
    expect(googleMaps.infoWindows[1].open).toHaveBeenCalledWith(
      baseOptions.mapInstanceRef.current,
      secondMarker,
    );
  });

  it("opens an InfoWindow for selected accommodation id 0", () => {
    const googleMaps = installGoogleMapsMock();
    const selectedAccommodation = createAccommodation({ id: 0 });
    const selectedMarker = createMarker(selectedAccommodation.id);
    const infoWindowRef = ref<google.maps.InfoWindow | null>(null);

    renderHook(() =>
      useMapSelectionInfoWindow(
        createHookOptions({
          accommodations: [selectedAccommodation],
          infoWindowRef,
          markersRef: ref<SearchMapMarker[]>([selectedMarker]),
          selectedAccommodationId: selectedAccommodation.id,
        }),
      ),
    );

    expect(googleMaps.infoWindows).toHaveLength(1);
    expect(infoWindowRef.current).toBe(googleMaps.infoWindows[0]);
    expect(googleMaps.infoWindows[0].open).toHaveBeenCalledWith(
      expect.anything(),
      selectedMarker,
    );
  });
});

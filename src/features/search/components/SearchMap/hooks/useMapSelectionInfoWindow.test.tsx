import { renderHook } from "@testing-library/react";
import type { MutableRefObject, RefObject } from "react";
import type { Mock } from "vitest";
import type { SearchMapAccommodation, SearchMapMarker } from "../types";
import { useMapSelectionInfoWindow } from "./useMapSelectionInfoWindow";

type HookOptions = Parameters<typeof useMapSelectionInfoWindow>[0];

interface FakeInfoWindowInstance {
  addListener: Mock;
  close: Mock;
  listeners: Record<string, Array<() => void>>;
  open: Mock;
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
    getIcon: vi.fn(),
    icons: {
      default: "default-icon",
      hovered: "hovered-icon",
      selected: "selected-icon",
    },
    setIcon: vi.fn(),
  }) as unknown as SearchMapMarker;

const createHookOptions = (
  overrides: Partial<HookOptions> = {},
): HookOptions => ({
  accommodations: [],
  getAccommodationHref: (id) => `/accommodations/${id}`,
  hoveredAccommodationId: null,
  hoveredAccommodationIdRef: ref<number | null>(null),
  infoWindowRef: ref<google.maps.InfoWindow | null>(null),
  mapInstanceRef: ref({} as google.maps.Map),
  mapRef: {
    current: document.createElement("div"),
  } as RefObject<HTMLDivElement | null>,
  markersRef: ref<SearchMapMarker[]>([]),
  onAccommodationSelect: vi.fn(),
  prevHoveredIdRef: ref<number | null>(null),
  prevSelectedIdRef: ref<number | null>(null),
  selectedAccommodationId: null,
  ...overrides,
});

const installGoogleMapsMock = () => {
  const infoWindows: FakeInfoWindowInstance[] = [];
  const removeListener = vi.fn();
  const addMapListener = vi.fn(
    (_target: unknown, _eventName: string, _handler: () => void) => ({
      remove: vi.fn(),
    }),
  );

  class FakeInfoWindow implements FakeInfoWindowInstance {
    addListener = vi.fn((eventName: string, handler: () => void) => {
      this.listeners[eventName] = [
        ...(this.listeners[eventName] ?? []),
        handler,
      ];

      return { remove: vi.fn() };
    });

    close = vi.fn(() => {
      this.listeners.close?.forEach((handler) => {
        handler();
      });
    });

    listeners: Record<string, Array<() => void>> = {};
    open = vi.fn();

    constructor() {
      infoWindows.push(this);
    }
  }

  (window as any).google = {
    maps: {
      Map: function Map() {},
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
  afterEach(() => {
    delete (window as any).google;
    delete (global as any).google;
    vi.clearAllMocks();
  });

  it("closes and clears the current InfoWindow when the selected accommodation disappears", () => {
    const googleMaps = installGoogleMapsMock();
    const selectedAccommodation = createAccommodation();
    const selectedMarker = createMarker(selectedAccommodation.id);
    const infoWindowRef = ref<google.maps.InfoWindow | null>(null);
    const onAccommodationSelect = vi.fn();

    const options: HookOptions = {
      accommodations: [selectedAccommodation],
      getAccommodationHref: (id) => `/accommodations/${id}`,
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
    const onAccommodationSelect = vi.fn();
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
    expect(firstMarker.isSelected).toBe(false);
    expect(secondMarker.isSelected).toBe(true);
  });

  it("keeps the selected InfoWindow alive when only hover state changes", () => {
    const googleMaps = installGoogleMapsMock();
    const selectedAccommodation = createAccommodation();
    const selectedMarker = createMarker(selectedAccommodation.id);
    const baseOptions = createHookOptions({
      accommodations: [selectedAccommodation],
      markersRef: ref<SearchMapMarker[]>([selectedMarker]),
      selectedAccommodationId: selectedAccommodation.id,
    });

    const { rerender } = renderHook(
      ({ hoveredAccommodationId }) =>
        useMapSelectionInfoWindow({
          ...baseOptions,
          hoveredAccommodationId,
        }),
      { initialProps: { hoveredAccommodationId: null as number | null } },
    );

    rerender({ hoveredAccommodationId: 99 });

    expect(googleMaps.infoWindows).toHaveLength(1);
    expect(googleMaps.infoWindows[0].close).not.toHaveBeenCalled();
    expect(selectedMarker.isSelected).toBe(true);
    expect(selectedMarker.setIcon).toHaveBeenLastCalledWith(
      selectedMarker.icons?.selected,
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

  it("closes its InfoWindow and clears DOM/resize timers on unmount", () => {
    vi.useFakeTimers();
    const googleMaps = installGoogleMapsMock();
    const selectedAccommodation = createAccommodation();
    const selectedMarker = createMarker(selectedAccommodation.id);
    const mapElement = document.createElement("div");
    mapElement.innerHTML = `
      <div>
        <div class="gm-style-iw-c">
          <div class="gm-style-iw-d">
            <div id="info-window-${selectedAccommodation.id}">card</div>
          </div>
        </div>
      </div>
    `;

    const { unmount } = renderHook(() =>
      useMapSelectionInfoWindow(
        createHookOptions({
          accommodations: [selectedAccommodation],
          mapRef: { current: mapElement },
          markersRef: ref<SearchMapMarker[]>([selectedMarker]),
          selectedAccommodationId: selectedAccommodation.id,
        }),
      ),
    );
    const infoWindow = googleMaps.infoWindows[0];

    infoWindow.listeners.domready[0]();
    const resizeCall = googleMaps.addMapListener.mock.calls.find(
      ([, eventName]) => eventName === "resize",
    );
    expect(resizeCall).toBeDefined();
    resizeCall?.[2]?.();

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(infoWindow.close).toHaveBeenCalledTimes(1);
    expect(googleMaps.removeListener).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

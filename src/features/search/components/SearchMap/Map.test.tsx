import { act, fireEvent, render, screen } from "@testing-library/react";
import { Map } from "./Map";
import type { SearchMapProps } from "./types";

const hookMocks = vi.hoisted(() => ({
  useAccommodationMarkers: vi.fn(),
  useGoogleMapInstance: vi.fn(),
  useGoogleMapsScript: vi.fn(),
  useMapBoundsReporter: vi.fn(),
  useMapExpandControl: vi.fn(),
  useMapSelectionInfoWindow: vi.fn(),
}));

vi.mock("../../../../platform/integrations/useGoogleMapsScript", () => ({
  useGoogleMapsScript: hookMocks.useGoogleMapsScript,
}));
vi.mock("./hooks/useAccommodationMarkers", () => ({
  useAccommodationMarkers: hookMocks.useAccommodationMarkers,
}));
vi.mock("./hooks/useGoogleMapInstance", () => ({
  useGoogleMapInstance: hookMocks.useGoogleMapInstance,
}));
vi.mock("./hooks/useMapBoundsReporter", () => ({
  useMapBoundsReporter: hookMocks.useMapBoundsReporter,
}));
vi.mock("./hooks/useMapExpandControl", () => ({
  useMapExpandControl: hookMocks.useMapExpandControl,
}));
vi.mock("./hooks/useMapSelectionInfoWindow", () => ({
  useMapSelectionInfoWindow: hookMocks.useMapSelectionInfoWindow,
}));

const baseProps: SearchMapProps = {
  accommodations: [],
  getAccommodationHref: (accommodationId) =>
    `/accommodations/${accommodationId}`,
  onAccommodationSelect: vi.fn(),
  selectedAccommodationId: null,
};

describe("SearchMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookMocks.useGoogleMapsScript.mockReturnValue({
      error: null,
      isLoaded: false,
      status: "loading",
    });
    hookMocks.useGoogleMapInstance.mockReturnValue(null);
    hookMocks.useMapBoundsReporter.mockReturnValue({
      isLoadingBounds: false,
      searchAround: vi.fn(),
      cancelPendingBounds: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reveals the map before opening a selected marker card on mobile", () => {
    const onMapInteraction = vi.fn();
    const onAccommodationSelect = vi.fn();
    render(
      <Map
        {...baseProps}
        onMapInteraction={onMapInteraction}
        onAccommodationSelect={onAccommodationSelect}
      />,
    );
    const selection =
      hookMocks.useAccommodationMarkers.mock.calls[0]?.[0]
        .onAccommodationSelectRef;
    act(() => selection.current({ id: 10 }));
    expect(onMapInteraction).toHaveBeenCalledOnce();
    expect(onAccommodationSelect).toHaveBeenCalledWith({ id: 10 });
    expect(onMapInteraction.mock.invocationCallOrder[0]).toBeLessThan(
      onAccommodationSelect.mock.invocationCallOrder[0]!,
    );
    act(() => selection.current(null));
    expect(onMapInteraction).toHaveBeenCalledOnce();
  });

  it("cancels old map searches before requesting location and moves only after permission succeeds", () => {
    let succeed: PositionCallback | undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      succeed = success;
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const searchAround = vi.fn();
    const cancelPendingBounds = vi.fn();
    hookMocks.useGoogleMapsScript.mockReturnValue({
      isLoaded: true,
      status: "loaded",
    });
    hookMocks.useMapBoundsReporter.mockReturnValue({
      isLoadingBounds: false,
      searchAround,
      cancelPendingBounds,
    });
    render(<Map {...baseProps} onBoundsChange={vi.fn()} />);
    const button = screen.getByRole("button", { name: "현재 위치에서 검색" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(cancelPendingBounds).toHaveBeenCalledOnce();
    expect(cancelPendingBounds.mock.invocationCallOrder[0]).toBeLessThan(
      getCurrentPosition.mock.invocationCallOrder[0]!,
    );
    expect(button).toBeDisabled();
    expect(searchAround).not.toHaveBeenCalled();
    act(() =>
      succeed?.({
        coords: { latitude: 35.17, longitude: 129.07 },
      } as GeolocationPosition),
    );
    expect(searchAround).toHaveBeenCalledExactlyOnceWith({
      lat: 35.17,
      lng: 129.07,
    });
    expect(button).toBeEnabled();
  });

  it("ignores a pending location response after a map interaction", () => {
    let succeed: PositionCallback | undefined;
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          succeed = success;
        }),
      },
    });
    const searchAround = vi.fn();
    const cancelLocationSearch = vi.fn();
    const onMapInteraction = vi.fn();
    hookMocks.useGoogleMapsScript.mockReturnValue({
      isLoaded: true,
      status: "loaded",
    });
    hookMocks.useMapBoundsReporter.mockReturnValue({
      isLoadingBounds: false,
      searchAround,
      cancelPendingBounds: vi.fn(),
      cancelLocationSearch,
    });
    render(
      <Map
        {...baseProps}
        onBoundsChange={vi.fn()}
        onMapInteraction={onMapInteraction}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "현재 위치에서 검색" }));
    act(() =>
      hookMocks.useGoogleMapInstance.mock.lastCall?.[0].onMapInteraction(),
    );
    act(() =>
      succeed?.({
        coords: { latitude: 35.17, longitude: 129.07 },
      } as GeolocationPosition),
    );
    expect(searchAround).not.toHaveBeenCalled();
    expect(cancelLocationSearch).toHaveBeenCalledOnce();
    expect(onMapInteraction).toHaveBeenCalledTimes(2);
  });

  it("keeps repeat requests disabled until the location camera has settled", () => {
    hookMocks.useGoogleMapsScript.mockReturnValue({
      isLoaded: true,
      status: "loaded",
    });
    hookMocks.useMapBoundsReporter.mockReturnValue({
      isLoadingBounds: true,
      isLocationSearchPending: true,
      searchAround: vi.fn(),
      cancelPendingBounds: vi.fn(),
    });
    render(<Map {...baseProps} onBoundsChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "현재 위치에서 검색" }),
    ).toBeDisabled();
    expect(screen.getByText("주변 검색 중…")).toBeVisible();
  });

  it("renders loading feedback while forwarding absent composition inputs", () => {
    render(<Map {...baseProps} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "지도를 불러오는 중입니다.",
    );
    expect(hookMocks.useGoogleMapInstance.mock.calls[0]?.[0]).toHaveProperty(
      "viewport",
      undefined,
    );
    expect(
      hookMocks.useMapSelectionInfoWindow.mock.calls[0]?.[0],
    ).toHaveProperty("checkIn", undefined);
    expect(hookMocks.useMapExpandControl.mock.calls[0]?.[0]).toHaveProperty(
      "onExpandToggle",
      undefined,
    );
  });

  it("forwards every present option and renders bounds progress", () => {
    const viewport = { north: 38, south: 37, east: 128, west: 126 };
    const optionalProps: Required<
      Pick<
        SearchMapProps,
        | "boundsRequestKey"
        | "checkIn"
        | "checkOut"
        | "hoveredAccommodationId"
        | "onBoundsChange"
        | "onBoundsDragCancel"
        | "onBoundsDragStart"
        | "onExpandToggle"
        | "onMapBoundsUpdated"
        | "onMapInteraction"
        | "onWishlistToggle"
        | "viewport"
      >
    > = {
      boundsRequestKey: "seoul-page-1",
      checkIn: "2026-09-01",
      checkOut: "2026-09-02",
      hoveredAccommodationId: null,
      onBoundsChange: vi.fn(),
      onBoundsDragCancel: vi.fn(),
      onBoundsDragStart: vi.fn(),
      onExpandToggle: vi.fn(),
      onMapBoundsUpdated: vi.fn(),
      onMapInteraction: vi.fn(),
      onWishlistToggle: vi.fn(),
      viewport,
    };
    hookMocks.useGoogleMapsScript.mockReturnValue({
      error: null,
      isLoaded: true,
      status: "loaded",
    });
    hookMocks.useMapBoundsReporter.mockReturnValue({
      isLoadingBounds: true,
      searchAround: vi.fn(),
    });

    render(
      <Map
        {...baseProps}
        {...optionalProps}
        isExpanded
        isMapDragMode
        shouldUpdateMapBounds
      />,
    );

    expect(screen.getByRole("region", { name: "숙소 지도" })).toBeVisible();
    expect(
      screen.getByRole("status", { name: "지도 범위 검색 중" }),
    ).toBeVisible();
    expect(hookMocks.useGoogleMapInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        onMapInteraction: expect.any(Function),
        viewport,
      }),
    );
    expect(hookMocks.useMapBoundsReporter).toHaveBeenCalledWith(
      expect.objectContaining({
        isMapLoaded: true,
        onBoundsChange: optionalProps.onBoundsChange,
        onUserDragCancel: optionalProps.onBoundsDragCancel,
        onUserDragStart: optionalProps.onBoundsDragStart,
        requestKey: optionalProps.boundsRequestKey,
      }),
    );
    expect(hookMocks.useMapSelectionInfoWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        checkIn: optionalProps.checkIn,
        checkOut: optionalProps.checkOut,
        hoveredAccommodationId: null,
        onWishlistToggle: optionalProps.onWishlistToggle,
      }),
    );
    expect(hookMocks.useMapExpandControl).toHaveBeenCalledWith(
      expect.objectContaining({
        isExpanded: true,
        onExpandToggle: optionalProps.onExpandToggle,
      }),
    );
  });

  it.each([
    {
      mapRuntimeError: null,
      script: { error: new Error("script"), isLoaded: false, status: "error" },
    },
    {
      mapRuntimeError: new Error("runtime"),
      script: { error: null, isLoaded: true, status: "loaded" },
    },
    {
      mapRuntimeError: null,
      script: { error: null, isLoaded: false, status: "missing-key" },
    },
    {
      mapRuntimeError: null,
      script: { error: null, isLoaded: true, status: "error" },
    },
  ])(
    "renders failure feedback for $script.status",
    ({ mapRuntimeError, script }) => {
      hookMocks.useGoogleMapsScript.mockReturnValue(script);
      hookMocks.useGoogleMapInstance.mockReturnValue(mapRuntimeError);

      render(<Map {...baseProps} />);

      expect(
        screen.getByRole("heading", {
          name: "지도 없이 결과를 둘러볼 수 있어요",
        }),
      ).toBeVisible();
      expect(screen.getByRole("alert")).toHaveAttribute(
        "data-state-kind",
        "terminal-error",
      );
    },
  );
});

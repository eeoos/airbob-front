import { render, screen } from "@testing-library/react";
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
    hookMocks.useMapBoundsReporter.mockReturnValue(false);
  });

  it("renders loading feedback while forwarding absent composition inputs", () => {
    render(<Map {...baseProps} />);

    expect(screen.getByText("지도를 불러오는 중...")).toBeVisible();
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
        | "checkIn"
        | "checkOut"
        | "hoveredAccommodationId"
        | "onBoundsChange"
        | "onExpandToggle"
        | "onMapBoundsUpdated"
        | "onMapInteraction"
        | "onWishlistToggle"
        | "viewport"
      >
    > = {
      checkIn: "2026-09-01",
      checkOut: "2026-09-02",
      hoveredAccommodationId: null,
      onBoundsChange: vi.fn(),
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
    hookMocks.useMapBoundsReporter.mockReturnValue(true);

    render(
      <Map
        {...baseProps}
        {...optionalProps}
        isExpanded
        isMapDragMode
        shouldUpdateMapBounds
      />,
    );

    expect(
      screen.getByRole("region", { name: "숙소 지도" }),
    ).toBeVisible();
    expect(
      screen.getByRole("status", { name: "지도 범위 검색 중" }),
    ).toBeVisible();
    expect(hookMocks.useGoogleMapInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        onMapInteraction: optionalProps.onMapInteraction,
        viewport,
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
  ])("renders failure feedback for $script.status", ({
    mapRuntimeError,
    script,
  }) => {
    hookMocks.useGoogleMapsScript.mockReturnValue(script);
    hookMocks.useGoogleMapInstance.mockReturnValue(mapRuntimeError);

    render(<Map {...baseProps} />);

    expect(screen.getByText("지도를 불러올 수 없습니다.")).toBeVisible();
  });
});

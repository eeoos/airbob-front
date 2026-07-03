import {
  haveAccommodationIdsChanged,
  hasBoundsChanged,
  hasViewportChanged,
  shouldFitAccommodationBounds,
} from "./mapBounds";

describe("map bounds helpers", () => {
  it("treats bounds changes within the threshold as unchanged", () => {
    const previous = {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    };

    expect(
      hasBoundsChanged(previous, {
        north: 38.0005,
        south: 36.9995,
        east: 128.0005,
        west: 125.9995,
      })
    ).toBe(false);
  });

  it("treats bounds changes exactly at the threshold as unchanged", () => {
    const previous = {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    };

    expect(
      hasBoundsChanged(previous, {
        north: 38.001,
        south: 37,
        east: 128,
        west: 126,
      })
    ).toBe(false);
  });

  it("treats any bounds movement over the threshold as changed", () => {
    const previous = {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    };

    expect(
      hasBoundsChanged(previous, {
        north: 38.002,
        south: 37,
        east: 128,
        west: 126,
      })
    ).toBe(true);
  });

  it("treats a missing previous viewport or coordinate drift as changed", () => {
    const viewport = {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    };

    expect(hasViewportChanged(null, viewport)).toBe(true);
    expect(hasViewportChanged(viewport, { ...viewport })).toBe(false);
    expect(hasViewportChanged(viewport, { ...viewport, west: 126.1 })).toBe(true);
  });

  it("detects accommodation id changes using the current order-sensitive behavior", () => {
    expect(haveAccommodationIdsChanged([], [{ id: 1 }])).toBe(true);
    expect(
      haveAccommodationIdsChanged([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2 }])
    ).toBe(false);
    expect(
      haveAccommodationIdsChanged([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }])
    ).toBe(true);
  });

  it("keeps fitBounds disabled while map drag mode is active", () => {
    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 3,
        isMapDragMode: true,
        viewportJustChanged: true,
        shouldUpdateMapBounds: true,
        boundsInitialized: false,
        accommodationsChanged: true,
      })
    ).toBe(false);
  });

  it("requests fitBounds for initial load, viewport transition, page update, or changed accommodations", () => {
    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 1,
        isMapDragMode: false,
        viewportJustChanged: false,
        shouldUpdateMapBounds: false,
        boundsInitialized: false,
        accommodationsChanged: false,
      })
    ).toBe(true);

    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 2,
        isMapDragMode: false,
        viewportJustChanged: true,
        shouldUpdateMapBounds: false,
        boundsInitialized: true,
        accommodationsChanged: false,
      })
    ).toBe(true);

    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 2,
        isMapDragMode: false,
        viewportJustChanged: false,
        shouldUpdateMapBounds: true,
        boundsInitialized: true,
        accommodationsChanged: false,
      })
    ).toBe(true);

    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 2,
        isMapDragMode: false,
        viewportJustChanged: false,
        shouldUpdateMapBounds: false,
        boundsInitialized: true,
        accommodationsChanged: true,
      })
    ).toBe(true);
  });

  it("does not fit bounds when there are no valid accommodations or no trigger changed", () => {
    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 0,
        isMapDragMode: false,
        viewportJustChanged: true,
        shouldUpdateMapBounds: true,
        boundsInitialized: false,
        accommodationsChanged: true,
      })
    ).toBe(false);

    expect(
      shouldFitAccommodationBounds({
        validAccommodationCount: 2,
        isMapDragMode: false,
        viewportJustChanged: false,
        shouldUpdateMapBounds: false,
        boundsInitialized: true,
        accommodationsChanged: false,
      })
    ).toBe(false);
  });
});

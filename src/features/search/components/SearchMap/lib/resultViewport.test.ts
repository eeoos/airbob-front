import { requireDefined } from "../../../../../test/assertions";
import { getResultViewport } from "./resultViewport";

const point = (latitude: number, longitude: number, markerWidth = 100) => ({
  latitude,
  longitude,
  markerWidth,
  markerHeight: 28,
});
const mercator = (latitude: number) =>
  Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
const longitudeSpan = (west: number, east: number) => (east - west + 360) % 360;

describe("getResultViewport", () => {
  it.each([
    { width: 1200, height: 900 },
    { width: 425, height: 810 },
  ])(
    "keeps all complete price bubbles inside a $width × $height map",
    ({ width, height }) => {
      const points = [
        point(37.48, 126.88),
        point(37.64, 127.04),
        point(37.54, 127.1, 132),
      ];
      const viewport = requireDefined(
        getResultViewport(points, width, height),
        "result viewport",
      );
      const span = longitudeSpan(viewport.west, viewport.east);
      const northY = mercator(viewport.north);
      const southY = mercator(viewport.south);
      const clearances = points.flatMap((p) => {
        const x = (longitudeSpan(viewport.west, p.longitude) / span) * width;
        const y =
          ((northY - mercator(p.latitude)) / (northY - southY)) * height;
        return [
          x - p.markerWidth / 2,
          width - x - p.markerWidth / 2,
          y - p.markerHeight,
          height - y,
        ];
      });
      // The fitted page fills at least one axis and leaves room for the full labels.
      expect(Math.min(...clearances)).toBeCloseTo(16, 5);
      expect(clearances.every((clearance) => clearance >= 16 - 1e-5)).toBe(
        true,
      );
    },
  );

  it("zooms to the distribution of the next page and includes its outlier", () => {
    const compact = requireDefined(
      getResultViewport([point(37.55, 126.98), point(37.56, 127)], 1000, 800),
      "compact page",
    );
    const spread = requireDefined(
      getResultViewport(
        [point(37.55, 126.98), point(37.63, 127.18)],
        1000,
        800,
      ),
      "spread page",
    );
    expect(spread.east - spread.west).toBeGreaterThan(
      compact.east - compact.west,
    );
    expect(spread.north).toBeGreaterThan(37.63);
    expect(spread.east).toBeGreaterThan(127.18);
    expect((spread.east + spread.west) / 2).toBeGreaterThan(
      (compact.east + compact.west) / 2,
    );
  });

  it.each([0, 0.000001])(
    "caps zoom for identical or near-identical coordinates (%s)",
    (offset) => {
      const viewport = requireDefined(
        getResultViewport(
          [point(37.5, 127), point(37.5 + offset, 127 + offset)],
          1000,
          800,
        ),
        "close results",
      );
      const zoom = Math.log2(
        1000 / (((viewport.east - viewport.west) / 360) * 256),
      );
      expect(zoom).toBeCloseTo(16);
    },
  );

  it("keeps results across the antimeridian together", () => {
    const viewport = requireDefined(
      getResultViewport([point(10, 179.9), point(10.1, -179.9)], 1000, 800),
      "antimeridian results",
    );
    expect(viewport.west).toBeGreaterThan(179);
    expect(viewport.east).toBeLessThan(-179);
    expect(longitudeSpan(viewport.west, viewport.east)).toBeLessThan(1);
  });

  it("does not fit an empty page or a hidden/unmeasured map", () => {
    expect(getResultViewport([], 1000, 800)).toBeNull();
    expect(getResultViewport([point(37.5, 127)], 0, 800)).toBeNull();
    expect(getResultViewport([point(37.5, 127)], 1000, Number.NaN)).toBeNull();
    expect(getResultViewport([point(37.5, 127)], Infinity, 800)).toBeNull();
  });
});

import { SEARCH_MAP_CAMERA } from "../../../lib/searchMapConfig";
import type { SearchMapViewport } from "../types";

interface ResultMapPoint {
  latitude: number;
  longitude: number;
  markerWidth: number;
  markerHeight: number;
}

const WORLD_SIZE = 256;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const toWorldY = (latitude: number) => {
  const lat = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const sine = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * WORLD_SIZE;
};
const toLatitude = (y: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD_SIZE))) * 180) / Math.PI;
const toLongitude = (x: number) =>
  (((((x / WORLD_SIZE) * 360) % 360) + 360) % 360) - 180;

/** Fit the current page, including the full price labels, without excessive zoom for nearby pins. */
export const getResultViewport = (
  points: readonly ResultMapPoint[],
  width: number,
  height: number,
): SearchMapViewport | null => {
  if (
    !points.length ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const xs = points
    .map((p) => ((p.longitude + 180) / 360) * WORLD_SIZE)
    .sort((a, b) => a - b);
  const ys = points.map((p) => toWorldY(p.latitude));
  // Cut at the largest longitude gap so results around ±180° stay together.
  let largestGap = -1;
  let startIndex = 0;
  xs.forEach((x, index) => {
    const next =
      xs[(index + 1) % xs.length]! + (index === xs.length - 1 ? WORLD_SIZE : 0);
    if (next - x > largestGap) {
      largestGap = next - x;
      startIndex = (index + 1) % xs.length;
    }
  });
  const minX = xs[startIndex]!;
  const maxX = minX + Math.max(0, WORLD_SIZE - largestGap);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const sidePadding =
    SEARCH_MAP_CAMERA.resultMargin +
    Math.max(...points.map((p) => p.markerWidth)) / 2;
  const topPadding =
    SEARCH_MAP_CAMERA.resultMargin +
    Math.max(...points.map((p) => p.markerHeight));
  const bottomPadding = SEARCH_MAP_CAMERA.resultMargin;
  const xScale = Math.max(1, width - sidePadding * 2) / (maxX - minX);
  const yScale =
    Math.max(1, height - topPadding - bottomPadding) / (maxY - minY);
  const scale = Math.max(
    1,
    Math.min(2 ** SEARCH_MAP_CAMERA.maximumResultZoom, xScale, yScale),
  );
  const centerX = (minX + maxX) / 2;
  const centerY =
    (minY + maxY) / 2 + (bottomPadding - topPadding) / (2 * scale);
  return {
    north: toLatitude(centerY - height / (2 * scale)),
    south: toLatitude(centerY + height / (2 * scale)),
    west: toLongitude(centerX - width / (2 * scale)),
    east: toLongitude(centerX + width / (2 * scale)),
  };
};

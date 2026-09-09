export const MAP_CARD_LAYOUT = {
  width: 327,
  margin: 16,
  markerGap: 16,
} as const;

interface MapCardPlacementInput {
  mapWidth: number;
  mapHeight: number;
  cardWidth: number;
  cardHeight: number;
  markerX: number;
  markerY: number;
  markerHeight: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

export const getMapCardPlacement = ({
  mapWidth,
  mapHeight,
  cardWidth,
  cardHeight,
  markerX,
  markerY,
  markerHeight,
}: MapCardPlacementInput) => {
  const { margin, markerGap } = MAP_CARD_LAYOUT;
  const above = markerY - markerHeight - markerGap - cardHeight;
  const below = markerY + markerGap;
  const fitsAbove = above >= margin;
  const fitsBelow = below + cardHeight <= mapHeight - margin;
  const preferAbove = markerY - markerHeight / 2 >= mapHeight / 2;
  const placeAbove = preferAbove
    ? fitsAbove || !fitsBelow
    : !fitsBelow && fitsAbove;

  return {
    left: clamp(markerX - cardWidth / 2, margin, mapWidth - margin - cardWidth),
    top: clamp(
      placeAbove ? above : below,
      margin,
      mapHeight - margin - cardHeight,
    ),
    side: placeAbove ? "above" : "below",
  } as const;
};

export const getMarkerMapPoint = (
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  mapWidth: number,
  mapHeight: number,
) => {
  const projection = map.getProjection();
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (!projection || !center || zoom === undefined) return null;
  const centerPoint = projection.fromLatLngToPoint(center);
  const markerPoint = projection.fromLatLngToPoint(position);
  if (!centerPoint || !markerPoint) return null;
  // Use the nearest world copy, including maps crossing the date line.
  const deltaX =
    ((((markerPoint.x - centerPoint.x + 128) % 256) + 256) % 256) - 128;
  const scale = 2 ** zoom;
  return {
    x: mapWidth / 2 + deltaX * scale,
    y: mapHeight / 2 + (markerPoint.y - centerPoint.y) * scale,
  };
};

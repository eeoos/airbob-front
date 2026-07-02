export interface MapBoundsLiteral {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface IdentifiedAccommodation {
  id: number;
}

const DEFAULT_BOUNDS_CHANGE_THRESHOLD = 0.001;

export const hasBoundsChanged = (
  previousBounds: MapBoundsLiteral | null,
  nextBounds: MapBoundsLiteral,
  threshold = DEFAULT_BOUNDS_CHANGE_THRESHOLD
) => {
  if (!previousBounds) {
    return true;
  }

  return (
    Math.abs(previousBounds.north - nextBounds.north) > threshold ||
    Math.abs(previousBounds.south - nextBounds.south) > threshold ||
    Math.abs(previousBounds.east - nextBounds.east) > threshold ||
    Math.abs(previousBounds.west - nextBounds.west) > threshold
  );
};

export const hasViewportChanged = (
  previousViewport: MapBoundsLiteral | null,
  nextViewport: MapBoundsLiteral
) => {
  if (!previousViewport) {
    return true;
  }

  return (
    previousViewport.north !== nextViewport.north ||
    previousViewport.south !== nextViewport.south ||
    previousViewport.east !== nextViewport.east ||
    previousViewport.west !== nextViewport.west
  );
};

export const haveAccommodationIdsChanged = (
  previousAccommodations: IdentifiedAccommodation[],
  nextAccommodations: IdentifiedAccommodation[]
) =>
  previousAccommodations.length !== nextAccommodations.length ||
  previousAccommodations.some(
    (accommodation, index) => accommodation.id !== nextAccommodations[index]?.id
  );

interface ShouldFitAccommodationBoundsInput {
  validAccommodationCount: number;
  isMapDragMode: boolean;
  viewportJustChanged: boolean;
  shouldUpdateMapBounds: boolean;
  boundsInitialized: boolean;
  accommodationsChanged: boolean;
}

export const shouldFitAccommodationBounds = ({
  validAccommodationCount,
  isMapDragMode,
  viewportJustChanged,
  shouldUpdateMapBounds,
  boundsInitialized,
  accommodationsChanged,
}: ShouldFitAccommodationBoundsInput) => {
  if (validAccommodationCount <= 0 || isMapDragMode) {
    return false;
  }

  return (
    viewportJustChanged ||
    shouldUpdateMapBounds ||
    !boundsInitialized ||
    accommodationsChanged
  );
};

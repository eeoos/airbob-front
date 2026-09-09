import type { SearchViewport } from "../model/search";

// Seoul–Incheon metropolitan area, matching the regional scale of an empty search.
// Both the initial map and the first accommodation query use this same fallback.
export const DEFAULT_SEARCH_VIEWPORT: SearchViewport = {
  north: 37.75,
  south: 37.25,
  east: 127.2,
  west: 126.5,
};

export const SEARCH_MAP_CAMERA = {
  viewportPadding: 0,
  accommodationPadding: 50,
  nearbyZoom: 13,
  singleAccommodationZoom: 12,
} as const;

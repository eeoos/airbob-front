import type { SearchAccommodationMapViewModel } from "../../lib/searchAccommodationViewModel";

export interface SearchMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type SearchMapViewport = SearchMapBounds;
export type SearchMapAccommodation = SearchAccommodationMapViewModel;

export interface SearchMapProps {
  accommodations: SearchMapAccommodation[];
  selectedAccommodationId: number | null;
  hoveredAccommodationId?: number | null;
  onAccommodationSelect: (accommodation: SearchMapAccommodation | null) => void;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
  detailSearchParams?: URLSearchParams;
  checkIn?: string | null;
  checkOut?: string | null;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onBoundsChange?: (bounds: SearchMapBounds) => void;
  isMapDragMode?: boolean;
  shouldUpdateMapBounds?: boolean;
  onMapBoundsUpdated?: () => void;
  viewport?: SearchMapViewport | null;
  onMapInteraction?: () => void;
}

export interface SearchMapMarkerIcons {
  default: google.maps.Icon;
  selected: google.maps.Icon;
  hovered: google.maps.Icon;
}

export type SearchMapMarker = google.maps.Marker & {
  accommodation?: SearchMapAccommodation;
  accommodationId?: number;
  icons?: SearchMapMarkerIcons;
  originalIcon?: google.maps.Icon;
};

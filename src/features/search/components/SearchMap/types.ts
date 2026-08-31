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
  hoveredAccommodationId?: number | null | undefined;
  onAccommodationSelect: (accommodation: SearchMapAccommodation | null) => void;
  onWishlistToggle?:
    ((accommodationId: number, isInWishlist: boolean) => void) | undefined;
  getAccommodationHref: (accommodationId: number) => string;
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
  isExpanded?: boolean | undefined;
  onExpandToggle?: (() => void) | undefined;
  onBoundsChange?: ((bounds: SearchMapBounds) => void) | undefined;
  isMapDragMode?: boolean | undefined;
  shouldUpdateMapBounds?: boolean | undefined;
  onMapBoundsUpdated?: (() => void) | undefined;
  viewport?: SearchMapViewport | null | undefined;
  onMapInteraction?: (() => void) | undefined;
}

interface SearchMapMarkerIcons {
  default: google.maps.Icon;
  selected: google.maps.Icon;
  hovered: google.maps.Icon;
}

export type SearchMapMarker = google.maps.Marker & {
  accommodation?: SearchMapAccommodation;
  accommodationId?: number;
  dispose?: () => void;
  icons?: SearchMapMarkerIcons;
  isSelected?: boolean;
  originalIcon?: google.maps.Icon;
};

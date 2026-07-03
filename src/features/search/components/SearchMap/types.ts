import { AccommodationSearchInfo } from "../../../../types/accommodation";

export interface SearchMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type SearchMapViewport = SearchMapBounds;

export interface SearchMapProps {
  accommodations: AccommodationSearchInfo[];
  selectedAccommodationId: number | null;
  hoveredAccommodationId?: number | null;
  onAccommodationSelect: (accommodation: AccommodationSearchInfo | null) => void;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
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
  accommodation?: AccommodationSearchInfo;
  accommodationId?: number;
  icons?: SearchMapMarkerIcons;
  originalIcon?: google.maps.Icon;
};

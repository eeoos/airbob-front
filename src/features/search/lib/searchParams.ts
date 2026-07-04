import { AccommodationSearchRequest } from "../../../types/accommodation";
import type { SearchRouteQuery } from "../../../routes/paths";
import { clampSearchPage } from "./pagination";

export interface SearchViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SearchPlaceSelection {
  lat: number;
  lng: number;
  viewport: SearchViewport;
}

export interface SearchNavigationInput {
  destination?: string;
  selectedPlace?: SearchPlaceSelection | null;
  checkIn?: Date | null;
  checkOut?: Date | null;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
}

const VIEWPORT_KEYS = [
  "topLeftLat",
  "topLeftLng",
  "bottomRightLat",
  "bottomRightLng",
] as const;

const LOCATION_KEYS = ["lat", "lng"] as const;

const cloneParams = (params: URLSearchParams): URLSearchParams =>
  new URLSearchParams(params.toString());

const SEARCH_QUERY_KEYS_TO_PRESERVE = [
  "destination",
  "page",
  "lat",
  "lng",
  "topLeftLat",
  "topLeftLng",
  "bottomRightLat",
  "bottomRightLng",
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

export const pickSearchParams = (params: URLSearchParams) => {
  const nextParams = new URLSearchParams();

  SEARCH_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      nextParams.set(key, value);
    }
  });

  return nextParams;
};

export const toSearchRouteQuery = (
  params: URLSearchParams,
): SearchRouteQuery => {
  const query: SearchRouteQuery = {};

  SEARCH_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      query[key] = value;
    }
  });

  return query;
};

const formatDateForSearchParam = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseOptionalInt = (
  params: URLSearchParams,
  key: string,
): number | undefined => {
  const value = params.get(key);
  if (value === null) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalFloat = (
  params: URLSearchParams,
  key: string,
): number | undefined => {
  const value = params.get(key);
  if (value === null) {
    return undefined;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const setViewportParams = (
  params: URLSearchParams,
  viewport: SearchViewport,
) => {
  params.set("topLeftLat", viewport.north.toString());
  params.set("topLeftLng", viewport.west.toString());
  params.set("bottomRightLat", viewport.south.toString());
  params.set("bottomRightLng", viewport.east.toString());
};

export const removeViewportParams = (
  params: URLSearchParams,
): URLSearchParams => {
  const nextParams = cloneParams(params);
  VIEWPORT_KEYS.forEach((key) => nextParams.delete(key));
  return nextParams;
};

const removeViewportAndLocationParams = (
  params: URLSearchParams,
): URLSearchParams => {
  const nextParams = removeViewportParams(params);
  LOCATION_KEYS.forEach((key) => nextParams.delete(key));
  return nextParams;
};

export const getViewportFromSearchParams = (
  params: URLSearchParams,
): SearchViewport | null => {
  const north = parseOptionalFloat(params, "topLeftLat");
  const west = parseOptionalFloat(params, "topLeftLng");
  const south = parseOptionalFloat(params, "bottomRightLat");
  const east = parseOptionalFloat(params, "bottomRightLng");

  if (
    north === undefined ||
    west === undefined ||
    south === undefined ||
    east === undefined
  ) {
    return null;
  }

  return { north, west, south, east };
};

export const getViewportSearchParamSignature = (
  params: URLSearchParams,
): string | null => {
  const viewport = getViewportFromSearchParams(params);

  if (!viewport) {
    return null;
  }

  return `${viewport.north},${viewport.west},${viewport.south},${viewport.east}`;
};

export const buildSearchNavigationParams = (
  currentParams: URLSearchParams,
  input: SearchNavigationInput,
): URLSearchParams => {
  const params = pickSearchParams(currentParams);
  const destination = input.destination?.trim();

  if (destination) {
    params.set("destination", destination);
  } else {
    params.delete("destination");
  }

  params.delete("page");

  if (input.selectedPlace) {
    params.set("lat", input.selectedPlace.lat.toString());
    params.set("lng", input.selectedPlace.lng.toString());
    setViewportParams(params, input.selectedPlace.viewport);
  } else {
    LOCATION_KEYS.forEach((key) => params.delete(key));
    VIEWPORT_KEYS.forEach((key) => params.delete(key));
  }

  if (input.checkIn) {
    params.set("checkIn", formatDateForSearchParam(input.checkIn));
  } else {
    params.delete("checkIn");
  }

  if (input.checkOut) {
    params.set("checkOut", formatDateForSearchParam(input.checkOut));
  } else {
    params.delete("checkOut");
  }

  params.set("adultOccupancy", input.adultOccupancy.toString());
  params.set("childOccupancy", input.childOccupancy.toString());
  params.set("infantOccupancy", input.infantOccupancy.toString());
  params.set("petOccupancy", input.petOccupancy.toString());

  return params;
};

export const buildMapBoundsSearchParams = (
  currentParams: URLSearchParams,
  bounds: SearchViewport,
): URLSearchParams => {
  const params = removeViewportAndLocationParams(
    pickSearchParams(currentParams),
  );

  setViewportParams(params, bounds);
  params.delete("destination");
  params.delete("page");

  return params;
};

export const buildSearchRequestFromParams = (
  params: URLSearchParams,
  options: { page?: number; size?: number } = {},
): AccommodationSearchRequest => {
  const viewport = getViewportFromSearchParams(params);
  const page = options.page ?? clampSearchPage(params.get("page"));

  return {
    topLeftLat: viewport?.north,
    topLeftLng: viewport?.west,
    bottomRightLat: viewport?.south,
    bottomRightLng: viewport?.east,
    destination: !viewport ? params.get("destination") || undefined : undefined,
    checkIn: params.get("checkIn") || undefined,
    checkOut: params.get("checkOut") || undefined,
    adultOccupancy: parseOptionalInt(params, "adultOccupancy"),
    childOccupancy: parseOptionalInt(params, "childOccupancy"),
    infantOccupancy: parseOptionalInt(params, "infantOccupancy"),
    petOccupancy: parseOptionalInt(params, "petOccupancy"),
    page,
    size: options.size ?? 18,
  };
};

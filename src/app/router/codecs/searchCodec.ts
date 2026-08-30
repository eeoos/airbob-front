import {
  appendDefinedSearchParam,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseStrictDate,
  parseStrictFiniteNumber,
  type SearchParamsInput,
  toSearchParams,
} from "./queryCodecUtils";

export const MAX_SEARCH_PAGE = 15;

export type RouteQueryValue = string | number;

export interface AccommodationBookingRouteQuery {
  checkIn?: RouteQueryValue;
  checkOut?: RouteQueryValue;
  adultOccupancy?: RouteQueryValue;
  childOccupancy?: RouteQueryValue;
  infantOccupancy?: RouteQueryValue;
  petOccupancy?: RouteQueryValue;
}

export interface AccommodationBookingRouteState {
  checkIn?: string;
  checkOut?: string;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
}

export interface SearchRouteQuery extends AccommodationBookingRouteQuery {
  destination?: RouteQueryValue;
  page?: RouteQueryValue;
  lat?: RouteQueryValue;
  lng?: RouteQueryValue;
  topLeftLat?: RouteQueryValue;
  topLeftLng?: RouteQueryValue;
  bottomRightLat?: RouteQueryValue;
  bottomRightLng?: RouteQueryValue;
}

export interface SearchRouteState {
  destination?: string;
  page: number;
  lat?: number;
  lng?: number;
  topLeftLat?: number;
  topLeftLng?: number;
  bottomRightLat?: number;
  bottomRightLng?: number;
  checkIn?: string;
  checkOut?: string;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
}

const SEARCH_ROUTE_QUERY_KEYS = [
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

const ACCOMMODATION_BOOKING_ROUTE_QUERY_KEYS = [
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

const pickRouteParams = (
  input: SearchParamsInput,
  keys: readonly string[],
): URLSearchParams => {
  const source = toSearchParams(input);
  const picked = new URLSearchParams();

  keys.forEach((key) => {
    const value = source.get(key);
    if (value !== null && value !== "") picked.set(key, value);
  });

  return picked;
};

const pickSearchRouteParams = (
  input: SearchParamsInput,
): URLSearchParams => pickRouteParams(input, SEARCH_ROUTE_QUERY_KEYS);

const pickAccommodationBookingRouteParams = (
  input: SearchParamsInput,
): URLSearchParams =>
  pickRouteParams(input, ACCOMMODATION_BOOKING_ROUTE_QUERY_KEYS);

const clampPage = (value: string | null): number => {
  const parsed = parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(parsed, MAX_SEARCH_PAGE - 1));
};

const parseCoordinatePair = (
  params: URLSearchParams,
  firstKey: string,
  secondKey: string,
): readonly [number, number] | null => {
  const first = parseStrictFiniteNumber(params.get(firstKey));
  const second = parseStrictFiniteNumber(params.get(secondKey));

  return first === undefined || second === undefined ? null : [first, second];
};

const parseViewport = (
  params: URLSearchParams,
): readonly [number, number, number, number] | null => {
  const topLeft = parseCoordinatePair(params, "topLeftLat", "topLeftLng");
  const bottomRight = parseCoordinatePair(
    params,
    "bottomRightLat",
    "bottomRightLng",
  );

  return topLeft && bottomRight
    ? [topLeft[0], topLeft[1], bottomRight[0], bottomRight[1]]
    : null;
};

export const parseSearchRouteState = (
  input: SearchParamsInput,
): SearchRouteState => {
  const params = toSearchParams(input);
  const booking = parseAccommodationBookingRouteState(params);
  const location = parseCoordinatePair(params, "lat", "lng");
  const viewport = parseViewport(params);
  const destination = params.get("destination") || undefined;

  return {
    ...(destination ? { destination } : {}),
    page: clampPage(params.get("page")),
    ...(location ? { lat: location[0], lng: location[1] } : {}),
    ...(viewport
      ? {
          topLeftLat: viewport[0],
          topLeftLng: viewport[1],
          bottomRightLat: viewport[2],
          bottomRightLng: viewport[3],
        }
      : {}),
    ...booking,
  };
};

export const parseAccommodationBookingRouteState = (
  input: SearchParamsInput,
): AccommodationBookingRouteState => {
  const params = toSearchParams(input);
  const checkIn = parseStrictDate(params.get("checkIn"));
  const checkOut = parseStrictDate(params.get("checkOut"));

  return {
    ...(checkIn ? { checkIn } : {}),
    ...(checkOut ? { checkOut } : {}),
    adultOccupancy: parsePositiveInteger(params.get("adultOccupancy"), 1),
    childOccupancy: parseNonNegativeInteger(params.get("childOccupancy"), 0),
    infantOccupancy: parseNonNegativeInteger(params.get("infantOccupancy"), 0),
    petOccupancy: parseNonNegativeInteger(params.get("petOccupancy"), 0),
  };
};

export const serializeAccommodationBookingRouteQuery = (
  query?: AccommodationBookingRouteQuery,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "checkIn", query?.checkIn);
  appendDefinedSearchParam(params, "checkOut", query?.checkOut);
  appendDefinedSearchParam(params, "adultOccupancy", query?.adultOccupancy);
  appendDefinedSearchParam(params, "childOccupancy", query?.childOccupancy);
  appendDefinedSearchParam(params, "infantOccupancy", query?.infantOccupancy);
  appendDefinedSearchParam(params, "petOccupancy", query?.petOccupancy);

  return params;
};

export const serializeSearchRouteQuery = (
  query?: SearchRouteQuery,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "destination", query?.destination);
  appendDefinedSearchParam(params, "page", query?.page);
  appendDefinedSearchParam(params, "lat", query?.lat);
  appendDefinedSearchParam(params, "lng", query?.lng);
  appendDefinedSearchParam(params, "topLeftLat", query?.topLeftLat);
  appendDefinedSearchParam(params, "topLeftLng", query?.topLeftLng);
  appendDefinedSearchParam(params, "bottomRightLat", query?.bottomRightLat);
  appendDefinedSearchParam(params, "bottomRightLng", query?.bottomRightLng);
  appendDefinedSearchParam(params, "checkIn", query?.checkIn);
  appendDefinedSearchParam(params, "checkOut", query?.checkOut);
  appendDefinedSearchParam(params, "adultOccupancy", query?.adultOccupancy);
  appendDefinedSearchParam(params, "childOccupancy", query?.childOccupancy);
  appendDefinedSearchParam(params, "infantOccupancy", query?.infantOccupancy);
  appendDefinedSearchParam(params, "petOccupancy", query?.petOccupancy);

  return params;
};

const canonicalizeSearchRoute = (input: SearchParamsInput): string =>
  serializeSearchRouteQuery(parseSearchRouteState(input)).toString();

export const searchCodec = {
  parse: parseSearchRouteState,
  serialize: serializeSearchRouteQuery,
  canonicalize: canonicalizeSearchRoute,
  pick: pickSearchRouteParams,
} as const;

export const accommodationBookingCodec = {
  parse: parseAccommodationBookingRouteState,
  serialize: serializeAccommodationBookingRouteQuery,
  canonicalize: (input: SearchParamsInput): string =>
    serializeAccommodationBookingRouteQuery(
      parseAccommodationBookingRouteState(input),
    ).toString(),
  pick: pickAccommodationBookingRouteParams,
} as const;

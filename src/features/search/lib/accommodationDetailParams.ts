import type { AccommodationBookingRouteQuery } from "../../../routes/routeQueryContracts";

const DETAIL_QUERY_KEYS_TO_PRESERVE = [
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

export const toAccommodationBookingRouteQuery = (
  params: URLSearchParams,
): AccommodationBookingRouteQuery => {
  const query: AccommodationBookingRouteQuery = {};

  DETAIL_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      query[key] = value;
    }
  });

  return query;
};

export const buildAccommodationDetailSearchParams = (
  params: URLSearchParams,
) => {
  const nextParams = new URLSearchParams();

  DETAIL_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      nextParams.set(key, value);
    }
  });

  return nextParams;
};

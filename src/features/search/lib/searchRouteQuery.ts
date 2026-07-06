import { appendDefinedSearchParam } from "../../../routes/routeQuery";

type RouteParamValue = string | number;

export type AccommodationBookingRouteQuery = {
  checkIn?: RouteParamValue;
  checkOut?: RouteParamValue;
  adultOccupancy?: RouteParamValue;
  childOccupancy?: RouteParamValue;
  infantOccupancy?: RouteParamValue;
  petOccupancy?: RouteParamValue;
};

export type SearchRouteQuery = AccommodationBookingRouteQuery & {
  destination?: RouteParamValue;
  page?: RouteParamValue;
  lat?: RouteParamValue;
  lng?: RouteParamValue;
  topLeftLat?: RouteParamValue;
  topLeftLng?: RouteParamValue;
  bottomRightLat?: RouteParamValue;
  bottomRightLng?: RouteParamValue;
};

export const buildAccommodationBookingRouteSearchParams = (
  query?: AccommodationBookingRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "checkIn", query?.checkIn);
  appendDefinedSearchParam(params, "checkOut", query?.checkOut);
  appendDefinedSearchParam(params, "adultOccupancy", query?.adultOccupancy);
  appendDefinedSearchParam(params, "childOccupancy", query?.childOccupancy);
  appendDefinedSearchParam(params, "infantOccupancy", query?.infantOccupancy);
  appendDefinedSearchParam(params, "petOccupancy", query?.petOccupancy);

  return params;
};

export const buildSearchRouteSearchParams = (query?: SearchRouteQuery) => {
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

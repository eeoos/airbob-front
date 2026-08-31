import type {
  SearchCommittedRouteState,
  SearchRequest,
} from "../model/search";

export const SEARCH_PAGE_SIZE = 18;
export const SEARCH_PAGE_LIMIT = 15;

const SEARCH_PAGE_MAX_INDEX = SEARCH_PAGE_LIMIT - 1;

const clampPage = (page: number): number => {
  if (!Number.isFinite(page)) return 0;
  return Math.max(0, Math.min(Math.trunc(page), SEARCH_PAGE_MAX_INDEX));
};

const hasCompleteViewport = (
  state: SearchCommittedRouteState,
): state is SearchCommittedRouteState &
  Required<
    Pick<
      SearchCommittedRouteState,
      "topLeftLat" | "topLeftLng" | "bottomRightLat" | "bottomRightLng"
    >
  > =>
  [
    state.topLeftLat,
    state.topLeftLng,
    state.bottomRightLat,
    state.bottomRightLng,
  ].every((coordinate) =>
    typeof coordinate === "number" && Number.isFinite(coordinate)
  );

export const toSearchRequest = (
  state: SearchCommittedRouteState,
): SearchRequest => {
  const hasViewport = hasCompleteViewport(state);

  return {
    ...(hasViewport
      ? {
          topLeftLat: state.topLeftLat,
          topLeftLng: state.topLeftLng,
          bottomRightLat: state.bottomRightLat,
          bottomRightLng: state.bottomRightLng,
        }
      : state.destination
        ? { destination: state.destination }
        : {}),
    ...(state.checkIn ? { checkIn: state.checkIn } : {}),
    ...(state.checkOut ? { checkOut: state.checkOut } : {}),
    adultOccupancy: state.adultOccupancy,
    childOccupancy: state.childOccupancy,
    infantOccupancy: state.infantOccupancy,
    petOccupancy: state.petOccupancy,
    page: clampPage(state.page),
    size: SEARCH_PAGE_SIZE,
  };
};

const normalizeStringArray = (
  values: readonly string[],
): readonly string[] => [...values];

/**
 * Produces the stable semantic value used by both the transport and query key.
 * Undefined fields are deliberately omitted so malformed/raw URL text cannot
 * create a distinct cache entry after the route codec has normalized it.
 */
export const normalizeSearchRequest = (
  request: SearchRequest,
): SearchRequest => ({
  ...(request.destination === undefined
    ? {}
    : { destination: request.destination }),
  ...(request.minPrice === undefined ? {} : { minPrice: request.minPrice }),
  ...(request.maxPrice === undefined ? {} : { maxPrice: request.maxPrice }),
  ...(request.checkIn === undefined ? {} : { checkIn: request.checkIn }),
  ...(request.checkOut === undefined ? {} : { checkOut: request.checkOut }),
  ...(request.adultOccupancy === undefined
    ? {}
    : { adultOccupancy: request.adultOccupancy }),
  ...(request.childOccupancy === undefined
    ? {}
    : { childOccupancy: request.childOccupancy }),
  ...(request.infantOccupancy === undefined
    ? {}
    : { infantOccupancy: request.infantOccupancy }),
  ...(request.petOccupancy === undefined
    ? {}
    : { petOccupancy: request.petOccupancy }),
  ...(request.amenityTypes === undefined
    ? {}
    : { amenityTypes: normalizeStringArray(request.amenityTypes) }),
  ...(request.accommodationTypes === undefined
    ? {}
    : {
        accommodationTypes: normalizeStringArray(request.accommodationTypes),
      }),
  ...(request.topLeftLat === undefined
    ? {}
    : { topLeftLat: request.topLeftLat }),
  ...(request.topLeftLng === undefined
    ? {}
    : { topLeftLng: request.topLeftLng }),
  ...(request.bottomRightLat === undefined
    ? {}
    : { bottomRightLat: request.bottomRightLat }),
  ...(request.bottomRightLng === undefined
    ? {}
    : { bottomRightLng: request.bottomRightLng }),
  ...(request.page === undefined ? {} : { page: request.page }),
  ...(request.size === undefined ? {} : { size: request.size }),
});

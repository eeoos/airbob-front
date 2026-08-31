import type { SearchCommittedRouteState } from "../model/search";
import {
  normalizeSearchRequest,
  SEARCH_PAGE_SIZE,
  toSearchRequest,
} from "./searchRequest";

const committedState = (
  overrides: Partial<SearchCommittedRouteState> = {},
): SearchCommittedRouteState => ({
  destination: "Seoul",
  page: 2,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 0,
  ...overrides,
});

describe("search request mapping", () => {
  it("maps committed destination state to the current endpoint query", () => {
    expect(toSearchRequest(committedState())).toEqual({
      destination: "Seoul",
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 0,
      page: 2,
      size: SEARCH_PAGE_SIZE,
    });
  });

  it("prefers a complete viewport over destination and clamps the page", () => {
    expect(
      toSearchRequest(
        committedState({
          destination: "Seoul",
          page: 99,
          topLeftLat: 38,
          topLeftLng: 126,
          bottomRightLat: 37,
          bottomRightLng: 128,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        topLeftLat: 38,
        topLeftLng: 126,
        bottomRightLat: 37,
        bottomRightLng: 128,
        page: 14,
        size: 18,
      }),
    );
    expect(
      toSearchRequest(
        committedState({
          destination: "Seoul",
          page: 99,
          topLeftLat: 38,
          topLeftLng: 126,
          bottomRightLat: 37,
          bottomRightLng: 128,
        }),
      ),
    ).not.toHaveProperty("destination");
  });

  it("ignores partial or non-finite viewport state and clamps invalid pages", () => {
    expect(
      toSearchRequest(
        committedState({
          page: Number.NaN,
          topLeftLat: 38,
          topLeftLng: Number.POSITIVE_INFINITY,
          bottomRightLat: 37,
          bottomRightLng: 128,
        }),
      ),
    ).toMatchObject({ destination: "Seoul", page: 0, size: 18 });
  });

  it("normalizes present request values without dropping zeros", () => {
    expect(
      normalizeSearchRequest({
        adultOccupancy: 1,
        childOccupancy: 0,
        page: 0,
        amenityTypes: ["WIFI"],
      }),
    ).toEqual({
      adultOccupancy: 1,
      childOccupancy: 0,
      amenityTypes: ["WIFI"],
      page: 0,
    });
  });
});

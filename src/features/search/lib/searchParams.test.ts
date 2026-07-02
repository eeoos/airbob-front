import {
  buildMapBoundsSearchParams,
  buildSearchNavigationParams,
  buildSearchRequestFromParams,
  getViewportFromSearchParams,
  removeViewportParams,
} from "./searchParams";

const date = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

describe("search params helpers", () => {
  it("builds Google Place search params with viewport and resets page", () => {
    const existing = new URLSearchParams(
      "destination=old&page=4&sort=popular&topLeftLat=1&topLeftLng=2&bottomRightLat=3&bottomRightLng=4"
    );

    const params = buildSearchNavigationParams(existing, {
      destination: "Seoul",
      selectedPlace: {
        lat: 37.5665,
        lng: 126.978,
        viewport: {
          north: 37.7,
          south: 37.4,
          east: 127.1,
          west: 126.8,
        },
      },
      checkIn: date("2026-07-10"),
      checkOut: date("2026-07-12"),
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
    });

    expect(params.get("destination")).toBe("Seoul");
    expect(params.get("lat")).toBe("37.5665");
    expect(params.get("lng")).toBe("126.978");
    expect(params.get("topLeftLat")).toBe("37.7");
    expect(params.get("topLeftLng")).toBe("126.8");
    expect(params.get("bottomRightLat")).toBe("37.4");
    expect(params.get("bottomRightLng")).toBe("127.1");
    expect(params.get("checkIn")).toBe("2026-07-10");
    expect(params.get("checkOut")).toBe("2026-07-12");
    expect(params.get("adultOccupancy")).toBe("2");
    expect(params.get("childOccupancy")).toBe("1");
    expect(params.get("infantOccupancy")).toBe("0");
    expect(params.get("petOccupancy")).toBe("1");
    expect(params.get("sort")).toBe("popular");
    expect(params.has("page")).toBe(false);
  });

  it("builds plain text search params by removing stale viewport and coordinates", () => {
    const existing = new URLSearchParams(
      "destination=old&page=3&lat=1&lng=2&topLeftLat=3&topLeftLng=4&bottomRightLat=5&bottomRightLng=6"
    );

    const params = buildSearchNavigationParams(existing, {
      destination: "Busan",
      selectedPlace: null,
      checkIn: null,
      checkOut: null,
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });

    expect(params.get("destination")).toBe("Busan");
    expect(params.has("lat")).toBe(false);
    expect(params.has("lng")).toBe(false);
    expect(params.has("topLeftLat")).toBe(false);
    expect(params.has("topLeftLng")).toBe(false);
    expect(params.has("bottomRightLat")).toBe(false);
    expect(params.has("bottomRightLng")).toBe(false);
    expect(params.has("page")).toBe(false);
    expect(params.get("adultOccupancy")).toBe("1");
    expect(params.get("childOccupancy")).toBe("0");
    expect(params.get("infantOccupancy")).toBe("0");
    expect(params.get("petOccupancy")).toBe("0");
  });

  it("builds map bounds params by clearing destination, coordinates, and page", () => {
    const existing = new URLSearchParams(
      "destination=Seoul&lat=37&lng=127&page=2&checkIn=2026-07-10&adultOccupancy=2"
    );

    const params = buildMapBoundsSearchParams(existing, {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    });

    expect(params.get("topLeftLat")).toBe("38");
    expect(params.get("topLeftLng")).toBe("126");
    expect(params.get("bottomRightLat")).toBe("37");
    expect(params.get("bottomRightLng")).toBe("128");
    expect(params.has("destination")).toBe(false);
    expect(params.has("lat")).toBe(false);
    expect(params.has("lng")).toBe(false);
    expect(params.has("page")).toBe(false);
    expect(params.get("checkIn")).toBe("2026-07-10");
    expect(params.get("adultOccupancy")).toBe("2");
  });

  it("builds a search API request from viewport params and ignores destination", () => {
    const params = new URLSearchParams(
      "destination=Seoul&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1&page=20"
    );

    expect(buildSearchRequestFromParams(params)).toEqual({
      topLeftLat: 38,
      topLeftLng: 126,
      bottomRightLat: 37,
      bottomRightLng: 128,
      destination: undefined,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
      page: 14,
      size: 18,
    });
  });

  it("builds a search API request from destination when viewport is absent", () => {
    const params = new URLSearchParams("destination=Jeju&page=2");

    expect(buildSearchRequestFromParams(params)).toMatchObject({
      destination: "Jeju",
      topLeftLat: undefined,
      topLeftLng: undefined,
      bottomRightLat: undefined,
      bottomRightLng: undefined,
      page: 2,
      size: 18,
    });
  });

  it("reads and removes viewport params consistently", () => {
    const params = new URLSearchParams(
      "topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&lat=37&lng=127"
    );

    expect(getViewportFromSearchParams(params)).toEqual({
      north: 38,
      west: 126,
      south: 37,
      east: 128,
    });

    const withoutViewport = removeViewportParams(params);

    expect(withoutViewport.has("topLeftLat")).toBe(false);
    expect(withoutViewport.has("topLeftLng")).toBe(false);
    expect(withoutViewport.has("bottomRightLat")).toBe(false);
    expect(withoutViewport.has("bottomRightLng")).toBe(false);
    expect(withoutViewport.get("lat")).toBe("37");
    expect(withoutViewport.get("lng")).toBe("127");
  });
});

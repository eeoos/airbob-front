import { getMapCardPlacement, getMarkerMapPoint } from "./infoWindowPlacement";

describe("map card placement", () => {
  it.each([
    ["north", 600, 24, "below"],
    ["south", 600, 890, "above"],
    ["west", 8, 480, "above"],
    ["east", 1192, 440, "below"],
    ["northwest", 8, 24, "below"],
    ["northeast", 1192, 24, "below"],
    ["southwest", 8, 890, "above"],
    ["southeast", 1192, 890, "above"],
  ] as const)(
    "keeps a %s edge card inside the map without covering its marker",
    (_, x, y, side) => {
      const card = getMapCardPlacement({
        mapWidth: 1200,
        mapHeight: 900,
        cardWidth: 327,
        cardHeight: 354,
        markerX: x,
        markerY: y,
        markerHeight: 28,
      });
      expect(card.side).toBe(side);
      expect(card.left).toBeGreaterThanOrEqual(16);
      expect(card.left + 327).toBeLessThanOrEqual(1184);
      expect(card.top).toBeGreaterThanOrEqual(16);
      expect(card.top + 354).toBeLessThanOrEqual(884);
      const markerGap =
        side === "above" ? y - 28 - (card.top + 354) : card.top - y;
      expect(markerGap).toBeGreaterThanOrEqual(16);
    },
  );

  it("uses the roomier side when the card cannot fit on either side", () => {
    expect(
      getMapCardPlacement({
        mapWidth: 500,
        mapHeight: 640,
        cardWidth: 327,
        cardHeight: 300,
        markerX: 250,
        markerY: 340,
        markerHeight: 28,
      }).side,
    ).toBe("above");
  });

  it("keeps a card within a narrow map after it has been constrained to the viewport", () => {
    const card = getMapCardPlacement({
      mapWidth: 280,
      mapHeight: 230,
      cardWidth: 248,
      cardHeight: 198,
      markerX: 275,
      markerY: 30,
      markerHeight: 28,
    });
    expect(card.left).toBe(16);
    expect(card.top).toBe(16);
  });

  it("projects the nearest marker copy across the date line at fractional zoom", () => {
    const center = {};
    const map = {
      getCenter: () => center,
      getZoom: () => 2.5,
      getProjection: () => ({
        fromLatLngToPoint: (value: unknown) =>
          value === center ? { x: 255, y: 128 } : { x: 1, y: 130 },
      }),
    } as unknown as google.maps.Map;
    expect(getMarkerMapPoint(map, { lat: 0, lng: -179 }, 600, 400)).toEqual({
      x: 300 + 2 * 2 ** 2.5,
      y: 200 + 2 * 2 ** 2.5,
    });
  });
});

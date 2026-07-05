import { readFileSync } from "fs";
import { join } from "path";

const searchMapRoot = join(
  process.cwd(),
  "src/features/search/components/SearchMap",
);

describe("SearchMap structure", () => {
  it("keeps Google Maps SDK side effects out of the render shell", () => {
    const mapSource = readFileSync(join(searchMapRoot, "Map.tsx"), "utf8");

    const forbiddenRenderShellOwnership = [
      "new window.google.maps.Marker",
      "new window.google.maps.InfoWindow",
      "new Blob",
      "window.toggleWishlist",
      "window.closeInfoWindow",
    ];

    const offenders = forbiddenRenderShellOwnership.filter((snippet) =>
      mapSource.includes(snippet),
    );

    expect(offenders).toEqual([]);
  });

  it("forwards detail search params into the map selection info-window hook", () => {
    const mapSource = readFileSync(join(searchMapRoot, "Map.tsx"), "utf8");

    expect(mapSource).toContain("detailSearchParams,");
    expect(mapSource).toMatch(
      /useMapSelectionInfoWindow\(\{[\s\S]*detailSearchParams,[\s\S]*\}\);/,
    );
  });

  it("filters booking-safe params for map info-window detail links", () => {
    const eventsHookSource = readFileSync(
      join(searchMapRoot, "hooks/useMapInfoWindowEvents.ts"),
      "utf8",
    );

    expect(eventsHookSource).toContain("toAccommodationBookingRouteQuery");
    expect(eventsHookSource).toMatch(
      /const detailParams = detailSearchParams\s*\?\s*toAccommodationBookingRouteQuery\(detailSearchParams\)\s*:\s*undefined;/,
    );
    expect(eventsHookSource).toMatch(
      /routeTo\.accommodationDetail\(\s*accommodationId,\s*detailParams,?\s*\)/,
    );
  });

  it("uses delegated info-window events without window globals or private Google Maps fields", () => {
    const hookSource = readFileSync(
      join(searchMapRoot, "hooks/useMapSelectionInfoWindow.ts"),
      "utf8",
    );
    const eventsHookSource = readFileSync(
      join(searchMapRoot, "hooks/useMapInfoWindowEvents.ts"),
      "utf8",
    );
    const contentSource = readFileSync(
      join(searchMapRoot, "lib/infoWindowContent.ts"),
      "utf8",
    );
    const infoWindowSource = `${hookSource}\n${eventsHookSource}\n${contentSource}`;

    expect(hookSource).toContain("useMapInfoWindowEvents");
    expect(hookSource).not.toContain('from "../lib/infoWindowEvents"');
    expect(hookSource).not.toContain("bindInfoWindowEvents({");
    expect(eventsHookSource).toContain("bindInfoWindowEvents");

    const forbiddenInfoWindowSnippets = [
      "window.toggleWishlist",
      "window.closeInfoWindow",
      "_resizeListener",
    ];
    const offenders = forbiddenInfoWindowSnippets.filter((snippet) =>
      infoWindowSource.includes(snippet),
    );

    expect(offenders).toEqual([]);
  });

  it("routes the rich accommodation adapter through the exported info-window content boundary", () => {
    const contentSource = readFileSync(
      join(searchMapRoot, "lib/infoWindowContent.ts"),
      "utf8",
    );
    const adapterStart = contentSource.indexOf(
      "export const buildInfoWindowContent",
    );
    const adapterSource = contentSource.slice(adapterStart);

    expect(adapterStart).toBeGreaterThanOrEqual(0);
    expect(adapterSource).toContain("return buildSearchMapInfoWindowContent({");
    expect(adapterSource).not.toContain(
      "return buildSearchMapInfoWindowContentView({",
    );
  });

  it("keeps Google Maps CSS overrides inside the documented vendor boundary", () => {
    const mapCss = readFileSync(join(searchMapRoot, "Map.module.css"), "utf8");
    const boundaryStart = mapCss.indexOf(
      "Vendor boundary: Google Maps InfoWindow chrome",
    );
    const boundaryEnd = mapCss.indexOf(
      "End vendor boundary: Google Maps InfoWindow chrome",
    );

    expect(boundaryStart).toBeGreaterThanOrEqual(0);
    expect(boundaryEnd).toBeGreaterThan(boundaryStart);

    const googleMapsOverrideIndexes: number[] = [];
    const googleMapsOverridePattern = /:global\(\.gm-/g;
    let match: RegExpExecArray | null;

    while ((match = googleMapsOverridePattern.exec(mapCss)) !== null) {
      googleMapsOverrideIndexes.push(match.index);
    }

    expect(googleMapsOverrideIndexes.length).toBeGreaterThan(0);
    expect(
      googleMapsOverrideIndexes.every(
        (index) => index > boundaryStart && index < boundaryEnd,
      ),
    ).toBe(true);
  });
});

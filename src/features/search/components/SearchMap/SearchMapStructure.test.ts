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

  it("forwards the app-owned detail href resolver into the info-window hook", () => {
    const mapSource = readFileSync(join(searchMapRoot, "Map.tsx"), "utf8");

    expect(mapSource).toContain("getAccommodationHref,");
    expect(mapSource).toMatch(
      /useMapSelectionInfoWindow\(\{[\s\S]*getAccommodationHref,[\s\S]*\}\);/,
    );
  });

  it("opens only the app-injected detail href from map info windows", () => {
    const eventsHookSource = readFileSync(
      join(searchMapRoot, "hooks/useMapInfoWindowEvents.ts"),
      "utf8",
    );

    expect(eventsHookSource).toContain("browserWindowNavigation.openInNewTab");
    expect(eventsHookSource).toContain("getAccommodationHref(accommodationId)");
    expect(eventsHookSource).not.toContain("routeTo");
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

  it("keeps selection work event-driven and removes only owned SDK listeners", () => {
    const selectionHookSource = readFileSync(
      join(searchMapRoot, "hooks/useMapSelectionInfoWindow.ts"),
      "utf8",
    );
    const mapInstanceHookSource = readFileSync(
      join(searchMapRoot, "hooks/useGoogleMapInstance.ts"),
      "utf8",
    );

    expect(selectionHookSource).not.toContain("requestAnimationFrame");
    expect(selectionHookSource).not.toContain("clearInstanceListeners");
    expect(mapInstanceHookSource).not.toContain("clearInstanceListeners");
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

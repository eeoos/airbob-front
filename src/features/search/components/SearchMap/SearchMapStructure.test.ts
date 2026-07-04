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
    const hookSource = readFileSync(
      join(searchMapRoot, "hooks/useMapSelectionInfoWindow.ts"),
      "utf8",
    );

    expect(hookSource).toContain("toAccommodationBookingRouteQuery");
    expect(hookSource).toMatch(
      /const detailParams = detailSearchParams\s*\?\s*toAccommodationBookingRouteQuery\(detailSearchParams\)\s*:\s*undefined;/,
    );
    expect(hookSource).toMatch(
      /routeTo\.accommodationDetail\(\s*selectedAccommodation\.id,\s*detailParams,?\s*\)/,
    );
  });
});

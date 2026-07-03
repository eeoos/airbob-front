import { readFileSync } from "fs";
import { join } from "path";

const searchMapRoot = join(
  process.cwd(),
  "src/features/search/components/SearchMap"
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
      mapSource.includes(snippet)
    );

    expect(offenders).toEqual([]);
  });
});

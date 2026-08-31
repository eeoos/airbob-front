import { readFileSync } from "fs";
import { join } from "path";

describe("Search Places integration boundary", () => {
  it("keeps Search Places loading on platform-owned integrations", () => {
    const featureSource = readFileSync(
      join(process.cwd(), "src/features/search/hooks/usePlacesAutocomplete.ts"),
      "utf8",
    );

    expect(featureSource).toMatch(/ensureGoogleMapsScript/);
    expect(featureSource).toMatch(/ensureGooglePlacesReady/);
    expect(featureSource).not.toMatch(/GOOGLE_MAPS_API_KEY/);
    expect(featureSource).not.toMatch(
      /document\.createElement\(\s*["']script["']\s*\)/,
    );
    expect(featureSource).not.toMatch(/maps\.googleapis\.com\/maps\/api\/js/);
  });
});

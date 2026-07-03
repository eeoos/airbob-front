import { readFileSync } from "fs";
import { join } from "path";

describe("hooks boundary contracts", () => {
  it("keeps usePlacesAutocomplete on the shared Google Maps script loader", () => {
    const source = readFileSync(
      join(process.cwd(), "src/hooks/usePlacesAutocomplete.ts"),
      "utf8"
    );

    expect(source).toMatch(/useGoogleMapsScript/);
    expect(source).not.toMatch(/GOOGLE_MAPS_API_KEY/);
    expect(source).not.toMatch(/document\.createElement\(\s*["']script["']\s*\)/);
    expect(source).not.toMatch(/maps\.googleapis\.com\/maps\/api\/js/);
  });
});

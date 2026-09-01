import { readFileSync } from "fs";
import { join } from "path";
import { accommodationAmenityCatalog } from "./accommodationAmenityCatalog";

describe("accommodation amenity catalog", () => {
  it("owns one unique semantic label for each amenity code", () => {
    const codes = accommodationAmenityCatalog.knownAmenities.map(
      ({ code }) => code,
    );

    expect(new Set(codes).size).toBe(codes.length);
    expect(accommodationAmenityCatalog.knownAmenities).toHaveLength(30);
    expect(accommodationAmenityCatalog.resolve("WIFI")).toEqual({
      code: "WIFI",
      isKnown: true,
      label: "무선 인터넷",
    });
  });

  it("signals an unknown backend code instead of presenting it as known", () => {
    expect(accommodationAmenityCatalog.resolve("FUTURE_AMENITY")).toEqual({
      code: "FUTURE_AMENITY",
      isKnown: false,
      label: "알 수 없는 편의시설",
    });
  });

  it("keeps semantic amenity labels out of nested detail and editor registries", () => {
    const projectRoot = process.cwd();
    const formerDetailLabels = readFileSync(
      join(
        projectRoot,
        "src/features/accommodations/detail/lib/accommodationLabels.ts",
      ),
      "utf8",
    );
    const formerEditorOptions = readFileSync(
      join(
        projectRoot,
        "src/screens/accommodation-edit/components/editorOptions.ts",
      ),
      "utf8",
    );
    const detailComposition = readFileSync(
      join(
        projectRoot,
        "src/screens/accommodation-detail/AccommodationDetailController.tsx",
      ),
      "utf8",
    );
    const editorComposition = readFileSync(
      join(
        projectRoot,
        "src/screens/accommodation-edit/AccommodationEditController.tsx",
      ),
      "utf8",
    );

    expect(formerDetailLabels).not.toContain("accommodationAmenityLabels");
    expect(formerEditorOptions).not.toContain("AMENITY_OPTIONS");
    expect(detailComposition).toContain("amenityCatalog,");
    expect(editorComposition).toContain("amenityCatalog.resolve(name)");
  });
});

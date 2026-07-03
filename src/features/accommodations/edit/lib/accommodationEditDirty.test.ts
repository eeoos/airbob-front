import {
  areAmenityInfosChanged,
  areImageItemsChanged,
} from "./accommodationEditDirty";
import { AccommodationEditImageItem } from "./imageItems";

describe("accommodation edit dirty helpers", () => {
  it("compares amenities without mutating input order", () => {
    const current = [
      { name: "TV", count: 1 },
      { name: "WIFI", count: 1 },
    ];
    const initial = [
      { name: "WIFI", count: 1 },
      { name: "TV", count: 1 },
    ];

    expect(areAmenityInfosChanged(current, initial)).toBe(false);
    expect(current.map((item) => item.name)).toEqual(["TV", "WIFI"]);
    expect(initial.map((item) => item.name)).toEqual(["WIFI", "TV"]);
  });

  it("detects changed amenity counts", () => {
    expect(
      areAmenityInfosChanged(
        [{ name: "WIFI", count: 2 }],
        [{ name: "WIFI", count: 1 }]
      )
    ).toBe(true);
  });

  it("preserves existing image dirty behavior", () => {
    const initial: AccommodationEditImageItem[] = [
      { id: 1, url: "a.jpg" },
      { id: 2, url: "b.jpg" },
    ];

    expect(
      areImageItemsChanged({
        isNewDraft: false,
        currentImageItems: [
          { id: 2, url: "b.jpg" },
          { id: 1, url: "a.jpg" },
        ],
        initialImageItems: initial,
      })
    ).toBe(false);
    expect(
      areImageItemsChanged({
        isNewDraft: false,
        currentImageItems: [{ id: 1, url: "changed.jpg" }],
        initialImageItems: initial,
      })
    ).toBe(true);
    expect(
      areImageItemsChanged({
        isNewDraft: true,
        currentImageItems: [{ id: 1, url: "changed.jpg" }],
        initialImageItems: initial,
      })
    ).toBe(false);
  });
});

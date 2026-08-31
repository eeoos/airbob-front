import { getLimitedTotalPages, getPaginationItems } from "./pagination";

describe("search pagination helpers", () => {
  it("limits API total pages to the product maximum", () => {
    expect(getLimitedTotalPages(3)).toBe(3);
    expect(getLimitedTotalPages(40)).toBe(15);
  });

  it("clamps the selected page to zero-based page bounds", () => {
    expect(getPaginationItems({ currentPage: -1, totalPages: 20 })).toEqual([
      0,
      1,
      2,
      3,
      4,
      "ellipsis",
      14,
    ]);
    expect(getPaginationItems({ currentPage: 99, totalPages: 20 })).toEqual([
      0,
      "ellipsis",
      10,
      11,
      12,
      13,
      14,
    ]);
  });

  it("returns every page when seven or fewer pages are available", () => {
    expect(getPaginationItems({ currentPage: 2, totalPages: 5 })).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("uses a trailing ellipsis near the beginning", () => {
    expect(getPaginationItems({ currentPage: 0, totalPages: 20 })).toEqual([
      0,
      1,
      2,
      3,
      4,
      "ellipsis",
      14,
    ]);
  });

  it("uses both ellipses in the middle", () => {
    expect(getPaginationItems({ currentPage: 7, totalPages: 20 })).toEqual([
      0,
      "ellipsis",
      6,
      7,
      8,
      "ellipsis",
      14,
    ]);
  });

  it("uses a leading ellipsis near the end", () => {
    expect(getPaginationItems({ currentPage: 13, totalPages: 20 })).toEqual([
      0,
      "ellipsis",
      10,
      11,
      12,
      13,
      14,
    ]);
  });
});

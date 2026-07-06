import { searchQueryKeys } from "./queryKeys";

describe("searchQueryKeys", () => {
  it("builds stable search result keys from canonical signatures", () => {
    expect(searchQueryKeys.results("destination=Seoul&page=2")).toEqual([
      "search",
      "results",
      "destination=Seoul&page=2",
    ]);
  });

  it("canonicalizes equivalent search signatures independent of insertion order", () => {
    expect(searchQueryKeys.results("page=2&destination=Seoul")).toEqual(
      searchQueryKeys.results("destination=Seoul&page=2"),
    );
  });
});

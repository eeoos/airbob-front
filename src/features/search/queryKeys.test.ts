import { searchQueryKeys } from "./queryKeys";

describe("searchQueryKeys", () => {
  it("builds stable search result keys from params", () => {
    expect(searchQueryKeys.results("destination=Seoul&page=2")).toEqual([
      "search",
      "results",
      "destination=Seoul&page=2",
    ]);
  });

  it("canonicalizes equivalent search params independent of insertion order", () => {
    expect(searchQueryKeys.results("page=2&destination=Seoul")).toEqual(
      searchQueryKeys.results("destination=Seoul&page=2"),
    );
    expect(
      searchQueryKeys.results(new URLSearchParams("page=2&destination=Seoul")),
    ).toEqual(searchQueryKeys.results("destination=Seoul&page=2"));
  });
});

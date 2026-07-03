import { searchQueryKeys } from "./queryKeys";

describe("searchQueryKeys", () => {
  it("builds stable search result keys from params", () => {
    expect(searchQueryKeys.results("destination=Seoul&page=2")).toEqual([
      "search",
      "results",
      "destination=Seoul&page=2",
    ]);
  });
});

import {
  appendDefinedSearchParam,
  toCanonicalSearchString,
} from "./urlSearchParams";

describe("urlSearchParams helpers", () => {
  it("appends only meaningful values", () => {
    const params = new URLSearchParams();

    appendDefinedSearchParam(params, "destination", "Seoul");
    appendDefinedSearchParam(params, "page", 2);
    appendDefinedSearchParam(params, "empty", "");
    appendDefinedSearchParam(params, "nullish", null);
    appendDefinedSearchParam(params, "missing", undefined);

    expect(params.toString()).toBe("destination=Seoul&page=2");
  });

  it("canonicalizes params by key while preserving duplicate values", () => {
    const params = new URLSearchParams();
    params.append("page", "2");
    params.append("destination", "Seoul");
    params.append("destination", "Busan");

    expect(toCanonicalSearchString(params)).toBe(
      "destination=Seoul&destination=Busan&page=2",
    );
  });
});

import {
  createRequireDefined,
  requireDefined,
  requireFixtureItem,
} from "./assertions";

describe("test assertions", () => {
  it("returns defined values and reports the fixture label when one is missing", () => {
    expect(requireDefined(0, "zero fixture")).toBe(0);
    expect(() => requireDefined(null, "nullable fixture")).toThrow(
      "Expected nullable fixture to be defined",
    );
  });

  it("supports domain-specific missing-value diagnostics", () => {
    const requireTokenFixture = createRequireDefined(
      (label) => `Missing required design-token fixture value: ${label}`,
    );

    expect(requireTokenFixture("--color", "token name")).toBe("--color");
    expect(() => requireTokenFixture(undefined, "token name")).toThrow(
      "Missing required design-token fixture value: token name",
    );
  });

  it("returns indexed fixtures and reports the missing index", () => {
    expect(requireFixtureItem(["first"], 0, "tracked query client")).toBe(
      "first",
    );
    expect(() => requireFixtureItem([], 2, "tracked query client")).toThrow(
      "Missing tracked query client at index 2.",
    );
  });
});

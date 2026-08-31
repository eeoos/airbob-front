import { requireCssModuleClass } from "./requireCssModuleClass";

describe("requireCssModuleClass", () => {
  it("returns a class emitted by the CSS Module build", () => {
    expect(requireCssModuleClass("dialog_hash")).toBe("dialog_hash");
  });

  it("fails closed when source and CSS Module exports drift", () => {
    expect(() => requireCssModuleClass(undefined)).toThrow(
      "A referenced CSS Module class is missing from the build.",
    );
  });
});

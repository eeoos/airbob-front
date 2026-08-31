import type { MockedFunction, MockInstance } from "vitest";
import { isTestEnvironment } from "../config/env";
import { clientLogger } from "./clientLogger";

vi.mock("../config/env", () => ({
  isTestEnvironment: vi.fn(),
}));

const mockIsTestEnvironment = isTestEnvironment as MockedFunction<
  typeof isTestEnvironment
>;

describe("clientLogger", () => {
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("suppresses client logs in the test runtime", () => {
    mockIsTestEnvironment.mockReturnValue(true);

    clientLogger.warn({ message: "warning" });
    clientLogger.error({ message: "error" });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("routes warnings and errors through the matching console method", () => {
    mockIsTestEnvironment.mockReturnValue(false);
    const error = new Error("failure");

    clientLogger.warn({ message: "warning", error });
    clientLogger.error({ message: "error", error });

    expect(warnSpy).toHaveBeenCalledWith("warning", error);
    expect(errorSpy).toHaveBeenCalledWith("error", error);
  });
});

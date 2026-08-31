import { AppError, isAppError } from "../http/errors";
import { IntegrationError } from "./errors";

describe("IntegrationError", () => {
  it("is the integration subtype of the single platform AppError model", () => {
    const error = new IntegrationError({
      code: "INTEGRATION_TIMEOUT",
      integration: "google-maps",
      message: "Google Maps runtime is unavailable.",
      retryable: true,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(IntegrationError);
    expect(isAppError(error)).toBe(true);
    expect(error).toMatchObject({
      kind: "integration",
      code: "INTEGRATION_TIMEOUT",
      integration: "google-maps",
      retryable: true,
    });
  });
});

import { AppError, normalizeHttpError } from "./errors";
import { HttpTransportFailure } from "./transportFailure";

const transportFailure = ({
  data,
  kind,
  status,
}: {
  data?: unknown;
  kind: ConstructorParameters<typeof HttpTransportFailure>[0];
  status?: number;
}) =>
  new HttpTransportFailure(kind, {
    cause: {
      headers: { Authorization: "Bearer authorization-secret-canary" },
      message: "raw-secret-message",
      password: "request-password-canary",
    },
    ...(data === undefined ? {} : { responseData: data }),
    ...(status === undefined ? {} : { status }),
  });

describe("normalizeHttpError", () => {
  it.each([
    ["cancelled", undefined, "cancelled", "REQUEST_CANCELLED", false],
    ["timeout", undefined, "timeout", "REQUEST_TIMEOUT", true],
    ["network", undefined, "network", "NETWORK_ERROR", true],
    ["http", 401, "authentication", "AUTHENTICATION_REQUIRED", false],
    ["http", 400, "validation", "VALIDATION_ERROR", false],
    ["http", 422, "validation", "VALIDATION_ERROR", false],
    ["http", 409, "conflict", "CONFLICT", false],
    ["http", 503, "server", "SERVER_ERROR", true],
    ["http", 404, "http", "HTTP_ERROR", false],
    [
      "configuration",
      undefined,
      "configuration",
      "INVALID_REQUEST_CONFIGURATION",
      false,
    ],
  ] as const)(
    "maps transport kind %p and status %p to %s",
    (transportKind, status, kind, appCode, retryable) => {
      const failure = transportFailure({
        kind: transportKind,
        ...(status === undefined ? {} : { status }),
      });

      expect(normalizeHttpError(failure)).toMatchObject({
        kind,
        code: appCode,
        status,
        retryable,
      });
    },
  );

  it("recognizes the backend authentication code without copying the response body", () => {
    const error = normalizeHttpError(
      transportFailure({
        kind: "http",
        status: 403,
        data: {
          success: false,
          error: {
            code: "M004",
            message: "backend-secret-message-canary",
            token: "response-token-canary",
          },
        },
      }),
    );

    expect(error).toMatchObject({
      kind: "authentication",
      code: "M004",
      status: 403,
    });
    expect(error.message).toBe("Authentication is required.");
    expect(JSON.stringify(error)).not.toMatch(
      /backend-secret-message-canary|response-token-canary/,
    );
  });

  it.each([
    { error: { code: "M004" } },
    { success: true, data: null, error: { code: "M004" } },
  ])("does not trust M004 outside a failure envelope (%p)", (data) => {
    expect(
      normalizeHttpError(transportFailure({ kind: "http", status: 403, data })),
    ).toMatchObject({
      kind: "http",
      code: "HTTP_ERROR",
      status: 403,
    });
  });

  it("keeps raw transport causes non-enumerable and messages secret-safe", () => {
    const rawError = transportFailure({
      kind: "http",
      status: 503,
      data: { password: "response-password-canary" },
    });
    const error = normalizeHttpError(rawError);
    const serialized = JSON.stringify(error);

    expect(error).toBeInstanceOf(AppError);
    expect(error.cause).toBe(rawError);
    expect(Object.keys(error)).not.toContain("cause");
    expect(serialized).not.toMatch(
      /raw-secret-message|authorization-secret-canary|request-password-canary|response-password-canary/,
    );
    expect(error.message).not.toContain("raw-secret-message");
  });

  it("normalizes an external AbortError without transport-specific fields", () => {
    expect(
      normalizeHttpError(new DOMException("cancelled", "AbortError")),
    ).toMatchObject({
      kind: "cancelled",
      code: "REQUEST_CANCELLED",
    });
  });

  it("passes an existing AppError through unchanged", () => {
    const error = new AppError({
      kind: "integration",
      code: "SDK_UNAVAILABLE",
      message: "The integration is unavailable.",
    });

    expect(normalizeHttpError(error)).toBe(error);
  });
});

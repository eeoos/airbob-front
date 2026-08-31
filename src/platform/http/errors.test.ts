import { AppError, normalizeHttpError } from "./errors";

const axiosFailure = ({
  code,
  status,
  data,
  message = "raw-secret-message",
}: {
  code?: string;
  status?: number;
  data?: unknown;
  message?: string;
}) => ({
  isAxiosError: true,
  code,
  message,
  config: {
    headers: { Authorization: "Bearer authorization-secret-canary" },
    data: { password: "request-password-canary" },
  },
  response:
    status === undefined
      ? undefined
      : {
          status,
          data,
          headers: { "set-cookie": "cookie-secret-canary" },
        },
});

describe("normalizeHttpError", () => {
  it.each([
    ["ERR_CANCELED", undefined, "cancelled", "REQUEST_CANCELLED", false],
    ["ECONNABORTED", undefined, "timeout", "REQUEST_TIMEOUT", true],
    ["ETIMEDOUT", undefined, "timeout", "REQUEST_TIMEOUT", true],
    [undefined, undefined, "network", "NETWORK_ERROR", true],
    [undefined, 401, "authentication", "AUTHENTICATION_REQUIRED", false],
    [undefined, 400, "validation", "VALIDATION_ERROR", false],
    [undefined, 422, "validation", "VALIDATION_ERROR", false],
    [undefined, 409, "conflict", "CONFLICT", false],
    [undefined, 503, "server", "SERVER_ERROR", true],
    [undefined, 404, "http", "HTTP_ERROR", false],
  ] as const)(
    "maps transport code %p and status %p to %s",
    (code, status, kind, appCode, retryable) => {
      const failure = axiosFailure({
        ...(code === undefined ? {} : { code }),
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
      axiosFailure({
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
  ])(
    "does not trust M004 outside a failure envelope (%p)",
    (data) => {
      expect(
        normalizeHttpError(axiosFailure({ status: 403, data })),
      ).toMatchObject({
        kind: "http",
        code: "HTTP_ERROR",
        status: 403,
      });
    },
  );

  it("keeps the raw transport cause non-enumerable and messages secret-safe", () => {
    const rawError = axiosFailure({
      status: 503,
      data: { password: "response-password-canary" },
    });
    const error = normalizeHttpError(rawError);
    const serialized = JSON.stringify(error);

    expect(error).toBeInstanceOf(AppError);
    expect(error.cause).toBe(rawError);
    expect(Object.keys(error)).not.toContain("cause");
    expect(serialized).not.toMatch(
      /raw-secret-message|authorization-secret-canary|request-password-canary|cookie-secret-canary|response-password-canary/,
    );
    expect(error.message).not.toContain("raw-secret-message");
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

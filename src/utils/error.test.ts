import { ApiClientError } from "../api/response";
import { AppError } from "../platform/http/errors";
import { ErrorResponse } from "../types/api";
import { getApiErrorMessage, isAuthError, parseApiError } from "./error";

describe("parseApiError", () => {
  it("preserves message, status, code, and field errors from ApiClientError", () => {
    const backendError: ErrorResponse = {
      message: "입력값을 확인해주세요.",
      status: 400,
      code: "VALIDATION_FAILED",
      errors: [
        {
          field: "checkoutDate",
          value: "2026-07-01",
          reason: "체크아웃은 체크인 이후여야 합니다.",
        },
      ],
    };

    expect(parseApiError(new ApiClientError(backendError))).toEqual(backendError);
  });

  it("preserves a backend envelope from the platform Axios runtime", () => {
    const backendError: ErrorResponse = {
      message: "입력값을 확인해주세요.",
      status: 422,
      code: "VALIDATION_FAILED",
      errors: [
        {
          field: "guestCount",
          value: "0",
          reason: "인원은 1명 이상이어야 합니다.",
        },
      ],
    };
    const error = {
      isAxiosError: true,
      message: "Request failed with status code 422",
      response: {
        status: 422,
        data: { success: false, data: null, error: backendError },
      },
    };

    expect(parseApiError(error)).toBe(backendError);
  });

  it("preserves the typed AppError contract before the generic Error path", () => {
    const error = new AppError({
      kind: "validation",
      code: "A003",
      message: "The request could not be validated.",
      status: 422,
    });

    expect(parseApiError(error)).toEqual({
      message: "The request could not be validated.",
      status: 422,
      code: "A003",
    });
    expect(getApiErrorMessage(error)).toBe(
      "숙소 게시를 위한 필수 정보가 누락되었습니다.",
    );
  });

  it("preserves the current no-response network error contract", () => {
    const error = {
      isAxiosError: true,
      message: "Network Error",
    };

    expect(parseApiError(error)).toEqual({
      message: "Network Error",
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("falls back to the HTTP status when the response is not an API envelope", () => {
    const error = {
      isAxiosError: true,
      message: "Request failed with status code 502",
      response: {
        status: 502,
        data: "<html>Bad Gateway</html>",
      },
    };

    expect(parseApiError(error)).toEqual({
      message: "Request failed with status code 502",
      status: 502,
      code: "HTTP_502",
    });
  });

  it("keeps a non-Axios Error on the generic error path", () => {
    expect(parseApiError(new Error("Unexpected failure"))).toEqual({
      message: "Unexpected failure",
      status: 500,
      code: "UNKNOWN_ERROR",
    });
    expect(
      parseApiError({
        message: "Untrusted lookalike",
        response: { status: 401 },
      }),
    ).toBeNull();
  });
});

describe("getApiErrorMessage", () => {
  it("includes field errors from ApiClientError", () => {
    const backendError: ErrorResponse = {
      message: "입력값을 확인해주세요.",
      status: 400,
      code: "VALIDATION_FAILED",
      errors: [
        {
          field: "checkoutDate",
          value: "2026-07-01",
          reason: "체크아웃은 체크인 이후여야 합니다.",
        },
        {
          field: "guestCount",
          value: "0",
          reason: "인원은 1명 이상이어야 합니다.",
        },
      ],
    };

    expect(getApiErrorMessage(new ApiClientError(backendError))).toBe(
      [
        "입력값을 확인해주세요.",
        "checkoutDate: 체크아웃은 체크인 이후여야 합니다.",
        "guestCount: 인원은 1명 이상이어야 합니다.",
      ].join("\n")
    );
  });
});

describe("isAuthError", () => {
  it("detects a typed AppError by auth code", () => {
    const error = new AppError({
      kind: "authentication",
      code: "M004",
      message: "Authentication is required.",
      status: 403,
    });

    expect(isAuthError(error)).toBe(true);
  });

  it("detects ApiClientError by auth code", () => {
    const backendError: ErrorResponse = {
      message: "로그인이 필요합니다.",
      status: 403,
      code: "M004",
    };

    expect(isAuthError(new ApiClientError(backendError))).toBe(true);
  });

  it("detects ApiClientError by unauthorized status", () => {
    const backendError: ErrorResponse = {
      message: "인증이 만료되었습니다.",
      status: 401,
      code: "TOKEN_EXPIRED",
    };

    expect(isAuthError(new ApiClientError(backendError))).toBe(true);
  });
});

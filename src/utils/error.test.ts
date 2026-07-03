import { ApiClientError } from "../api/response";
import { ErrorResponse } from "../types/api";
import { getApiErrorMessage, isAuthError, parseApiError } from "./error";

jest.mock("axios", () => ({
  AxiosError: class AxiosError extends Error {},
}));

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

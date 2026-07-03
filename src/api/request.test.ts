import { ApiResponse, ErrorResponse } from "../types/api";
import { onAuthError } from "../utils/authEvents";
import { ApiClientError } from "./response";
import { requestApi, requestApiNullable } from "./request";

type Listing = {
  id: number;
  name: string;
};

describe("requestApi", () => {
  it("unwraps successful API envelopes to data", async () => {
    const listing: Listing = { id: 1, name: "Seoul stay" };
    const response: ApiResponse<Listing> = {
      success: true,
      data: listing,
      error: null,
    };

    await expect(requestApi(() => Promise.resolve({ data: response }))).resolves.toEqual(listing);
  });

  it("allows null success only through requestApiNullable", async () => {
    const response: ApiResponse<null> = {
      success: true,
      data: null,
      error: null,
    };

    await expect(requestApi(() => Promise.resolve({ data: response }))).rejects.toMatchObject({
      code: "EMPTY_API_DATA",
      status: 500,
      message: "응답 데이터가 비어 있습니다.",
    });
    await expect(requestApiNullable(() => Promise.resolve({ data: response }))).resolves.toBeNull();
  });

  it("throws ApiClientError with backend status code and message for unsuccessful envelopes", async () => {
    const backendError: ErrorResponse = {
      message: "예약을 찾을 수 없습니다.",
      status: 404,
      code: "RESERVATION_NOT_FOUND",
    };
    const response: ApiResponse<never> = {
      success: false,
      data: null,
      error: backendError,
    };

    let thrownError: unknown;
    try {
      await requestApi(() => Promise.resolve({ data: response }));
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiClientError);
    const clientError = thrownError as ApiClientError;
    expect(clientError.message).toBe("예약을 찾을 수 없습니다.");
    expect(clientError.status).toBe(404);
    expect(clientError.code).toBe("RESERVATION_NOT_FOUND");
  });

  it("publishes a global auth error for 401 or M004 unsuccessful envelopes", async () => {
    jest.useFakeTimers();
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);

    try {
      const unauthorizedResponse: ApiResponse<never> = {
        success: false,
        data: null,
        error: {
          message: "인증이 필요합니다.",
          status: 401,
          code: "AUTH_REQUIRED",
        },
      };
      const expiredSessionResponse: ApiResponse<never> = {
        success: false,
        data: null,
        error: {
          message: "세션이 만료되었습니다.",
          status: 403,
          code: "M004",
        },
      };

      await expect(
        requestApi(() => Promise.resolve({ data: unauthorizedResponse }))
      ).rejects.toMatchObject({
        code: "AUTH_REQUIRED",
        status: 401,
      });
      expect(listener).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);

      await expect(
        requestApiNullable(() => Promise.resolve({ data: expiredSessionResponse }))
      ).rejects.toMatchObject({
        code: "M004",
        status: 403,
      });
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });
});

import { ApiResponse, ErrorResponse } from "../types/api";
import { ApiClientError, unwrapApiResponse } from "./response";

type TypeContractListing = {
  id: number;
  name: string;
};

const nullableListingResponse: ApiResponse<TypeContractListing> = {
  success: true,
  data: null,
  error: null,
};

const listingResponseWithNullableGeneric: ApiResponse<TypeContractListing | null> = {
  success: true,
  data: { id: 1, name: "Seoul stay" },
  error: null,
};

const defaultUnwrappedListing = unwrapApiResponse(listingResponseWithNullableGeneric);
const mustBeNonNullListing: TypeContractListing = defaultUnwrappedListing;

const nullableUnwrappedListing = unwrapApiResponse<TypeContractListing>(
  nullableListingResponse,
  { allowNull: true }
);
const maybeListing: TypeContractListing | null = nullableUnwrappedListing;
// @ts-expect-error allowNull can return null and must not be assigned to a non-null type.
const mustRejectNullableListing: TypeContractListing = nullableUnwrappedListing;

function expectInvalidApiResponse(thunk: () => unknown) {
  let thrownError: unknown;
  try {
    thunk();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(ApiClientError);
  const clientError = thrownError as ApiClientError;
  expect(clientError.message).toBe("Invalid API Response");
  expect(clientError.status).toBe(500);
  expect(clientError.code).toBe("INVALID_API_RESPONSE");
}

describe("unwrapApiResponse", () => {
  it("returns data for successful response", () => {
    const response: ApiResponse<{ id: number; name: string }> = {
      success: true,
      data: { id: 1, name: "Seoul stay" },
      error: null,
    };

    expect(unwrapApiResponse(response)).toEqual({ id: 1, name: "Seoul stay" });
  });

  it("throws ApiClientError for backend error response and exposes backend message", () => {
    const backendError: ErrorResponse = {
      message: "예약을 찾을 수 없습니다.",
      status: 404,
      code: "RESERVATION_NOT_FOUND",
      errors: [
        {
          field: "reservationUid",
          value: "reservation-1",
          reason: "존재하지 않는 예약입니다.",
        },
      ],
    };
    const response: ApiResponse<never> = {
      success: false,
      data: null,
      error: backendError,
    };

    let thrownError: unknown;
    try {
      unwrapApiResponse(response);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiClientError);
    const clientError = thrownError as ApiClientError;
    expect(clientError.message).toBe("예약을 찾을 수 없습니다.");
    expect(clientError.status).toBe(404);
    expect(clientError.code).toBe("RESERVATION_NOT_FOUND");
    expect(clientError.errors).toBe(backendError.errors);
  });

  it("throws fallback ApiClientError when backend error response has no error body", () => {
    const response: ApiResponse<never> = {
      success: false,
      data: null,
      error: null,
    };

    let thrownError: unknown;
    try {
      unwrapApiResponse(response);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiClientError);
    const clientError = thrownError as ApiClientError;
    expect(clientError.message).toBe("요청 처리 중 오류가 발생했습니다.");
    expect(clientError.status).toBe(500);
    expect(clientError.code).toBe("UNKNOWN_API_ERROR");
  });

  it('throws typed error with message "응답 데이터가 비어 있습니다." when success is true but data is null and allowNull is not set', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: null,
      error: null,
    };

    let thrownError: unknown;
    try {
      unwrapApiResponse(response);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiClientError);
    const clientError = thrownError as ApiClientError;
    expect(clientError.message).toBe("응답 데이터가 비어 있습니다.");
    expect(clientError.status).toBe(500);
    expect(clientError.code).toBe("EMPTY_API_DATA");
  });

  it("allows null data for mutation endpoints when configured with allowNull", () => {
    const response: ApiResponse<null> = {
      success: true,
      data: null,
      error: null,
    };

    expect(unwrapApiResponse(response, { allowNull: true })).toBeNull();
  });

  it("allows missing data for mutation endpoints when configured with allowNull", () => {
    const response = {
      success: true,
    } as unknown as ApiResponse<null>;

    expect(unwrapApiResponse(response, { allowNull: true })).toBeNull();
  });

  it("rejects string/html response as invalid API response", () => {
    expectInvalidApiResponse(() => {
      unwrapApiResponse("<html>login</html>" as unknown as ApiResponse<string>);
    });
  });

  it("rejects undefined or null response as invalid API response", () => {
    expectInvalidApiResponse(() => {
      unwrapApiResponse(undefined as unknown as ApiResponse<string>);
    });

    expectInvalidApiResponse(() => {
      unwrapApiResponse(null as unknown as ApiResponse<string>);
    });
  });

  it("rejects object missing success as invalid API response", () => {
    expectInvalidApiResponse(() => {
      unwrapApiResponse({
        data: { id: 1, name: "Seoul stay" },
        error: null,
      } as unknown as ApiResponse<TypeContractListing>);
    });
  });

  it("rejects object with non-boolean success as invalid API response", () => {
    expectInvalidApiResponse(() => {
      unwrapApiResponse({
        success: "true",
        data: { id: 1, name: "Seoul stay" },
        error: null,
      } as unknown as ApiResponse<TypeContractListing>);
    });
  });

  it("rejects success true missing data as invalid API response", () => {
    expectInvalidApiResponse(() => {
      unwrapApiResponse({
        success: true,
        error: null,
      } as unknown as ApiResponse<TypeContractListing>);
    });
  });
});

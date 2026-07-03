import { ApiResponse } from "../types/api";
import { triggerAuthError } from "../utils/authEvents";
import { isApiClientError, unwrapApiResponse } from "./response";

type ApiRequest<T> = () => Promise<{ data: ApiResponse<T> }>;

function publishAuthErrorIfNeeded(error: unknown) {
  if (
    isApiClientError(error) &&
    (error.status === 401 || error.code === "M004")
  ) {
    triggerAuthError();
  }
}

export async function requestApi<T>(request: ApiRequest<T>): Promise<NonNullable<T>> {
  try {
    const response = await request();
    return unwrapApiResponse(response.data);
  } catch (error) {
    publishAuthErrorIfNeeded(error);
    throw error;
  }
}

export async function requestApiNullable<T>(request: ApiRequest<T>): Promise<T | null> {
  try {
    const response = await request();
    return unwrapApiResponse(response.data, { allowNull: true });
  } catch (error) {
    publishAuthErrorIfNeeded(error);
    throw error;
  }
}

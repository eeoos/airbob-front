import { ApiResponse } from "../types/api";
import { triggerAuthError } from "../utils/authEvents";
import type { AuthEventPolicyMetadata } from "./authEventPolicy";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";
import { isApiClientError, unwrapApiResponse } from "./response";

type ApiRequest<T> = () => Promise<{ data: ApiResponse<T> }>;

function publishAuthErrorIfNeeded(
  error: unknown,
  policy: AuthEventPolicyMetadata,
) {
  if (
    isApiClientError(error) &&
    (error.status === 401 || error.code === "M004") &&
    !isSessionOwnedAuthEventRequest(policy)
  ) {
    triggerAuthError();
  }
}

export async function requestApi<T>(
  request: ApiRequest<T>,
  policy: AuthEventPolicyMetadata = {},
): Promise<NonNullable<T>> {
  try {
    const response = await request();
    return unwrapApiResponse(response.data);
  } catch (error) {
    publishAuthErrorIfNeeded(error, policy);
    throw error;
  }
}

export async function requestApiNullable<T>(
  request: ApiRequest<T>,
  policy: AuthEventPolicyMetadata = {},
): Promise<T | null> {
  try {
    const response = await request();
    return unwrapApiResponse(response.data, { allowNull: true });
  } catch (error) {
    publishAuthErrorIfNeeded(error, policy);
    throw error;
  }
}

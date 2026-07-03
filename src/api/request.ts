import { ApiResponse } from "../types/api";
import { unwrapApiResponse } from "./response";

type ApiRequest<T> = () => Promise<{ data: ApiResponse<T> }>;

export async function requestApi<T>(request: ApiRequest<T>): Promise<NonNullable<T>> {
  const response = await request();
  return unwrapApiResponse(response.data);
}

export async function requestApiNullable<T>(request: ApiRequest<T>): Promise<T | null> {
  const response = await request();
  return unwrapApiResponse(response.data, { allowNull: true });
}
